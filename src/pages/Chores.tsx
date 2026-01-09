import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Chore } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Check, CheckCircle, Trophy, Plus, User } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AddChoreModal } from '../components/chores/AddChoreModal';

export default function Chores() {
    const { profile } = useAuth();
    const [chores, setChores] = useState<Chore[]>([]);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    useEffect(() => {
        if (!profile?.family_id) return;

        const fetchChores = async () => {
            const { data } = await supabase
                .from('chores')
                .select('*')
                .eq('family_id', profile.family_id)
                .order('created_at', { ascending: false });
            if (data) setChores(data);
        };

        fetchChores();

        // Subscribe to changes
        const channel = supabase.channel(`chores:${profile.family_id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chores', filter: `family_id=eq.${profile.family_id}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newChore = payload.new as Chore;
                        setChores(prev => {
                            if (prev.some(c => c.id === newChore.id)) return prev;
                            return [newChore, ...prev];
                        });
                    }
                    if (payload.eventType === 'UPDATE') setChores(prev => prev.map(c => c.id === payload.new.id ? payload.new as Chore : c));
                    if (payload.eventType === 'DELETE') setChores(prev => prev.filter(c => c.id !== payload.old.id));
                })
            .subscribe();

        return () => { supabase.removeChannel(channel) };
    }, [profile?.family_id]);

    const toggleChore = async (chore: Chore) => {
        if (!profile) return;
        const isNowDone = !chore.is_completed;

        // Logic: If completing a task that is unassigned, claim it for the current user so they get points.
        // If it's already assigned (to me or someone else), keep the assignment as is.
        const shouldClaim = isNowDone && !chore.assigned_to;
        const newAssignedTo = shouldClaim ? profile.id : chore.assigned_to;

        // Optimistic UI update
        setChores(prev => prev.map(c => c.id === chore.id ? { ...c, is_completed: isNowDone, assigned_to: newAssignedTo } : c));

        if (isNowDone) {
            // Check if all done
            const allOthersDone = chores.filter(c => c.id !== chore.id).every(c => c.is_completed);
            if (allOthersDone && chores.length > 0) {
                triggerConfetti();
            }
        }

        // Prepare DB updates
        const updates: any = { is_completed: isNowDone };
        if (shouldClaim) {
            updates.assigned_to = profile.id;
        }

        const { error } = await supabase.from('chores').update(updates).eq('id', chore.id);

        if (error) {
            // Revert optimistic update
            setChores(prev => prev.map(c => c.id === chore.id ? { ...c, is_completed: !isNowDone, assigned_to: chore.assigned_to } : c));
        }
    };

    const handleAddChore = async (title: string, points: number, assignedTo: string | null) => {
        if (!profile?.family_id) return;

        const { data, error } = await supabase.from('chores').insert([{
            title,
            points,
            assigned_to: assignedTo,
            family_id: profile.family_id,
            is_completed: false
        }])
            .select()
            .single(); // Ensure we get the return data

        if (error) {
            console.error("Error adding chore:", error);
            alert("Failed to add chore");
        } else if (data) {
            // Manually update state immediately
            setChores(prev => [data, ...prev]);
        }
    };

    const triggerConfetti = () => {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#6366f1', '#f43f5e', '#14b8a6', '#fbbf24']
        });
    };

    const total = chores.length;
    const completed = chores.filter(c => c.is_completed).length;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

    return (
        <div className="space-y-6 pb-20">
            <header className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                    <CheckCircle className="text-accent" /> Chores
                </h1>
                {profile?.role === 'parent' && (
                    <Button size="icon" onClick={() => setIsAddModalOpen(true)}>
                        <Plus />
                    </Button>
                )}
            </header>

            {/* Progress Card */}
            <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none overflow-hidden relative">
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <p className="text-indigo-100 font-medium">Daily Progress</p>
                        <h2 className="text-4xl font-bold mt-1">{progress}%</h2>
                        <p className="text-sm text-indigo-100 mt-2">{completed} of {total} tasks done</p>
                    </div>
                    <div className="h-20 w-20 relative flex items-center justify-center">
                        {/* Simple SVG Circle implementation */}
                        <svg className="transform -rotate-90 w-20 h-20">
                            <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-indigo-400 opacity-30" />
                            <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={226} strokeDashoffset={226 - (226 * progress) / 100} className="text-white transition-all duration-1000 ease-out" />
                        </svg>
                        {progress === 100 && total > 0 && <Trophy className="absolute h-8 w-8 text-yellow-300 animate-bounce" />}
                    </div>
                </div>

                {/* Decorative circles */}
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white opacity-10 rounded-full" />
            </Card>

            <div className="space-y-3">
                {chores.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 bg-white rounded-3xl border border-slate-100 border-dashed">
                        <p>No chores assigned!</p>
                        {profile?.role === 'parent' && (
                            <Button variant="ghost" className="mt-2 text-indigo-500" onClick={() => setIsAddModalOpen(true)}>
                                create one?
                            </Button>
                        )}
                    </div>
                ) : (
                    chores.map((chore) => (
                        <div
                            key={chore.id}
                            onClick={() => toggleChore(chore)}
                            className={`flex items-center gap-4 p-4 rounded-3xl border transition-all cursor-pointer select-none ${chore.is_completed ? 'bg-slate-50 border-transparent opacity-60' : 'bg-white border-slate-100 shadow-sm hover:border-indigo-200'}`}
                        >
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors ${chore.is_completed ? 'bg-accent border-accent text-white' : 'border-slate-300 text-transparent'}`}>
                                <Check size={16} strokeWidth={3} />
                            </div>
                            <div className="flex-1">
                                <h3 className={`font-semibold text-lg ${chore.is_completed ? 'line-through text-slate-500' : 'text-slate-800'}`}>{chore.title}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{chore.points} pts</span>
                                    {chore.assigned_to && (
                                        <span className="text-xs text-indigo-400 flex items-center gap-1">
                                            <User size={10} /> Assigned
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <AddChoreModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={handleAddChore}
            />
        </div>
    );
}
