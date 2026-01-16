import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, CheckCircle2, DollarSign } from 'lucide-react-native';
import { formatCurrency, calculateBalances } from '../../lib/expense-utils';

export default function SettleUpScreen({ navigation }: any) {
    const { user, family } = useAuth();

    const [members, setMembers] = useState<any[]>([]);
    const [payer, setPayer] = useState('');
    const [receiver, setReceiver] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [balances, setBalances] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchData();
        fetchFamilyMembers();
    }, []);

    // Suggest payer/receiver based on balances
    useEffect(() => {
        const myBalance = balances[user?.id || ''];
        if (myBalance && myBalance < 0 && !payer && !receiver) {
            setPayer(user?.id || '');
            // Find who needs money most
            const suggestedReceiverId = Object.keys(balances).find(pid => balances[pid] > 0);
            if (suggestedReceiverId) setReceiver(suggestedReceiverId);
        }
    }, [balances]);

    const fetchFamilyMembers = async () => {
        try {
            const { data: familyIdData } = await supabase.rpc('get_my_family_id');
            const { data: members } = await supabase.from('profiles')
                .select('*')
                .eq('family_id', familyIdData)
                .eq('role', 'parent');
            if (members) {
                setMembers(members);
                // Default receiver if not set
                if (!receiver && user?.id) {
                    const other = members.find(m => m.id !== user.id);
                    if (other) setReceiver(other.id);
                }
            }
        } catch (e) { console.error(e); }
    };

    const fetchData = async () => {
        // Recycle balance calc logic for suggestions
        try {
            const { data: expenses } = await supabase.from('expenses').select('*');
            const { data: splits } = await supabase.from('expense_splits').select('*');
            const { data: settlements } = await supabase.from('settlements').select('*');

            if (expenses && splits && settlements) {
                const calculated = calculateBalances(expenses, splits as any, settlements);
                const balMap: Record<string, number> = {};
                calculated.forEach(b => balMap[b.profile_id] = b.amount);
                setBalances(balMap);
            }
        } catch (e) { console.error(e); }
    };

    const handleSubmit = async () => {
        if (!amount || !payer || !receiver) {
            Alert.alert('Error', 'Please fill all fields');
            return;
        }

        try {
            setLoading(true);
            const { data: familyIdData } = await supabase.rpc('get_my_family_id');

            const { error } = await supabase.from('settlements').insert({
                payer_id: payer,
                receiver_id: receiver,
                amount: parseFloat(amount),
                date,
                family_id: familyIdData
            });

            if (error) throw error;
            Alert.alert('Success', 'Payment recorded!');
            navigation.goBack();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const currency = family?.currency || 'INR';

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Record Payment</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Info Card */}
                <View style={styles.infoCard}>
                    <DollarSign size={20} color="#2563eb" />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.infoTitle}>Settle Up</Text>
                        <Text style={styles.infoText}>Record a cash or bank transfer payment to update balances.</Text>
                    </View>
                </View>

                {/* Form */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Payer (From)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                        {members.map(m => (
                            <TouchableOpacity
                                key={m.id}
                                onPress={() => setPayer(m.id)}
                                style={[styles.chip, payer === m.id && styles.chipActive]}
                            >
                                <Text style={[styles.chipText, payer === m.id && styles.chipTextActive]}>
                                    {m.display_name} {m.id === user?.id ? '(You)' : ''}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    {payer && balances[payer] < 0 && (
                        <Text style={styles.balanceHint}>Example: Owes {formatCurrency(Math.abs(balances[payer]), currency)}</Text>
                    )}
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Receiver (To)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                        {members.filter(m => m.id !== payer).map(m => (
                            <TouchableOpacity
                                key={m.id}
                                onPress={() => setReceiver(m.id)}
                                style={[styles.chip, receiver === m.id && styles.chipActive]}
                            >
                                <Text style={[styles.chipText, receiver === m.id && styles.chipTextActive]}>
                                    {m.display_name} {m.id === user?.id ? '(You)' : ''}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Amount ({currency})</Text>
                    <TextInput
                        style={styles.amountInput}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="numeric"
                        placeholder="0.00"
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Date</Text>
                    <TextInput
                        style={styles.input}
                        value={date}
                        onChangeText={setDate}
                        placeholder="YYYY-MM-DD"
                    />
                </View>

                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={loading}
                    style={styles.submitBtn}
                >
                    <CheckCircle2 color="white" size={20} />
                    <Text style={styles.submitBtnText}>{loading ? 'Recording...' : 'Record Settlement'}</Text>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    content: { padding: 24 },

    infoCard: { backgroundColor: '#eff6ff', padding: 16, borderRadius: 12, flexDirection: 'row', gap: 12, marginBottom: 24 },
    infoTitle: { fontWeight: '600', color: '#1e3a8a', marginBottom: 4 },
    infoText: { color: '#1e40af', fontSize: 13, lineHeight: 18 },

    formGroup: { marginBottom: 24 },
    label: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 12 },
    input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 16 },
    amountInput: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
    balanceHint: { fontSize: 12, color: '#ef4444', marginTop: 4 },

    chipRow: { gap: 8, paddingRight: 20 },
    chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    chipActive: { backgroundColor: '#eef2ff', borderColor: '#4f46e5' },
    chipText: { color: '#64748b', fontWeight: '500' },
    chipTextActive: { color: '#4f46e5', fontWeight: 'bold' },

    submitBtn: { backgroundColor: '#2563eb', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    submitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
