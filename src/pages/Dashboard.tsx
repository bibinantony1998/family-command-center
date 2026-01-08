import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import type { Note, Chore } from '../types';

export default function Dashboard() {
    const { profile } = useAuth();
    const [groceryCount, setGroceryCount] = useState(0);
    const [nextChore, setNextChore] = useState<Chore | null>(null);
    const [latestNote, setLatestNote] = useState<Note | null>(null);
    const [loading, setLoading] = useState(true);

    const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

    useEffect(() => {
        if (!profile?.family_id) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Get Grocery Count (unpurchased)
                const { count: gCount } = await supabase
                    .from('groceries')
                    .select('*', { count: 'exact', head: true })
                    .eq('family_id', profile.family_id)
                    .eq('is_purchased', false);

                if (gCount !== null) setGroceryCount(gCount);

                // 2. Get Next Uncompleted Chore
                const { data: choreData } = await supabase
                    .from('chores')
                    .select('*')
                    .eq('family_id', profile.family_id)
                    .eq('is_completed', false)
                    .limit(1)
                    .maybeSingle();

                if (choreData) setNextChore(choreData);

                // 3. Get Latest Note
                const { data: noteData } = await supabase
                    .from('notes')
                    .select('*')
                    .eq('family_id', profile.family_id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (noteData) setLatestNote(noteData);

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Optional: subscribe to refresh dashboard data, but for now simple fetch on mount is fine.
    }, [profile?.family_id]);

    return (
        <div className="space-y-6 pb-20">
            <header>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                    Good morning, {profile?.display_name || 'Family'}!
                </h1>
                <p className="text-slate-500 font-medium">{today}</p>
            </header>

            {/* Widgets */}
            <div className="space-y-4">
                {/* Chore Widget */}
                <Card className="bg-gradient-to-br from-indigo-50 to-white border-indigo-100 relative overflow-hidden group">
                    {/* Decorative circle */}
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-100 rounded-full opacity-50 blur-xl group-hover:scale-110 transition-transform" />

                    <h3 className="font-semibold text-indigo-900 mb-2 z-10 relative">Up Next</h3>
                    {nextChore ? (
                        <div className="z-10 relative">
                            <p className="text-2xl font-bold text-indigo-700">{nextChore.title}</p>
                            <p className="text-indigo-500 text-sm mt-1">Worth {nextChore.points} points</p>
                        </div>
                    ) : (
                        <p className="text-slate-500 italic z-10 relative">All chores done! 🎉</p>
                    )}
                </Card>

                {/* Grocery Widget */}
                <Card className="bg-gradient-to-br from-rose-50 to-white border-rose-100 relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-100 rounded-full opacity-50 blur-xl group-hover:scale-110 transition-transform" />

                    <h3 className="font-semibold text-rose-900 mb-2 z-10 relative">Grocery List</h3>
                    <div className="flex items-baseline gap-2 z-10 relative">
                        <span className="text-3xl font-bold text-rose-600">{groceryCount}</span>
                        <span className="text-rose-800">items needed</span>
                    </div>
                </Card>

                {/* Notes Widget */}
                <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100 relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-100 rounded-full opacity-50 blur-xl group-hover:scale-110 transition-transform" />

                    <h3 className="font-semibold text-amber-900 mb-2 z-10 relative">Latest Note</h3>
                    {latestNote ? (
                        <div className={`p-4 rounded-xl rotate-1 shadow-sm inline-block text-sm max-w-full ${latestNote.color || 'bg-yellow-200'} z-10 relative transition-transform group-hover:rotate-0`}>
                            <p className="font-medium text-slate-800 line-clamp-3">{latestNote.content}</p>
                        </div>
                    ) : (
                        <p className="text-slate-500 italic z-10 relative">Fridge is empty</p>
                    )}
                </Card>
            </div>
        </div>
    );
}
