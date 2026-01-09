import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Trophy, Flame, Star, Copy, Users, Check } from 'lucide-react';
import type { Family } from '../types';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface HistoryItem {
    id: string;
    title: string;
    points: number;
    date: string;
    type: 'chore' | 'game';
}

export default function Profile() {
    const { profile, signOut } = useAuth();
    const [totalPoints, setTotalPoints] = useState(0);
    const [streak, setStreak] = useState(0);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [graphData, setGraphData] = useState<{ day: string; points: number }[]>([]);
    const [family, setFamily] = useState<Family | null>(null);
    const [copied, setCopied] = useState(false);

    const processStats = (data: HistoryItem[]) => {
        // Use local time for "Today"
        const today = new Date();
        const getLocalYYYYMMDD = (d: Date) => d.toLocaleDateString('en-CA'); // 'en-CA' gives YYYY-MM-DD in local time

        const todayKey = getLocalYYYYMMDD(today);

        // Group points by date 'YYYY-MM-DD' (Local Time)
        const pointsByDate: Record<string, number> = {};
        const activeDates = new Set<string>();

        data.forEach(item => {
            // Treat database timestamps as if they happened in local time for display purposes
            // or just convert normally. `new Date(item.date)` converts UTC string to Local Date object.
            const date = new Date(item.date);
            const dateKey = getLocalYYYYMMDD(date);

            pointsByDate[dateKey] = (pointsByDate[dateKey] || 0) + (item.points || 0);
            activeDates.add(dateKey);
        });

        // Generate last 7 days for Graph
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const dateKey = getLocalYYYYMMDD(d);
            last7Days.push({
                day: d.toLocaleDateString('en-US', { weekday: 'short' }), // Mon, Tue
                points: pointsByDate[dateKey] || 0
            });
        }
        setGraphData(last7Days);

        // Calculate Streak (Consecutive Days backward from today)
        let currentStreak = 0;
        let checkDate = new Date(); // Start checking from Today locally

        // If no activity today yet, we can check yesterday to seeing if streak is kept alive
        // But strict streak means: Activity Today OR Yesterday (to continue).
        // If I did something yesterday, streak is 1. If I do something today, streak becomes 2.
        // If I did nothing yesterday, streak is broken.

        // Algorithm:
        // 1. Check Today. If active, count ++, move to yesterday.
        // 2. If NOT active Today, check Yesterday. If active, count ++ (start streak from 1), move to day before.
        // 3. If NOT active Yesterday either -> Streak is 0.

        if (activeDates.has(todayKey)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            // Check yesterday
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayKey = getLocalYYYYMMDD(yesterday);

            if (activeDates.has(yesterdayKey)) {
                currentStreak++;
                checkDate = yesterday; // Start loop from yesterday
                checkDate.setDate(checkDate.getDate() - 1); // Move to day before yesterday for loop
            } else {
                setStreak(0);
                return;
            }
        }

        // Continue checking backwards
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
            // Fetch Family Details
            if (profile.family_id) {
                const { data: familyData } = await supabase
                    .from('families')
                    .select('*')
                    .eq('id', profile.family_id)
                    .single();
                if (familyData) setFamily(familyData);
            }

            // Fetch all completed chores for this user
            const { data: choreData } = await supabase
                .from('chores')
                .select('*')
                .eq('family_id', profile.family_id)
                .eq('assigned_to', profile.id)
                .eq('is_completed', true)
                .order('created_at', { ascending: false });

            // Fetch game scores
            const { data: gameData } = await supabase
                .from('game_scores')
                .select('*')
                .eq('family_id', profile.family_id)
                .eq('profile_id', profile.id)
                .order('played_at', { ascending: false });

            if (choreData || gameData) {
                // Combine history
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

                setHistory(combinedHistory); // Note: history state type needs update to 'any' or union type locally

                // 1. Total Points
                const chorePoints = (choreData || []).reduce((acc, curr) => acc + (curr.points || 0), 0);
                const gamePoints = (gameData || []).reduce((acc, curr) => acc + (curr.points || 0), 0);
                setTotalPoints(chorePoints + gamePoints);

                // 2. Weekly Graph Data & Streak Calculation
                processStats(combinedHistory);
            }
        };

        fetchStats();
    }, [profile]);

    const copyCode = () => {
        if (family?.secret_key) {
            navigator.clipboard.writeText(family.secret_key);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
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

            {/* Family Info Card */}
            {family && (
                <Card className="bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white border-none">
                    <div className="flex flex-col gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 opacity-90">
                                <Users size={16} />
                                <span className="text-sm font-medium">My Family</span>
                            </div>
                            <h2 className="text-2xl font-bold truncate">{family.name}</h2>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl flex items-center justify-between cursor-pointer hover:bg-white/30 transition-colors w-full" onClick={copyCode}>
                            <div className="text-xs uppercase tracking-wider font-semibold opacity-80">Invite Code</div>
                            <div className="text-xl font-mono font-bold flex items-center gap-2">
                                {family.secret_key}
                                {copied ? <Check size={16} className="text-green-300" /> : <Copy size={16} />}
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Parent ONLY: Add Child Section */}
            {family && profile?.role === 'parent' && (
                <AddChildSection family={family} />
            )}

            <div className="grid grid-cols-2 gap-4">
                <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-orange-100">
                    <div className="flex flex-col items-center text-center p-2">
                        <div className="h-10 w-10 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center mb-2">
                            <Trophy size={20} />
                        </div>
                        <span className="text-3xl font-bold text-slate-800">{totalPoints}</span>
                        <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Points</span>
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
                    <ResponsiveContainer width="100%" height="100%">
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
            // Create a temp client to avoid signing out the parent
            const tempClient = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY
            );

            // Construct dummy email: username.secret_key@kids.fcc
            // Remove spaces from username
            const cleanUser = username.replace(/\s+/g, '').toLowerCase();
            const email = `${cleanUser}.${family.secret_key}@kids.fcc`;

            const { data, error } = await tempClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        display_name: username,
                        role: 'child', // Crucial
                        family_id: family.id
                    }
                }
            });

            if (error) throw error;
            if (data.user) {
                setMsg(`Success! Child "${username}" created. Login with Username: ${cleanUser} and Family Code: ${family.secret_key}`);
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
                    <p className="text-xs text-slate-400">Create a restricted account for your kid</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-4 bg-slate-50 border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-2">Create Child Account</h3>
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
