import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Grocery } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Plus, Trash2, Check, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Groceries() {
    const { profile } = useAuth();
    const [items, setItems] = useState<Grocery[]>([]);
    const [newItem, setNewItem] = useState('');
    const [newQuantity, setNewQuantity] = useState('');

    useEffect(() => {
        if (!profile?.family_id) return;

        // Initial Fetch
        const fetchGroceries = async () => {
            const { data } = await supabase
                .from('groceries')
                .select('*')
                .eq('family_id', profile.family_id)
                .order('created_at', { ascending: false });

            if (data) setItems(data);
        };

        fetchGroceries();

        // Real-time Subscription
        // Use a unique channel for this family to ensure isolation
        const channel = supabase
            .channel(`groceries:${profile.family_id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'groceries',
                    filter: `family_id=eq.${profile.family_id}`,
                },
                (payload) => {
                    console.log("Realtime event received:", payload);
                    if (payload.eventType === 'INSERT') {
                        const newItem = payload.new as Grocery;
                        setItems((prev) => {
                            // Deduplication: Don't add if already exists
                            if (prev.some(i => i.id === newItem.id)) return prev;
                            return [newItem, ...prev];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        setItems((prev) => prev.map((item) => item.id === payload.new.id ? payload.new as Grocery : item));
                    } else if (payload.eventType === 'DELETE') {
                        setItems((prev) => prev.filter((item) => item.id !== payload.old.id));
                    }
                }
            )
            .subscribe((status) => {
                console.log("Subscription status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.family_id]);

    const addItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.trim() || !profile?.family_id) return;

        const pendingItem = newItem;
        const pendingQuantity = newQuantity;

        setNewItem(''); // Optimistic clear
        setNewQuantity('');

        const { data, error } = await supabase.from('groceries').insert([
            {
                item_name: pendingItem,
                quantity: pendingQuantity || null, // handle empty string as null
                family_id: profile.family_id,
                is_purchased: false,
                added_by: profile.id,
            },
        ])
            .select()
            .single();

        if (error) {
            console.error('Error adding item:', error);
            setNewItem(pendingItem); // Revert on error
            setNewQuantity(pendingQuantity);
        } else if (data) {
            // Instant UI update
            setItems(prev => [data, ...prev]);
        }
    };

    const togglePurchased = async (item: Grocery) => {
        // Optimistic update
        const updatedStatus = !item.is_purchased;
        setItems((prev) => prev.map(i => i.id === item.id ? { ...i, is_purchased: updatedStatus } : i));

        const { error } = await supabase
            .from('groceries')
            .update({ is_purchased: updatedStatus })
            .eq('id', item.id);

        if (error) {
            // Revert
            setItems((prev) => prev.map(i => i.id === item.id ? { ...i, is_purchased: !updatedStatus } : i));
        }
    };

    const deleteItem = async (id: string) => {
        // Optimistic Delete
        setItems(prev => prev.filter(i => i.id !== id));

        const { error } = await supabase.from('groceries').delete().eq('id', id);
        if (error) {
            console.error("Failed to delete", error);
        }
    };

    const toBuy = items.filter((i) => !i.is_purchased);
    const purchased = items.filter((i) => i.is_purchased);

    return (
        <div className="space-y-6 pb-20">
            <header>
                <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                    <ShoppingCart className="text-primary" /> Grocery List
                </h1>
            </header>

            <form onSubmit={addItem} className="flex gap-2">
                <Input
                    placeholder="Add milk, eggs..."
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    className="flex-[2]"
                />
                <Input
                    placeholder="Qty (e.g. 1L)"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    className="flex-1"
                />
                <Button type="submit" size="icon" disabled={!newItem.trim()}>
                    <Plus />
                </Button>
            </form>

            <div className="space-y-2">
                <h2 className="text-lg font-semibold text-slate-600 px-2">To Buy ({toBuy.length})</h2>
                <AnimatePresence initial={false}>
                    {toBuy.map((item) => (
                        <GroceryItem
                            key={item.id}
                            item={item}
                            onToggle={() => togglePurchased(item)}
                            onDelete={() => deleteItem(item.id)}
                        />
                    ))}
                    {toBuy.length === 0 && (
                        <p className="text-slate-400 italic px-4 py-2">Fridge is full!</p>
                    )}
                </AnimatePresence>
            </div>

            {purchased.length > 0 && (
                <div className="space-y-2 pt-4 border-t border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-600 px-2">In Cart ({purchased.length})</h2>
                    <AnimatePresence initial={false}>
                        {purchased.map((item) => (
                            <GroceryItem
                                key={item.id}
                                item={item}
                                onToggle={() => togglePurchased(item)}
                                onDelete={() => deleteItem(item.id)}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}

function GroceryItem({ item, onToggle, onDelete }: { item: Grocery; onToggle: () => void; onDelete: () => void }) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${item.is_purchased ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-100 shadow-sm'}`}
        >
            <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={onToggle}>
                <div className={`flex items-center justify-center h-6 w-6 rounded-full border-2 transition-colors ${item.is_purchased ? 'bg-green-100 border-green-500 text-green-600' : 'border-slate-300'}`}>
                    {item.is_purchased && <Check size={14} />}
                </div>
                <span className={`text-lg transition-all ${item.is_purchased ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {item.item_name}
                    {item.quantity && <span className="text-sm text-slate-400 ml-2 font-normal">({item.quantity})</span>}
                </span>
            </div>
            {item.is_purchased && (
                <button onClick={onDelete} className="text-slate-400 hover:text-red-500 p-2">
                    <Trash2 size={18} />
                </button>
            )}
        </motion.div>
    )
}
