import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { Trophy, Flame, Star } from 'lucide-react';
import type { Chore } from '../types';

export default function Profile() {
    const { profile, signOut } = useAuth();
    const [totalPoints, setTotalPoints] = useState(0);
    // const [completedTasks, setCompletedTasks] = useState(0);
    const [streak, setStreak] = useState(0);
    const [history, setHistory] = useState<Chore[]>([]);
    // const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;

        const fetchStats = async () => {
            // setLoading(true);

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

                // Calculate Total Points
                const points = data.reduce((acc, curr) => acc + (curr.points || 0), 0);
                setTotalPoints(points);
                // setCompletedTasks(data.length);

                // Calculate Streak (Consecutive days with at least one completed task)
                // This is a rough estimation based on created_at since we don't track 'completed_at' yet
                // TO DO: Add 'completed_at' to schema for accurate streaks.
                const uniqueDays = new Set(data.map(c => new Date(c.created_at).toDateString()));
                setStreak(uniqueDays.size);
            }
            // setLoading(false);
        };

        fetchStats();
    }, [profile]);

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
                        <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Active Days</span>
                    </div>
                </Card>
            </div>

            <Card>
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Star size={18} className="text-yellow-500" /> Recent Achievements
                </h3>
                <div className="space-y-3">
                    {history.slice(0, 5).map(chore => (
                        <div key={chore.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
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
            </Card>

            <button
                onClick={() => signOut()}
                className="w-full py-3 rounded-xl bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition-colors"
            >
                Sign Out
            </button>
        </div>
    );
}
