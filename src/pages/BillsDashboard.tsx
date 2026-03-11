import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchBills } from '../lib/api/assets';
import type { Bill, InsurancePolicy } from '../types';
import { DollarSign, Receipt, Zap, Droplet, Flame, Wifi, Tv, Smartphone, Phone, GraduationCap, CreditCard, Building2, HandCoins, MoreHorizontal, AlertCircle, CheckCircle, Clock, EyeOff, Users, ArrowRight, Shield, HeartPulse, Car } from 'lucide-react';
import { supabase } from '../lib/supabase';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    electricity: <Zap className="w-5 h-5 text-yellow-500" />,
    water: <Droplet className="w-5 h-5 text-blue-500" />,
    gas: <Flame className="w-5 h-5 text-orange-500" />,
    broadband: <Wifi className="w-5 h-5 text-indigo-500" />,
    dth: <Tv className="w-5 h-5 text-purple-500" />,
    mobile_postpaid: <Smartphone className="w-5 h-5 text-emerald-500" />,
    landline: <Phone className="w-5 h-5 text-gray-500" />,
    education_fees: <GraduationCap className="w-5 h-5 text-amber-600" />,
    credit_card: <CreditCard className="w-5 h-5 text-red-500" />,
    property_tax: <Building2 className="w-5 h-5 text-teal-600" />,
    municipal_tax: <Building2 className="w-5 h-5 text-cyan-600" />,
    subscription: <HandCoins className="w-5 h-5 text-pink-500" />,
    other: <MoreHorizontal className="w-5 h-5 text-slate-500" />
};

export default function BillsDashboard() {
    const navigate = useNavigate();
    const { profile, currentFamily } = useAuth();
    const [bills, setBills] = useState<Bill[]>([]);
    const [insurance, setInsurance] = useState<InsurancePolicy[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [payingBill, setPayingBill] = useState<Bill | null>(null);
    const [isMarkingPaid, setIsMarkingPaid] = useState(false);

    useEffect(() => {
        if (!currentFamily?.id || profile?.role !== 'parent') {
            setLoading(false);
            return;
        }

        const familyId = currentFamily.id;

        // Initial load
        const loadBillsAndInsurance = async () => {
            try {
                const [billsData, { data: insuranceData, error: insError }] = await Promise.all([
                    fetchBills(familyId),
                    supabase.from('insurance_policies').select('*').eq('family_id', familyId)
                ]);
                setBills(billsData || []);
                if (insError) throw insError;
                setInsurance(insuranceData || []);
            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadBillsAndInsurance();

        // Realtime subscriptions
        const channel = supabase
            .channel(`bills-insurance-${familyId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'bills', filter: `family_id=eq.${familyId}` },
                () => { fetchBills(familyId).then(data => setBills(data || [])); }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'insurance_policies', filter: `family_id=eq.${familyId}` },
                () => {
                    supabase.from('insurance_policies').select('*').eq('family_id', familyId)
                        .then(({ data }) => setInsurance(data || []));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentFamily, profile?.role]);

    const handleSplitExpense = (bill: Bill) => {
        const params = new URLSearchParams({
            bill_id: bill.id,
            amount: bill.amount.toString(),
            desc: `Bill Payment: ${bill.provider_name}`,
            cat: 'Utilities'
        });
        navigate(`/expenses/add?${params.toString()}`);
    };

    const handleMarkOnly = async (bill: Bill) => {
        setIsMarkingPaid(true);
        try {
            const { error } = await supabase.from('bills').update({ status: 'paid' }).eq('id', bill.id);
            if (error) throw error;
            setBills(bills.map(b => b.id === bill.id ? { ...b, status: 'paid' } : b));
            setPayingBill(null);
        } catch (e) {
            console.error(e);
            alert('Failed to update bill');
        } finally {
            setIsMarkingPaid(false);
        }
    };

    const totalDue = bills
        .filter(b => b.status === 'pending' || b.status === 'overdue')
        .reduce((sum, b) => sum + Number(b.amount), 0);

    if (profile?.role !== 'parent') {
        return (
            <div className="p-8 text-center max-w-lg mx-auto mt-20 bg-white rounded-2xl shadow-sm border border-slate-100">
                <Receipt className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Restricted</h2>
                <p className="text-slate-500">Only parents can view and manage family bills and assets.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bills & Payments</h1>
                    <p className="text-slate-500 mt-1">Manage utility bills, subscriptions, and recurring payments</p>
                </div>
            </div>

            {/* Services Hub Grid */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm mb-8">
                <h2 className="text-lg font-bold text-slate-800 mb-4">Payment Categories</h2>
                <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    {[
                        { id: 'electricity', label: 'Electricity', icon: <Zap className="w-5 h-5 text-yellow-500" /> },
                        { id: 'water', label: 'Water', icon: <Droplet className="w-5 h-5 text-blue-500" /> },
                        { id: 'gas', label: 'Gas', icon: <Flame className="w-5 h-5 text-orange-500" /> },
                        { id: 'broadband', label: 'Broadband', icon: <Wifi className="w-5 h-5 text-indigo-500" /> },
                        { id: 'dth', label: 'DTH', icon: <Tv className="w-5 h-5 text-purple-500" /> },
                        { id: 'mobile_postpaid', label: 'Mobile', icon: <Smartphone className="w-5 h-5 text-emerald-500" /> },
                        { id: 'credit_card', label: 'Credit Card', icon: <CreditCard className="w-5 h-5 text-red-500" /> },
                        { id: 'insurance', label: 'Insurance', icon: <Shield className="w-5 h-5 text-teal-600" /> },
                    ].map((service) => (
                        <button
                            key={service.id}
                            onClick={() => service.id === 'insurance' ? navigate('/insurance') : navigate(`/bills/add?category=${service.id}`)}
                            className="flex flex-col items-center justify-center px-2 py-3 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors group cursor-pointer"
                        >
                            <div className="w-11 h-11 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-2 group-hover:shadow-sm transition-all">
                                {service.icon}
                            </div>
                            <span className="text-xs font-medium text-slate-700 text-center leading-tight">
                                {service.label}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <DollarSign className="w-24 h-24 text-red-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 mb-1">Total Due This Month</p>
                    <div className="flex items-baseline space-x-2">
                        <span className="text-3xl font-bold text-slate-900">₹{totalDue.toLocaleString('en-IN')}</span>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : bills.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-50 mb-4">
                        <Receipt className="w-10 h-10 text-indigo-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No bills added yet</h3>
                    <p className="text-slate-500 mb-6 max-w-sm mx-auto">Track your electricity, water, internet, and other recurring family bills here.</p>
                    <button
                        onClick={() => navigate('/bills/add')}
                        className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-medium transition-all"
                    >
                        <Receipt className="w-5 h-5" />
                        <span>Add Your First Bill</span>
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(
                        bills.reduce((acc, bill) => {
                            if (!acc[bill.category]) acc[bill.category] = [];
                            acc[bill.category].push(bill);
                            return acc;
                        }, {} as Record<string, Bill[]>)
                    ).map(([category, categoryBills]) => (
                        <div key={category} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
                                    {CATEGORY_ICONS[category] || <Receipt className="w-5 h-5 text-slate-500" />}
                                </div>
                                <h2 className="text-lg font-bold text-slate-800 capitalize">
                                    {category.replace('_', ' ')}
                                </h2>
                                <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded-full shadow-sm">
                                    {categoryBills.length}
                                </span>
                            </div>
                            <ul className="divide-y divide-slate-100">
                                {categoryBills.map((bill) => (
                                    <li key={bill.id} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                                                {CATEGORY_ICONS[bill.category] || <Receipt className="w-6 h-6 text-slate-500" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <h3 className="text-lg font-bold text-slate-900">{bill.provider_name}</h3>
                                                    {bill.visibility === 'personal' ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                                            <EyeOff className="w-3 h-3 mr-1" /> Personal
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">
                                                            <Users className="w-3 h-3 mr-1" /> Public
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center space-x-3 text-sm mt-1">
                                                    <span className="text-slate-500">ID: {bill.consumer_number}</span>
                                                    <span className="text-slate-300">•</span>
                                                    {bill.due_date && (
                                                        <span className="flex items-center text-slate-500">
                                                            <Clock className="w-3 h-3 mr-1" />
                                                            Due {new Date(bill.due_date).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-6">
                                            <div className="text-right">
                                                <p className="text-xl font-bold text-slate-900">₹{bill.amount}</p>
                                                <div className="flex justify-end mt-1">
                                                    {bill.status === 'paid' ? (
                                                        <span className="inline-flex items-center text-xs font-medium text-emerald-600">
                                                            <CheckCircle className="w-3 h-3 mr-1" /> Paid
                                                        </span>
                                                    ) : bill.status === 'overdue' ? (
                                                        <span className="inline-flex items-center text-xs font-medium text-red-600">
                                                            <AlertCircle className="w-3 h-3 mr-1" /> Overdue
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center text-xs font-medium text-amber-600">
                                                            <Clock className="w-3 h-3 mr-1" /> Pending
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {bill.status !== 'paid' && (
                                                <button
                                                    onClick={() => setPayingBill(bill)}
                                                    className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg font-medium transition-colors flex items-center space-x-1"
                                                >
                                                    <span>Pay</span>
                                                    <ArrowRight className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    {/* Insurance Shortcut Cards (Already displayed in grid, but keep active policies if any) */}
                    {['life', 'health', 'vehicle'].map((insType) => {
                        const policies = insurance.filter(p => p.type === insType);
                        if (policies.length === 0) return null;

                        const getInsIcon = (type: string) => {
                            if (type === 'life') return <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center"><Shield className="w-5 h-5 text-indigo-500" /></div>;
                            if (type === 'health') return <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center"><HeartPulse className="w-5 h-5 text-rose-500" /></div>;
                            if (type === 'vehicle') return <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center"><Car className="w-5 h-5 text-slate-700" /></div>;
                            return <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center"><Shield className="w-5 h-5 text-slate-500" /></div>;
                        };

                        return (
                            <div key={`ins-${insType}`} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center space-x-3">
                                    {getInsIcon(insType)}
                                    <h2 className="text-lg font-bold text-slate-800 capitalize">
                                        {insType} Insurance
                                    </h2>
                                    <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded-full shadow-sm">
                                        {policies.length}
                                    </span>
                                </div>
                                <ul className="divide-y divide-slate-100">
                                    {policies.map((policy) => (
                                        <li key={policy.id} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                                                    <Shield className="w-6 h-6 text-indigo-500" />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900">{policy.provider}</h3>
                                                    <div className="flex items-center space-x-3 text-sm mt-1">
                                                        <span className="text-slate-500">Target ID: {policy.target_id}</span>
                                                        <span className="text-slate-300">•</span>
                                                        {policy.next_due_date && (
                                                            <span className="flex items-center text-slate-500">
                                                                <Clock className="w-3 h-3 mr-1" />
                                                                Due {new Date(policy.next_due_date).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-6">
                                                <div className="text-right">
                                                    <p className="text-xl font-bold text-slate-900">₹{policy.premium_amount}</p>
                                                    <div className="flex justify-end mt-1">
                                                        <span className="inline-flex items-center text-xs font-medium text-amber-600">
                                                            <AlertCircle className="w-3 h-3 mr-1" /> Premium Action Required
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => navigate(`/insurance`)}
                                                    className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg font-medium transition-colors flex items-center space-x-1"
                                                >
                                                    <span>View</span>
                                                    <ArrowRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Payment Modal */}
            {payingBill && (
                <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-6">
                        <div>
                            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                                <DollarSign className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Pay Bill</h3>
                            <p className="text-slate-500 mt-1">
                                {payingBill.provider_name} - <span className="font-semibold text-slate-800">₹{payingBill.amount}</span>
                            </p>
                        </div>

                        <div className="space-y-3 pt-2">
                            <button
                                onClick={() => handleSplitExpense(payingBill)}
                                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center"
                            >
                                Pay & Split Expense
                            </button>
                            <button
                                onClick={() => handleMarkOnly(payingBill)}
                                disabled={isMarkingPaid}
                                className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-medium transition-colors flex items-center justify-center disabled:opacity-50"
                            >
                                {isMarkingPaid ? 'Marking...' : 'Just Mark as Paid'}
                            </button>
                        </div>

                        <button
                            onClick={() => setPayingBill(null)}
                            className="w-full py-2 text-slate-500 hover:text-slate-700 font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
