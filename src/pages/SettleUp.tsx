

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { calculateBalances, formatCurrency } from '../lib/expense-utils';
import type { ExpenseSplit, Settlement } from '../lib/expense-utils';

export default function SettleUp() {
    const navigate = useNavigate();
    const { user, family, profile } = useAuth();

    const [members, setMembers] = useState<Record<string, any>>({});
    const [balances, setBalances] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});
    const [settling, setSettling] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [user]);

    const loadData = async () => {
        setLoading(true);
        await Promise.all([fetchFamilyMembers(), fetchBalances()]);
        setLoading(false);
    };

    const fetchFamilyMembers = async () => {
        try {
            const { data: profile } = await supabase.from('profiles').select('family_id').eq('id', user?.id).single();
            if (!profile) return;

            const { data: membersData } = await supabase.from('profiles').select('*').eq('family_id', profile.family_id);
            if (membersData) {
                const map: Record<string, any> = {};
                membersData.forEach(p => map[p.id] = p);
                setMembers(map);
            }
        } catch (e) {
            console.error("Error fetching family members:", e);
        }
    };

    const fetchBalances = async () => {
        try {
            const { data: expenses } = await supabase.from('expenses').select('*');
            const { data: splits } = await supabase.from('expense_splits').select('*');
            const { data: settlements } = await supabase.from('settlements').select('*');

            if (expenses && splits && settlements) {
                const calculated = calculateBalances(expenses, splits as ExpenseSplit[], settlements as Settlement[]);
                const balMap: Record<string, number> = {};
                calculated.forEach(b => balMap[b.profile_id] = b.amount);
                setBalances(balMap);

                // Pre-fill logical amounts
                const myBal = balMap[profile?.id || ''] || 0;
                if (myBal < 0) {
                    const newAmounts: Record<string, string> = {};
                    calculated.forEach(b => {
                        if (b.amount > 0 && b.profile_id !== profile?.id) {
                            const suggested = Math.min(Math.abs(myBal), b.amount);
                            newAmounts[b.profile_id] = suggested.toFixed(2);
                        }
                    });
                    setPayAmounts(newAmounts);
                }
            }
        } catch (e) {
            console.error("Error fetching balances:", e);
        }
    };

    const handleSettle = async (receiverId: string) => {
        const amountStr = payAmounts[receiverId];
        const amount = parseFloat(amountStr);

        if (!amount || amount <= 0) {
            alert('Please enter a valid amount greater than 0');
            return;
        }

        try {
            setSettling(receiverId);
            const { data: userData } = await supabase.from('profiles').select('family_id').eq('id', user?.id).single();
            if (!userData) throw new Error("Family not found");

            const { error } = await supabase.from('settlements').insert({
                payer_id: profile?.id, // Use profile.id
                receiver_id: receiverId,
                amount: amount,
                date: new Date().toISOString().split('T')[0],
                family_id: userData.family_id
            });

            if (error) throw error;

            // Refresh
            await fetchBalances();
            alert('Payment recorded successfully!');
        } catch (error) {
            console.error('Error settling up:', error);
            alert('Failed to record settlement');
        } finally {
            setSettling(null);
        }
    };

    const currency = family?.currency || 'USD';
    const myBalance = balances[profile?.id || ''] || 0;

    // Creditors: People with positive balances (excluding self)
    const creditors = Object.entries(balances)
        .filter(([id, amount]) => amount > 0.01 && id !== profile?.id)
        .sort((a, b) => b[1] - a[1]);

    if (loading) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/expenses')} className="text-gray-500 hover:text-gray-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Settle Up</h1>
            </div>

            {/* My Status Card */}
            <div className={`p-8 rounded-2xl text-center shadow-lg text-white ${myBalance >= 0 ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-pink-600'}`}>
                <p className="text-white/90 font-medium mb-2">Your Balance</p>
                <div className="text-5xl font-bold mb-4">
                    {myBalance >= 0 ? '+' : ''}{formatCurrency(myBalance, currency)}
                </div>
                <p className="text-white/90">
                    {myBalance >= 0 ? "You don't owe anything right now." : "You owe money to the family."}
                </p>
            </div>

            {/* List of Creditors */}
            {myBalance < 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-700 ml-1">Who to pay</h3>

                    {creditors.length > 0 ? (
                        creditors.map(([id, creditAmount]) => (
                            <div key={id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-6">
                                {/* Person Info */}
                                <div className="flex items-center gap-4 flex-1 w-full">
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-xl font-bold text-gray-500">
                                        {members[id]?.avatar_url ? (
                                            <img src={members[id].avatar_url} className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            members[id]?.display_name?.[0]
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-lg">{members[id]?.display_name}</h4>
                                        <p className="text-sm text-gray-500">Is owed {formatCurrency(creditAmount, currency)}</p>
                                    </div>
                                </div>

                                {/* Pay Action */}
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <div className="relative flex-1 md:w-32">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">{currency === 'USD' ? '$' : currency}</span>
                                        <input
                                            type="number"
                                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                            placeholder="0.00"
                                            value={payAmounts[id] || ''}
                                            onChange={(e) => setPayAmounts(prev => ({ ...prev, [id]: e.target.value }))}
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleSettle(id)}
                                        disabled={settling === id}
                                        className="bg-gray-900 text-white px-6 py-3 rounded-lg font-bold hover:bg-black transition flex items-center justify-center min-w-[100px]"
                                    >
                                        {settling === id ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Pay'}
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center p-8 text-gray-500 bg-white rounded-xl">
                            No one to pay right now.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

