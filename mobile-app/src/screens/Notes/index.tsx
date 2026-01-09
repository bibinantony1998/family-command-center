import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Note } from '../../types/schema';
import { Plus, X } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const COLORS = ['bg-yellow-200', 'bg-blue-200', 'bg-green-200', 'bg-pink-200', 'bg-purple-200', 'bg-orange-200'];
const COLOR_MAP: Record<string, string> = {
    'bg-yellow-200': '#fef08a',
    'bg-blue-200': '#bfdbfe',
    'bg-green-200': '#bbf7d0',
    'bg-pink-200': '#fbcfe8',
    'bg-purple-200': '#e9d5ff',
    'bg-orange-200': '#fed7aa',
};

export default function NotesScreen() {
    const { profile } = useAuth();
    const [notes, setNotes] = useState<Note[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // New Note State
    const [content, setContent] = useState('');
    const [selectedColor, setSelectedColor] = useState('bg-yellow-200');

    const fetchNotes = async () => {
        if (!profile?.family_id) return;
        const { data } = await supabase
            .from('notes')
            .select('*')
            .eq('family_id', profile.family_id)
            .order('created_at', { ascending: false });
        if (data) setNotes(data);
    };

    useEffect(() => {
        fetchNotes();
        const channel = supabase.channel(`notes:${profile?.family_id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `family_id=eq.${profile?.family_id}` }, () => fetchNotes())
            .subscribe();
        return () => { supabase.removeChannel(channel) };
    }, [profile?.family_id]);

    const addNote = async () => {
        if (!content.trim()) return;
        const { error } = await supabase.from('notes').insert([{
            content,
            color: selectedColor,
            family_id: profile?.family_id,
            author_id: profile?.id // Optional if DB allows null, but good practice
        }]);

        if (error) Alert.alert('Error', error.message);
        else {
            setIsModalOpen(false);
            setContent('');
            setSelectedColor('bg-yellow-200');
            fetchNotes(); // Optimistic update ideally
        }
    };

    const deleteNote = async (id: string) => {
        if (profile?.role !== 'parent') return;
        Alert.alert('Delete Note', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await supabase.from('notes').delete().eq('id', id);
                    setNotes(prev => prev.filter(n => n.id !== id));
                }
            }
        ]);
    };

    const renderItem = ({ item }: { item: Note }) => (
        <TouchableOpacity
            style={[styles.note, { backgroundColor: COLOR_MAP[item.color] || '#fef08a' }]}
            onLongPress={() => deleteNote(item.id)}
            delayLongPress={500}
            activeOpacity={0.8}
        >
            <Text style={styles.noteText}>{item.content}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Family Board</Text>
                <TouchableOpacity onPress={() => setIsModalOpen(true)} style={styles.addButton}>
                    <Plus color="white" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={notes}
                keyExtractor={item => item.id}
                numColumns={2}
                columnWrapperStyle={{ gap: 12 }}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchNotes(); setRefreshing(false); }} />}
                renderItem={renderItem}
                ListEmptyComponent={<Text style={styles.emptyText}>No notes yet. Post something!</Text>}
            />

            <Modal visible={isModalOpen} transparent animationType="slide">
                <View style={styles.overlay}>
                    <View style={styles.modal}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Note</Text>
                            <TouchableOpacity onPress={() => setIsModalOpen(false)}><X color="#64748b" /></TouchableOpacity>
                        </View>

                        <Input
                            multiline
                            numberOfLines={4}
                            placeholder="Write something..."
                            value={content}
                            onChangeText={setContent}
                            style={{ height: 100, textAlignVertical: 'top' }}
                        />

                        <Text style={styles.label}>Color</Text>
                        <View style={styles.colorGrid}>
                            {COLORS.map(c => (
                                <TouchableOpacity
                                    key={c}
                                    style={[styles.colorBtn, { backgroundColor: COLOR_MAP[c] }, selectedColor === c && styles.selectedColor]}
                                    onPress={() => setSelectedColor(c)}
                                />
                            ))}
                        </View>

                        <Button title="Post Note" onPress={addNote} style={{ marginTop: 24 }} />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: 'white' },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b' },
    addButton: { backgroundColor: '#f59e0b', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 16 },
    note: { flex: 1, padding: 16, borderRadius: 16, minHeight: 120, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    noteText: { fontSize: 16, color: '#1e293b', lineHeight: 22 },
    emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8' },
    // Modal
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modal: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    label: { fontSize: 14, fontWeight: '500', color: '#334155', marginBottom: 12, marginTop: 16 },
    colorGrid: { flexDirection: 'row', gap: 12 },
    colorBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
    selectedColor: { borderColor: '#6366f1' },
});
