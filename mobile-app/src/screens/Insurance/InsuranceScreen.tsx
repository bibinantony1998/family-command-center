import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { fetchInsurancePolicies, type InsurancePolicy } from '../../lib/assets';

type NavProp = StackNavigationProp<RootStackParamList>;

const INSURANCE_ICONS: Record<string, string> = {
    health: '🏥', life: '❤️', vehicle: '🚗', property: '🏠', medical: '🩺',
};

const INSURANCE_COLORS: Record<string, string> = {
    health: '#fff1f2', life: '#fef2f2', vehicle: '#eff6ff', property: '#eef2ff', medical: '#f0fdfa',
};

const INSURANCE_ACCENT: Record<string, string> = {
    health: '#f43f5e', life: '#ef4444', vehicle: '#3b82f6', property: '#6366f1', medical: '#14b8a6',
};

function getPolicyStatus(expiry: string): 'active' | 'expiring' | 'expired' {
    const today = new Date();
    const exp = new Date(expiry);
    const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'expiring';
    return 'active';
}

export default function InsuranceScreen() {
    const navigation = useNavigation<NavProp>();
    const { profile, family } = useAuth() as any;
    const insets = useSafeAreaInsets();
    const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!family?.id || profile?.role !== 'parent') { setLoading(false); return; }
        fetchInsurancePolicies(family.id)
            .then(data => setPolicies(data))
            .catch(e => console.error('Insurance load error:', e))
            .finally(() => setLoading(false));
    }, [family?.id, profile?.role]);

    if (profile?.role !== 'parent') {
        return (
            <View style={styles.accessDenied}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
                <Text style={styles.accessDeniedTitle}>Access Restricted</Text>
                <Text style={styles.accessDeniedText}>Only parents can manage insurance policies</Text>
            </View>
        );
    }

    const CATEGORIES = [
        { id: 'health', label: 'Health', emoji: '🏥' },
        { id: 'life', label: 'Life', emoji: '❤️' },
        { id: 'vehicle', label: 'Vehicle', emoji: '🚗' },
        { id: 'property', label: 'Property', emoji: '🏠' },
    ];

    return (
        <View style={styles.container}>
            <View style={[styles.navBar, { paddingTop: insets.top + 16 }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <ChevronLeft size={28} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.navTitle}>Health & Insurance</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Category Grid */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Insurance Categories</Text>
                    <View style={styles.categoryGrid}>
                        {CATEGORIES.map(cat => (
                            <TouchableOpacity
                                key={cat.id}
                                style={styles.categoryBtn}
                                onPress={() => navigation.navigate('AddPolicy' as any, { category: cat.id })}>
                                <View style={[styles.categoryIcon, { backgroundColor: INSURANCE_COLORS[cat.id] }]}>
                                    <Text style={{ fontSize: 24 }}>{cat.emoji}</Text>
                                </View>
                                <Text style={styles.categoryLabel}>{cat.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Stats */}
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Active Policies</Text>
                    <Text style={styles.statValue}>{policies.length}</Text>
                    <Text style={styles.statSublabel}>Across all categories</Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
                ) : policies.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Text style={{ fontSize: 48, marginBottom: 12 }}>🛡️</Text>
                        <Text style={styles.emptyTitle}>No policies yet</Text>
                        <Text style={styles.emptyText}>Protect your family with health, life, and vehicle insurance</Text>
                        <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('AddPolicy' as any)}>
                            <Text style={styles.emptyBtnText}>+ Add Your First Policy</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.policyGrid}>
                        <Text style={styles.sectionTitle2}>Your Policies</Text>
                        {policies.map(policy => {
                            const status = getPolicyStatus(policy.expiry_date);
                            const statusColors = {
                                active: { bg: '#dcfce7', text: '#166534', label: '✓ Active' },
                                expiring: { bg: '#fef3c7', text: '#92400e', label: '⚠ Expiring Soon' },
                                expired: { bg: '#fee2e2', text: '#991b1b', label: '✕ Expired' },
                            }[status];

                            return (
                                <View key={policy.id} style={styles.policyCard}>
                                    <View style={styles.policyCardTop}>
                                        <View style={[styles.policyIconBox, { backgroundColor: INSURANCE_COLORS[policy.type] ?? '#f1f5f9' }]}>
                                            <Text style={{ fontSize: 22 }}>{INSURANCE_ICONS[policy.type] ?? '🛡️'}</Text>
                                        </View>
                                        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                                            <Text style={[styles.statusText, { color: statusColors.text }]}>{statusColors.label}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.policyType}>{policy.type.toUpperCase()} INSURANCE</Text>
                                    <Text style={styles.policyProvider}>{policy.provider}</Text>
                                    <View style={styles.divider} />
                                    <View style={styles.policyRow}>
                                        <Text style={styles.policyRowLabel}>Annual Premium</Text>
                                        <Text style={styles.policyRowValue}>₹{policy.premium_amount.toLocaleString('en-IN')}</Text>
                                    </View>
                                    {policy.coverage_amount && (
                                        <View style={styles.policyRow}>
                                            <Text style={styles.policyRowLabel}>Coverage</Text>
                                            <Text style={styles.policyRowValue}>₹{policy.coverage_amount.toLocaleString('en-IN')}</Text>
                                        </View>
                                    )}
                                    <View style={styles.policyRow}>
                                        <Text style={styles.policyRowLabel}>Expires</Text>
                                        <Text style={[styles.policyRowValue, { color: status === 'expired' ? '#dc2626' : status === 'expiring' ? '#d97706' : '#1e293b' }]}>
                                            {new Date(policy.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </Text>
                                    </View>
                                    {status === 'expiring' && (
                                        <View style={styles.renewWarning}>
                                            <Text style={styles.renewWarningText}>⚠ Renew before expiry to avoid coverage gap</Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}
                <View style={{ height: 32 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    navTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    backBtn: { padding: 4, marginLeft: -4 },
    addBtn: { backgroundColor: '#6366f1', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
    addBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
    scroll: { flex: 1 },
    card: { backgroundColor: 'white', margin: 16, marginBottom: 0, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
    sectionTitle2: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 8, marginHorizontal: 16, marginTop: 16 },
    categoryGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    categoryBtn: { alignItems: 'center', flex: 1 },
    categoryIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    categoryLabel: { fontSize: 12, fontWeight: '600', color: '#475569' },
    statCard: { backgroundColor: '#4f46e5', margin: 16, marginBottom: 0, borderRadius: 16, padding: 20 },
    statLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
    statValue: { fontSize: 40, fontWeight: '800', color: 'white' },
    statSublabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
    emptyCard: { alignItems: 'center', margin: 16, backgroundColor: 'white', borderRadius: 16, padding: 32, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
    emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 16 },
    emptyBtn: { backgroundColor: '#0f172a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    emptyBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
    policyGrid: {},
    policyCard: { backgroundColor: 'white', marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    policyCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    policyIconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: 12, fontWeight: '700' },
    policyType: { fontSize: 10, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 2 },
    policyProvider: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginBottom: 10 },
    policyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    policyRowLabel: { fontSize: 13, color: '#64748b' },
    policyRowValue: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
    renewWarning: { backgroundColor: '#fef3c7', borderRadius: 8, padding: 8, marginTop: 8 },
    renewWarningText: { fontSize: 12, color: '#92400e' },
    accessDenied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    accessDeniedTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
    accessDeniedText: { fontSize: 15, color: '#64748b', textAlign: 'center' },
});
