

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, CheckCircle2, DollarSign } from 'lucide-react';
import { calculateBalances, formatCurrency } from '../lib/expense-utils';
import type { ExpenseSplit, Settlement } from '../lib/expense-utils';

export default function SettleUp() {
    const navigate = useNavigate();
    const { user, family } = useAuth();

    const [members, setMembers] = useState<any[]>([]);
    const [payer, setPayer] = useState('');
    const [receiver, setReceiver] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [balances, setBalances] = useState<Record<string, number>>({});

    useEffect(() => {
        fetchFamilyMembers();
        fetchBalances();
    }, [user]); // Added user to dependency array for fetchData

    const fetchFamilyMembers = async () => {
        try {
            const { data: profile } = await supabase.from('profiles').select('family_id').eq('id', user?.id).single();
            if (!profile) return;

            const { data: membersData } = await supabase.from('profiles').select('*').eq('family_id', profile.family_id).eq('role', 'parent');
            if (membersData) {
                setMembers(membersData);
                // Default receiver: first person who user owes money to, or just the first other person
                const other = membersData.find(m => m.id !== user?.id);
                if (other) setReceiver(other.id);
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
            }
        } catch (e) {
            console.error("Error fetching balances:", e);
        }
    };

    const currency = family?.currency || 'USD'; // Default to USD if family or currency is not available

    // Suggest payer/receiver based on balances?
    // Logic: If I owe someone, select me as payer and them as receiver.
    useEffect(() => {
        const myBalance = balances[user?.id || ''];
        if (myBalance && myBalance < 0 && !payer && !receiver) {
            setPayer(user?.id || '');
            // Find who needs money most? Simply pick anyone with positive balance for now.
            const suggestedReceiverId = Object.keys(balances).find(pid => balances[pid] > 0);
            if (suggestedReceiverId) setReceiver(suggestedReceiverId);
        }
    }, [balances, user, payer, receiver]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !payer || !receiver) return;

        try {
            const { data: userData } = await supabase.from('profiles').select('family_id').eq('id', user?.id).single();
            if (!userData) throw new Error("Family not found");

            const { error } = await supabase.from('settlements').insert({
                payer_id: payer,
                receiver_id: receiver,
                amount: parseFloat(amount),
                date,
                family_id: userData.family_id
            });

            if (error) throw error;
            navigate('/expenses');
        } catch (error) {
            console.error('Error settling up:', error);
            alert('Failed to record settlement');
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/expenses')} className="text-gray-500 hover:text-gray-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Record Payment</h1>
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-6">

                {/* Summary Card */}
                <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
                    <DollarSign className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                        <h3 className="font-medium text-blue-900">Settle Up</h3>
                        <p className="text-sm text-blue-700 mt-1">
                            Record a payment made between family members (e.g., cash, bank transfer) to update balances.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Payer (From)</label>
                        <select
                            value={payer}
                            onChange={e => setPayer(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            required
                        >
                            <option value="">Select Payer</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>{m.display_name} {m.id === user?.id ? '(You)' : ''}</option>
                            ))}
                        </select>
                        {payer && balances[payer] < 0 && (
                            <p className="text-xs text-red-500 mt-2">
                                Net balance: owes {formatCurrency(Math.abs(balances[payer]), currency)}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Receiver (To)</label>
                        <select
                            value={receiver}
                            onChange={e => setReceiver(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md"
                            required
                        >
                            <option value="">Select Receiver</option>
                            {members.filter(m => m.id !== payer).map(m => (
                                <option key={m.id} value={m.id}>{m.display_name} {m.id === user?.id ? '(You)' : ''}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({currency})</label>
                    <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md text-2xl font-bold text-gray-900"
                        placeholder="0.00"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                        type="date"
                        required
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                    />
                </div>

                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                    <CheckCircle2 className="w-5 h-5" />
                    Record Settlement
                </button>
            </form>
        </div>
    );
}

