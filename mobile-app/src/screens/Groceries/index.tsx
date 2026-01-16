import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Grocery } from '../../types/schema';
import { Check, Plus, Trash2, ShoppingCart, X } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function GroceriesScreen() {
    const { profile } = useAuth();
    const [items, setItems] = useState<Grocery[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // New Item State
    const [newItemName, setNewItemName] = useState('');
    const [quantity, setQuantity] = useState('');

    const fetchItems = async () => {
        if (!profile?.family_id) return;
        const { data } = await supabase
            .from('groceries')
            .select('*')
            .eq('family_id', profile.family_id)
            .order('is_purchased', { ascending: true })
            .order('created_at', { ascending: false });
        if (data) setItems(data);
    };

    useEffect(() => {
        fetchItems();

        // Simple realtime subscription
        const channel = supabase.channel(`groceries:${profile?.family_id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'groceries', filter: `family_id=eq.${profile?.family_id}` },
                () => fetchItems())
            .subscribe();

        return () => { supabase.removeChannel(channel) };
    }, [profile?.family_id]);

    const addItem = async () => {
        if (!newItemName.trim()) return;
        setLoading(true);
        const { error } = await supabase.from('groceries').insert([{
            item_name: newItemName,
            quantity: quantity.trim() || null,
            family_id: profile?.family_id,
            is_purchased: false,
            added_by: profile?.id
        }]);

        if (error) Alert.alert('Error', error.message);
        else {
            setNewItemName('');
            setQuantity('');
            setIsModalOpen(false);
            fetchItems();
        }

        setLoading(false);
    };

    const toggleItem = async (item: Grocery) => {
        // Optimistic
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_purchased: !item.is_purchased } : i));

        const { error } = await supabase.from('groceries').update({ is_purchased: !item.is_purchased }).eq('id', item.id);
        if (error) fetchItems(); // revert
    };

    const deleteItem = async (id: string) => {
        const { error } = await supabase.from('groceries').delete().eq('id', id);
        if (error) Alert.alert('Error', error.message);
        else setItems(prev => prev.filter(i => i.id !== id));
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Shopping List</Text>
                <TouchableOpacity onPress={() => setIsModalOpen(true)} style={styles.headerAddBtn}>
                    <Plus color="white" size={24} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={items}
                keyExtractor={item => item.id}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchItems(); setRefreshing(false); }} />}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<View style={styles.emptyContainer}><ShoppingCart size={48} color="#e2e8f0" /><Text style={styles.emptyText}>Basket is empty!</Text></View>}
                style={{ flex: 1 }}
                renderItem={({ item }) => (
                    <View style={styles.itemWrapper}>
                        <TouchableOpacity
                            style={[styles.item, item.is_purchased && styles.itemPurchased]}
                            onPress={() => toggleItem(item)}
                        >
                            <View style={[styles.checkbox, item.is_purchased && styles.checkboxChecked]}>
                                {item.is_purchased && <Check size={14} color="white" strokeWidth={3} />}
                            </View>
                            <Text style={[styles.itemText, item.is_purchased && styles.textPurchased]}>
                                {item.item_name}
                                {item.quantity ? <Text style={styles.quantityText}> ({item.quantity})</Text> : ''}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.deleteBtn}>
                            <Trash2 size={18} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>
                )}
            />

            <Modal visible={isModalOpen} transparent animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
                    <View style={styles.modal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Item</Text>
                            <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                                <X color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <Input
                            placeholder="Item (e.g. Milk, Eggs)"
                            label="Item Name"
                            value={newItemName}
                            onChangeText={setNewItemName}
                            autoFocus
                        />

                        <Input
                            placeholder="Qty (e.g. 1L, 12pk)"
                            label="Quantity (Optional)"
                            value={quantity}
                            onChangeText={setQuantity}
                        />

                        <Button
                            title={loading ? "Adding..." : "Add to List"}
                            onPress={addItem}
                            disabled={loading || !newItemName.trim()}
                            style={{ marginTop: 16 }}
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: 'white' },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b' },
    headerAddBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f43f5e', justifyContent: 'center', alignItems: 'center' },
    list: { padding: 16, paddingBottom: 100 },
    itemWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: 'white', borderRadius: 12, paddingRight: 12, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 5 },
    item: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16 },
    itemPurchased: { opacity: 0.5 },
    checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#cbd5e1', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
    checkboxChecked: { backgroundColor: '#10b981', borderColor: '#10b981' },
    itemText: { fontSize: 16, color: '#1e293b', fontWeight: '500' },
    quantityText: { color: '#64748b', fontSize: 14, fontWeight: 'normal' },
    textPurchased: { textDecorationLine: 'line-through', color: '#94a3b8' },
    deleteBtn: { padding: 8 },
    emptyContainer: { alignItems: 'center', marginTop: 60 },
    emptyText: { color: '#94a3b8', marginTop: 12 },

    // Modal
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modal: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
});
