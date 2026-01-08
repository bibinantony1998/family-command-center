import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Trophy, Flame, Star } from 'lucide-react';
import type { Chore } from '../types';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Profile() {
    const { profile, signOut } = useAuth();
    const [totalPoints, setTotalPoints] = useState(0);
    const [streak, setStreak] = useState(0);
    const [history, setHistory] = useState<Chore[]>([]);
    const [graphData, setGraphData] = useState<{ day: string; points: number }[]>([]);

    useEffect(() => {
        if (!profile) return;

        const fetchStats = async () => {
            // Fetch all completed chores for this user
            const { data } = await supabase
                .from('chores')
                .select('*')
                .eq('family_id', profile.family_id)
                .eq('assigned_to', profile.id)
                .eq('is_completed', true)
                .order('created_at', { ascending: false });

            if (data) {
                setHistory(data);
                
                // 1. Total Points
                const points = data.reduce((acc, curr) => acc + (curr.points || 0), 0);
                setTotalPoints(points);

                // 2. Weekly Graph Data & Streak Calculation
                processStats(data);
            }
        };

        fetchStats();
    }, [profile]);

    const processStats = (data: Chore[]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Group points by date 'YYYY-MM-DD'
        const pointsByDate: Record<string, number> = {};
        const activeDates = new Set<string>();

        data.forEach(chore => {
             const date = new Date(chore.created_at);
             const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
             pointsByDate[dateKey] = (pointsByDate[dateKey] || 0) + (chore.points || 0);
             activeDates.add(dateKey);
        });

        // Generate last 7 days for Graph
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];
            last7Days.push({
                day: d.toLocaleDateString('en-US', { weekday: 'short' }), // Mon, Tue
                points: pointsByDate[dateKey] || 0
            });
        }
        setGraphData(last7Days);

        // Calculate Streak (Consecutive Days backward from today)
        let currentStreak = 0;
        
        // Check if we have activity today
        const todayKey = today.toISOString().split('T')[0];
        let checkDate = new Date(today);
        
        // If no activity today, check if there was activity yesterday to start the streak
        // If there IS activity today, start counting from today.
        // If NOT, we check yesterday. If yesterday has activity, streak is alive. If not, streak is broken (0).
        
        if (!activeDates.has(todayKey)) {
             // Peek at yesterday
             const yesterday = new Date(today);
             yesterday.setDate(yesterday.getDate() - 1);
             const yesterdayKey = yesterday.toISOString().split('T')[0];
             if (!activeDates.has(yesterdayKey)) {
                 setStreak(0);
                 return;
             }
             // Start checking from yesterday
             checkDate = yesterday;
        }

        // Count backwards
        while (true) {
            const key = checkDate.toISOString().split('T')[0];
            if (activeDates.has(key)) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        setStreak(currentStreak);
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
                                tick={{fontSize: 12, fill: '#94a3b8'}} 
                                axisLine={false} 
                                tickLine={false} 
                            />
                            <Tooltip 
                                cursor={{fill: '#f1f5f9'}}
                                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
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
                {history.slice(0, 5).map(chore => (
                    <div key={chore.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <div>
                            <p className="font-medium text-slate-700">{chore.title}</p>
                            <p className="text-xs text-slate-400">{new Date(chore.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className="text-sm font-bold text-indigo-600">+{chore.points}</span>
                    </div>
                ))}
                {history.length === 0 && (
                    <p className="text-slate-400 text-center italic py-4">No tasks completed yet. Go do some chores!</p>
                )}
            </div>

            <button 
                onClick={() => signOut()}
                className="w-full py-3 rounded-xl bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition-colors"
            >
                Sign Out
            </button>
        </div>
    );
}
