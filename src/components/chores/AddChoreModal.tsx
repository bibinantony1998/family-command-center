import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { X, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Profile } from '../../types';

interface AddChoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (title: string, points: number, assignedTo: string | null) => Promise<void>;
}

export function AddChoreModal({ isOpen, onClose, onAdd }: AddChoreModalProps) {
    const { profile } = useAuth();
    const [title, setTitle] = useState('');
    const [points, setPoints] = useState(10);
    const [assignedTo, setAssignedTo] = useState<string>('');
    const [members, setMembers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !profile?.family_id) return;

        const fetchMembers = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('family_id', profile.family_id);

            if (data) setMembers(data);
        };

        fetchMembers();
    }, [isOpen, profile?.family_id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onAdd(title, points, assignedTo || null);
            setTitle('');
            setPoints(10);
            setAssignedTo('');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black z-40"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-xl p-6 space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold text-slate-800">New Chore</h2>
                                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                                    <X />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Chore Title</label>
                                    <Input
                                        placeholder="e.g. Wash dishes"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Points ({points})</label>
                                    <input
                                        type="range"
                                        min="5"
                                        max="100"
                                        step="5"
                                        value={points}
                                        onChange={(e) => setPoints(Number(e.target.value))}
                                        className="w-full h-2 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                                        <span>Easy (5)</span>
                                        <span>Hard (100)</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Assign To</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setAssignedTo('')}
                                            className={`p-2 rounded-xl border text-sm flex items-center gap-2 justify-center transition-colors ${assignedTo === '' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            <User size={16} /> Any
                                        </button>
                                        {members.map(m => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setAssignedTo(m.id)}
                                                className={`p-2 rounded-xl border text-sm flex items-center gap-2 justify-center transition-colors ${assignedTo === m.id ? 'border-primary bg-indigo-50 text-primary font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                            >
                                                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] overflow-hidden">
                                                    {m.avatar_url ? <img src={m.avatar_url} className="w-full h-full object-cover" /> : m.display_name?.[0]}
                                                </div>
                                                <span className="truncate max-w-[80px]">{m.display_name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <Button type="submit" className="w-full" isLoading={loading} disabled={!title.trim()}>
                                    Create Chore
                                </Button>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
