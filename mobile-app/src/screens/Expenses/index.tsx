import { useFocusEffect } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Modal } from 'react-native'; // Added Modal
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Wallet, Plus, ArrowLeftRight, FileBarChart, Receipt, Bell, Edit2, Trash2 } from 'lucide-react-native'; // Added Edit2, Trash2
import { calculateBalances, formatCurrency, type Balance } from '../../lib/expense-utils';

export default function ExpensesScreen({ navigation }: any) {
    const { user, family, profile } = useAuth();
    const [balances, setBalances] = useState<Balance[]>([]);
    const [members, setMembers] = useState<Record<string, { display_name: string, avatar_url: string }>>({});
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Delete State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

    // Data Fetching with Focus Effect
    useFocusEffect(
        React.useCallback(() => {
            fetchData();
        }, [])
    );

    const fetchData = async () => {
        try {
            const { data: familyIdData, error: familyIdError } = await supabase.rpc('get_my_family_id');
            if (familyIdError) throw familyIdError;
            const family_id = familyIdData;

            const { data: profiles, error: profilesError } = await supabase.from('profiles')
                .select('id, display_name, avatar_url')
                .eq('family_id', family_id);

            if (profilesError) throw profilesError;

            const memberMap: Record<string, { display_name: string, avatar_url: string }> = {};
            profiles?.forEach((p: any) => memberMap[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url });
            setMembers(memberMap);

            // Fetch expenses, splits, and settlements
            const { data: expensesData, error: expensesError } = await supabase.from('expenses').select('*').order('date', { ascending: false });
            const { data: splitsData, error: splitsError } = await supabase.from('expense_splits').select('*');
            const { data: settlementsData, error: settlementsError } = await supabase.from('settlements').select('*').order('created_at', { ascending: false });

            if (expensesError) throw expensesError;
            if (splitsError) throw splitsError;
            if (settlementsError) throw settlementsError;

            if (expensesData && splitsData && settlementsData) {
                const calculatedBalances = calculateBalances(expensesData, splitsData as any, settlementsData);
                setBalances(calculatedBalances.filter(b => Math.abs(b.amount) > 0.01));

                // Combine for Activity Stream
                const combined = [
                    ...expensesData.map(e => ({ ...e, type: 'expense' })),
                    ...settlementsData.map(s => ({ ...s, type: 'settlement' }))
                ].sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())
                    .slice(0, 10);

                setRecentActivity(combined);

                // DEBUG LOGGING
                const currentId = user?.id || profile?.id;
                console.log("DEBUG: Current User ID:", currentId);
                console.log("DEBUG: Auth User ID:", user?.id);
                console.log("DEBUG: Profile ID:", profile?.id);
                console.log("DEBUG: Balance Keys:", calculatedBalances.map(b => b.profile_id));
            }

            setLoading(false);
            setRefreshing(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleRemind = async (profileId: string) => {
        if (!family?.id) return;
        try {
            const { error } = await supabase.from('notifications').insert({
                family_id: family.id,
                recipient_id: profileId,
                sender_id: user?.id,
                type: 'settle_up_reminder',
                message: 'Please settle up your expenses.'
            });

            if (error) throw error;
            Alert.alert('Success', 'Reminder sent!');
        } catch (error: any) {
            console.error('Error sending reminder:', error);
            Alert.alert('Error', 'Failed to send reminder');
        }
    };

    const handleDelete = (id: string) => {
        setExpenseToDelete(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!expenseToDelete) return;

        try {
            const { error } = await supabase.from('expenses').delete().eq('id', expenseToDelete);
            if (error) throw error;

            // Refresh
            fetchData();
            setShowDeleteModal(false);
            setExpenseToDelete(null);
        } catch (error: any) {
            console.error('Error deleting expense:', error);
            Alert.alert('Error', 'Failed to delete expense');
        }
    };

    const myBalance = balances.find(b => b.profile_id === user?.id)?.amount || 0;
    const currency = family?.currency || 'INR';

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Expenses</Text>
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => navigation.navigate('ExpenseReports')}
                >
                    <FileBarChart size={24} color="#4f46e5" />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                style={styles.scrollView}
            >
                {/* Balance Card */}
                <View style={[styles.balanceCard, myBalance >= 0 ? styles.bgEmerald : styles.bgRose]}>
                    <View style={styles.balanceHeader}>
                        <Wallet size={20} color="white" />
                        <Text style={styles.balanceLabel}>My Balance</Text>
                    </View>
                    <Text style={styles.balanceValue}>{formatCurrency(Math.abs(myBalance), currency)}</Text>
                    <Text style={styles.balanceSubtext}>
                        {myBalance >= 0 ? 'you are owed' : 'you owe'}
                    </Text>
                </View>

                {/* Actions */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => navigation.navigate('AddExpense')}
                    >
                        <View style={[styles.actionIcon, styles.bgIndigo]}>
                            <Plus size={24} color="#4f46e5" />
                        </View>
                        <Text style={styles.actionText}>Add Expense</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => navigation.navigate('SettleUp')}
                    >
                        <View style={[styles.actionIcon, styles.bgOrange]}>
                            <ArrowLeftRight size={24} color="#ea580c" />
                        </View>
                        <Text style={styles.actionText}>Settle Up</Text>
                    </TouchableOpacity>
                </View>

                {/* Balances List */}
                {balances.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Balances</Text>
                        <View style={styles.card}>
                            {balances.map((b, index) => (
                                <View key={b.profile_id} style={[styles.balanceItem, index === balances.length - 1 && styles.lastItem]}>
                                    <View style={styles.row}>
                                        <View style={styles.avatar}>
                                            <Text style={styles.avatarText}>{members[b.profile_id]?.display_name?.[0] || '?'}</Text>
                                        </View>
                                        <View>
                                            <Text style={styles.memberName}>
                                                {b.profile_id === user?.id ? 'You' : members[b.profile_id]?.display_name}
                                            </Text>
                                            {b.amount < 0 && b.profile_id !== user?.id && (
                                                <TouchableOpacity onPress={() => handleRemind(b.profile_id)} style={styles.remindBtn}>
                                                    <Bell size={12} color="#4f46e5" />
                                                    <Text style={styles.remindText}>Remind</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                    <Text style={[styles.amountText, b.amount >= 0 ? styles.textEmerald : styles.textRose]}>
                                        {b.amount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(b.amount), currency)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}



                {/* Activity */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitleLarge}>Recent Activity</Text>
                    {recentActivity.length > 0 ? (
                        <View style={styles.card}>
                            {recentActivity.map((item, index) => (
                                <View key={item.id} style={[styles.activityItem, index === recentActivity.length - 1 && styles.lastItem]}>
                                    <View style={[styles.activityIcon, item.type === 'expense' ? styles.bgIndigo : styles.bgEmeraldLight]}>
                                        {item.type === 'expense' ? <Receipt size={18} color="#4f46e5" /> : <ArrowLeftRight size={18} color="#059669" />}
                                    </View>
                                    <View style={styles.activityContent}>
                                        <View style={styles.rowBetween}>
                                            <Text style={styles.activityTitle} numberOfLines={1}>
                                                {item.type === 'expense' ? item.description : 'Settlement'}
                                            </Text>
                                            <Text style={[styles.activityAmount, item.type === 'expense' ? styles.textSlate : styles.textEmerald]}>
                                                {formatCurrency(item.amount, currency)}
                                            </Text>
                                        </View>
                                        <View style={styles.activityFooter}>
                                            <Text style={styles.activityMeta} numberOfLines={1} ellipsizeMode="tail">
                                                {item.type === 'expense'
                                                    ? `${members[item.paid_by]?.display_name || 'Unknown'} paid`
                                                    : `${members[item.payer_id]?.display_name} → ${members[item.receiver_id]?.display_name}`
                                                }
                                                {' • '}
                                                {new Date(item.date || item.created_at).toLocaleDateString()}
                                            </Text>

                                            {/* Action Buttons for Expense Owner */}
                                            {item.type === 'expense' && item.paid_by === user?.id && (
                                                <View style={styles.activityActions}>
                                                    <TouchableOpacity
                                                        onPress={() => navigation.navigate('AddExpense', { id: item.id })}
                                                        style={styles.actionIconBtn}
                                                    >
                                                        <Edit2 size={14} color="#64748b" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => handleDelete(item.id)}
                                                        style={[styles.actionIconBtn, { backgroundColor: '#fef2f2' }]}
                                                    >
                                                        <Trash2 size={14} color="#ef4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No activity yet</Text>
                        </View>
                    )}
                </View>

            </ScrollView>

            {/* Delete Modal */}
            <Modal
                visible={showDeleteModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDeleteModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Delete Expense?</Text>
                        <Text style={styles.modalText}>
                            Are you sure you want to delete this expense? This action cannot be undone and will recalculate all balances.
                        </Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                onPress={() => setShowDeleteModal(false)}
                                style={[styles.modalBtn, styles.cancelBtn]}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={confirmDelete}
                                style={[styles.modalBtn, styles.deleteBtn]}
                            >
                                <Text style={styles.deleteBtnText}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
    iconButton: { padding: 8, backgroundColor: '#eef2ff', borderRadius: 999 },
    scrollView: { backgroundColor: '#f8fafc' },
    scrollContent: { paddingBottom: 100 },

    // Balance Card
    balanceCard: { marginHorizontal: 24, marginTop: 24, padding: 24, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, marginBottom: 24 },
    bgEmerald: { backgroundColor: '#059669' },
    bgRose: { backgroundColor: '#e11d48' },
    balanceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, opacity: 0.9 },
    balanceLabel: { color: 'white', fontWeight: '500' },
    balanceValue: { fontSize: 48, fontWeight: 'bold', color: 'white', marginVertical: 8 },
    balanceSubtext: { color: 'rgba(255,255,255,0.9)', fontWeight: '500' },

    // Sections
    section: { paddingHorizontal: 24, marginTop: 24 },
    sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
    sectionTitleLarge: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 16 },
    card: { backgroundColor: 'white', borderRadius: 16, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },

    // List Items
    balanceItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    activityItem: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
    lastItem: { borderBottomWidth: 0 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },

    // Avatars & Icons
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#475569', fontWeight: 'bold' },
    activityIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

    // Text Styles
    memberName: { fontWeight: '600', color: '#334155' },
    amountText: { fontWeight: 'bold' },
    textEmerald: { color: '#059669' },
    textRose: { color: '#e11d48' },
    textSlate: { color: '#0f172a' },
    activityTitle: { fontWeight: '600', color: '#0f172a', maxWidth: '70%' },
    activityAmount: { fontWeight: 'bold' },
    activityFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    activityMeta: { fontSize: 12, color: '#64748b', flex: 1, marginRight: 8 },
    activityActions: { flexDirection: 'row', gap: 8 },
    actionIconBtn: { padding: 6, borderRadius: 8, backgroundColor: '#f1f5f9' },
    activityContent: { flex: 1 },

    // Actions
    actionRow: { paddingHorizontal: 24, flexDirection: 'row', gap: 16, marginVertical: 32 },
    actionButton: { flex: 1, backgroundColor: 'white', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
    actionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    actionText: { color: '#0f172a', fontWeight: 'bold' },
    bgIndigo: { backgroundColor: '#eef2ff' },
    bgOrange: { backgroundColor: '#fff7ed' },
    bgEmeraldLight: { backgroundColor: '#ecfdf5' },

    // Empty State
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: '#94a3b8' },

    remindBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, paddingVertical: 2, paddingHorizontal: 6, backgroundColor: '#eef2ff', borderRadius: 8, alignSelf: 'flex-start' },
    remindText: { fontSize: 10, color: '#4f46e5', fontWeight: 'bold' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
    modalText: { fontSize: 16, color: '#64748b', marginBottom: 24, lineHeight: 24 },
    modalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
    modalBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12 },
    cancelBtn: { backgroundColor: '#f1f5f9' },
    deleteBtn: { backgroundColor: '#ef4444' },
    cancelBtnText: { color: '#64748b', fontWeight: 'bold' },
    deleteBtnText: { color: 'white', fontWeight: 'bold' },
});
