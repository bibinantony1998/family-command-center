import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { fetchAssets, deleteAsset, type Asset } from '../../lib/assets';

type NavProp = StackNavigationProp<RootStackParamList>;

const ASSET_ICONS: Record<string, string> = { vehicle: '🚗', property: '🏠', other: '📦' };
const ASSET_COLORS: Record<string, string> = { vehicle: '#eff6ff', property: '#eef2ff', other: '#f0fdf4' };

export default function AssetsScreen() {
    const navigation = useNavigation<NavProp>();
    const { profile, family } = useAuth() as any;
    const insets = useSafeAreaInsets();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);

    const loadAssets = async () => {
        if (!family?.id) return;
        try {
            const data = await fetchAssets(family.id);
            setAssets(data);
        } catch (e) { console.error('Assets load error:', e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadAssets(); }, [family?.id]);

    const handleDelete = (asset: Asset) => {
        Alert.alert('Delete Asset', `Remove "${asset.details?.name || asset.type}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    await deleteAsset(family.id, asset.id);
                    setAssets(prev => prev.filter(a => a.id !== asset.id));
                }
            }
        ]);
    };

    if (profile?.role !== 'parent') {
        return (
            <View style={styles.accessDenied}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
                <Text style={styles.accessDeniedTitle}>Access Restricted</Text>
                <Text style={styles.accessDeniedText}>Only parents can manage family assets</Text>
            </View>
        );
    }

    const grouped = assets.reduce((acc, a) => {
        if (!acc[a.type]) acc[a.type] = [];
        acc[a.type].push(a);
        return acc;
    }, {} as Record<string, Asset[]>);

    return (
        <View style={styles.container}>
            <View style={[styles.navBar, { paddingTop: insets.top + 16 }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <ChevronLeft size={28} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.navTitle}>Assets</Text>
                <TouchableOpacity onPress={() => navigation.navigate('AddAsset' as any)} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>+ Add</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.statRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{assets.filter(a => a.type === 'vehicle').length}</Text>
                        <Text style={styles.statLabel}>🚗 Vehicles</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{assets.filter(a => a.type === 'property').length}</Text>
                        <Text style={styles.statLabel}>🏠 Properties</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{assets.filter(a => a.type === 'other').length}</Text>
                        <Text style={styles.statLabel}>📦 Others</Text>
                    </View>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
                ) : assets.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Text style={{ fontSize: 48, marginBottom: 12 }}>🏠</Text>
                        <Text style={styles.emptyTitle}>No assets yet</Text>
                        <Text style={styles.emptyText}>Track vehicles, properties, and other family assets</Text>
                        <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('AddAsset' as any)}>
                            <Text style={styles.emptyBtnText}>+ Add First Asset</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    Object.entries(grouped).map(([type, typeAssets]) => (
                        <View key={type} style={styles.section}>
                            <Text style={styles.sectionTitle}>{ASSET_ICONS[type]} {type.charAt(0).toUpperCase() + type.slice(1)}s</Text>
                            <View style={styles.assetGrid}>
                                {typeAssets.map(asset => (
                                    <View key={asset.id} style={[styles.assetCard, { backgroundColor: ASSET_COLORS[asset.type] }]}>
                                        <Text style={styles.assetIcon}>{ASSET_ICONS[asset.type]}</Text>
                                        <Text style={styles.assetName}>{asset.details?.name || asset.details?.make || 'Asset'}</Text>
                                        {Object.entries(asset.details || {}).slice(0, 3).map(([k, v]) => (
                                            <View key={k} style={styles.assetDetailRow}>
                                                <Text style={styles.assetDetailKey}>{k}</Text>
                                                <Text style={styles.assetDetailValue}>{v}</Text>
                                            </View>
                                        ))}
                                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(asset)}>
                                            <Text style={styles.deleteBtnText}>Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))
                )}
                <View style={{ height: 40 }} />
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
    statRow: { flexDirection: 'row', margin: 16, marginBottom: 0, gap: 10 },
    statCard: { flex: 1, backgroundColor: 'white', borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
    statValue: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
    statLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
    section: { margin: 16, marginBottom: 0 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 10 },
    assetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    assetCard: { width: '47%', borderRadius: 16, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    assetIcon: { fontSize: 32, marginBottom: 8 },
    assetName: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
    assetDetailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
    assetDetailKey: { fontSize: 11, color: '#64748b', flex: 1 },
    assetDetailValue: { fontSize: 11, fontWeight: '600', color: '#1e293b', flex: 1, textAlign: 'right' },
    deleteBtn: { marginTop: 10, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
    deleteBtnText: { fontSize: 12, fontWeight: '700', color: '#dc2626' },
    emptyCard: { alignItems: 'center', margin: 16, backgroundColor: 'white', borderRadius: 16, padding: 32, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
    emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 16 },
    emptyBtn: { backgroundColor: '#0f172a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    emptyBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
    accessDenied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    accessDeniedTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
    accessDeniedText: { fontSize: 15, color: '#64748b', textAlign: 'center' },
});
