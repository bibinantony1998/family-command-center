import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Chore } from '../../types/schema';
import { Check, CheckCircle, Plus, Trash2, User } from 'lucide-react-native';
import { AddChoreModal } from '../../components/chores/AddChoreModal';
import { Card } from '../../components/ui/Card';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChoresScreen() {
    const { profile, user, family } = useAuth();
    const [chores, setChores] = useState<Chore[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchChores = async () => {
        if (!family?.id) return;
        const { data } = await supabase
            .from('chores')
            .select('*, assignee:profiles!assigned_to(display_name, avatar_url)')
            .eq('family_id', family.id)
            .order('created_at', { ascending: false });
        if (data) setChores(data as any);
    };

    useEffect(() => {
        if (family?.id) fetchChores();

        const channel = supabase.channel(`chores:${family?.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chores', filter: `family_id=eq.${family?.id}` },
                () => {
                    // Refetch to get joined profile data
                    fetchChores();
                })
            .subscribe();

        return () => { supabase.removeChannel(channel) };
    }, [family?.id]);

    const toggleChore = async (chore: Chore) => {
        const isNowDone = !chore.is_completed;
        const shouldClaim = isNowDone && !chore.assigned_to;
        const updates: any = { is_completed: isNowDone };
        if (shouldClaim && user) {
            updates.assigned_to = user.id;
        }

        // Optimistic
        setChores(prev => prev.map(c => c.id === chore.id ? { ...c, ...updates } : c));

        const { error } = await supabase.from('chores').update(updates).eq('id', chore.id);
        if (error) {
            Alert.alert('Error', 'Failed to update chore');
            fetchChores(); // Revert
        } else {
            // If we claimed it, we need to re-fetch to see our name (unless we optimistic update name too, but refetch is safer)
            if (shouldClaim) fetchChores();
        }
    };

    const deleteChore = async (id: string) => {
        Alert.alert('Delete Chore', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const { error } = await supabase.from('chores').delete().eq('id', id);
                    if (error) Alert.alert('Error', error.message);
                }
            }
        ]);
    };

    const handleAddChore = async (title: string, points: number) => {
        if (!family?.id) return;
        const { data, error } = await supabase.from('chores').insert([{
            title, points, family_id: family.id
        }]).select().single();

        if (error) throw error;
        // fetchChores handles the update via realtime usually, or we can refetch manually
        // Since we refetch on realtime, this is covered.
    };

    const renderItem = ({ item }: { item: Chore }) => (
        <View style={styles.itemWrapper}>
            <TouchableOpacity
                style={[styles.item, item.is_completed && styles.itemCompleted]}
                onPress={() => toggleChore(item)}
                onLongPress={() => profile?.role === 'parent' && deleteChore(item.id)}
                delayLongPress={500}
            >
                <View style={[styles.checkCircle, item.is_completed && styles.checkedCircle]}>
                    {item.is_completed && <Check size={16} color="white" strokeWidth={3} />}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, item.is_completed && styles.textCompleted]}>{item.title}</Text>
                    <View style={styles.metaRow}>
                        <View style={styles.badge}><Text style={styles.badgeText}>{item.points} pts</Text></View>
                        {item.assigned_to && (
                            <View style={styles.assignedBadge}>
                                <User size={10} color="#6366f1" />
                                <Text style={styles.assignedText}>
                                    {item.assignee?.display_name || 'Assigned'}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Chores</Text>
                {/* ... */}
                {profile?.role === 'parent' && (
                    <TouchableOpacity onPress={() => setIsModalOpen(true)} style={styles.addButton}>
                        <Plus color="white" />
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={chores}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchChores(); setRefreshing(false); }} />}
                ListEmptyComponent={<Text style={styles.emptyText}>No chores yet!</Text>}
                style={{ flex: 1 }}
            />

            <AddChoreModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAdd={handleAddChore}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 16, backgroundColor: 'white',
        borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
    },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    addButton: { backgroundColor: '#6366f1', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 16, backgroundColor: '#f8fafc', minHeight: '100%' },
    itemWrapper: { marginBottom: 12 },
    item: {
        flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white',
        borderRadius: 16, gap: 16,
        borderWidth: 1, borderColor: '#e2e8f0',
        shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8, elevation: 1
    },
    itemCompleted: { backgroundColor: '#f8fafc', borderColor: 'transparent', opacity: 0.7 },
    checkCircle: {
        width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#cbd5e1',
        justifyContent: 'center', alignItems: 'center'
    },
    checkedCircle: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
    title: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
    textCompleted: { textDecorationLine: 'line-through', color: '#94a3b8' },
    metaRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    badge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    badgeText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
    assignedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    assignedText: { fontSize: 12, color: '#6366f1', fontWeight: '500' },
    emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8' }
});
