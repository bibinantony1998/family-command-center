
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { calculateBalances } from '../lib/expense-utils';
import type { Balance } from '../lib/expense-utils';
import { useNavigate } from 'react-router-dom';
import { Plus, Wallet, ArrowRightLeft, Receipt, Edit2, Trash2, Bell, BarChart2 } from 'lucide-react';
import { formatCurrency } from '../lib/expense-utils';
import { Toast, type ToastType } from '../components/ui/Toast';

export default function Expenses() {
    const navigate = useNavigate();
    const { user, family } = useAuth(); // Added family

    const [balances, setBalances] = useState<Balance[]>([]);
    const [members, setMembers] = useState<Record<string, { display_name: string, avatar_url: string }>>({});
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

    const promptDelete = (expenseId: string) => {
        setExpenseToDelete(expenseId);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!expenseToDelete) return;

        try {
            setLoading(true);
            const { error } = await supabase.from('expenses').delete().eq('id', expenseToDelete);
            if (error) throw error;

            setToast({ message: "Expense deleted successfully", type: 'success' });
            setShowDeleteModal(false);
            setExpenseToDelete(null);
            await fetchData();
        } catch (error) {
            console.error('Error deleting expense:', error);
            setToast({ message: "Failed to delete expense", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleRemind = async (profileId: string) => {
        if (!family?.id) return;
        try {
            const { error } = await supabase.from('notifications').insert({
                family_id: family.id,
                recipient_id: profileId,
                sender_id: user?.id,
                type: 'settle_up_reminder',
                message: 'Please settle up your expenses.'
            });

            if (error) throw error;
            setToast({ message: "Reminder sent!", type: 'success' });
        } catch (error) {
            console.error('Error sending reminder:', error);
            setToast({ message: "Failed to send reminder", type: 'error' });
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Fetch profiles for the current family
            const { data: familyIdData, error: familyIdError } = await supabase.rpc('get_my_family_id');
            if (familyIdError) throw familyIdError;
            const family_id = familyIdData;

            const { data: profiles, error: profilesError } = await supabase.from('profiles')
                .select('id, display_name, avatar_url')
                .eq('family_id', family_id);

            if (profilesError) throw profilesError;

            const memberMap: Record<string, { display_name: string, avatar_url: string }> = {};
            profiles?.forEach((p: any) => memberMap[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url });
            setMembers(memberMap);

            // Fetch expenses, splits, and settlements
            const { data: expensesData, error: expensesError } = await supabase.from('expenses').select('*').order('date', { ascending: false });
            const { data: splitsData, error: splitsError } = await supabase.from('expense_splits').select('*');
            const { data: settlementsData, error: settlementsError } = await supabase.from('settlements').select('*').order('created_at', { ascending: false });

            if (expensesError) throw expensesError;
            if (splitsError) throw splitsError;
            if (settlementsError) throw settlementsError;

            if (expensesData && splitsData && settlementsData) {
                const calculatedBalances = calculateBalances(expensesData, splitsData as any, settlementsData);
                setBalances(calculatedBalances.filter(b => Math.abs(b.amount) > 0.01)); // Filter out zero balances

                // Combine for Activity Stream
                const combined = [
                    ...expensesData.map(e => ({ ...e, type: 'expense' })),
                    ...settlementsData.map(s => ({ ...s, type: 'settlement' }))
                ].sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())
                    .slice(0, 10); // Limit to 10 recent activities

                setRecentActivity(combined);
            }
        } catch (error) {
            console.error('Error fetching expenses:', error);
        } finally {
            setLoading(false);
        }
    };

    const myBalance = balances.find(b => b.profile_id === user?.id)?.amount || 0;
    const currency = family?.currency || 'INR'; // Default

    if (loading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="space-y-6 pb-20">
            {/* Header with Total Balance */}
            <div className={`p-6 rounded-2xl text-white shadow-lg ${myBalance >= 0 ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-pink-600'}`}>
                <div className="flex items-center gap-2 mb-2 opacity-90">
                    <Wallet className="w-5 h-5" />
                    <span className="font-medium">My Balance</span>
                </div>
                <div className="text-4xl font-bold">
                    {formatCurrency(Math.abs(myBalance), currency)}
                </div>
                <div className="text-sm mt-1 opacity-90 font-medium">
                    {myBalance >= 0 ? 'you are owed' : 'you owe'}
                </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => navigate('/expenses/add')}
                    className="flex items-center justify-center gap-2 bg-blue-600 text-white p-4 rounded-xl shadow-sm hover:bg-blue-700 transition"
                >
                    <Plus className="w-5 h-5" />
                    <span className="font-semibold">Add Expense</span>
                </button>
                <button
                    onClick={() => navigate('/expenses/settle')}
                    className="flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 p-4 rounded-xl shadow-sm hover:bg-gray-50 transition"
                >
                    <ArrowRightLeft className="w-5 h-5" />
                    <span className="font-semibold">Settle Up</span>
                </button>
            </div>

            {/* Who owes who */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Balances</h3>
                {balances.length === 0 ? (
                    <p className="text-center text-gray-400 py-4">All settled up!</p>
                ) : (
                    <div className="space-y-4">
                        {balances.map(b => (
                            <div key={b.profile_id} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-lg">
                                        {members[b.profile_id]?.avatar_url ? (
                                            <img src={members[b.profile_id].avatar_url} className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            members[b.profile_id]?.display_name?.[0] || '?'
                                        )}
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700 block">
                                            {b.profile_id === user?.id ? 'You' : members[b.profile_id]?.display_name}
                                        </span>
                                        {/* Remind Button for others with negative balance */}
                                        {b.amount < 0 && b.profile_id !== user?.id && (
                                            <button
                                                onClick={() => handleRemind(b.profile_id)}
                                                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Bell size={12} /> Remind
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <span className={`font-bold ${b.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {b.amount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(b.amount), currency)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Activity Stream */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Recent Activity</h3>
                    <button
                        onClick={() => navigate('/expenses/reports')}
                        className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
                        title="View Reports"
                    >
                        <BarChart2 size={20} />
                    </button>
                </div>
                <div className="space-y-6">
                    {recentActivity.map(item => (
                        <div key={item.id} className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg mt-1 shrink-0 ${item.type === 'expense' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                {item.type === 'expense' ? <Receipt className="w-5 h-5" /> : <ArrowRightLeft className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <p className="font-medium text-gray-900 truncate">
                                        {item.type === 'expense' ? item.description : 'Settlement'}
                                    </p>
                                    <span className={`font-bold shrink-0 ${item.type === 'expense' ? 'text-gray-900' : 'text-green-600'}`}>
                                        {formatCurrency(item.amount, currency)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <p className="text-sm text-gray-500">
                                        {item.type === 'expense' ? (
                                            <>
                                                <span className="font-medium text-gray-700">{members[item.paid_by]?.display_name || 'Unknown'}</span> paid
                                            </>
                                        ) : (
                                            <>
                                                <span className="font-medium text-gray-700">{members[item.payer_id]?.display_name}</span> sent to <span className="font-medium text-gray-700">{members[item.receiver_id]?.display_name}</span>
                                            </>
                                        )}
                                        {' • '}{new Date(item.date || item.created_at).toLocaleDateString()}
                                    </p>

                                    {/* Edit/Delete Actions for Expense Owner */}
                                    {item.type === 'expense' && item.paid_by === user?.id && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => navigate(`/expenses/add?id=${item.id}`)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => promptDelete(item.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {recentActivity.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            No activity yet.
                        </div>
                    )}
                </div>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Expense?</h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete this expense? This action cannot be undone and will recalculate all balances.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setExpenseToDelete(null);
                                }}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
