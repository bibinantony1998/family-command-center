import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Wallet, Plus, ArrowLeftRight, FileBarChart, Receipt } from 'lucide-react-native';
import { calculateBalances, formatCurrency, type Balance } from '../../lib/expense-utils';

export default function ExpensesScreen({ navigation }: any) {
    const { user, family } = useAuth();
    const [balances, setBalances] = useState<Balance[]>([]);
    const [members, setMembers] = useState<Record<string, { display_name: string, avatar_url: string }>>({});
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Initial Fetch
    useEffect(() => {
        fetchData();
    }, []);

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

    const myBalance = balances.find(b => b.profile_id === user?.id)?.amount || 0;
    const currency = family?.currency || 'INR';

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Expenses</Text>
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => Alert.alert('Reports', 'Coming soon!')}
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
                                        <Text style={styles.memberName}>
                                            {b.profile_id === user?.id ? 'You' : members[b.profile_id]?.display_name}
                                        </Text>
                                    </View>
                                    <Text style={[styles.amountText, b.amount >= 0 ? styles.textEmerald : styles.textRose]}>
                                        {b.amount >= 0 ? '+' : '-'}{formatCurrency(Math.abs(b.amount), currency)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => Alert.alert('Add Expense', 'Feature coming in next update')}
                    >
                        <View style={[styles.actionIcon, styles.bgIndigo]}>
                            <Plus size={24} color="#4f46e5" />
                        </View>
                        <Text style={styles.actionText}>Add Expense</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => Alert.alert('Settle Up', 'Feature coming in next update')}
                    >
                        <View style={[styles.actionIcon, styles.bgOrange]}>
                            <ArrowLeftRight size={24} color="#ea580c" />
                        </View>
                        <Text style={styles.actionText}>Settle Up</Text>
                    </TouchableOpacity>
                </View>

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
                                        <Text style={styles.activityMeta}>
                                            {item.type === 'expense'
                                                ? `${members[item.paid_by]?.display_name || 'Unknown'} paid`
                                                : `${members[item.payer_id]?.display_name} → ${members[item.receiver_id]?.display_name}`
                                            }
                                            {' • '}
                                            {new Date(item.date || item.created_at).toLocaleDateString()}
                                        </Text>
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
    activityMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
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
    emptyText: { color: '#94a3b8' }
});
