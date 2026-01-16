import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, CheckCircle2, DollarSign, Wallet } from 'lucide-react-native';
import { formatCurrency, calculateBalances } from '../../lib/expense-utils';

export default function SettleUpScreen({ navigation }: any) {
    const { user, family } = useAuth();

    const [members, setMembers] = useState<Record<string, any>>({});
    const [balances, setBalances] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [settling, setSettling] = useState<string | null>(null); // ID of person currently being paid
    const [payAmounts, setPayAmounts] = useState<Record<string, string>>({}); // keyed by receiver_id

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        await Promise.all([fetchFamilyMembers(), fetchBalances()]);
        setLoading(false);
    };

    const fetchFamilyMembers = async () => {
        try {
            const { data: familyIdData } = await supabase.rpc('get_my_family_id');
            const { data: profiles } = await supabase.from('profiles')
                .select('*')
                .eq('family_id', familyIdData);

            const map: Record<string, any> = {};
            profiles?.forEach(p => map[p.id] = p);
            setMembers(map);
        } catch (e) { console.error(e); }
    };

    const fetchBalances = async () => {
        try {
            const { data: expenses } = await supabase.from('expenses').select('*');
            const { data: splits } = await supabase.from('expense_splits').select('*');
            const { data: settlements } = await supabase.from('settlements').select('*');

            if (expenses && splits && settlements) {
                const calculated = calculateBalances(expenses, splits as any, settlements);
                const balMap: Record<string, number> = {};
                calculated.forEach(b => balMap[b.profile_id] = b.amount);
                setBalances(balMap);

                // Pre-fill logical amounts
                const myBal = balMap[user?.id || ''] || 0;
                if (myBal < 0) { // Only if I owe money
                    const newAmounts: Record<string, string> = {};
                    calculated.forEach(b => {
                        if (b.amount > 0 && b.profile_id !== user?.id) {
                            // Logic: Suggest paying them what they are owed, up to what I owe
                            // But usually, just paying them what they are owed is a good default, or simple 0
                            // User asked to "calculate the value logically". 
                            // Simple logic: min(abs(my_current_debt), their_current_credit)
                            // But pairwise is hard. Let's just suggest min(abs(myBal), b.amount)
                            const suggested = Math.min(Math.abs(myBal), b.amount);
                            newAmounts[b.profile_id] = suggested.toFixed(2);
                        }
                    });
                    setPayAmounts(newAmounts);
                }
            }
        } catch (e) { console.error(e); }
    };

    const handleSettle = async (receiverId: string) => {
        const amountStr = payAmounts[receiverId];
        const amount = parseFloat(amountStr);

        if (!amount || amount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0');
            return;
        }

        try {
            setSettling(receiverId);
            const { data: familyIdData } = await supabase.rpc('get_my_family_id');

            const { error } = await supabase.from('settlements').insert({
                payer_id: user?.id,
                receiver_id: receiverId,
                amount: amount,
                date: new Date().toISOString().split('T')[0],
                family_id: familyIdData
            });

            if (error) throw error;

            Alert.alert('Success', 'Payment recorded!');
            // Refresh logic
            await fetchBalances();
            // setPayAmounts val cleared? Or kept? Better to keep or re-calc. 
            // loadData re-calcs.

        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSettling(null);
        }
    };

    const currency = family?.currency || 'INR';
    const myBalance = balances[user?.id || ''] || 0;

    // Potential people to pay: Anyone with a Positive Balance
    const creditors = Object.entries(balances)
        .filter(([id, amount]) => amount > 0.01 && id !== user?.id) // Filter out < 0.01
        .sort((a, b) => b[1] - a[1]); // Highest owed first

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settle Up</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* My Status */}
                <View style={[styles.statusCard, myBalance >= 0 ? styles.bgEmerald : styles.bgRose]}>
                    <Text style={styles.statusLabel}>Your Balance</Text>
                    <Text style={styles.statusAmount}>{myBalance >= 0 ? '+' : ''}{formatCurrency(myBalance, currency)}</Text>
                    <Text style={styles.statusText}>
                        {myBalance >= 0 ? "You don't owe anything right now." : "You owe money to the family."}
                    </Text>
                </View>

                {myBalance < 0 && (
                    <View style={styles.listContainer}>
                        <Text style={styles.sectionTitle}>Who to pay</Text>

                        {creditors.length > 0 ? creditors.map(([id, creditAmount]) => (
                            <View key={id} style={styles.creditorCard}>
                                <View style={styles.creditorHeader}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>{members[id]?.display_name?.[0]}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.creditorName}>{members[id]?.display_name}</Text>
                                        <Text style={styles.creditorInfo}>Is owed {formatCurrency(creditAmount, currency)}</Text>
                                    </View>
                                </View>

                                <View>
                                    <Text style={styles.inputLabel}>Amount ({currency})</Text>
                                    <View style={styles.payRow}>
                                        <View style={styles.inputWrapper}>
                                            <TextInput
                                                style={styles.payInput}
                                                value={payAmounts[id] || ''}
                                                onChangeText={(txt) => setPayAmounts(prev => ({ ...prev, [id]: txt }))}
                                                keyboardType="numeric"
                                                placeholder="0.00"
                                            />
                                        </View>
                                        <TouchableOpacity
                                            style={styles.payBtn}
                                            onPress={() => handleSettle(id)}
                                            disabled={settling === id}
                                        >
                                            {settling === id ? (
                                                <ActivityIndicator color="white" size="small" />
                                            ) : (
                                                <Text style={styles.payBtnText}>Pay</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        )) : (
                            <Text style={styles.emptyText}>No one to pay right now.</Text>
                        )}
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    content: { padding: 20 },

    statusCard: { padding: 24, borderRadius: 20, alignItems: 'center', marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
    bgEmerald: { backgroundColor: '#059669' },
    bgRose: { backgroundColor: '#e11d48' },
    statusLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600', marginBottom: 4 },
    statusAmount: { color: 'white', fontSize: 36, fontWeight: 'bold', marginBottom: 8 },
    statusText: { color: 'white', fontSize: 14, opacity: 0.9 },

    listContainer: {},
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155', marginBottom: 12, marginLeft: 4 },

    creditorCard: { backgroundColor: 'white', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, elevation: 2 },
    creditorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
    creditorName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
    creditorInfo: { fontSize: 13, color: '#64748b' },

    inputLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 4 },
    payRow: { flexDirection: 'row', gap: 12 },
    inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    payInput: { flex: 1, height: 48, fontSize: 16, fontWeight: '600', color: '#0f172a' },

    payBtn: { backgroundColor: '#0f172a', paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 80 },
    payBtnText: { color: 'white', fontWeight: 'bold' },

    emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 20 }
});
