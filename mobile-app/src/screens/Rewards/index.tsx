import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Reward } from '../../types/schema';
import { Gift, Heart, Star, Gamepad2, Ticket, Pizza, IceCream, Plus, Trash2 } from 'lucide-react-native';
import { AddRewardModal } from '../../components/rewards/AddRewardModal';
import { Card } from '../../components/ui/Card';

const ICONS: Record<string, any> = {
    'gift': Gift,
    'heart': Heart,
    'star': Star,
    'gamepad-2': Gamepad2,
    'ticket': Ticket,
    'pizza': Pizza,
    'ice-cream': IceCream,
};

export default function RewardsScreen() {
    const { profile } = useAuth();
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchRewards = async () => {
        if (!profile?.family_id) return;
        const { data } = await supabase
            .from('rewards')
            .select('*')
            .eq('family_id', profile.family_id)
            .order('cost', { ascending: true });
        if (data) setRewards(data);
    };

    useEffect(() => {
        fetchRewards();
    }, [profile?.family_id]);

    const handleAddReward = async (name: string, cost: number, icon: string) => {
        if (!profile?.family_id) return;
        const { data, error } = await supabase.from('rewards').insert([{
            name, cost, icon, family_id: profile.family_id
        }]).select().single();

        if (error) Alert.alert('Error', error.message);
        if (data) setRewards(prev => [...prev, data]);
    };

    const deleteReward = async (id: string) => {
        Alert.alert('Delete Reward', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const { error } = await supabase.from('rewards').delete().eq('id', id);
                    if (error) Alert.alert('Error', error.message);
                    else setRewards(prev => prev.filter(r => r.id !== id));
                }
            }
        ]);
    };

    const redeemReward = async (reward: Reward) => {
        if (!profile) return;
        if (profile.role !== 'child') return;

        if (profile.balance < reward.cost) {
            Alert.alert('Not enough points!', `You need ${reward.cost - profile.balance} more points.`);
            return;
        }

        Alert.alert('Redeem Reward', `Spend ${reward.cost} points for ${reward.name}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Redeem!',
                onPress: async () => {
                    const { error } = await supabase.rpc('request_redemption', { reward_id_param: reward.id });
                    if (error) {
                        Alert.alert('Error', error.message);
                    } else {
                        Alert.alert('Success', 'Request sent to parents!');
                        // Ideally refresh profile balance here
                        // trigger profile refresh via context
                    }
                }
            }
        ]);
    };

    const renderItem = ({ item }: { item: Reward }) => {
        const IconComp = ICONS[item.icon] || Gift;
        return (
            <TouchableOpacity
                style={styles.item}
                onPress={() => profile?.role === 'child' ? redeemReward(item) : null}
                onLongPress={() => profile?.role === 'parent' ? deleteReward(item.id) : null}
                activeOpacity={0.7}
            >
                <View style={styles.iconBox}>
                    <IconComp size={32} color="#8b5cf6" />
                </View>
                <Text style={styles.cost} numberOfLines={1}>{item.cost}</Text>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Rewards</Text>
                    {profile?.role === 'child' && (
                        <Text style={styles.balance}>{profile.balance} Points</Text>
                    )}
                </View>
                {profile?.role === 'parent' && (
                    <TouchableOpacity onPress={() => setIsModalOpen(true)} style={styles.addButton}>
                        <Plus color="white" />
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={rewards}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                numColumns={2}
                columnWrapperStyle={{ gap: 16 }}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchRewards(); setRefreshing(false); }} />}
                ListEmptyComponent={<Text style={styles.emptyText}>No rewards yet!</Text>}
            />

            <AddRewardModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAdd={handleAddReward}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: 'white'
    },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b' },
    balance: { fontSize: 16, color: '#6366f1', fontWeight: '600' },
    addButton: { backgroundColor: '#8b5cf6', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 16 },
    item: {
        flex: 1, backgroundColor: 'white', borderRadius: 24, padding: 16,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1, borderColor: '#f3e8ff',
        shadowColor: '#7c3aed', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
        aspectRatio: 0.8
    },
    iconBox: { marginBottom: 16, backgroundColor: '#f5f3ff', padding: 12, borderRadius: 20 },
    cost: { fontSize: 24, fontWeight: 'bold', color: '#7c3aed', marginBottom: 4 },
    name: { fontSize: 14, fontWeight: '600', color: '#4b5563', textAlign: 'center' },
    emptyText: { textAlign: 'center', marginTop: 40, color: '#94a3b8' }
});
