import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
    ArrowLeft, Search, Shield, CheckCircle2, UserCircle2, PlusCircle,
    ChevronRight, AlertCircle, Calendar, Columns, X, Check
} from 'lucide-react';
import { fetchMockInsuranceQuotes, groupMembersForInsurance } from '../lib/api/bbps';
import type { Quote, InsuranceMember } from '../lib/api/bbps';
import { fetchAssets } from '../lib/api/assets';
import type { Asset, InsurancePolicy } from '../types';
import { Toast, type ToastType } from '../components/ui/Toast';
import { Select } from '../components/ui/Select';

interface FamilyMember {
    id: string;
    display_name: string;
    date_of_birth?: string | null;
    role?: string;
}

// Calculate age from DOB string (YYYY-MM-DD)
function calcAge(dob: string): number {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

type Step = 'select' | 'review-grouping' | 'quotes';

export default function AddPolicy() {
    const navigate = useNavigate();
    const { profile, currentFamily } = useAuth();

    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [step, setStep] = useState<Step>('select');

    const queryParams = new URLSearchParams(window.location.search);
    const category = queryParams.get('category') as 'health' | 'life' | 'vehicle' | 'property' | 'medical' | null;
    const insuranceType = category || 'health';
    const isPersonBased = ['health', 'life', 'medical'].includes(insuranceType);

    const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
    const [memberRoles, setMemberRoles] = useState<Record<string, 'parent' | 'child' | 'member'>>({});
    const [existingPolicies, setExistingPolicies] = useState<InsurancePolicy[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);

    // Person-based selection
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    // Ages collected via DOB modal (memberID -> DOB string)
    const [dobInputs, setDobInputs] = useState<Record<string, string>>({});
    const [showDobModal, setShowDobModal] = useState(false);
    // Grouping result
    const [planGroups, setPlanGroups] = useState<{
        floater: InsuranceMember[];
        individuals: InsuranceMember[];
        seniors: InsuranceMember[];
        seniorWarning: boolean;
    } | null>(null);
    // Which group are we buying quotes for (one at a time)
    const [activeGroup, setActiveGroup] = useState<InsuranceMember[] | null>(null);
    const [activeGroupLabel, setActiveGroupLabel] = useState<string>('');

    // Asset-based
    const [targetId, setTargetId] = useState('');

    const [isFetchingQuotes, setIsFetchingQuotes] = useState(false);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [compareList, setCompareList] = useState<Quote[]>([]);
    const [detailedQuote, setDetailedQuote] = useState<Quote | null>(null);

    useEffect(() => {
        if (!currentFamily?.id) return;
        const loadData = async () => {
            const [membersRes, rolesRes, policiesRes, assetsData] = await Promise.all([
                supabase
                    .from('family_members')
                    .select('profile:profiles(id, display_name, date_of_birth)')
                    .eq('family_id', currentFamily.id),
                supabase
                    .from('family_members')
                    .select('profile_id, role')
                    .eq('family_id', currentFamily.id),
                supabase
                    .from('insurance_policies')
                    .select('*')
                    .eq('family_id', currentFamily.id)
                    .eq('type', insuranceType),
                fetchAssets(currentFamily.id)
            ]);


            if (membersRes.data) {
                const members = (membersRes.data as unknown as { profile: FamilyMember }[])
                    .map(m => m.profile)
                    .filter((p): p is FamilyMember => p != null)
                    .map(m => {
                        // 1. Try DB value (m.date_of_birth)
                        // 2. Fallback to Auth profile (profile.date_of_birth) for logged-in user only
                        const authDob = m.id === profile?.id ? profile?.date_of_birth : null;
                        const resolvedDob = m.date_of_birth || authDob;
                        
                        if (resolvedDob && !m.date_of_birth) {
                            return { ...m, date_of_birth: resolvedDob };
                        }
                        return m;
                    });
                setFamilyMembers(members);
            }

            if (rolesRes.data) {
                const roles: Record<string, 'parent' | 'child' | 'member'> = {};
                (rolesRes.data as { profile_id: string; role: 'parent' | 'child' | 'member' }[]).forEach(r => {
                    roles[r.profile_id] = r.role;
                });
                setMemberRoles(roles);
            }

            if (policiesRes.data) {
                setExistingPolicies(policiesRes.data as InsurancePolicy[]);
            }

            setAssets(assetsData);
        };
        loadData();
    }, [currentFamily?.id, insuranceType, profile?.id, profile?.date_of_birth]);

    const insuredMemberIds = new Set(existingPolicies.map(p => p.target_id).filter(Boolean));
    const uninsuredMembers = familyMembers.filter(m => !insuredMemberIds.has(m.id));
    const insuredMembers = familyMembers.filter(m => insuredMemberIds.has(m.id));

    const selectedMembers = familyMembers.filter(m => selectedMemberIds.includes(m.id));
    // Members who are missing DOB
    const missingDobMembers = selectedMembers.filter(m => !m.date_of_birth && !dobInputs[m.id]);

    const toggleMember = (id: string) => {
        setSelectedMemberIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleProceedFromSelection = () => {
        if (missingDobMembers.length > 0) {
            setShowDobModal(true);  // open modal instead of changing page step
        } else {
            computeGroups();
        }
    };

    const computeGroups = () => {
        const members: InsuranceMember[] = selectedMembers.map(m => ({
            id: m.id,
            name: m.display_name,
            age: m.date_of_birth
                ? calcAge(m.date_of_birth)
                : (dobInputs[m.id] ? calcAge(dobInputs[m.id]) : 30),
        }));

        const groups = groupMembersForInsurance(members, memberRoles);
        setPlanGroups(groups);

        // If everyone fits in one group, skip review
        const hasMultipleGroups = (groups.floater.length > 0 ? 1 : 0)
            + (groups.individuals.length > 0 ? 1 : 0)
            + (groups.seniors.length > 0 ? 1 : 0);

        if (hasMultipleGroups > 1) {
            setStep('review-grouping');
        } else if (groups.individuals.length > 0 && groups.floater.length === 0 && groups.seniors.length === 0) {
            // Only individual adult-children selected, go straight to their quotes
            startQuotesForGroup(groups.individuals, 'Individual Plan');
        } else {
            // Everyone fits in one group
            const all = [...groups.floater, ...groups.individuals, ...groups.seniors];
            startQuotesForGroup(all, 'Your Plan');
        }
    };

    const handleSaveDobs = async () => {
        const merged = { ...dobInputs };
        // 1. Try to save to DB (profiles.date_of_birth)
        let savedCount = 0;
        let failedCount = 0;
        let lastError = '';

        const updates = Object.entries(merged)
            .map(async ([id, dob]) => {
                console.log(`Current User ID: ${profile?.id}`);
                console.log(`Target Profile ID: ${id}`);
                console.log(`Mismatch? ${profile?.id !== id ? 'YES - THIS WILL FAIL RLS' : 'NO - RLS SHOULD PASS'}`);
                console.log(`Attempting to save DOB for ID: ${id}, Value: ${dob}`);
                const { data, error, count } = await supabase
                    .from('profiles')
                    .update({ date_of_birth: dob })
                    .eq('id', id)
                    .select(); // Request updated data back to verify success

                if (error) {
                    console.error('DOB save error:', id, error.message, error.details);
                    failedCount++;
                    lastError = error.message;
                } else if (!data || data.length === 0) {
                    console.warn('DOB save matched 0 rows for ID:', id);
                    failedCount++;
                    lastError = 'No profile found with this ID or permission denied.';
                } else {
                    console.log('Successfully updated DB for ID:', id, data[0]);
                    savedCount++;
                }
            });
        await Promise.all(updates);

        if (failedCount > 0) {
            setToast({ 
                message: `Update failed for ${failedCount} member(s): ${lastError}`, 
                type: 'error' 
            });
        } else if (savedCount > 0) {
            setToast({ message: `Successfully saved ${savedCount} DOB(s) to the database!`, type: 'success' });
        }

        // 2. Optimistically update local state
        setFamilyMembers(prev => prev.map(m =>
            merged[m.id] ? { ...m, date_of_birth: merged[m.id] } : m
        ));

        setShowDobModal(false);
        computeGroups();
    };

    const startQuotesForGroup = async (group: InsuranceMember[], label: string) => {
        setActiveGroup(group);
        setActiveGroupLabel(label);
        setSelectedQuote(null);
        setIsFetchingQuotes(true);
        setStep('quotes');

        try {
            const ages = group.map(m => m.age);
            const fetched = await fetchMockInsuranceQuotes(insuranceType, 500000, ages);
            setQuotes(fetched);
        } catch {
            setToast({ message: 'Failed to fetch quotes. Please try again.', type: 'error' });
            setStep('review-grouping');
        } finally {
            setIsFetchingQuotes(false);
        }
    };

    const handleSavePolicy = async () => {
        if (!selectedQuote || !currentFamily?.id || !activeGroup) return;

        try {
            setIsSaving(true);

            const today = new Date();
            const nextYear = new Date(today);
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            const expiryDate = nextYear.toISOString().split('T')[0];

            const inserts = activeGroup.map(m => ({
                family_id: currentFamily.id,
                target_id: m.id,
                type: insuranceType,
                provider: selectedQuote.provider_name,
                premium_amount: selectedQuote.premium,
                coverage_amount: selectedQuote.coverage,
                expiry_date: expiryDate,
                next_due_date: expiryDate,
            }));

            const { error } = await supabase.from('insurance_policies').insert(inserts);
            if (error) throw error;

            navigate('/insurance');
        } catch (error: Error | unknown) {
            setToast({ message: (error as Error).message || 'Failed to save policy', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    if (profile?.role !== 'parent') {
        return <div className="p-8 text-center text-red-500">Access Denied</div>;
    }

    const categoryLabel: Record<string, string> = {
        health: 'Health Insurance', life: 'Life Insurance',
        medical: 'Medical Cover', vehicle: 'Vehicle Insurance', property: 'Property Insurance',
    };
    const stepLabels: Record<Step, string> = {
        'select': 'Choose who to insure',
        'review-grouping': 'Review plan grouping',
        'quotes': 'Pick the best plan',
    };

    const handleBack = () => {
        if (step === 'quotes' || step === 'review-grouping') {
            setStep('select');  // Always go back to person selection
        } else {
            navigate('/insurance');
        }
    };



    return (
        <div className={`mx-auto space-y-6 ${step === 'quotes' ? 'max-w-5xl' : 'max-w-2xl'}`}>
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleBack}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 shadow-sm"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{categoryLabel[insuranceType]}</h1>
                    <p className="text-sm text-slate-500">{stepLabels[step]}</p>
                </div>
            </div>

            {/* ═══ STEP: select ═══ */}
            {step === 'select' && isPersonBased && (
                <div className="space-y-5">
                    {insuredMembers.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                                <h2 className="font-semibold text-slate-700 text-sm">Already Covered</h2>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {insuredMembers.map(member => {
                                    const policy = existingPolicies.find(p => p.target_id === member.id);
                                    return (
                                        <div key={member.id} className="flex items-center gap-4 px-5 py-4">
                                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                                <UserCircle2 className="w-6 h-6 text-green-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-slate-800">{member.display_name}</p>
                                                <p className="text-xs text-slate-500">
                                                    {policy?.provider} · ₹{policy?.premium_amount?.toLocaleString('en-IN')}/yr
                                                </p>
                                            </div>
                                            <span className="flex items-center gap-1.5 text-green-600 text-xs font-semibold bg-green-50 px-3 py-1.5 rounded-full border border-green-200 shrink-0">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Covered
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {uninsuredMembers.length > 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                <h2 className="font-semibold text-slate-700 text-sm">Who needs coverage?</h2>
                                <span className="text-xs text-slate-400">Select one or more</span>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {uninsuredMembers.map(member => {
                                    const isSelected = selectedMemberIds.includes(member.id);
                                    return (
                                        <button
                                            key={member.id}
                                            onClick={() => toggleMember(member.id)}
                                            className={`w-full flex items-center gap-4 px-5 py-4 transition-colors text-left ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-indigo-600' : 'bg-slate-100'}`}>
                                                {isSelected
                                                    ? <CheckCircle2 className="w-5 h-5 text-white" />
                                                    : <UserCircle2 className="w-6 h-6 text-slate-500" />
                                                }
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-semibold ${isSelected ? 'text-indigo-700' : 'text-slate-800'}`}>{member.display_name}</p>
                                                <p className="text-xs text-slate-500">
                                                    {member.date_of_birth
                                                        ? `Age ${calcAge(member.date_of_birth)} · No active ${categoryLabel[insuranceType]}`
                                                        : `No active ${categoryLabel[insuranceType]}`}
                                                </p>
                                            </div>
                                            {isSelected
                                                ? <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                                                : <PlusCircle className="w-5 h-5 text-slate-300" />
                                            }
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
                            <p className="font-semibold text-green-800">Everyone is already covered!</p>
                            <p className="text-sm text-green-600 mt-1">All family members have active {categoryLabel[insuranceType]}.</p>
                        </div>
                    )}

                    {uninsuredMembers.length > 0 && (
                        <button
                            disabled={selectedMemberIds.length === 0}
                            onClick={handleProceedFromSelection}
                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 disabled:opacity-40 flex justify-center items-center gap-2 text-lg shadow-sm"
                        >
                            <ChevronRight className="w-5 h-5" />
                            {selectedMemberIds.length > 0
                                ? `Continue with ${selectedMemberIds.length} ${selectedMemberIds.length === 1 ? 'Person' : 'People'}`
                                : 'Select at least one person'
                            }
                        </button>
                    )}
                </div>
            )}

            {/* ═══ STEP: select (asset-based) ═══ */}
            {step === 'select' && !isPersonBased && (
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
                    <form onSubmit={(e) => { e.preventDefault(); startQuotesForGroup([], 'Vehicle Plan'); }} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Select Asset to Insure</label>
                            <Select
                                value={targetId}
                                onChange={setTargetId}
                                placeholder="-- Choose an Asset --"
                                options={assets
                                    .filter(a => a.type === insuranceType || (insuranceType === 'vehicle' && a.type === 'vehicle') || (insuranceType === 'property' && a.type === 'property'))
                                    .map(a => ({
                                        label: `${a.details?.name as string} ${a.details?.registration_number ? `(${a.details.registration_number as string})` : ''}`,
                                        value: a.id
                                    }))}
                            />
                            {assets.length === 0 && (
                                <div className="mt-3 bg-red-50 border border-red-100 p-3 rounded-xl flex items-center justify-between">
                                    <p className="text-red-600 text-sm font-medium">No assets of this type found.</p>
                                    <button type="button" onClick={() => navigate('/assets')} className="text-xs font-bold text-red-700 bg-white px-3 py-1.5 rounded-lg border border-red-200 shadow-sm">Add New Asset</button>
                                </div>
                            )}
                        </div>
                        <button type="submit" disabled={!targetId} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 flex justify-center items-center gap-2 text-lg shadow-sm">
                            Compare Quotes
                        </button>
                    </form>
                </div>
            )}

            {/* ═══ DOB MODAL ═══ */}
            {showDobModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-5 py-4 bg-amber-50 border-b border-amber-100 flex items-start gap-3">
                            <Calendar className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800">
                                <strong>Date of birth needed</strong> for accurate premium calculation. Saved to your profile — won't be asked again.
                            </p>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                            {selectedMembers
                                .filter(m => !m.date_of_birth)
                                .map(member => (
                                    <div key={member.id} className="px-5 py-4">
                                        <p className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                            <UserCircle2 className="w-4 h-4 text-slate-500" />
                                            {member.display_name}
                                        </p>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Date of Birth</label>
                                            <input
                                                type="date"
                                                value={dobInputs[member.id] || ''}
                                                max={new Date().toISOString().split('T')[0]}
                                                onChange={e => setDobInputs(prev => ({ ...prev, [member.id]: e.target.value }))}
                                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50 text-slate-800 font-medium"
                                            />
                                            {dobInputs[member.id] && (
                                                <p className="text-xs text-slate-500 mt-1">Age: {calcAge(dobInputs[member.id])} years</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>
                        <div className="p-5 flex gap-3">
                            <button
                                onClick={() => setShowDobModal(false)}
                                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveDobs}
                                disabled={selectedMembers.filter(m => !m.date_of_birth).some(m => !dobInputs[m.id])}
                                className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                            >
                                Save & Get Quotes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ STEP: review-grouping ═══ */}
            {step === 'review-grouping' && planGroups && (
                <div className="space-y-5">
                    {/* Mandatory split notice (adult children) */}
                    {planGroups.individuals.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-red-800">Separate Plan Required</p>
                                <p className="text-xs text-red-700 mt-1">
                                    Children aged <strong>25 and above</strong> cannot be on a family floater per Indian insurance regulations. They need their own individual plan.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Soft advisory for seniors */}
                    {planGroups.seniorWarning && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-amber-800">Senior Members (60+) — Recommendation</p>
                                <p className="text-xs text-amber-700 mt-1">
                                    Members aged 60+ <strong>can legally stay in a family floater</strong> (e.g., husband &amp; wife together). However, a dedicated Senior Citizen plan often gives better coverage and lower co-pays. Choose what works best for your family.
                                </p>
                            </div>
                        </div>
                    )}

                    {planGroups.floater.length > 0 && (
                        <PlanGroupCard
                            label="Family Floater Plan"
                            members={planGroups.floater}
                            description="Best combined rate — husband, wife &amp; young dependents"
                            color="indigo"
                            onGetQuotes={() => startQuotesForGroup(planGroups.floater, 'Family Floater')}
                        />
                    )}
                    {planGroups.individuals.length > 0 && (
                        <PlanGroupCard
                            label="Individual Plan (Adult Child)"
                            members={planGroups.individuals}
                            description="Age 25+ — must be separate by regulation"
                            color="orange"
                            onGetQuotes={() => startQuotesForGroup(planGroups.individuals, 'Individual Cover')}
                        />
                    )}
                    {planGroups.seniors.length > 0 && (
                        <>
                            <PlanGroupCard
                                label="Senior Citizen Plan (Recommended)"
                                members={planGroups.seniors}
                                description="Better coverage &amp; lower co-pay for 60+ members"
                                color="purple"
                                onGetQuotes={() => startQuotesForGroup(planGroups.seniors, 'Senior Plan')}
                            />
                            <button
                                onClick={() => {
                                    // Move seniors back into floater and fetch quotes for all together
                                    const combined = [...planGroups.floater, ...planGroups.seniors];
                                    startQuotesForGroup(combined, 'Family Floater (incl. seniors)');
                                }}
                                className="w-full py-3 text-sm font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-colors"
                            >
                                Or keep everyone in the same Family Floater →
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* ═══ STEP: quotes ═══ */}
            {step === 'quotes' && (
                <div className="space-y-6">
                    {/* Who is being insured */}
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-sm font-medium text-slate-500">Plan for:</span>
                        {activeGroup?.map(m => (
                            <div key={m.id} className="flex items-center gap-1.5 bg-indigo-100 text-indigo-700 text-sm font-medium px-3 py-1.5 rounded-full">
                                <UserCircle2 className="w-4 h-4" /> {m.name} · {m.age}yr
                            </div>
                        ))}
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{activeGroupLabel}</span>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">Available Quotes</h2>
                            <p className="text-slate-500 text-sm mt-1">Premiums are age-adjusted for your members.</p>
                        </div>
                        {/* Removed viewMode toggle */}
                    </div>

                    {isFetchingQuotes ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="animate-spin w-10 h-10 border-4 border-indigo-600 rounded-full border-t-transparent" />
                            <p className="text-slate-500 text-sm">Fetching the best quotes…</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-5 sm:grid-cols-2">
                                    {[...quotes].sort((a, b) => a.premium - b.premium).map((quote, idx) => {
                                        const isSelected = selectedQuote?.provider_name === quote.provider_name;
                                        const isCheapest = quote.premium === Math.min(...quotes.map(q => q.premium));
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => setSelectedQuote(quote)}
                                                className={`relative flex flex-col p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${isSelected ? 'border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-100' : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md'}`}
                                            >
                                                {isCheapest && (
                                                    <div className="absolute -top-3.5 -right-3.5 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-lg border-2 border-white z-10" title="Best Price">
                                                        <Shield className="w-4 h-4 text-white fill-white" />
                                                    </div>
                                                )}
                                                {isSelected && (
                                                    <div className="absolute -bottom-3.5 -right-3.5 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg border-2 border-white z-10">
                                                        <Shield className="w-4 h-4 text-white fill-white" />
                                                    </div>
                                                )}
                                                <h3 className="font-bold text-lg text-slate-900 leading-tight mb-4">{quote.provider_name}</h3>
                                                <div className={`mb-4 p-3 rounded-xl ${isSelected ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                                                    <p className="text-xs text-white/70 mb-0.5 uppercase tracking-wider">Annual Premium</p>
                                                    <p className="text-xl font-bold text-white leading-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                                        ₹{quote.premium.toLocaleString('en-IN')}/yr
                                                    </p>
                                                </div>
                                                <div className="mb-4 flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5">
                                                    <span className="text-xs font-medium text-slate-500 mr-4">Coverage</span>
                                                    <span className="text-sm font-bold text-slate-800">₹{quote.coverage.toLocaleString('en-IN')}</span>
                                                </div>
                                                <ul className="space-y-2 mt-auto mb-4">
                                                    {quote.features.map((feature, i) => (
                                                        <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                                                            <div className="w-2 h-2 rounded-full bg-indigo-300 shrink-0 mt-1.5" />
                                                            {feature}
                                                        </li>
                                                    ))}
                                                </ul>
                                                <div className="flex flex-col gap-2 mt-auto">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setDetailedQuote(quote); }}
                                                        className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-colors"
                                                    >
                                                        View Details
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const isComparing = compareList.some(q => q.provider_name === quote.provider_name);
                                                            if (isComparing) {
                                                                setCompareList(compareList.filter(q => q.provider_name !== quote.provider_name));
                                                            } else if (compareList.length < 2) {
                                                                setCompareList([...compareList, quote]);
                                                            } else {
                                                                setToast({ message: 'You can compare only 2 plans at a time.', type: 'error' });
                                                            }
                                                        }}
                                                        className={`w-full flex items-center justify-center gap-1.5 py-2.5 font-semibold rounded-xl border transition-colors ${compareList.some(q => q.provider_name === quote.provider_name) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-indigo-600 hover:border-indigo-300'}`}
                                                    >
                                                        {compareList.some(q => q.provider_name === quote.provider_name) ? 'Added to Compare' : 'Add to Compare'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Floating Compare Action Bar */}
                                {compareList.length === 1 && (
                                    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-max max-w-[90vw] bg-slate-900 text-white px-6 py-4 rounded-full font-medium shadow-2xl z-[60] flex items-center gap-4 animate-in slide-in-from-bottom-5">
                                        <div className="flex -space-x-2">
                                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold border-2 border-slate-900">1</div>
                                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold border-2 border-slate-900 border-dashed text-slate-400">2</div>
                                        </div>
                                        <span className="text-sm">Select 1 more plan to compare</span>
                                        <button onClick={() => setCompareList([])} className="p-1 hover:bg-slate-800 rounded-full ml-2">
                                            <X className="w-4 h-4 text-slate-400" />
                                        </button>
                                    </div>
                                )}

                                {/* Compare Side-by-Side Modal */}
                                {compareList.length === 2 && (
                                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                                        <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
                                                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                                    <Columns className="w-5 h-5 text-indigo-600" /> Compare Plans
                                                </h2>
                                                <button onClick={() => setCompareList([])} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                                                    <X className="w-6 h-6" />
                                                </button>
                                            </div>

                                            <div className="flex-1 overflow-y-auto p-2 sm:p-6">
                                                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                                                    {compareList.map((plan, idx) => (
                                                        <div key={idx} className="flex-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative">
                                                            <button 
                                                                className="absolute top-4 right-4 bg-slate-100 p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                                onClick={() => setCompareList(compareList.filter(q => q.provider_name !== plan.provider_name))}
                                                                title="Remove from comparison"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                            <h3 className="text-xl font-bold text-slate-900 mb-6 pr-8">{plan.provider_name}</h3>
                                                            
                                                            <div className="space-y-4 mb-6">
                                                                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                                                                    <p className="text-xs font-bold text-indigo-600 uppercase mb-1">Annual Premium</p>
                                                                    <p className="text-3xl font-bold text-indigo-900">₹{plan.premium.toLocaleString('en-IN')}</p>
                                                                </div>
                                                                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                                                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Coverage</p>
                                                                    <p className="text-2xl font-bold text-slate-900">₹{plan.coverage.toLocaleString('en-IN')}</p>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-3 mb-4">
                                                                {plan.claim_settlement_ratio && (
                                                                    <div className="flex items-center justify-between text-sm p-3 bg-emerald-50 rounded-lg text-emerald-800">
                                                                        <span className="font-semibold">Claim Settlement</span>
                                                                        <span className="font-bold">{plan.claim_settlement_ratio}%</span>
                                                                    </div>
                                                                )}
                                                                {plan.network_hospitals && (
                                                                    <div className="flex items-center justify-between text-sm p-3 bg-blue-50 rounded-lg text-blue-800 mb-4">
                                                                        <span className="font-semibold">Network</span>
                                                                        <span className="font-bold">{plan.network_hospitals.toLocaleString('en-IN')}+</span>
                                                                    </div>
                                                                )}

                                                                <div className="pt-2">
                                                                    {plan.policy_details && Object.entries(plan.policy_details).map(([key, value]) => (
                                                                        <div key={key} className="flex items-center justify-between text-sm py-2.5 border-b border-slate-100">
                                                                            <span className="text-slate-500">{key}</span>
                                                                            <span className="font-semibold text-slate-800 text-right line-clamp-1" title={value}>{value}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            <div className="mt-4 space-y-4">
                                                                <div>
                                                                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                                        <Check className="w-3.5 h-3.5" /> What's Covered
                                                                    </p>
                                                                    <ul className="space-y-1.5">
                                                                        {(plan.key_inclusions || plan.features).map((inc, i) => (
                                                                            <li key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-snug">
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                                                                                {inc}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                                {plan.key_exclusions && plan.key_exclusions.length > 0 && (
                                                                    <div>
                                                                        <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                                            <X className="w-3.5 h-3.5" /> What's NOT Covered
                                                                        </p>
                                                                        <ul className="space-y-1.5">
                                                                            {plan.key_exclusions.map((exc, i) => (
                                                                                <li key={i} className="flex items-start gap-2 text-xs text-slate-500 leading-snug">
                                                                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1.5" />
                                                                                    {exc}
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            
                                                            <div className="relative group w-full mt-6">
                                                                <button
                                                                    disabled
                                                                    className="w-full py-3 bg-slate-300 text-slate-500 rounded-xl font-bold cursor-not-allowed"
                                                                >
                                                                    Select {plan.provider_name}
                                                                </button>
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                                    🚀 Coming in a future release
                                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                        </>
                    )}
                    {!isFetchingQuotes && (
                        <div className="flex gap-4 pt-4 max-w-md mx-auto">
                            <button onClick={handleBack} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors">
                                Back
                            </button>
                            <div className="relative group flex-[2]">
                                <button
                                    disabled
                                    className="w-full py-3 bg-slate-300 text-slate-500 rounded-xl font-semibold cursor-not-allowed"
                                >
                                    Buy This Policy
                                </button>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    🚀 Coming in a future release
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ DETAILED VIEW MODAL ═══ */}
            {detailedQuote && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-900">{detailedQuote.provider_name}</h2>
                            <button onClick={() => setDetailedQuote(null)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            <div className="flex flex-wrap gap-4">
                                <div className="flex-1 min-w-[200px] bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
                                    <p className="text-sm font-medium text-indigo-600 mb-1">Annual Premium</p>
                                    <p className="text-3xl font-bold text-indigo-900">₹{detailedQuote.premium.toLocaleString('en-IN')}</p>
                                </div>
                                <div className="flex-1 min-w-[200px] bg-slate-50 border border-slate-200 rounded-2xl p-5">
                                    <p className="text-sm font-medium text-slate-500 mb-1">Coverage Amount</p>
                                    <p className="text-3xl font-bold text-slate-900">₹{detailedQuote.coverage.toLocaleString('en-IN')}</p>
                                </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                                {detailedQuote.claim_settlement_ratio && (
                                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-center justify-between">
                                        <span className="text-sm font-semibold text-emerald-800">Claim Settlement</span>
                                        <span className="text-lg font-bold text-emerald-700">{detailedQuote.claim_settlement_ratio}%</span>
                                    </div>
                                )}
                                {detailedQuote.network_hospitals && (
                                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between">
                                        <span className="text-sm font-semibold text-blue-800">Network Hospitals</span>
                                        <span className="text-lg font-bold text-blue-700">{detailedQuote.network_hospitals.toLocaleString('en-IN')}+</span>
                                    </div>
                                )}
                            </div>

                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Policy Specifics</h3>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {detailedQuote.policy_details && Object.entries(detailedQuote.policy_details).map(([key, value], i) => (
                                        <div key={key} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 px-5 ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                                            <span className="text-sm text-slate-500 mb-1 sm:mb-0">{key}</span>
                                            <span className="text-sm font-bold text-slate-900">{value}</span>
                                        </div>
                                    ))}
                                    {!detailedQuote.policy_details && (
                                        <div className="p-5 text-sm text-slate-400 text-center">No detailed specifications available.</div>
                                    )}
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" /> What's Included
                                    </h3>
                                    <ul className="space-y-3">
                                        {(detailedQuote.key_inclusions && detailedQuote.key_inclusions.length > 0 ? detailedQuote.key_inclusions : detailedQuote.features).map((inc, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-sm font-medium text-slate-700">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-2" />
                                                {inc}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5 text-red-500" /> What's Excluded
                                    </h3>
                                    <ul className="space-y-3">
                                        {(detailedQuote.key_exclusions || ['Standard exclusions apply', 'Pre-existing illnesses until waiting period']).map((exc, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-sm font-medium text-slate-600">
                                                <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                                {exc}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-4">
                            <button
                                onClick={() => setDetailedQuote(null)}
                                className="flex-1 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm"
                            >
                                Close Details
                            </button>
                            <div className="relative group flex-1">
                                <button
                                    disabled
                                    className="w-full py-3.5 bg-slate-300 text-slate-500 rounded-xl font-bold cursor-not-allowed"
                                >
                                    Select This Plan
                                </button>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    🚀 Coming in a future release
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

// ─── Plan Group Card sub-component ───────────────────────────────────────────
function PlanGroupCard({
    label, members, description, color, onGetQuotes
}: {
    label: string;
    members: InsuranceMember[];
    description: string;
    color: 'indigo' | 'orange' | 'purple';
    onGetQuotes: () => void;
}) {
    const colorMap = {
        indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700', btn: 'bg-indigo-600 hover:bg-indigo-700' },
        orange: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700', btn: 'bg-orange-500 hover:bg-orange-600' },
        purple: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', btn: 'bg-purple-600 hover:bg-purple-700' },
    }[color];

    return (
        <div className={`${colorMap.bg} border ${colorMap.border} rounded-2xl p-5`}>
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h3 className="font-bold text-slate-800">{label}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                </div>
                <button
                    onClick={onGetQuotes}
                    className={`${colorMap.btn} text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5 shrink-0`}
                >
                    <Search className="w-3.5 h-3.5" /> Get Quotes
                </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
                {members.map(m => (
                    <div key={m.id} className={`flex items-center gap-1.5 ${colorMap.badge} text-xs font-medium px-2.5 py-1 rounded-full`}>
                        <UserCircle2 className="w-3 h-3" /> {m.name} · {m.age}yr
                    </div>
                ))}
            </div>
        </div>
    );
}
