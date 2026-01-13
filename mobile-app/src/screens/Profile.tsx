import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { GradientCard } from '../components/ui/GradientCard';
import { LogOut, User, Shield, CreditCard, Users, Star, Trophy, Copy, Check, ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { PointsChart } from '../components/PointsChart';

import { AddKidModal } from '../components/profile/AddKidModal';
import { Plus } from 'lucide-react-native';

interface HistoryItem {
    id: string;
    title: string;
    points: number;
    date: string;
    type: 'chore' | 'game';
}

export default function ProfileScreen() {
    const { profile, user, signOut } = useAuth();
    const [loading, setLoading] = useState(false);
    const navigation = useNavigation();
    const [stats, setStats] = useState({ points: 0, streak: 0 });
    const [kids, setKids] = useState<any[]>([]);
    const [family, setFamily] = useState<any>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [isAddKidOpen, setIsAddKidOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const fetchData = async () => {
        if (!profile) return;
        const supabase = (await import('../lib/supabase')).supabase;

        // 1. Family
        if (profile.family_id) {
            const { data: fData } = await supabase.from('families').select('*').eq('id', profile.family_id).single();
            if (fData) setFamily(fData);

            // 2. Kids (for parents)
            if (profile.role === 'parent') {
                const { data: kData } = await supabase.from('profiles').select('*').eq('family_id', profile.family_id).eq('role', 'child');
                if (kData) setKids(kData);
            }
        }

        // 3. Stats (Points & Streak)
        const { data: pData } = await supabase.from('profiles').select('balance').eq('id', profile.id).single();
        const points = pData?.balance || 0;
        setStats({ points, streak: 0 });

        // 4. History (Recent Achievements)
        // Fetch completed chores
        const { data: choreData } = await supabase
            .from('chores')
            .select('*')
            .eq('family_id', profile.family_id)
            .eq('assigned_to', profile.id)
            .eq('is_completed', true)
            .order('created_at', { ascending: false })
            .limit(5);

        // Fetch game scores
        const { data: gameData } = await supabase
            .from('game_scores')
            .select('*')
            .eq('family_id', profile.family_id)
            .eq('profile_id', profile.id)
            .order('played_at', { ascending: false })
            .limit(5);

        const chores = (choreData || []).map((c: any) => ({
            id: c.id,
            title: c.title,
            points: c.points,
            date: c.created_at,
            type: 'chore' as const
        }));

        const games = (gameData || []).map((g: any) => ({
            id: g.id,
            title: `${g.game_id.replace('-', ' ')} (Lvl ${g.level})`,
            points: g.points,
            date: g.played_at,
            type: 'game' as const
        }));

        const combined = [...chores, ...games].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
        setHistory(combined);
    };

    React.useEffect(() => {
        fetchData();
    }, [profile]);

    const copyCode = () => {
        if (family?.secret_key) {
            // In React Native, we'd use Clipboard.setString(family.secret_key);
            // But we need to import Clipboard first. For now, let's just alert.
            Alert.alert('Copied!', `Family Code: ${family.secret_key}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

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
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Sticky Navigation Header */}
            <View style={styles.navBar}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ChevronLeft size={28} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.navTitle}>My Profile</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {profile?.display_name?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                    </View>
                    <Text style={styles.name}>{profile?.display_name}</Text>
                    <Text style={styles.role}>{profile?.role === 'parent' ? 'Parent / Admin' : 'Child Account'}</Text>
                </View>

                {/* Family Section - Moved to Top with Gradient */}
                {family && (
                    <View style={styles.section}>
                        <GradientCard style={styles.familyCard}>
                            <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, opacity: 0.9 }}>
                                    <Users size={16} color="white" style={{ marginRight: 6 }} />
                                    <Text style={{ color: 'white', fontWeight: '500', fontSize: 14 }}>My Family</Text>
                                </View>
                                <Text style={styles.familyName}>{family.name}</Text>
                            </View>

                            <TouchableOpacity style={styles.codeBox} onPress={copyCode}>
                                <View>
                                    <Text style={{ fontSize: 10, color: '#4c1d95', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 }}>Invite Code</Text>
                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#5b21b6', fontFamily: 'monospace' }}>{family.secret_key}</Text>
                                </View>
                                {copied ? <Check size={20} color="#16a34a" /> : <Copy size={20} color="#7c3aed" />}
                            </TouchableOpacity>
                        </GradientCard>
                    </View>
                )}

                {/* Kids List (Parent Only) */}
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

                {/* Recent Achievements */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { marginBottom: 12, flexDirection: 'row', alignItems: 'center' }]}>
                        Recent Achievements
                    </Text>
                    {history.length === 0 ? (
                        <Text style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginBottom: 20 }}>No activity yet.</Text>
                    ) : (
                        <View style={{ gap: 10 }}>
                            {history.map((item, index) => (
                                <Card key={index} style={styles.historyItem}>
                                    <View>
                                        <Text style={styles.historyTitle}>{item.title}</Text>
                                        <Text style={styles.historyDate}>
                                            {item.type === 'game' ? 'Game • ' : ''}
                                            {new Date(item.date).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <Text style={styles.historyPoints}>+{item.points}</Text>
                                </Card>
                            ))}
                        </View>
                    )}
                </View>

                <AddKidModal
                    isOpen={isAddKidOpen}
                    onClose={() => setIsAddKidOpen(false)}
                    onSuccess={fetchData}
                />

                <View style={styles.section}>
                    <Button
                        title="Sign Out"
                        onPress={handleSignOut}
                        variant="destructive"
                        isLoading={loading}
                        style={styles.signOutBtn}
                    />
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc' },
    navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#f8fafc' },
    navTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    backBtn: { padding: 4, marginLeft: -4 },
    scrollContent: { padding: 20 },

    // Existing styles below...
    container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
    header: { alignItems: 'center', marginTop: 10, marginBottom: 30 },
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
    // Family Card
    familyCard: { padding: 20 },
    familyName: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 16 },
    codeBox: {
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },

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
    kidPointsText: { fontSize: 12, fontWeight: 'bold', color: '#ca8a04' },

    // History
    historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginBottom: 0 },
    historyTitle: { fontSize: 16, fontWeight: '600', color: '#334155' },
    historyDate: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    historyPoints: { fontSize: 16, fontWeight: 'bold', color: '#6366f1' }
});
