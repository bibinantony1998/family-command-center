import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList,
    ScrollView, Modal, ActivityIndicator, Alert
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { fetchBills, fetchInsurancePolicies, updateBillStatus, type Bill, type InsurancePolicy } from '../../lib/assets';

type NavProp = StackNavigationProp<RootStackParamList>;

const CATEGORY_META: Record<string, { label: string; color: string; emoji: string }> = {
    electricity: { label: 'Electricity', color: '#f59e0b', emoji: '⚡' },
    water: { label: 'Water', color: '#3b82f6', emoji: '💧' },
    gas: { label: 'Gas', color: '#f97316', emoji: '🔥' },
    broadband: { label: 'Broadband', color: '#6366f1', emoji: '📶' },
    dth: { label: 'DTH', color: '#a855f7', emoji: '📺' },
    mobile_postpaid: { label: 'Mobile', color: '#10b981', emoji: '📱' },
    landline: { label: 'Landline', color: '#6b7280', emoji: '☎️' },
    education_fees: { label: 'Education', color: '#d97706', emoji: '🎓' },
    credit_card: { label: 'Credit Card', color: '#ef4444', emoji: '💳' },
    property_tax: { label: 'Property Tax', color: '#0d9488', emoji: '🏛️' },
    municipal_tax: { label: 'Municipal Tax', color: '#0891b2', emoji: '🏢' },
    subscription: { label: 'Subscription', color: '#ec4899', emoji: '🔔' },
    other: { label: 'Other', color: '#64748b', emoji: '📋' },
};

const INSURANCE_CATEGORIES = [
    { id: 'electricity', label: 'Electricity', emoji: '⚡' },
    { id: 'water', label: 'Water', emoji: '💧' },
    { id: 'gas', label: 'Gas', emoji: '🔥' },
    { id: 'broadband', label: 'Broadband', emoji: '📶' },
    { id: 'dth', label: 'DTH', emoji: '📺' },
    { id: 'mobile_postpaid', label: 'Mobile', emoji: '📱' },
    { id: 'credit_card', label: 'Credit Card', emoji: '💳' },
    { id: 'insurance', label: 'Insurance', emoji: '🛡️' },
];

export default function BillsScreen() {
    const navigation = useNavigation<NavProp>();
    const { profile, family } = useAuth() as any;
    const insets = useSafeAreaInsets();
    const [bills, setBills] = useState<Bill[]>([]);
    const [insurance, setInsurance] = useState<InsurancePolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [payingBill, setPayingBill] = useState<Bill | null>(null);
    const [isMarkingPaid, setIsMarkingPaid] = useState(false);

    const loadData = useCallback(async () => {
        if (!family?.id) return;
        try {
            const [billsData, { data: insData }] = await Promise.all([
                fetchBills(family.id),
                supabase.from('insurance_policies').select('*').eq('family_id', family.id)
            ]);
            setBills(billsData || []);
            setInsurance(insData || []);
        } catch (e) {
            console.error('Bills load error:', e);
        } finally {
            setLoading(false);
        }
    }, [family?.id]);

    useEffect(() => {
        loadData();
        if (!family?.id) return;
        const channel = supabase
            .channel(`bills-mobile-${family.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bills', filter: `family_id=eq.${family.id}` }, () => loadData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [family?.id, loadData]);

    const handleMarkPaid = async () => {
        if (!payingBill || !family?.id) return;
        setIsMarkingPaid(true);
        try {
            await updateBillStatus(family.id, payingBill.id, 'paid');
            setBills(prev => prev.map(b => b.id === payingBill.id ? { ...b, status: 'paid' } : b));
            setPayingBill(null);
        } catch (e) {
            Alert.alert('Error', 'Failed to update bill status');
        } finally {
            setIsMarkingPaid(false);
        }
    };

    const totalDue = bills
        .filter(b => b.status === 'pending' || b.status === 'overdue')
        .reduce((sum, b) => sum + Number(b.amount), 0);

    if (profile?.role !== 'parent') {
        return (
            <View style={styles.accessDenied}>
                <Text style={styles.accessDeniedIcon}>🔒</Text>
                <Text style={styles.accessDeniedTitle}>Access Restricted</Text>
                <Text style={styles.accessDeniedText}>Only parents can manage bills</Text>
            </View>
        );
    }

    const groupedBills = bills.reduce((acc, bill) => {
        if (!acc[bill.category]) acc[bill.category] = [];
        acc[bill.category].push(bill);
        return acc;
    }, {} as Record<string, Bill[]>);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.navBar, { paddingTop: insets.top + 16 }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <ChevronLeft size={28} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.navTitle}>Bills & Payments</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Category Grid */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Payment Categories</Text>
                    <View style={styles.categoryGrid}>
                        {INSURANCE_CATEGORIES.map(cat => (
                            <TouchableOpacity
                                key={cat.id}
                                style={styles.categoryBtn}
                                onPress={() => cat.id === 'insurance'
                                    ? navigation.navigate('Insurance' as any)
                                    : navigation.navigate('AddBill' as any, { category: cat.id })}
                            >
                                <View style={styles.categoryIcon}>
                                    <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                                </View>
                                <Text style={styles.categoryLabel}>{cat.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Total Due */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Total Due This Month</Text>
                    <Text style={styles.summaryAmount}>₹{totalDue.toLocaleString('en-IN')}</Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
                ) : bills.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyIcon}>🧾</Text>
                        <Text style={styles.emptyTitle}>No bills added yet</Text>
                        <Text style={styles.emptyText}>Track electricity, water, internet & more</Text>
                        <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('AddBill' as any)}>
                            <Text style={styles.emptyBtnText}>+ Add Your First Bill</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {Object.entries(groupedBills).map(([category, catBills]) => {
                            const meta = CATEGORY_META[category] || { label: category, color: '#64748b', emoji: '📋' };
                            return (
                                <View key={category} style={styles.card}>
                                    <View style={styles.categoryHeader}>
                                        <Text style={styles.categoryHeaderText}>{meta.emoji} {meta.label.toUpperCase()}</Text>
                                        <View style={[styles.countBadge, { backgroundColor: meta.color + '20' }]}>
                                            <Text style={[styles.countBadgeText, { color: meta.color }]}>{catBills.length}</Text>
                                        </View>
                                    </View>
                                    {catBills.map(bill => (
                                        <View key={bill.id} style={styles.billRow}>
                                            <View style={[styles.billIcon, { backgroundColor: meta.color + '20' }]}>
                                                <Text style={{ fontSize: 18 }}>{meta.emoji}</Text>
                                            </View>
                                            <View style={styles.billInfo}>
                                                <Text style={styles.billProvider}>{bill.provider_name}</Text>
                                                <Text style={styles.billSub}>ID: {bill.consumer_number}</Text>
                                                {bill.due_date && (
                                                    <Text style={styles.billSub}>Due: {new Date(bill.due_date).toLocaleDateString('en-IN')}</Text>
                                                )}
                                            </View>
                                            <View style={styles.billRight}>
                                                <Text style={styles.billAmount}>₹{bill.amount}</Text>
                                                <View style={[styles.statusBadge, { backgroundColor: bill.status === 'paid' ? '#d1fae5' : bill.status === 'overdue' ? '#fee2e2' : '#fef3c7' }]}>
                                                    <Text style={[styles.statusText, { color: bill.status === 'paid' ? '#065f46' : bill.status === 'overdue' ? '#991b1b' : '#92400e' }]}>
                                                        {bill.status === 'paid' ? '✓ Paid' : bill.status === 'overdue' ? '⚠ Overdue' : '⏳ Pending'}
                                                    </Text>
                                                </View>
                                                {bill.status !== 'paid' && (
                                                    <TouchableOpacity style={styles.payBtn} onPress={() => setPayingBill(bill)}>
                                                        <Text style={styles.payBtnText}>Pay →</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            );
                        })}

                        {/* Insurance shortcut policies */}
                        {['life', 'health', 'vehicle'].map(insType => {
                            const policies = insurance.filter(p => p.type === insType);
                            if (!policies.length) return null;
                            const emoji = insType === 'health' ? '🏥' : insType === 'life' ? '❤️' : '🚗';
                            return (
                                <View key={`ins-${insType}`} style={styles.card}>
                                    <View style={styles.categoryHeader}>
                                        <Text style={styles.categoryHeaderText}>{emoji} {insType.toUpperCase()} INSURANCE</Text>
                                        <View style={styles.countBadge}>
                                            <Text style={styles.countBadgeText}>{policies.length}</Text>
                                        </View>
                                    </View>
                                    {policies.map(p => (
                                        <View key={p.id} style={styles.billRow}>
                                            <View style={[styles.billIcon, { backgroundColor: '#ede9fe' }]}>
                                                <Text style={{ fontSize: 18 }}>{emoji}</Text>
                                            </View>
                                            <View style={styles.billInfo}>
                                                <Text style={styles.billProvider}>{p.provider}</Text>
                                                {p.next_due_date && <Text style={styles.billSub}>Due: {new Date(p.next_due_date).toLocaleDateString('en-IN')}</Text>}
                                            </View>
                                            <View style={styles.billRight}>
                                                <Text style={styles.billAmount}>₹{p.premium_amount}</Text>
                                                <TouchableOpacity style={styles.payBtn} onPress={() => navigation.navigate('Insurance' as any)}>
                                                    <Text style={styles.payBtnText}>View →</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            );
                        })}
                    </>
                )}
                <View style={{ height: 32 }} />
            </ScrollView>

            {/* Pay Modal */}
            <Modal visible={!!payingBill} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalIcon}>💳</Text>
                        <Text style={styles.modalTitle}>Pay Bill</Text>
                        <Text style={styles.modalDesc}>{payingBill?.provider_name}</Text>
                        <Text style={styles.modalAmount}>₹{payingBill?.amount}</Text>
                        <TouchableOpacity
                            style={[styles.modalBtn, { backgroundColor: '#6366f1' }]}
                            onPress={() => {
                                setPayingBill(null);
                                // Navigate to AddExpense for split
                            }}>
                            <Text style={styles.modalBtnText}>Pay & Split Expense</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalBtn, { backgroundColor: '#f1f5f9', marginTop: 8 }]}
                            onPress={handleMarkPaid}
                            disabled={isMarkingPaid}>
                            <Text style={[styles.modalBtnText, { color: '#334155' }]}>
                                {isMarkingPaid ? 'Marking...' : 'Just Mark as Paid'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setPayingBill(null)}>
                            <Text style={styles.modalCancel}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    navTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    backBtn: { padding: 4, marginLeft: -4 },
    scroll: { flex: 1 },
    card: { backgroundColor: 'white', margin: 16, marginBottom: 0, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    categoryBtn: { width: '25%', alignItems: 'center', paddingVertical: 8 },
    categoryIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    categoryEmoji: { fontSize: 20 },
    categoryLabel: { fontSize: 10, fontWeight: '600', color: '#475569', textAlign: 'center' },
    summaryCard: { backgroundColor: '#4f46e5', margin: 16, marginBottom: 0, borderRadius: 16, padding: 20 },
    summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
    summaryAmount: { fontSize: 32, fontWeight: '800', color: 'white' },
    emptyCard: { alignItems: 'center', margin: 16, backgroundColor: 'white', borderRadius: 16, padding: 32, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 4 },
    emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 16 },
    emptyBtn: { backgroundColor: '#0f172a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    emptyBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
    categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    categoryHeaderText: { fontSize: 12, fontWeight: '700', color: '#475569', letterSpacing: 0.5, flex: 1 },
    countBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    countBadgeText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
    billRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
    billIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    billInfo: { flex: 1 },
    billProvider: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
    billSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
    billRight: { alignItems: 'flex-end' },
    billAmount: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
    statusText: { fontSize: 11, fontWeight: '600' },
    payBtn: { backgroundColor: '#ede9fe', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginTop: 6 },
    payBtnText: { fontSize: 12, fontWeight: '700', color: '#6366f1' },
    accessDenied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    accessDeniedIcon: { fontSize: 48, marginBottom: 16 },
    accessDeniedTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
    accessDeniedText: { fontSize: 15, color: '#64748b', textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, alignItems: 'center' },
    modalIcon: { fontSize: 36, marginBottom: 12 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
    modalDesc: { fontSize: 15, color: '#64748b', marginBottom: 4 },
    modalAmount: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 20 },
    modalBtn: { width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontWeight: '700', color: 'white' },
    modalCancel: { marginTop: 12, fontSize: 15, color: '#64748b', fontWeight: '600' },
});
