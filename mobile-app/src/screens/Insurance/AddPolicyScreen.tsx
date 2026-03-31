import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    TextInput, ActivityIndicator, Modal, Alert, Dimensions
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { groupMembersForInsurance, fetchMockInsuranceQuotes, type Quote, type InsuranceMember } from '../../lib/bbps';

type NavProp = StackNavigationProp<RootStackParamList>;
type RoutePropType = RouteProp<RootStackParamList, 'AddPolicy'>;

const SCROLL_MAX_H = Dimensions.get('window').height * 0.65;
type Step = 'select' | 'review-grouping' | 'quotes';

const INSURANCE_TYPES = [
    { id: 'health', label: 'Health', emoji: '🏥' },
    { id: 'life', label: 'Life', emoji: '❤️' },
    { id: 'vehicle', label: 'Vehicle', emoji: '🚗' },
    { id: 'property', label: 'Property', emoji: '🏠' },
    { id: 'medical', label: 'Medical', emoji: '🩺' },
];

function calcAge(dob: string): number {
    const today = new Date();
    const birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
    return age;
}

export default function AddPolicyScreen() {
    const navigation = useNavigation<NavProp>();
    const route = useRoute<RoutePropType>();
    const { profile, family } = useAuth() as any;
    const insets = useSafeAreaInsets();

    const initialCategory = (route.params as any)?.category || '';
    const [step, setStep] = useState<Step>('select');
    const [insuranceType, setInsuranceType] = useState(initialCategory);
    const [familyMembers, setFamilyMembers] = useState<any[]>([]);
    const [membersLoading, setMembersLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [dobMap, setDobMap] = useState<Record<string, string>>({});
    const [dobModalMember, setDobModalMember] = useState<any | null>(null);
    const [dobInput, setDobInput] = useState('');
    const [savingDob, setSavingDob] = useState(false);
    const [isFetchingQuotes, setIsFetchingQuotes] = useState(false);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [compareList, setCompareList] = useState<Quote[]>([]);
    const [compareModal, setCompareModal] = useState(false);
    const [detailModal, setDetailModal] = useState<Quote | null>(null);

    // Asset-based insurance (vehicle / property)
    const isAssetBased = insuranceType === 'vehicle' || insuranceType === 'property';
    const [assets, setAssets] = useState<any[]>([]);
    const [assetsLoading, setAssetsLoading] = useState(false);
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

    useEffect(() => {
        if (!family?.id) return;
        const loadMembers = async () => {
            try {
                const { data, error } = await supabase
                    .from('family_members')
                    .select('role, profile:profiles(*)')
                    .eq('family_id', family.id);

                if (error) throw error;

                const members = (data || [])
                    .filter((m: any) => m.profile)
                    .map((m: any) => ({
                        id: m.profile.id,
                        name: m.profile.full_name || m.profile.display_name || 'Member',
                        role: m.role,
                        dob: m.profile.date_of_birth || null,
                    }));

                setFamilyMembers(members);
                const initialDobs: Record<string, string> = {};
                members.forEach((m: any) => { if (m.dob) initialDobs[m.id] = m.dob; });
                setDobMap(initialDobs);
            } catch (e) {
                console.error('Failed to load members:', e);
            } finally {
                setMembersLoading(false);
            }
        };
        loadMembers();
    }, [family?.id]);

    // Load assets when switching to vehicle/property
    useEffect(() => {
        if (!isAssetBased || !family?.id) { setAssets([]); return; }
        const loadAssets = async () => {
            setAssetsLoading(true);
            setSelectedAssetId(null);
            try {
                const { data, error } = await supabase
                    .from('assets')
                    .select('*')
                    .eq('family_id', family.id)
                    .eq('type', insuranceType);
                if (error) throw error;
                setAssets(data || []);
            } catch (e) {
                console.error('Failed to load assets:', e);
            } finally {
                setAssetsLoading(false);
            }
        };
        loadAssets();
    }, [isAssetBased, insuranceType, family?.id]);

    const missingDobMembers = [...selectedIds].filter(id => !dobMap[id]);

    const selectedMembers: InsuranceMember[] = [...selectedIds]
        .filter(id => dobMap[id])
        .map(id => {
            const m = familyMembers.find(f => f.id === id);
            return { id, name: m?.name || 'Member', age: calcAge(dobMap[id]) };
        });

    const memberRoles = Object.fromEntries(familyMembers.map(m => [m.id, m.role as 'parent' | 'child' | 'member']));
    const grouping = selectedMembers.length > 0
        ? groupMembersForInsurance(selectedMembers, memberRoles)
        : { floater: [], individuals: [], seniors: [], seniorWarning: false };

    const activeGroup: InsuranceMember[] = [...grouping.floater, ...grouping.individuals, ...grouping.seniors];

    const handleSaveDob = async () => {
        if (!dobModalMember || !dobInput) return;
        setSavingDob(true);
        const { data, error } = await supabase
            .from('profiles')
            .update({ date_of_birth: dobInput })
            .eq('id', dobModalMember.id)
            .select();
        setSavingDob(false);
        if (!data || data.length === 0) {
            Alert.alert('Error', error?.message || 'Could not save. Check database permissions.');
        } else {
            setDobMap(prev => ({ ...prev, [dobModalMember.id]: dobInput }));
            setDobModalMember(null);
            setDobInput('');
            Alert.alert('Saved', `DOB saved for ${dobModalMember.name}`);
        }
    };

    const handleGetQuotes = async () => {
        if (isAssetBased) {
            if (!selectedAssetId) { Alert.alert('Select Asset', 'Please select a vehicle or property to insure'); return; }
            const asset = assets.find(a => a.id === selectedAssetId);
            const value = asset?.details?.estimated_value || asset?.value || 500000;
            setStep('quotes');
            setIsFetchingQuotes(true);
            try {
                const fetched = await fetchMockInsuranceQuotes(insuranceType, Number(value));
                setQuotes(fetched);
            } catch {
                Alert.alert('Error', 'Failed to fetch quotes');
                setStep('select');
            } finally {
                setIsFetchingQuotes(false);
            }
            return;
        }
        // Person-based
        if (missingDobMembers.length > 0) {
            const missing = familyMembers.filter(m => missingDobMembers.includes(m.id));
            setDobModalMember(missing[0]);
            return;
        }
        if (!insuranceType) { Alert.alert('Select Type', 'Please select an insurance type first'); return; }
        if (activeGroup.length === 0) { Alert.alert('No members', 'Please select at least one member'); return; }
        setStep('quotes');
        setIsFetchingQuotes(true);
        try {
            const ages = activeGroup.map(m => m.age);
            const fetched = await fetchMockInsuranceQuotes(insuranceType, 500000, ages);
            setQuotes(fetched);
        } catch {
            Alert.alert('Error', 'Failed to fetch quotes');
            setStep('select');
        } finally {
            setIsFetchingQuotes(false);
        }
    };

    const toggleCompare = (q: Quote) => {
        setCompareList(prev => {
            const exists = prev.find(c => c.provider_name === q.provider_name);
            if (exists) return prev.filter(c => c.provider_name !== q.provider_name);
            if (prev.length >= 3) { Alert.alert('Limit', 'Compare up to 3 plans at once'); return prev; }
            return [...prev, q];
        });
    };

    const handleBack = () => {
        if (step === 'quotes') { setStep(isAssetBased ? 'select' : 'review-grouping'); }
        else if (step === 'review-grouping') { setStep('select'); }
        else { navigation.goBack(); }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.navBar, { paddingTop: insets.top + 16 }]}>
                <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                    <ChevronLeft size={28} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.navTitle}>Add Policy</Text>
                <View style={{ width: 28 }} />
            </View>

            {/* Step bar */}
            <View style={styles.stepBar}>
                {(['select', 'review-grouping', 'quotes'] as Step[]).map((s, i) => {
                    const isDone = (step === 'review-grouping' && i === 0) || (step === 'quotes' && i < 2);
                    const isActive = step === s;
                    return (
                        <View key={s} style={styles.stepItem}>
                            <View style={[styles.stepCircle, (isActive || isDone) && styles.stepCircleActive]}>
                                <Text style={[styles.stepCircleText, (isActive || isDone) && { color: 'white' }]}>{i + 1}</Text>
                            </View>
                            <Text style={styles.stepLabel}>{['Choose', 'Review', 'Pick Plan'][i]}</Text>
                        </View>
                    );
                })}
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

                {/* ─── STEP 1: SELECT ─── */}
                {step === 'select' && (
                    <>
                        {/* Horizontal type chips */}
                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Insurance Type</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                                {INSURANCE_TYPES.map(type => (
                                    <TouchableOpacity
                                        key={type.id}
                                        style={[styles.typeChip, insuranceType === type.id && styles.typeChipActive]}
                                        onPress={() => setInsuranceType(type.id)}>
                                        <Text style={styles.typeChipEmoji}>{type.emoji}</Text>
                                        <Text style={[styles.typeChipLabel, insuranceType === type.id && styles.typeChipLabelActive]}>
                                            {type.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Who to Insure / Asset Picker */}
                        {isAssetBased ? (
                            <View style={[styles.card, { marginTop: 0 }]}>
                                <Text style={styles.sectionTitle}>{insuranceType === 'vehicle' ? '🚗 Select Vehicle' : '🏠 Select Property'}</Text>
                                {assetsLoading ? (
                                    <View style={styles.loadingRow}>
                                        <ActivityIndicator color="#6366f1" />
                                        <Text style={styles.loadingText}>Loading assets...</Text>
                                    </View>
                                ) : assets.length === 0 ? (
                                    <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                                        <Text style={styles.emptyText}>No {insuranceType === 'vehicle' ? 'vehicles' : 'properties'} found in your assets.</Text>
                                        <TouchableOpacity
                                            style={{ marginTop: 12, backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
                                            onPress={() => (navigation as any).navigate('AddAsset')}>
                                            <Text style={{ color: 'white', fontWeight: '700' }}>+ Add Asset</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    assets.map(asset => {
                                        const isSelected = selectedAssetId === asset.id;
                                        const name = asset.details?.name || asset.name || 'Asset';
                                        const reg = asset.details?.registration_number || asset.details?.reg_number || '';
                                        const value = asset.details?.estimated_value || asset.value || '';
                                        return (
                                            <TouchableOpacity
                                                key={asset.id}
                                                style={[styles.memberRow, isSelected && styles.memberRowActive]}
                                                onPress={() => setSelectedAssetId(asset.id)}>
                                                <View style={[styles.memberAvatar, { backgroundColor: isSelected ? '#6366f1' : '#e0e7ff' }]}>
                                                    <Text style={{ fontSize: 18 }}>{insuranceType === 'vehicle' ? '🚗' : '🏠'}</Text>
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.memberName, isSelected && { color: '#6366f1' }]}>{name}</Text>
                                                    <Text style={styles.memberMeta}>
                                                        {reg ? `${reg} · ` : ''}{value ? `₹${Number(value).toLocaleString('en-IN')}` : ''}
                                                    </Text>
                                                </View>
                                                <View style={[styles.memberCheck, isSelected && styles.memberCheckActive]}>
                                                    {isSelected && <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>✓</Text>}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                                {assets.length > 0 && (
                                    <TouchableOpacity style={styles.nextBtn} onPress={handleGetQuotes} disabled={!selectedAssetId}>
                                        <Text style={styles.nextBtnText}>Get Quotes →</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                        <View style={[styles.card, { marginTop: 0 }]}>
                            <Text style={styles.sectionTitle}>Who to Insure</Text>
                            {membersLoading ? (
                                <View style={styles.loadingRow}>
                                    <ActivityIndicator color="#6366f1" />
                                    <Text style={styles.loadingText}>Loading family members...</Text>
                                </View>
                            ) : familyMembers.length === 0 ? (
                                <Text style={styles.emptyText}>No family members found.</Text>
                            ) : (
                                familyMembers.map(member => {
                                    const isSelected = selectedIds.has(member.id);
                                    const hasDob = !!dobMap[member.id];
                                    const age = hasDob ? calcAge(dobMap[member.id]) : null;
                                    return (
                                        <TouchableOpacity
                                            key={member.id}
                                            style={[styles.memberRow, isSelected && styles.memberRowActive]}
                                            onPress={() => setSelectedIds(prev => {
                                                const next = new Set(prev);
                                                next.has(member.id) ? next.delete(member.id) : next.add(member.id);
                                                return next;
                                            })}>
                                            <View style={styles.memberAvatar}>
                                                <Text style={styles.memberAvatarText}>{member.name[0]?.toUpperCase()}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.memberName}>{member.name}</Text>
                                                <Text style={styles.memberSub}>
                                                    {hasDob ? `${age} yrs` : '⚠ DOB needed'}{' · '}{member.role}
                                                </Text>
                                            </View>
                                            {isSelected && !hasDob && (
                                                <TouchableOpacity
                                                    style={styles.addDobBtn}
                                                    onPress={() => { setDobModalMember(member); setDobInput(''); }}>
                                                    <Text style={styles.addDobBtnText}>Add DOB</Text>
                                                </TouchableOpacity>
                                            )}
                                            <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                                                {isSelected && <Text style={{ color: 'white', fontSize: 12 }}>✓</Text>}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </View>
                        )}

                        {/* Review grouping button — only for person-based */}
                        {!isAssetBased && (
                            <TouchableOpacity
                                style={[styles.primaryBtn, (!insuranceType || selectedIds.size === 0) && styles.primaryBtnDisabled]}
                                onPress={() => setStep('review-grouping')}
                                disabled={!insuranceType || selectedIds.size === 0}>
                                <Text style={styles.primaryBtnText}>Review Plan Grouping →</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}

                {/* ─── STEP 2: GROUPING ─── */}
                {step === 'review-grouping' && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Smart Plan Grouping</Text>
                        <Text style={styles.sectionSub}>Based on Indian insurance rules — how your members will be covered:</Text>

                        {grouping.floater.length > 0 && (
                            <View style={styles.groupSection}>
                                <Text style={styles.groupTitle}>🏠 Family Floater</Text>
                                <Text style={styles.groupSub}>One shared policy for all members</Text>
                                {grouping.floater.map(m => (
                                    <View key={m.id} style={styles.groupMember}>
                                        <Text style={styles.groupMemberName}>{m.name}</Text>
                                        <Text style={styles.groupMemberAge}>{m.age} yrs</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {grouping.seniors.length > 0 && (
                            <View style={[styles.groupSection, { backgroundColor: '#fef3c7' }]}>
                                <Text style={styles.groupTitle}>👴 Senior Citizen Plan</Text>
                                <Text style={styles.groupSub}>Age 60+ — recommended dedicated cover</Text>
                                {grouping.seniors.map(m => (
                                    <View key={m.id} style={styles.groupMember}>
                                        <Text style={styles.groupMemberName}>{m.name}</Text>
                                        <Text style={styles.groupMemberAge}>{m.age} yrs</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {grouping.individuals.length > 0 && (
                            <View style={[styles.groupSection, { backgroundColor: '#eff6ff' }]}>
                                <Text style={styles.groupTitle}>👤 Individual Plans</Text>
                                <Text style={styles.groupSub}>Adult children (25+) need separate plans</Text>
                                {grouping.individuals.map(m => (
                                    <View key={m.id} style={styles.groupMember}>
                                        <Text style={styles.groupMemberName}>{m.name}</Text>
                                        <Text style={styles.groupMemberAge}>{m.age} yrs</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        <TouchableOpacity style={styles.primaryBtn} onPress={handleGetQuotes}>
                            <Text style={styles.primaryBtnText}>Get Quotes →</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ─── STEP 3: QUOTES ─── */}
                {step === 'quotes' && (
                    <View style={{ marginTop: 16 }}>
                        {compareList.length > 0 && (
                            <TouchableOpacity style={styles.compareBar} onPress={() => setCompareModal(true)}>
                                <Text style={styles.compareBarText}>Compare {compareList.length} Plans</Text>
                                <Text style={styles.compareBarBtn}>View →</Text>
                            </TouchableOpacity>
                        )}

                        {isFetchingQuotes ? (
                            <View style={styles.loadingCard}>
                                <ActivityIndicator size="large" color="#6366f1" />
                                <Text style={styles.loadingTextLg}>Fetching best plans...</Text>
                            </View>
                        ) : quotes.map(quote => (
                            <View key={quote.provider_name} style={styles.quoteCard}>
                                <View style={styles.quoteHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.quoteName}>{quote.provider_name}</Text>
                                        {quote.claim_settlement_ratio && (
                                            <Text style={styles.quoteClaim}>{quote.claim_settlement_ratio}% Claim Ratio</Text>
                                        )}
                                    </View>
                                    <View style={styles.quotePremium}>
                                        <Text style={styles.quotePremiumAmt}>₹{quote.premium.toLocaleString('en-IN')}</Text>
                                        <Text style={styles.quotePremiumLabel}>/year</Text>
                                    </View>
                                </View>
                                <Text style={styles.quoteCoverage}>Coverage: ₹{quote.coverage.toLocaleString('en-IN')}</Text>
                                {quote.network_hospitals && (
                                    <Text style={styles.quoteNetwork}>🏥 {quote.network_hospitals.toLocaleString()} hospitals</Text>
                                )}
                                <View style={styles.featureTags}>
                                    {quote.features.slice(0, 3).map(f => (
                                        <View key={f} style={styles.featureTag}>
                                            <Text style={styles.featureTagText}>{f}</Text>
                                        </View>
                                    ))}
                                </View>

                                {quote.key_inclusions && (
                                    <View style={styles.inclusionSection}>
                                        <Text style={styles.inclusionTitle}>✅ Key Inclusions</Text>
                                        {quote.key_inclusions.slice(0, 3).map((item, i) => (
                                            <Text key={i} style={styles.inclusionItem}>• {item}</Text>
                                        ))}
                                    </View>
                                )}

                                <View style={styles.quoteActions}>
                                    <TouchableOpacity style={styles.detailBtn} onPress={() => setDetailModal(quote)}>
                                        <Text style={styles.detailBtnText}>Full Details</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.compareBtn, compareList.find(c => c.provider_name === quote.provider_name) && styles.compareBtnActive]}
                                        onPress={() => toggleCompare(quote)}>
                                        <Text style={[styles.compareBtnText, compareList.find(c => c.provider_name === quote.provider_name) && { color: 'white' }]}>
                                            {compareList.find(c => c.provider_name === quote.provider_name) ? '✓ Added' : 'Compare'}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.buyBtn}>
                                        <Text style={styles.buyBtnText}>🚀 Coming Soon</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* DOB Modal */}
            <Modal visible={!!dobModalMember} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Add Date of Birth</Text>
                        <Text style={styles.modalDesc}>For {dobModalMember?.name}</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="YYYY-MM-DD (e.g. 1985-06-15)"
                            value={dobInput}
                            onChangeText={setDobInput}
                            keyboardType="default"
                            maxLength={10}
                        />
                        <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveDob} disabled={savingDob || !dobInput}>
                            {savingDob ? <ActivityIndicator color="white" /> : <Text style={styles.modalSaveBtnText}>Save DOB</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setDobModalMember(null)}>
                            <Text style={styles.modalCancel}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Compare Modal */}
            <Modal visible={compareModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, width: '100%' }}>
                        <Text style={styles.modalTitle}>Plan Comparison</Text>
                        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: SCROLL_MAX_H, marginBottom: 12 }}>
                            {/* Header row */}
                            <View style={styles.compareTableRow}>
                                <Text style={[styles.compareTableCell, styles.compareHeaderCell, { flex: 1.2 }]}>Feature</Text>
                                {compareList.map(q => (
                                    <Text key={q.provider_name} style={[styles.compareTableCell, styles.compareHeaderCell]} numberOfLines={2}>
                                        {q.provider_name}
                                    </Text>
                                ))}
                            </View>
                            {[
                                { label: 'Premium/yr', val: (q: Quote) => `₹${q.premium.toLocaleString('en-IN')}`, bold: true, color: '#6366f1' },
                                { label: 'Coverage', val: (q: Quote) => `₹${q.coverage.toLocaleString('en-IN')}` },
                                { label: 'Claim Ratio', val: (q: Quote) => q.claim_settlement_ratio ? `${q.claim_settlement_ratio}%` : 'N/A' },
                                { label: 'Network', val: (q: Quote) => q.network_hospitals ? q.network_hospitals.toLocaleString() : 'N/A' },
                            ].map(row => (
                                <View key={row.label} style={styles.compareTableRow}>
                                    <Text style={[styles.compareTableCell, { flex: 1.2 }]}>{row.label}</Text>
                                    {compareList.map(q => (
                                        <Text key={q.provider_name} style={[styles.compareTableCell, row.bold && { fontWeight: '700', color: row.color }]}>
                                            {row.val(q)}
                                        </Text>
                                    ))}
                                </View>
                            ))}

                            {/* Policy details */}
                            {compareList[0]?.policy_details && Object.keys(compareList[0].policy_details).map(key => (
                                <View key={key} style={styles.compareTableRow}>
                                    <Text style={[styles.compareTableCell, { flex: 1.2, color: '#374151' }]}>{key}</Text>
                                    {compareList.map(q => <Text key={q.provider_name} style={styles.compareTableCell}>{q.policy_details?.[key] ?? '—'}</Text>)}
                                </View>
                            ))}

                            {/* Inclusions header */}
                            <View style={[styles.compareTableRow, { backgroundColor: '#f0fdf4' }]}>
                                <Text style={[styles.compareTableCell, styles.compareHeaderCell, { flex: 1.2, color: '#166534' }]}>✅ Covered</Text>
                                {compareList.map(q => <Text key={q.provider_name} style={[styles.compareTableCell, styles.compareHeaderCell, { color: '#166534' }]}>—</Text>)}
                            </View>
                            {Array.from({ length: Math.max(0, ...compareList.map(q => q.key_inclusions?.length || 0)) }).map((_, i) => (
                                <View key={`inc-${i}`} style={[styles.compareTableRow, { backgroundColor: i % 2 === 0 ? '#f0fdf4' : '#fff' }]}>
                                    <Text style={[styles.compareTableCell, { flex: 1.2, color: '#64748b', fontSize: 11 }]}>Point {i + 1}</Text>
                                    {compareList.map(q => (
                                        <Text key={q.provider_name} style={[styles.compareTableCell, { fontSize: 11, color: '#166534' }]}>
                                            {q.key_inclusions?.[i] ?? '—'}
                                        </Text>
                                    ))}
                                </View>
                            ))}

                            {/* Exclusions header */}
                            <View style={[styles.compareTableRow, { backgroundColor: '#fef2f2' }]}>
                                <Text style={[styles.compareTableCell, styles.compareHeaderCell, { flex: 1.2, color: '#991b1b' }]}>❌ Not Covered</Text>
                                {compareList.map(q => <Text key={q.provider_name} style={[styles.compareTableCell, styles.compareHeaderCell, { color: '#991b1b' }]}>—</Text>)}
                            </View>
                            {Array.from({ length: Math.max(0, ...compareList.map(q => q.key_exclusions?.length || 0)) }).map((_, i) => (
                                <View key={`exc-${i}`} style={[styles.compareTableRow, { backgroundColor: i % 2 === 0 ? '#fef2f2' : '#fff' }]}>
                                    <Text style={[styles.compareTableCell, { flex: 1.2, color: '#64748b', fontSize: 11 }]}>Point {i + 1}</Text>
                                    {compareList.map(q => (
                                        <Text key={q.provider_name} style={[styles.compareTableCell, { fontSize: 11, color: '#991b1b' }]}>
                                            {q.key_exclusions?.[i] ?? '—'}
                                        </Text>
                                    ))}
                                </View>
                            ))}
                            <View style={{ height: 8 }} />
                        </ScrollView>
                        <TouchableOpacity style={styles.modalSaveBtn} onPress={() => setCompareModal(false)}>
                            <Text style={styles.modalSaveBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Detail Modal */}
            <Modal visible={!!detailModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, {}]}>
                        <View style={styles.detailModalHeader}>
                            <Text style={styles.modalTitle}>{detailModal?.provider_name}</Text>
                            <View style={styles.detailBadgeRow}>
                                {detailModal?.claim_settlement_ratio && (
                                    <View style={[styles.detailBadge, { backgroundColor: '#dcfce7' }]}>
                                        <Text style={[styles.detailBadgeText, { color: '#166534' }]}>{detailModal.claim_settlement_ratio}% Claims</Text>
                                    </View>
                                )}
                                <View style={[styles.detailBadge, { backgroundColor: '#eef2ff' }]}>
                                    <Text style={[styles.detailBadgeText, { color: '#4338ca' }]}>₹{detailModal?.premium.toLocaleString('en-IN')}/yr</Text>
                                </View>
                            </View>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: SCROLL_MAX_H }}>
                            {/* Coverage summary */}
                            <View style={styles.detailCoverageBanner}>
                                <Text style={styles.detailCoverageBannerLabel}>Coverage</Text>
                                <Text style={styles.detailCoverageBannerValue}>₹{detailModal?.coverage.toLocaleString('en-IN')}</Text>
                                {detailModal?.network_hospitals && (
                                    <Text style={styles.detailCoverageBannerSub}>🏥 {detailModal.network_hospitals.toLocaleString()} network hospitals</Text>
                                )}
                            </View>

                            {/* All features */}
                            {detailModal?.features && detailModal.features.length > 0 && (
                                <>
                                    <Text style={styles.detailSectionTitle}>🏷 Plan Highlights</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
                                        {detailModal.features.map((f, i) => (
                                            <View key={i} style={styles.featureTag}>
                                                <Text style={styles.featureTagText}>{f}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}

                            {/* Policy spec table */}
                            {detailModal?.policy_details && Object.keys(detailModal.policy_details).length > 0 && (
                                <>
                                    <Text style={styles.detailSectionTitle}>📋 Policy Specifications</Text>
                                    {Object.entries(detailModal.policy_details).map(([k, v]) => (
                                        <View key={k} style={styles.detailRow}>
                                            <Text style={styles.detailKey}>{k}</Text>
                                            <Text style={styles.detailValue}>{v}</Text>
                                        </View>
                                    ))}
                                </>
                            )}

                            {/* Full inclusions */}
                            {detailModal?.key_inclusions && detailModal.key_inclusions.length > 0 && (
                                <>
                                    <Text style={[styles.detailSectionTitle, { color: '#166534' }]}>✅ What's Covered</Text>
                                    <View style={styles.inclusionBox}>
                                        {detailModal.key_inclusions.map((item, i) => (
                                            <View key={i} style={styles.inclusionRow}>
                                                <Text style={styles.inclusionDot}>✓</Text>
                                                <Text style={styles.inclusionRowText}>{item}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}

                            {/* Full exclusions */}
                            {detailModal?.key_exclusions && detailModal.key_exclusions.length > 0 && (
                                <>
                                    <Text style={[styles.detailSectionTitle, { color: '#991b1b' }]}>❌ Not Covered</Text>
                                    <View style={styles.exclusionBox}>
                                        {detailModal.key_exclusions.map((item, i) => (
                                            <View key={i} style={styles.inclusionRow}>
                                                <Text style={[styles.inclusionDot, { color: '#dc2626' }]}>✗</Text>
                                                <Text style={[styles.inclusionRowText, { color: '#991b1b' }]}>{item}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}
                            <View style={{ height: 16 }} />
                        </ScrollView>
                        <TouchableOpacity style={styles.modalSaveBtn} onPress={() => setDetailModal(null)}>
                            <Text style={styles.modalSaveBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    navTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    backBtn: { padding: 4, marginLeft: -4 },
    stepBar: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'white', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    stepItem: { alignItems: 'center' },
    stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    stepCircleActive: { backgroundColor: '#6366f1' },
    stepCircleText: { fontSize: 13, fontWeight: '700', color: '#94a3b8' },
    stepLabel: { fontSize: 10, fontWeight: '600', color: '#94a3b8' },
    scroll: { flex: 1 },
    card: { backgroundColor: 'white', margin: 16, marginBottom: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
    sectionSub: { fontSize: 13, color: '#64748b', marginBottom: 12 },

    // Horizontal type chips
    chipRow: { flexDirection: 'row' },
    typeChip: { alignItems: 'center', marginRight: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 40, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0', flexDirection: 'row', gap: 6 },
    typeChipActive: { backgroundColor: '#eef2ff', borderColor: '#6366f1' },
    typeChipEmoji: { fontSize: 16 },
    typeChipLabel: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    typeChipLabelActive: { color: '#6366f1' },

    // Members
    loadingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
    loadingText: { fontSize: 14, color: '#64748b' },
    emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center', padding: 12 },
    memberRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, marginBottom: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    memberRowActive: { backgroundColor: '#eef2ff', borderColor: '#6366f1' },
    memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    memberAvatarText: { color: 'white', fontWeight: '700', fontSize: 16 },
    memberName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
    memberSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
    memberMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
    memberCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
    memberCheckActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
    nextBtn: { marginTop: 16, backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    nextBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
    addDobBtn: { backgroundColor: '#fef3c7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginRight: 8 },
    addDobBtnText: { fontSize: 12, fontWeight: '700', color: '#92400e' },
    checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
    checkboxActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
    primaryBtn: { backgroundColor: '#6366f1', borderRadius: 14, padding: 16, alignItems: 'center', margin: 16 },
    primaryBtnDisabled: { backgroundColor: '#cbd5e1' },
    primaryBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },

    // Grouping step
    groupSection: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12, marginBottom: 12 },
    groupTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
    groupSub: { fontSize: 12, color: '#64748b', marginBottom: 8 },
    groupMember: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    groupMemberName: { fontSize: 14, color: '#1e293b', fontWeight: '600' },
    groupMemberAge: { fontSize: 13, color: '#64748b' },

    // Quotes step
    compareBar: { backgroundColor: '#6366f1', margin: 16, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    compareBarText: { color: 'white', fontWeight: '700', fontSize: 15 },
    compareBarBtn: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
    loadingCard: { alignItems: 'center', padding: 60 },
    loadingTextLg: { marginTop: 14, color: '#64748b', fontSize: 15 },
    quoteCard: { backgroundColor: 'white', marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    quoteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    quoteName: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
    quoteClaim: { fontSize: 12, color: '#10b981', fontWeight: '600', marginTop: 2 },
    quotePremium: { alignItems: 'flex-end' },
    quotePremiumAmt: { fontSize: 20, fontWeight: '800', color: '#6366f1' },
    quotePremiumLabel: { fontSize: 11, color: '#94a3b8' },
    quoteCoverage: { fontSize: 13, color: '#64748b', marginBottom: 2 },
    quoteNetwork: { fontSize: 12, color: '#64748b', marginBottom: 8 },
    featureTags: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
    featureTag: { backgroundColor: '#ede9fe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 6, marginBottom: 4 },
    featureTagText: { fontSize: 11, fontWeight: '600', color: '#7c3aed' },
    inclusionSection: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 10, marginBottom: 10 },
    inclusionTitle: { fontSize: 12, fontWeight: '700', color: '#166534', marginBottom: 4 },
    inclusionItem: { fontSize: 12, color: '#1e293b', marginBottom: 3 },
    exclusionItem: { fontSize: 12, color: '#991b1b', marginBottom: 3 },
    quoteActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    detailBtn: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
    detailBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    compareBtn: { flex: 1, backgroundColor: '#ede9fe', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
    compareBtnActive: { backgroundColor: '#6366f1' },
    compareBtnText: { fontSize: 13, fontWeight: '700', color: '#7c3aed' },
    buyBtn: { flex: 1, backgroundColor: '#f0fdf4', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
    buyBtnText: { fontSize: 13, fontWeight: '700', color: '#166534' },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center' },
    modalCard: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, width: '100%' },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
    modalDesc: { fontSize: 14, color: '#64748b', marginBottom: 16 },
    modalInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 14 },
    modalSaveBtn: { backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    modalSaveBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
    modalCancel: { textAlign: 'center', marginTop: 12, fontSize: 15, color: '#64748b', fontWeight: '600' },
    compareTableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    compareTableCell: { flex: 1, padding: 8, fontSize: 12, color: '#1e293b' },
    compareHeaderCell: { fontWeight: '700', backgroundColor: '#f8fafc', color: '#374151' },
    detailSectionTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginTop: 14, marginBottom: 8 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    detailKey: { fontSize: 13, color: '#64748b', flex: 1 },
    detailValue: { fontSize: 13, fontWeight: '600', color: '#1e293b', flex: 1, textAlign: 'right' },
    // Detail modal extras
    detailModalHeader: { marginBottom: 10 },
    detailBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
    detailBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    detailBadgeText: { fontSize: 12, fontWeight: '700' },
    detailCoverageBanner: { backgroundColor: '#eef2ff', borderRadius: 14, padding: 14, marginBottom: 16, alignItems: 'center' },
    detailCoverageBannerLabel: { fontSize: 12, fontWeight: '600', color: '#6366f1', letterSpacing: 0.5, textTransform: 'uppercase' },
    detailCoverageBannerValue: { fontSize: 26, fontWeight: '900', color: '#4338ca', marginVertical: 2 },
    detailCoverageBannerSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
    // Inclusion / Exclusion rows
    inclusionBox: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12, marginBottom: 12 },
    exclusionBox: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, marginBottom: 12 },
    inclusionRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 7 },
    inclusionDot: { fontSize: 14, fontWeight: '700', color: '#16a34a', marginRight: 8, marginTop: 1 },
    inclusionRowText: { fontSize: 13, color: '#1e293b', flex: 1, lineHeight: 19 },
});
