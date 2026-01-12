import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { LogOut, User, Shield, CreditCard, Users } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { PointsChart } from '../components/PointsChart';

import { AddKidModal } from '../components/profile/AddKidModal';
import { Plus } from 'lucide-react-native';

export default function ProfileScreen() {
    const { profile, user, signOut } = useAuth();
    const [loading, setLoading] = useState(false);
    const navigation = useNavigation();
    const [stats, setStats] = useState({ points: 0, streak: 0 });
    const [kids, setKids] = useState<any[]>([]);
    const [family, setFamily] = useState<any>(null);
    const [isAddKidOpen, setIsAddKidOpen] = useState(false);

    const fetchData = async () => {
        if (!profile) return;

        // 1. Family
        if (profile.family_id) {
            const { data: fData } = await import('../lib/supabase').then(m => m.supabase.from('families').select('*').eq('id', profile.family_id).single());
            if (fData) setFamily(fData);

            // 2. Kids (for parents)
            if (profile.role === 'parent') {
                const { data: kData } = await import('../lib/supabase').then(m => m.supabase.from('profiles').select('*').eq('family_id', profile.family_id).eq('role', 'child'));
                if (kData) setKids(kData);
            }
        }

        // 3. Stats (Points & Streak)
        const supabase = (await import('../lib/supabase')).supabase;
        const { data: pData } = await supabase.from('profiles').select('balance').eq('id', profile.id).single();
        const points = pData?.balance || 0;
        setStats({ points, streak: 0 });
    };

    React.useEffect(() => {
        fetchData();
    }, [profile]);

    const handleSignOut = async () => {
        setLoading(true);
        try {
            await signOut();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {profile?.display_name?.charAt(0).toUpperCase() || 'U'}
                    </Text>
                </View>
                <Text style={styles.name}>{profile?.display_name}</Text>
                <Text style={styles.role}>{profile?.role === 'parent' ? 'Parent / Admin' : 'Child Account'}</Text>
            </View>

            {/* Kids List (Parent Only) - REORDERED TO TOP */}
            {profile?.role === 'parent' && (
                <View style={styles.section}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Active Kids</Text>
                        <TouchableOpacity
                            onPress={() => setIsAddKidOpen(true)}
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0e7ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 }}
                        >
                            <Plus size={16} color="#4338ca" style={{ marginRight: 4 }} />
                            <Text style={{ color: '#4338ca', fontWeight: 'bold', fontSize: 12 }}>Add Kid</Text>
                        </TouchableOpacity>
                    </View>

                    {kids.length === 0 ? (
                        <Text style={{ color: '#94a3b8', fontStyle: 'italic' }}>No kids added yet.</Text>
                    ) : (
                        kids.map(kid => (
                            <Card key={kid.id} style={styles.kidCard}>
                                <View style={styles.kidAvatar}>
                                    <Text style={styles.kidAvatarText}>{kid.display_name?.[0]}</Text>
                                </View>
                                <Text style={styles.kidName}>{kid.display_name}</Text>
                                <View style={styles.kidPointsBadge}>
                                    <Text style={styles.kidPointsText}>{kid.balance} pts</Text>
                                </View>
                            </Card>
                        ))
                    )}
                </View>
            )}

            {/* Stats Cards */}
            <View style={styles.statsRow}>
                <Card style={[styles.statsCard, { backgroundColor: '#fff7ed', borderColor: '#ffedd5' }]}>
                    <View style={styles.statIconBox}><Text style={{ fontSize: 20 }}>🏆</Text></View>
                    <Text style={styles.statValue}>{stats.points}</Text>
                    <Text style={styles.statLabel}>Points Balance</Text>
                </Card>
                <Card style={[styles.statsCard, { backgroundColor: '#eef2ff', borderColor: '#e0e7ff' }]}>
                    <View style={[styles.statIconBox, { backgroundColor: '#e0e7ff' }]}><Text style={{ fontSize: 20 }}>🔥</Text></View>
                    <Text style={styles.statValue}>{stats.streak}</Text>
                    <Text style={styles.statLabel}>Day Streak</Text>
                </Card>
            </View>

            {/* Points Graph */}
            <Card style={{ marginBottom: 24, padding: 16 }}>
                <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Points History</Text>
                <PointsChart data={[
                    Math.max(0, stats.points - 50),
                    Math.max(0, stats.points - 30),
                    Math.max(0, stats.points - 15),
                    Math.max(0, stats.points - 5),
                    stats.points
                ]} />
            </Card>

            <AddKidModal
                isOpen={isAddKidOpen}
                onClose={() => setIsAddKidOpen(false)}
                onSuccess={fetchData}
            />

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account</Text>
                <Card style={styles.card}>
                    <View style={styles.row}>
                        <View style={styles.rowIcon}>
                            <User size={20} color="#64748b" />
                        </View>
                        <View style={styles.rowContent}>
                            <Text style={styles.label}>Email / Username</Text>
                            <Text style={styles.value}>{user?.email || profile?.display_name || 'N/A'}</Text>
                        </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                        <View style={styles.rowIcon}>
                            <Users size={20} color="#64748b" />
                        </View>
                        <View style={styles.rowContent}>
                            <Text style={styles.label}>Family: {family ? family.name : 'Loading...'}</Text>
                            <TouchableOpacity onPress={() => {
                                if (family?.secret_key) {
                                    Alert.alert('Family Code', family.secret_key);
                                }
                            }}>
                                <Text style={[styles.value, { color: '#6366f1' }]}>{family?.secret_key || '...'}</Text>
                                <Text style={{ fontSize: 10, color: '#94a3b8' }}>Tap to view code</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Card>
            </View>

            <View style={styles.section}>
                <Button
                    title="Sign Out"
                    onPress={handleSignOut}
                    variant="destructive"
                    isLoading={loading}
                    style={styles.signOutBtn}
                />
                <Button
                    title="Back"
                    onPress={() => navigation.goBack()}
                    variant="ghost"
                    style={{ marginTop: 12 }}
                />
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
    header: { alignItems: 'center', marginTop: 40, marginBottom: 40 },
    avatar: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: '#e0e7ff',
        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
        borderWidth: 4, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10
    },
    avatarText: { fontSize: 32, fontWeight: 'bold', color: '#6366f1' },
    name: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    role: { fontSize: 16, color: '#64748b', marginTop: 4 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
    card: { padding: 0, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    rowContent: { flex: 1 },
    label: { fontSize: 12, color: '#64748b', marginBottom: 2 },
    value: { fontSize: 16, color: '#1e293b', fontWeight: '500' },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginLeft: 72 },
    signOutBtn: { marginTop: 8 },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    statsCard: { flex: 1, alignItems: 'center', padding: 16, borderWidth: 1 },
    statIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffedd5', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    statValue: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    statLabel: { fontSize: 10, fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
    kidCard: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8 },
    kidAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e0e7ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    kidAvatarText: { fontSize: 14, fontWeight: 'bold', color: '#6366f1' },
    kidName: { flex: 1, fontSize: 16, fontWeight: '500', color: '#1e293b' },
    kidPointsBadge: { backgroundColor: '#fefce8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#fef9c3' },
    kidPointsText: { fontSize: 12, fontWeight: 'bold', color: '#ca8a04' }
});
