import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Trophy, Flame, Star, Copy, Users, Check, Edit2, Plus, ArrowRightLeft } from 'lucide-react';
import type { Family } from '../types';
import { calculateBalances, type ExpenseSplit, type Settlement } from '../lib/expense-utils';
import { Toast, type ToastType } from '../components/ui/Toast';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface HistoryItem {
    id: string;
    title: string;
    points: number;
    date: string;
    type: 'chore' | 'game';
}

export default function Profile() {
    const { profile, family, myFamilies, signOut, refreshProfile, switchFamily, leaveFamily } = useAuth();
    const navigate = useNavigate();
    const [totalPoints, setTotalPoints] = useState(0);
    const [streak, setStreak] = useState(0);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [graphData, setGraphData] = useState<{ day: string; points: number }[]>([]);
    // Use local family state if needed, but context 'family' is primary. 
    // keeping local distinct for specific edits (like currency)
    const [localFamily, setLocalFamily] = useState<Family | null>(null);
    const [kids, setKids] = useState<{ id: string; display_name: string; balance: number }[]>([]);
    const [copied, setCopied] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [leaveModal, setLeaveModal] = useState({ isOpen: false, familyId: '', familyName: '' });
    const [isLeaving, setIsLeaving] = useState(false);

    useEffect(() => {
        if (family) setLocalFamily(family);
    }, [family]);

    const processStats = (data: HistoryItem[]) => {
        const today = new Date();
        const getLocalYYYYMMDD = (d: Date) => d.toLocaleDateString('en-CA');

        const todayKey = getLocalYYYYMMDD(today);
        const pointsByDate: Record<string, number> = {};
        const activeDates = new Set<string>();

        data.forEach(item => {
            const date = new Date(item.date);
            const dateKey = getLocalYYYYMMDD(date);
            pointsByDate[dateKey] = (pointsByDate[dateKey] || 0) + (item.points || 0);
            activeDates.add(dateKey);
        });

        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const dateKey = getLocalYYYYMMDD(d);
            last7Days.push({
                day: d.toLocaleDateString('en-US', { weekday: 'short' }),
                points: pointsByDate[dateKey] || 0
            });
        }
        setGraphData(last7Days);

        let currentStreak = 0;
        let checkDate = new Date();

        if (activeDates.has(todayKey)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayKey = getLocalYYYYMMDD(yesterday);

            if (activeDates.has(yesterdayKey)) {
                currentStreak++;
                checkDate = yesterday;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                setStreak(0);
                return;
            }
        }

        while (true) {
            const key = getLocalYYYYMMDD(checkDate);
            if (activeDates.has(key)) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        setStreak(currentStreak);
    };

    useEffect(() => {
        if (!profile) return;

        const fetchStats = async () => {
            if (!profile) return;

            // 1. Kids (for active family parents)
            if (profile.role === 'parent' && family) {
                // Fetch Kids in Family (from family_members now)
                const { data: kidsMembers } = await supabase
                    .from('family_members')
                    .select('balance, role, profile:profiles(id, display_name)')
                    .eq('family_id', family.id)
                    .eq('role', 'child');

                if (kidsMembers) {
                    const mappedKids = kidsMembers.map((m: any) => ({
                        id: m.profile.id,
                        display_name: m.profile.display_name,
                        balance: m.balance
                    }));
                    setKids(mappedKids);
                }
            }

            // 2. Stats (Points) - Fetch from family_members for active family
            // Exact mirror of Mobile Logic
            if (family) {
                const { data: myMember } = await supabase
                    .from('family_members')
                    .select('balance')
                    .eq('profile_id', profile.id)
                    .eq('family_id', family.id)
                    .single();

                if (myMember) {
                    setTotalPoints(myMember.balance);
                } else {
                    setTotalPoints(0);
                }
            } else {
                setTotalPoints(0);
            }

            // 3. History
            if (family) {
                // Fetch all completed chores for this user
                const { data: choreData } = await supabase
                    .from('chores')
                    .select('*')
                    .eq('family_id', family.id)
                    .eq('assigned_to', profile.id)
                    .eq('is_completed', true)
                    .order('created_at', { ascending: false });

                // Fetch game scores
                const { data: gameData } = await supabase
                    .from('game_scores')
                    .select('*')
                    .eq('family_id', family.id)
                    .eq('profile_id', profile.id)
                    .order('played_at', { ascending: false });

                if (choreData || gameData) {
                    const chores = (choreData || []).map(c => ({
                        id: c.id,
                        title: c.title,
                        points: c.points,
                        date: c.created_at,
                        type: 'chore' as const
                    }));
                    const games = (gameData || []).map(g => ({
                        id: g.id,
                        title: `${g.game_id === 'quick-math' ? 'Quick Math' : g.game_id === 'memory-match' ? 'Memory Match' : g.game_id} (Lvl ${g.level})`,
                        points: g.points,
                        date: g.played_at,
                        type: 'game' as const
                    }));

                    const combinedHistory = [...chores, ...games].sort((a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    );

                    setHistory(combinedHistory);
                    processStats(combinedHistory);
                }
            } else {
                setHistory([]);
                setGraphData([]);
            }
        };

        fetchStats();
    }, [profile, family]); // Re-run when profile or family changes

    const copyCode = () => {
        if (localFamily?.secret_key) {
            navigator.clipboard.writeText(localFamily.secret_key);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleSwitchFamily = async (famId: string) => {
        try {
            await switchFamily(famId);
            setToast({ message: "Switched family successfully", type: 'success' });
        } catch (e) {
            setToast({ message: "Failed to switch family", type: 'error' });
        }
    };

    const handleLeaveFamily = async () => {
        if (!leaveModal.familyId) return;
        setIsLeaving(true);
        try {
            await leaveFamily(leaveModal.familyId);
            setToast({ message: `Left ${leaveModal.familyName}`, type: 'success' });
            setLeaveModal({ isOpen: false, familyId: '', familyName: '' });
        } catch (e: any) {
            setToast({ message: e.message || "Failed to leave family", type: 'error' });
        } finally {
            setIsLeaving(false);
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">My Profile</h1>
                    <p className="text-slate-500">{profile?.display_name}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
                    {profile?.display_name?.[0]}
                </div>
            </header>

            {/* My Families Section (Parent Only - Kids are restricted to single family view) */}
            {profile?.role === 'parent' && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2 px-1">
                            <Users size={18} className="text-violet-500" /> My Families
                        </h3>
                        <button
                            onClick={() => navigate('/join-family')}
                            className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
                        >
                            Join / Create New
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {myFamilies.map((fam) => {
                            const isActive = fam.id === family?.id;
                            return (
                                <div key={fam.id} className={`flex justify-between items-center p-3 rounded-xl border ${isActive ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'} shadow-sm`}>
                                    <div>
                                        <p className={`font-medium ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>{fam.name}</p>
                                        <p className="text-xs text-slate-400 capitalize">{fam.membership_role || 'member'}</p>
                                    </div>
                                    {isActive ? (
                                        <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full flex items-center gap-1">
                                            <Check size={12} /> Active
                                        </span>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleSwitchFamily(fam.id)}
                                                className="text-xs font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 px-2 py-1 hover:bg-slate-50 rounded"
                                            >
                                                <ArrowRightLeft size={12} /> Switch
                                            </button>
                                            <button
                                                onClick={() => setLeaveModal({ isOpen: true, familyId: fam.id, familyName: fam.name })}
                                                className="text-xs font-medium text-red-400 hover:text-red-600 px-2 py-1 hover:bg-red-50 rounded"
                                                title="Leave Family"
                                            >
                                                Leave
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {myFamilies.length === 0 && (
                            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center">
                                <p className="text-sm text-slate-500 mb-2">You are not in any families yet.</p>
                                <button onClick={() => navigate('/join-family')} className="text-sm font-medium text-indigo-600">Join or Create one</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Leave Family Confirmation Modal */}
            <ConfirmationModal
                isOpen={leaveModal.isOpen}
                onClose={() => setLeaveModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={handleLeaveFamily}
                title={`Leave ${leaveModal.familyName}?`}
                message={
                    <>
                        <p>Are you sure you want to leave <b>{leaveModal.familyName}</b>?</p>
                        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs border border-red-100 mt-2 flex gap-2 items-start">
                            <div className="font-bold">⚠️</div>
                            <div>
                                <b>Warning:</b> If you are the last member, this family and ALL its data (chores, notes, points) will be <b className="underline">permanently deleted</b>.
                            </div>
                        </div>
                    </>
                }
                isLoading={isLeaving}
            />


            {/* Active Family Info Card */}
            {localFamily && (
                <Card className="bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white border-none">
                    <div className="flex flex-col gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 opacity-90">
                                <Star size={16} />
                                <span className="text-sm font-medium">Current Family Context</span>
                            </div>
                            <h2 className="text-2xl font-bold truncate">{localFamily.name}</h2>
                        </div>

                        <div className="flex gap-3">
                            {/* Invite Code */}
                            <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl flex-1 flex items-center justify-between cursor-pointer hover:bg-white/30 transition-colors" onClick={copyCode}>
                                <div className="text-xs uppercase tracking-wider font-semibold opacity-80">Invite Code</div>
                                <div className="text-xl font-mono font-bold flex items-center gap-2">
                                    {localFamily.secret_key}
                                    {copied ? <Check size={16} className="text-green-300" /> : <Copy size={16} />}
                                </div>
                            </div>

                            {/* Currency Selector (Parent Only) */}
                            {profile?.role === 'parent' && (
                                <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-xl flex flex-col justify-center min-w-[80px] hover:bg-white/30 transition-colors relative group">
                                    <div className="flex items-center gap-1 opacity-80 mb-0.5">
                                        <label className="text-[9px] uppercase tracking-wider font-semibold">Currency</label>
                                        <Edit2 size={8} className="text-white opacity-50 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <select
                                        value={localFamily.currency || 'INR'}
                                        onChange={async (e) => {
                                            const newCurrency = e.target.value;
                                            const { data: expenses } = await supabase.from('expenses').select('*').eq('family_id', localFamily.id);
                                            const { data: settlements } = await supabase.from('settlements').select('*').eq('family_id', localFamily.id);

                                            if (expenses && expenses.length > 0) {
                                                const expenseIds = expenses.map(e => e.id);
                                                const { data: splits } = await supabase.from('expense_splits').select('*').in('expense_id', expenseIds);

                                                if (splits && settlements) {
                                                    const balances = calculateBalances(
                                                        expenses.map(e => ({ id: e.id, paid_by: e.paid_by, amount: e.amount })),
                                                        splits as ExpenseSplit[],
                                                        settlements as Settlement[]
                                                    );
                                                    const hasDebt = balances.some(b => Math.abs(b.amount) > 0.01);

                                                    if (hasDebt) {
                                                        setToast({ message: "Cannot change currency: Unsettled debts exist.", type: 'error' });
                                                        e.target.value = localFamily.currency || 'INR';
                                                        return;
                                                    }
                                                }
                                            }

                                            try {
                                                const oldCurrency = localFamily.currency;
                                                setLocalFamily(prev => prev ? { ...prev, currency: newCurrency } : null);
                                                const { error: updateError } = await supabase.from('families').update({ currency: newCurrency }).eq('id', localFamily.id);
                                                if (updateError) {
                                                    setLocalFamily(prev => prev ? { ...prev, currency: oldCurrency } : null);
                                                    throw updateError;
                                                }
                                                await refreshProfile();
                                                setToast({ message: "Currency updated", type: 'success' });
                                            } catch (err) {
                                                console.error(err);
                                                setToast({ message: "Failed to update currency", type: 'error' });
                                            }
                                        }}
                                        className="bg-transparent text-white font-mono font-bold text-lg outline-none border-none p-0 cursor-pointer appearance-none focus:ring-0"
                                    >
                                        {['INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'].map(c => (
                                            <option key={c} value={c} className="text-slate-800">{c}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            )}

            {/* Parent ONLY: Add Child Section */}
            {localFamily && profile?.role === 'parent' && (
                <>
                    <AddChildSection family={localFamily} />

                    {/* Active Kids List */}
                    {kids.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2 px-1">
                                <Users size={18} className="text-indigo-500" /> Active Kids (Current Family)
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {kids.map(kid => (
                                    <div key={kid.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                                                {kid.display_name?.[0]}
                                            </div>
                                            <p className="font-medium text-slate-700">{kid.display_name}</p>
                                        </div>
                                        <div className="flex items-center gap-2 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-100">
                                            <Trophy size={14} className="text-yellow-600" />
                                            <span className="text-sm font-bold text-yellow-700">{kid.balance} pts</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            <div className="grid grid-cols-2 gap-4">
                <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-orange-100">
                    <div className="flex flex-col items-center text-center p-2">
                        <div className="h-10 w-10 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center mb-2">
                            <Trophy size={20} />
                        </div>
                        <span className="text-3xl font-bold text-slate-800">{totalPoints}</span>
                        <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Points Balance</span>
                    </div>
                </Card>

                <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-blue-100">
                    <div className="flex flex-col items-center text-center p-2">
                        <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center mb-2">
                            <Flame size={20} />
                        </div>
                        <span className="text-3xl font-bold text-slate-800">{streak}</span>
                        <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Day Streak</span>
                    </div>
                </Card>
            </div>

            {/* Points Graph */}
            <Card>
                <h3 className="font-semibold text-slate-800 mb-4">Points Activity</h3>
                <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%" minHeight={100}>
                        <BarChart data={graphData}>
                            <XAxis
                                dataKey="day"
                                tick={{ fontSize: 12, fill: '#94a3b8' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: '#f1f5f9' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="points" radius={[4, 4, 4, 4]}>
                                {graphData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.points > 0 ? '#6366f1' : '#e2e8f0'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <div className="space-y-3">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2 px-1">
                    <Star size={18} className="text-yellow-500" /> Recent Achievements
                </h3>
                {history.slice(0, 5).map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <div>
                            <p className="font-medium text-slate-700">{item.title}</p>
                            <p className="text-xs text-slate-400">
                                {item.type === 'game' ? 'Game • ' : ''}
                                {new Date(item.date).toLocaleDateString()}
                            </p>
                        </div>
                        <span className="text-sm font-bold text-indigo-600">+{item.points}</span>
                    </div>
                ))}
            </div>

            <button
                onClick={() => signOut()}
                className="w-full py-3 rounded-xl bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition-colors"
                title="Sign Out"
            >
                Sign Out
            </button>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

import { UserPlus } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

function AddChildSection({ family }: { family: Family }) {
    const [isOpen, setIsOpen] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    const handleCreateChild = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMsg('');

        try {
            const tempClient = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY,
                {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                }
            );

            const cleanUser = username.replace(/\s+/g, '').toLowerCase();
            const email = `${cleanUser}@kids.fcc`;

            const { data, error } = await tempClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        display_name: username,
                        role: 'child',
                        family_id: family.id
                    }
                }
            });

            if (error) throw error;
            if (data.user) {
                setMsg(`Success! Child "${username}" created. Login with Username: ${cleanUser}`);
                setUsername('');
                setPassword('');
            }
        } catch (err: any) {
            setMsg('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <Card onClick={() => setIsOpen(true)} className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors border-dashed border-2 border-slate-200 shadow-none">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <UserPlus size={20} />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-700">Add Child Account</h3>
                    <p className="text-xs text-slate-400">Create a restricted account for your kid linked to this family</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-4 bg-slate-50 border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-2">Create Child Account (for {family.name})</h3>
            <form onSubmit={handleCreateChild} className="space-y-3">
                <Input
                    placeholder="Child's Name (e.g. Timmy)"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                />
                <Input
                    type="password"
                    placeholder="Set Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
                {msg && <p className="text-xs p-2 bg-white rounded border border-slate-200 text-slate-600">{msg}</p>}
                <div className="flex gap-2">
                    <Button type="submit" isLoading={loading} className="flex-1">Create Account</Button>
                    <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
                </div>
            </form>
        </Card>
    );
}

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: React.ReactNode;
    isLoading?: boolean;
}

function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, isLoading }: ConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <Card className="w-full max-w-sm bg-white p-6 space-y-4 animate-in fade-in zoom-in duration-200">
                <div className="space-y-2">
                    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                    <div className="text-sm text-slate-600 space-y-2">
                        {message}
                    </div>
                </div>
                <div className="flex gap-3 pt-2">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onConfirm}
                        isLoading={isLoading}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                        Leave & Delete
                    </Button>
                </div>
            </Card>
        </div>
    );
}
