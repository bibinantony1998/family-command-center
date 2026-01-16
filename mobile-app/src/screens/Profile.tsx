import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { GradientCard } from '../components/ui/GradientCard';
import { LogOut, User, Shield, CreditCard, Users, Star, Trophy, Copy, Check, ChevronLeft, ArrowLeftRight, Plus, Edit2, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { PointsChart } from '../components/PointsChart';
import { AddKidModal } from '../components/profile/AddKidModal';
import { Toast, ToastType } from '../components/ui/Toast';
import { calculateBalances } from '../lib/expense-utils';
import { supabase } from '../lib/supabase';

interface HistoryItem {
    id: string;
    title: string;
    points: number;
    date: string;
    type: 'chore' | 'game';
}

export default function ProfileScreen() {
    const { profile, user, signOut, family, myFamilies, switchFamily, leaveFamily } = useAuth();
    const [loading, setLoading] = useState(false);
    const navigation = useNavigation<any>();
    const [stats, setStats] = useState({ points: 0, streak: 0 });
    const [kids, setKids] = useState<any[]>([]);

    // Leave Family Logic
    const [leaveModal, setLeaveModal] = useState({ isOpen: false, familyId: '', familyName: '' });
    const [isLeaving, setIsLeaving] = useState(false);

    const handleLeaveFamily = async () => {
        if (!leaveModal.familyId) return;
        setIsLeaving(true);
        try {
            await leaveFamily(leaveModal.familyId);
            setToast({ message: `Left ${leaveModal.familyName}`, type: 'success' });
            setLeaveModal({ isOpen: false, familyId: '', familyName: '' });
        } catch (e: any) {
            Alert.alert('Error', e.message || "Failed to leave family");
        } finally {
            setIsLeaving(false);
        }
    };

    // Use context family as primary, but keep local for immediate updates if needed (though context should suffice)
    // We will just use 'family' from context directly.

    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [isAddKidOpen, setIsAddKidOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Currency Edit
    const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);
    const [updatingCurrency, setUpdatingCurrency] = useState(false);
    const currencies = ['INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD'];

    const fetchData = async () => {
        if (!profile) return;

        // 1. Kids (for active family parents)
        if (profile.role === 'parent' && family) {
            const { data: kData } = await supabase
                .from('family_members')
                .select('balance, role, profile:profiles(*)')
                .eq('family_id', family.id)
                .eq('role', 'child');

            if (kData) {
                const mappedKids = kData.map((m: any) => ({
                    ...m.profile,
                    balance: m.balance
                }));
                setKids(mappedKids);
            }
        }

        // 2. Stats (Points & Streak)
        // const { data: pData } = await supabase.from('profiles').select('balance').eq('id', profile.id).single();
        // const points = pData?.balance || 0;

        // NEW: Fetch from family_members for active family
        let points = 0;
        if (family) {
            const { data: memberData } = await supabase
                .from('family_members')
                .select('balance')
                .eq('profile_id', profile.id)
                .eq('family_id', family.id)
                .single();
            points = memberData?.balance || 0;
        }
        setStats({ points, streak: 0 });

        // 3. History (Recent Achievements)
        if (family) {
            const { data: choreData } = await supabase
                .from('chores')
                .select('*')
                .eq('family_id', family.id)
                .eq('assigned_to', profile.id)
                .eq('is_completed', true)
                .order('created_at', { ascending: false })
                .limit(5);

            const { data: gameData } = await supabase
                .from('game_scores')
                .select('*')
                .eq('family_id', family.id)
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
        } else {
            setHistory([]);
        }
    };

    React.useEffect(() => {
        fetchData();
    }, [profile, family]);

    const copyCode = () => {
        if (family?.secret_key) {
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

    const handleSwitchFamily = async (famId: string) => {
        try {
            await switchFamily(famId);
            setToast({ message: "Switched family successfully", type: 'success' });
        } catch (e) {
            setToast({ message: "Failed to switch family", type: 'error' });
        }
    };

    const handleUpdateCurrency = async (newCurrency: string) => {
        if (!family?.id) return;
        setUpdatingCurrency(true);

        try {
            // Check for existing unsettled debts
            const { data: expenses } = await supabase.from('expenses').select('*').eq('family_id', family.id);
            const { data: settlements } = await supabase.from('settlements').select('*').eq('family_id', family.id);

            if (expenses && expenses.length > 0) {
                const expenseIds = expenses.map((e: any) => e.id);
                const { data: splits } = await supabase.from('expense_splits').select('*').in('expense_id', expenseIds);

                if (splits && settlements) {
                    const balances = calculateBalances(
                        expenses.map((e: any) => ({ id: e.id, paid_by: e.paid_by, amount: e.amount })),
                        splits as any,
                        settlements as any
                    );
                    const hasDebt = balances.some(b => Math.abs(b.amount) > 0.01);

                    if (hasDebt) {
                        setToast({ message: "Cannot change currency: Unsettled debts exist.", type: 'error' });
                        setUpdatingCurrency(false);
                        setIsCurrencyModalOpen(false);
                        return;
                    }
                }
            }

            const { error: updateError } = await supabase.from('families').update({ currency: newCurrency }).eq('id', family.id);
            if (updateError) throw updateError;

            // Ideally context should auto-update, but we might need a manual refresh on context if it doesn't listen to realtime changes on family table
            // AuthContext `refreshProfile` re-fetches family.
            await switchFamily(family.id); // Hacky way to refresh current family data or just call refreshProfile if exposed

            setToast({ message: "Currency updated successfully", type: 'success' });
            setIsCurrencyModalOpen(false);

        } catch (error: any) {
            console.error(error);
            setToast({ message: "Failed to update currency", type: 'error' });
        } finally {
            setUpdatingCurrency(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

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

                {/* My Families Section (Parent Only) */}
                {profile?.role === 'parent' && (
                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <Text style={styles.sectionTitle}>My Families</Text>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('JoinFamily')}
                                style={{ backgroundColor: '#e0e7ff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}
                            >
                                <Text style={{ color: '#4338ca', fontWeight: 'bold', fontSize: 12 }}>Join / Create</Text>
                            </TouchableOpacity>
                        </View>

                        {myFamilies.length === 0 ? (
                            <Card style={{ padding: 16, alignItems: 'center' }}>
                                <Text style={{ color: '#94a3b8' }}>No families joined yet.</Text>
                            </Card>
                        ) : (
                            <View style={{ gap: 8 }}>
                                {myFamilies.map((fam) => {
                                    const isActive = fam.id === family?.id;
                                    return (
                                        <View key={fam.id} style={[styles.familyRow, isActive && styles.activeFamilyRow]}>
                                            <View>
                                                <Text style={[styles.familyRowName, isActive && { color: '#4338ca' }]}>{fam.name}</Text>
                                                <Text style={styles.familyRowRole}>{fam.membership_role || 'member'}</Text>
                                            </View>
                                            {isActive ? (
                                                <View style={styles.activeBadge}>
                                                    <Check size={12} color="#4338ca" />
                                                    <Text style={styles.activeBadgeText}>Active</Text>
                                                </View>
                                            ) : (
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <TouchableOpacity
                                                        onPress={() => handleSwitchFamily(fam.id)}
                                                        style={styles.switchBtn}
                                                    >
                                                        <ArrowLeftRight size={14} color="#64748b" style={{ marginRight: 4 }} />
                                                        <Text style={styles.switchBtnText}>Switch</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => setLeaveModal({ isOpen: true, familyId: fam.id, familyName: fam.name })}
                                                        style={[styles.switchBtn, { marginLeft: 8 }]}
                                                    >
                                                        <LogOut size={14} color="#ef4444" style={{ marginRight: 4 }} />
                                                        <Text style={[styles.switchBtnText, { color: '#ef4444' }]}>Leave</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                )}

                {/* Active Family Details */}
                {family && (
                    <View style={styles.section}>
                        <GradientCard style={styles.familyCard}>
                            <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, opacity: 0.9 }}>
                                    <Star size={16} color="white" style={{ marginRight: 6 }} />
                                    <Text style={{ color: 'white', fontWeight: '500', fontSize: 14 }}>Current Family Context</Text>
                                </View>
                                <Text style={styles.familyName}>{family.name}</Text>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <TouchableOpacity style={[styles.codeBox, { flex: 1 }]} onPress={copyCode}>
                                    <View>
                                        <Text style={{ fontSize: 10, color: '#4c1d95', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 }}>Invite Code</Text>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#5b21b6', fontFamily: 'monospace' }}>{family.secret_key}</Text>
                                    </View>
                                    {copied ? <Check size={20} color="#16a34a" /> : <Copy size={20} color="#7c3aed" />}
                                </TouchableOpacity>

                                {profile?.role === 'parent' && (
                                    <TouchableOpacity
                                        style={styles.currencyBox}
                                        onPress={() => setIsCurrencyModalOpen(true)}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Text style={{ fontSize: 10, color: '#4c1d95', fontWeight: 'bold', textTransform: 'uppercase' }}>Currency</Text>
                                            <Edit2 size={10} color="#5b21b6" />
                                        </View>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#5b21b6' }}>{family.currency || 'INR'}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </GradientCard>
                    </View>
                )}

                {/* Currency Selection Modal */}
                {isCurrencyModalOpen && (
                    <Modal
                        visible={isCurrencyModalOpen}
                        transparent={true}
                        animationType="fade"
                        onRequestClose={() => setIsCurrencyModalOpen(false)}
                    >
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <View style={styles.modalHeader}>
                                    <Text style={styles.modalTitle}>Select Currency</Text>
                                    <TouchableOpacity onPress={() => setIsCurrencyModalOpen(false)}>
                                        <X size={24} color="#64748b" />
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.modalSubtext}>
                                    Changing currency requires all debts to be settled first.
                                </Text>

                                <View style={styles.currencyList}>
                                    {currencies.map(c => (
                                        <TouchableOpacity
                                            key={c}
                                            style={[
                                                styles.currencyItem,
                                                family?.currency === c && styles.currencyItemActive
                                            ]}
                                            onPress={() => handleUpdateCurrency(c)}
                                            disabled={updatingCurrency}
                                        >
                                            <Text style={[
                                                styles.currencyText,
                                                family?.currency === c && styles.currencyTextActive
                                            ]}>{c}</Text>
                                            {family?.currency === c && <Check size={16} color="#4f46e5" />}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>
                    </Modal>
                )}

                {/* Kids List (Parent Only) */}
                {profile?.role === 'parent' && family && (
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

                {/* Leave Confirmation Modal */}
                <Modal
                    visible={leaveModal.isOpen}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setLeaveModal(prev => ({ ...prev, isOpen: false }))}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: '#ef4444' }]}>Leave Family?</Text>
                                <TouchableOpacity onPress={() => setLeaveModal(prev => ({ ...prev, isOpen: false }))}>
                                    <X size={24} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.modalSubtext}>
                                Are you sure you want to leave <Text style={{ fontWeight: 'bold' }}>{leaveModal.familyName}</Text>?
                            </Text>

                            <View style={{ backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, marginBottom: 20, flexDirection: 'row', gap: 8 }}>
                                <Text>⚠️</Text>
                                <Text style={{ fontSize: 12, color: '#b91c1c', flex: 1 }}>
                                    Warning: If you are the last member, this family and all its data will be <Text style={{ fontWeight: 'bold', textDecorationLine: 'underline' }}>permanently deleted</Text>.
                                </Text>
                            </View>

                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <Button
                                    title="Cancel"
                                    onPress={() => setLeaveModal(prev => ({ ...prev, isOpen: false }))}
                                    variant="secondary"
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    title="Leave & Delete"
                                    onPress={handleLeaveFamily}
                                    isLoading={isLeaving}
                                    variant="destructive"
                                    style={{ flex: 1 }}
                                />
                            </View>
                        </View>
                    </View>
                </Modal>

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
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f8fafc' },
    navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#f8fafc' },
    navTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
    backBtn: { padding: 4, marginLeft: -4 },
    scrollContent: { padding: 20 },

    header: { alignItems: 'center', marginTop: 10, marginBottom: 24 },
    avatar: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: '#e0e7ff',
        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
        borderWidth: 4, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10
    },
    avatarText: { fontSize: 32, fontWeight: 'bold', color: '#6366f1' },
    name: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    role: { fontSize: 16, color: '#64748b', marginTop: 4 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },

    // Family Rows
    familyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' },
    activeFamilyRow: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
    familyRowName: { fontSize: 16, fontWeight: '600', color: '#334155' },
    familyRowRole: { fontSize: 12, color: '#94a3b8', textTransform: 'capitalize' },
    activeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0e7ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
    activeBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#4338ca' },
    switchBtn: { flexDirection: 'row', alignItems: 'center', padding: 8 },
    switchBtnText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },

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
    currencyBox: {
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 12,
        padding: 12,
        justifyContent: 'center',
        minWidth: 80
    },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 20, padding: 24, width: '100%', maxWidth: 320 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
    modalSubtext: { fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 18 },
    currencyList: { gap: 8 },
    currencyItem: { padding: 16, borderRadius: 12, backgroundColor: '#f8fafc', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'transparent' },
    currencyItemActive: { backgroundColor: '#eef2ff', borderColor: '#818cf8' },
    currencyText: { fontSize: 16, fontWeight: '600', color: '#334155' },
    currencyTextActive: { color: '#4f46e5', fontWeight: 'bold' },

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
