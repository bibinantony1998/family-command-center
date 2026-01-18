import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Card } from '../components/ui/Card';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../navigation/types';
import { Check, X, ShoppingCart, StickyNote, Star, Gift, CheckSquare, Bell } from 'lucide-react-native';
import { Chore, Grocery, Note, Redemption } from '../types/schema';
import { SafeAreaView } from 'react-native-safe-area-context';

type DashboardNavigationProp = BottomTabNavigationProp<MainTabParamList, 'Dashboard'>;

interface Notification {
    id: string;
    type: string;
    message: string;
    sender_id: string;
    is_read: boolean;
    created_at: string;
    profiles?: { display_name: string };
}

export default function DashboardScreen() {
    const { profile, user, family } = useAuth();
    const navigation = useNavigation<DashboardNavigationProp>();
    const [refreshing, setRefreshing] = useState(false);

    // Parent State
    const [groceryCount, setGroceryCount] = useState(0);
    const [nextChore, setNextChore] = useState<Chore | null>(null);
    const [latestNote, setLatestNote] = useState<Note | null>(null);
    const [pendingRedemptions, setPendingRedemptions] = useState<Redemption[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Child State
    const [myPendingChores, setMyPendingChores] = useState<Chore[]>([]);

    const fetchData = useCallback(async () => {
        if (!family?.id) return;

        try {
            // Fetch Notifications (for everyone)
            const { data: notifData } = await supabase
                .from('notifications')
                .select('*, profiles:sender_id(display_name)')
                .eq('family_id', family.id)
                .eq('recipient_id', user?.id)
                .eq('is_read', false)
                .order('created_at', { ascending: false });

            setNotifications(notifData as any || []);

            if (profile?.role === 'parent') {
                // Parent Data
                const { count: gCount } = await supabase
                    .from('groceries')
                    .select('*', { count: 'exact', head: true })
                    .eq('family_id', family.id)
                    .eq('is_purchased', false);
                setGroceryCount(gCount || 0);

                const { data: choreData } = await supabase
                    .from('chores')
                    .select('*')
                    .eq('family_id', family.id)
                    .eq('is_completed', false)
                    .limit(1)
                    .maybeSingle();
                setNextChore(choreData);

                const { data: noteData } = await supabase
                    .from('notes')
                    .select('*')
                    .eq('family_id', family.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                setLatestNote(noteData);

                const { data: redemptionData } = await supabase
                    .from('redemptions')
                    .select('*, rewards(name, cost), profiles:kid_id(display_name)')
                    .eq('family_id', family.id)
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false });

                // Cast due to complex join typing
                setPendingRedemptions(redemptionData as any || []);

            } else {
                // Child Data
                const { data: chores } = await supabase
                    .from('chores')
                    .select('*')
                    .eq('family_id', family.id)
                    .eq('assigned_to', user?.id) // or unassigned logic if any, but sticking to simple
                    .eq('is_completed', false);
                setMyPendingChores(chores || []);
            }

        } catch (e) {
            console.error(e);
        }
    }, [profile, user, family?.id]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    }, [fetchData]);

    useEffect(() => {
        if (family?.id) fetchData();
    }, [family?.id, fetchData]);

    const handleDismissNotification = async (id: string) => {
        const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        if (!error) {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }
    };

    const handleRedemption = async (id: string, status: 'approved' | 'rejected') => {
        if (status === 'approved') {
            const { error } = await supabase.rpc('approve_redemption', { redemption_id_param: id });
            if (error) Alert.alert('Error', error.message);
        } else {
            const { error } = await supabase.rpc('reject_redemption', { redemption_id_param: id });
            if (error) Alert.alert('Error', error.message);
        }
        fetchData(); // refresh list
    };

    const NotificationsWidget = () => (
        notifications.length > 0 ? (
            <Card style={styles.notificationCard}>
                <View style={styles.cardHeader}>
                    <Bell size={20} color="#4f46e5" />
                    <Text style={styles.notificationTitle}>Notifications</Text>
                    <View style={styles.badge}><Text style={styles.badgeText}>{notifications.length}</Text></View>
                </View>

                {notifications.map(n => (
                    <View key={n.id} style={styles.notificationItem}>
                        <View style={styles.notificationIcon}>
                            <Bell size={14} color="#4f46e5" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.notificationMessage}>{n.message}</Text>
                            <Text style={styles.notificationMeta}>From {n.profiles?.display_name || 'System'}</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleDismissNotification(n.id)} style={styles.dismissBtn}>
                            <X size={16} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>
                ))}
            </Card>
        ) : null
    );

    const ParentDashboard = () => (
        <View>
            <NotificationsWidget />

            {/* Pending Redemptions */}
            {pendingRedemptions.length > 0 && (
                <Card style={styles.alertCard}>
                    <View style={styles.cardHeader}>
                        <Gift size={20} color="#7e22ce" />
                        <Text style={styles.alertTitle}>Pending Requests</Text>
                        <View style={styles.badge}><Text style={styles.badgeText}>{pendingRedemptions.length}</Text></View>
                    </View>

                    {pendingRedemptions.map(r => (
                        <View key={r.id} style={styles.redemptionItem}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.redemptionTitle}>{r.rewards?.name}</Text>
                                <Text style={styles.redemptionSubtitle}>For {r.profiles?.display_name} • {r.rewards?.cost} pts</Text>
                            </View>
                            <View style={styles.actions}>
                                <TouchableOpacity onPress={() => handleRedemption(r.id, 'rejected')} style={[styles.actionBtn, styles.rejectBtn]}>
                                    <X size={16} color="#ef4444" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleRedemption(r.id, 'approved')} style={[styles.actionBtn, styles.approveBtn]}>
                                    <Check size={16} color="#22c55e" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </Card>
            )}

            {/* Widgets Grid */}
            <View style={styles.grid}>
                <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('Groceries')}>
                    <Card style={styles.widgetCard}>
                        <View style={[styles.iconBox, { backgroundColor: '#ffe4e6' }]}>
                            <ShoppingCart size={24} color="#e11d48" />
                        </View>
                        <Text style={styles.widgetTitle}>Groceries</Text>
                        <Text style={styles.widgetValue}>{groceryCount} items</Text>
                    </Card>
                </TouchableOpacity>

                <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('Chores')}>
                    <Card style={styles.widgetCard}>
                        <View style={[styles.iconBox, { backgroundColor: '#e0e7ff' }]}>
                            <CheckSquare size={24} color="#4f46e5" />
                        </View>
                        <Text style={styles.widgetTitle}>Next Chore</Text>
                        <Text style={styles.widgetValue} numberOfLines={1}>
                            {nextChore ? nextChore.title : 'All done!'}
                        </Text>
                    </Card>
                </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => navigation.navigate('Notes')}>
                <Card style={styles.noteCard}>
                    <View style={styles.cardHeader}>
                        <StickyNote size={20} color="#b45309" />
                        <Text style={styles.noteTitle}>Latest Note</Text>
                    </View>
                    {latestNote ? (
                        <View style={[styles.noteContent, { backgroundColor: latestNote.color || '#fef08a' }]}>
                            <Text style={styles.noteText}>{latestNote.content}</Text>
                        </View>
                    ) : (
                        <Text style={styles.emptyText}>No notes yet</Text>
                    )}
                </Card>
            </TouchableOpacity>
        </View>
    );

    const ChildDashboard = () => (
        <View>
            <NotificationsWidget />

            <Card style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>My Balance</Text>
                <View style={styles.balanceRow}>
                    <Star size={32} color="#fbbf24" fill="#fbbf24" />
                    <Text style={styles.balanceValue}>{profile?.balance || 0}</Text>
                </View>
                <TouchableOpacity style={styles.spendButton} onPress={() => navigation.navigate('Rewards')}>
                    <Text style={styles.spendButtonText}>Spend Points 🎁</Text>
                </TouchableOpacity>
            </Card>

            <Text style={styles.sectionTitle}>My Chores</Text>
            {myPendingChores.length > 0 ? (
                myPendingChores.map(chore => (
                    <Card key={chore.id}>
                        <Text style={styles.choreTitle}>{chore.title}</Text>
                        <Text style={styles.chorePoints}>+{chore.points} pts</Text>
                    </Card>
                ))
            ) : (
                <Card>
                    <Text style={styles.emptyText}>No chores assigned! 🎉</Text>
                </Card>
            )}
        </View>
    );

    return (
        <View style={styles.containerSafe}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hi, {profile?.display_name}! 👋</Text>
                    <Text style={styles.role}>{profile?.role === 'parent' ? 'Family Admin' : 'Junior Officer'}</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Profile' as any)} style={styles.profileBtn}>
                    <View style={styles.avatarSmall}>
                        <Text style={styles.avatarTextSmall}>{profile?.display_name?.charAt(0).toUpperCase()}</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {profile?.role === 'parent' ? <ParentDashboard /> : <ChildDashboard />}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    containerSafe: { flex: 1, backgroundColor: '#f8fafc' },
    container: { padding: 16, paddingBottom: 100 },
    header: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    greeting: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    role: { fontSize: 13, color: '#64748b' },
    profileBtn: { padding: 4 },
    avatarSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    avatarTextSmall: { color: '#6366f1', fontWeight: 'bold', fontSize: 16 },

    // Alert Card
    alertCard: { backgroundColor: '#faf5ff', borderColor: '#e9d5ff', marginBottom: 16 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    alertTitle: { fontSize: 16, fontWeight: '600', color: '#6b21a8', marginLeft: 8, flex: 1 },
    badge: { backgroundColor: '#e9d5ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    badgeText: { color: '#6b21a8', fontWeight: 'bold', fontSize: 12 },
    redemptionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3e8ff' },
    redemptionTitle: { fontWeight: '600', color: '#1e293b' },
    redemptionSubtitle: { fontSize: 12, color: '#64748b' },
    actions: { flexDirection: 'row', gap: 8 },
    actionBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    rejectBtn: { backgroundColor: '#fef2f2' },
    approveBtn: { backgroundColor: '#f0fdf4' },

    // Notification Card
    notificationCard: { backgroundColor: '#eef2ff', borderColor: '#e0e7ff', marginBottom: 16 },
    notificationTitle: { fontSize: 16, fontWeight: '600', color: '#4338ca', marginLeft: 8, flex: 1 },
    notificationItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e0e7ff' },
    notificationIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0e7ff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    notificationMessage: { fontWeight: '600', color: '#1e293b', fontSize: 14 },
    notificationMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
    dismissBtn: { padding: 8 },

    // Grid
    grid: { flexDirection: 'row', gap: 16, marginBottom: 16 },
    gridItem: { flex: 1 },
    widgetCard: { alignItems: 'center', padding: 16 },
    iconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    widgetTitle: { fontSize: 14, fontWeight: '500', color: '#64748b' },
    widgetValue: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginTop: 4 },

    // Notes
    noteCard: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
    noteTitle: { fontSize: 16, fontWeight: '600', color: '#92400e', marginLeft: 8 },
    noteContent: { padding: 12, borderRadius: 8, marginTop: 8, transform: [{ rotate: '-1deg' }] },
    noteText: { color: '#1e293b', fontSize: 14 },

    // Child
    balanceCard: { backgroundColor: '#6366f1', alignItems: 'center', padding: 24 },
    balanceLabel: { color: '#e0e7ff', fontSize: 16, fontWeight: '500' },
    balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
    balanceValue: { color: 'white', fontSize: 48, fontWeight: 'bold' },
    spendButton: { backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
    spendButtonText: { color: '#6366f1', fontWeight: 'bold' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 12, marginTop: 8 },
    choreTitle: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
    chorePoints: { color: '#6366f1', fontWeight: '600' },
    emptyText: { color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' },
});
