
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { formatCurrency } from '../lib/expense-utils';
import { Toast, type ToastType } from '../components/ui/Toast';

export default function AddExpense() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const expenseId = searchParams.get('id');
    const { user, family } = useAuth();

    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('General');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [paidBy, setPaidBy] = useState(user?.id || '');
    const [splitType, setSplitType] = useState<'EQUAL' | 'PERCENTAGE' | 'EXACT'>('EQUAL');

    const [familyMembers, setFamilyMembers] = useState<any[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

    // Store custom split values: { memberId: value }. Value is percentage (0-100) or amount ($).
    const [splitValues, setSplitValues] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchFamilyMembers();
    }, []);

    const fetchFamilyMembers = async () => {
        let familyId = family?.id;
        if (!familyId) {
            const { data } = await supabase.rpc('get_my_family_id');
            familyId = data;
        }

        if (!familyId) return;

        const { data: members } = await supabase
            .from('family_members')
            .select('role, profile:profiles(*)')
            .eq('family_id', familyId);

        if (members) {
            // 1. Flatten
            const allProfiles = members.map((m: any) => ({ ...m.profile, role: m.role })).filter(p => p && p.id);

            // 2. Filter parents only for "Paid By" and "Splits" (usually expenses are between parents, but if kids are needed we can adjust. Defaulting to PARENTS based on existing logic).
            const parents = allProfiles.filter(p => p.role === 'parent');
            setFamilyMembers(parents);

            // 3. Default selection
            if (selectedMembers.length === 0) {
                setSelectedMembers(parents.map(p => p.id));
            }
        }
    };

    // Fetch expense defaults if editing
    useEffect(() => {
        if (expenseId && familyMembers.length > 0) {
            fetchExpenseDetails();
        }
    }, [expenseId, familyMembers.length]);

    const fetchExpenseDetails = async () => {
        if (!expenseId) return;
        const { data: expense } = await supabase.from('expenses').select('*').eq('id', expenseId).single();
        const { data: splits } = await supabase.from('expense_splits').select('*').eq('expense_id', expenseId);

        if (expense) {
            setDescription(expense.description);
            setAmount(expense.amount.toString());
            setCategory(expense.category);
            setDate(expense.date.split('T')[0]);
            setPaidBy(expense.paid_by);

            if (splits && splits.length > 0) {
                const members = splits.map(s => s.profile_id);
                setSelectedMembers(members);

                // Check equal
                const firstAmount = splits[0].amount;
                const isEqual = splits.every(s => Math.abs(s.amount - firstAmount) < 0.01);

                if (isEqual) {
                    setSplitType('EQUAL');
                } else {
                    // Default to EXACT for safety when editing complex splits
                    setSplitType('EXACT');
                    const values: Record<string, string> = {};
                    splits.forEach(s => values[s.profile_id] = s.amount.toString());
                    setSplitValues(values);
                }
            }
        }
    };

    // Effect to reset split values when members or mode changes
    useEffect(() => {
        const count = selectedMembers.length;
        if (count > 0 && splitType === 'PERCENTAGE') {
            const equalShare = (100 / count).toFixed(2);
            const newSplits: Record<string, string> = {};
            selectedMembers.forEach(id => newSplits[id] = equalShare);
            setSplitValues(newSplits);
        } else if (count > 0 && splitType === 'EXACT' && amount) {
            const equalShare = (parseFloat(amount) / count).toFixed(2);
            const newSplits: Record<string, string> = {};
            selectedMembers.forEach(id => newSplits[id] = equalShare);
            setSplitValues(newSplits);
        }
    }, [selectedMembers.length, splitType, amount]);

    const handleMemberToggle = (id: string) => {
        if (selectedMembers.includes(id)) {
            setSelectedMembers(selectedMembers.filter(m => m !== id));
        } else {
            setSelectedMembers([...selectedMembers, id]);
        }
    };

    const handleSplitValueChange = (id: string, value: string) => {
        setSplitValues(prev => ({ ...prev, [id]: value }));
    };

    const currency = family?.currency || 'INR';

    const getSplitValidation = () => {
        if (splitType === 'EQUAL') return { isValid: true, message: 'Splits Equally' };

        // Sum calculation
        let sum = 0;
        selectedMembers.forEach(id => {
            sum += parseFloat(splitValues[id] || '0');
        });

        if (splitType === 'PERCENTAGE') {
            if (Math.abs(sum - 100) > 0.1) return { isValid: false, message: `Total: ${sum.toFixed(1)}% (Must be 100%)` };
        } else if (splitType === 'EXACT') {
            const target = parseFloat(amount || '0');
            if (Math.abs(sum - target) > 0.01) return { isValid: false, message: `Total: ${formatCurrency(sum, currency)} (Must be ${formatCurrency(target, currency)})` };
        }

        return { isValid: true, message: 'Perfect!' };
    };

    const validation = getSplitValidation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !description || selectedMembers.length === 0) return;
        if (!validation.isValid) return;

        try {
            const { data: userData } = await supabase.from('profiles').select('family_id').eq('id', user?.id).single();
            if (!userData) throw new Error("Family not found");

            const totalAmount = parseFloat(amount);

            // 1. Prepare Splits Array for RPC
            const splitsArray = selectedMembers.map(memberId => {
                let memberAmount = 0;
                let memberPercentage: number | null = null;

                if (splitType === 'EQUAL') {
                    memberAmount = totalAmount / selectedMembers.length;
                    memberPercentage = 100 / selectedMembers.length;
                } else if (splitType === 'PERCENTAGE') {
                    const percent = parseFloat(splitValues[memberId] || '0');
                    memberAmount = (totalAmount * percent) / 100;
                    memberPercentage = percent;
                } else if (splitType === 'EXACT') {
                    memberAmount = parseFloat(splitValues[memberId] || '0');
                    memberPercentage = (memberAmount / totalAmount) * 100;
                }

                return {
                    profile_id: memberId,
                    amount: memberAmount,
                    percentage: memberPercentage
                };
            });

            // 2. Call Atomic RPC
            const { error } = await supabase.rpc('upsert_expense_with_splits', {
                p_expense_id: expenseId || null,
                p_description: description,
                p_amount: totalAmount,
                p_paid_by: paidBy,
                p_date: date,
                p_category: category,
                p_family_id: userData.family_id,
                p_splits: splitsArray
            });

            if (error) throw error;

            navigate('/expenses');
        } catch (error) {
            console.error('Error saving expense:', error);
            setToast({ message: "Failed to save expense", type: 'error' });
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/expenses')} className="text-gray-500 hover:text-gray-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">{expenseId ? 'Edit Expense' : 'Add New Expense'}</h1>
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm space-y-6">

                {/* Basic Info */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <input
                            type="text"
                            required
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Weekly Groceries"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({currency})</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md"
                            >
                                <option>General</option>
                                <option>Groceries</option>
                                <option>Food & Dining</option>
                                <option>Utilities</option>
                                <option>Entertainment</option>
                                <option>Transport</option>
                                <option>Kids</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Paid By</label>
                            <select
                                value={paidBy}
                                onChange={e => setPaidBy(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md"
                            >
                                {familyMembers.map(m => (
                                    <option key={m.id} value={m.id}>{m.display_name} {m.id === user?.id ? '(You)' : ''}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Split Section */}
                <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Split With</label>
                    <div className="flex flex-wrap gap-2 mb-4 max-h-32 overflow-y-auto px-1 custom-scrollbar">
                        {familyMembers.map(m => (
                            <button
                                type="button"
                                key={m.id}
                                onClick={() => handleMemberToggle(m.id)}
                                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selectedMembers.includes(m.id)
                                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                                    }`}
                            >
                                {m.display_name}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-4 text-sm text-gray-500 mb-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="splitType"
                                checked={splitType === 'EQUAL'}
                                onChange={() => setSplitType('EQUAL')}
                            />
                            Split Equally
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="splitType"
                                checked={splitType === 'PERCENTAGE'}
                                onChange={() => setSplitType('PERCENTAGE')}
                            />
                            By Percentage
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="splitType"
                                checked={splitType === 'EXACT'}
                                onChange={() => setSplitType('EXACT')}
                            />
                            By Exact Amount
                        </label>
                    </div>

                    {/* Dynamic Inputs for Non-Equal Splits */}
                    {splitType !== 'EQUAL' && (
                        <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                            {familyMembers.filter(m => selectedMembers.includes(m.id)).map(m => (
                                <div key={m.id} className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">{m.display_name}</span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={splitValues[m.id] || ''}
                                            onChange={e => handleSplitValueChange(m.id, e.target.value)}
                                            className="w-24 p-1 border rounded text-right"
                                            placeholder="0"
                                            step={splitType === 'PERCENTAGE' ? '0.1' : '0.01'}
                                        />
                                        <span className="text-gray-500 w-8 text-right text-xs">
                                            {splitType === 'PERCENTAGE' ? '%' : currency}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            <div className={`flex justify-between items-center pt-2 border-t ${validation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                                <span className="font-medium">Total:</span>
                                <span className="font-bold">{validation.message}</span>
                            </div>
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={!validation.isValid}
                    className={`w-full py-3 rounded-lg font-semibold transition ${validation.isValid
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                >
                    {expenseId ? 'Update Expense' : 'Save Expense'}
                </button>

            </form>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
