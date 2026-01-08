import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Note } from '../types';
import { Button } from '../components/ui/Button';
import { Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const COLORS = [
    { name: 'Yellow', bg: 'bg-yellow-100', text: 'text-yellow-900' },
    { name: 'Mint', bg: 'bg-teal-100', text: 'text-teal-900' },
    { name: 'Pink', bg: 'bg-rose-100', text: 'text-rose-900' },
    { name: 'Blue', bg: 'bg-indigo-100', text: 'text-indigo-900' },
];

export default function Notes() {
    const { profile } = useAuth();
    const [notes, setNotes] = useState<Note[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newContent, setNewContent] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLORS[0]);

    useEffect(() => {
        if (!profile?.family_id) return;

        const fetchNotes = async () => {
            const { data } = await supabase
                .from('notes')
                .select('*')
                .eq('family_id', profile.family_id)
                .order('created_at', { ascending: false });
            if (data) setNotes(data);
        };

        fetchNotes();

        const channel = supabase
            .channel(`notes:${profile.family_id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notes',
                filter: `family_id=eq.${profile.family_id}`
            },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newNote = payload.new as Note;
                        setNotes(prev => {
                            // Deduplication
                            if (prev.some(n => n.id === newNote.id)) return prev;
                            return [newNote, ...prev];
                        });
                    }
                    if (payload.eventType === 'DELETE') setNotes(prev => prev.filter(n => n.id !== payload.old.id));
                    if (payload.eventType === 'UPDATE') setNotes(prev => prev.map(n => n.id === payload.new.id ? payload.new as Note : n));
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel) };
    }, [profile?.family_id]);

    const addNote = async () => {
        if (!newContent.trim() || !profile?.family_id) return;

        const { data, error } = await supabase.from('notes').insert([{
            content: newContent,
            color: selectedColor.bg,
            family_id: profile.family_id,
            author_id: profile.id
        }])
            .select()
            .single(); // Get the return data

        if (!error && data) {
            setNewContent('');
            setIsAdding(false);
            // Instant UI update
            setNotes(prev => [data, ...prev]);
        }
    };

    const deleteNote = async (id: string) => {
        setNotes(prev => prev.filter(n => n.id !== id));
        const { error } = await supabase.from('notes').delete().eq('id', id);
        if (error) {
            console.error("Error deleting note:", error);
        }
    };

    return (
        <div className="space-y-6 pb-20">
            <header className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-800">Family Board</h1>
                <Button size="icon" onClick={() => setIsAdding(!isAdding)}>
                    {isAdding ? <X /> : <Plus />}
                </Button>
            </header>

            <AnimatePresence>
                {isAdding && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                            <textarea
                                className="w-full resize-none p-3 rounded-xl bg-slate-50 border-0 focus:ring-2 focus:ring-indigo-500"
                                rows={3}
                                placeholder="Write a note..."
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                            />
                            <div className="flex justify-between items-center">
                                <div className="flex gap-2">
                                    {COLORS.map((c) => (
                                        <button
                                            key={c.name}
                                            onClick={() => setSelectedColor(c)}
                                            className={`w-8 h-8 rounded-full ${c.bg} border-2 ${selectedColor.name === c.name ? 'border-slate-600' : 'border-transparent'}`}
                                        />
                                    ))}
                                </div>
                                <Button onClick={addNote} disabled={!newContent.trim()}>Post</Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="columns-2 gap-4 space-y-4">
                {notes.map((note) => (
                    <div key={note.id} className={`break-inside-avoid p-4 rounded-3xl ${note.color || 'bg-yellow-100'} shadow-sm relative group`}>
                        <p className="text-slate-800 font-medium whitespace-pre-wrap">{note.content}</p>
                        <button
                            onClick={() => deleteNote(note.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 hover:bg-black/20 p-1.5 rounded-full"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>
            {notes.length === 0 && (
                <div className="text-center py-20 text-slate-400">
                    <p>No notes yet. Add one!</p>
                </div>
            )}
        </div>
    );
}
