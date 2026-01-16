import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Check, ChevronDown } from 'lucide-react-native';
import { formatCurrency } from '../../lib/expense-utils';

export default function AddExpenseScreen({ navigation, route }: any) {
    const { user, family, profile } = useAuth();
    const expenseId = route.params?.id; // If editing

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('General');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [paidBy, setPaidBy] = useState(user?.id || '');
    const [splitType, setSplitType] = useState<'EQUAL' | 'PERCENTAGE' | 'EXACT'>('EQUAL');

    const [familyMembers, setFamilyMembers] = useState<any[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [splitValues, setSplitValues] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchFamilyMembers();
    }, []);

    useEffect(() => {
        if (expenseId && familyMembers.length > 0) {
            fetchExpenseDetails();
        }
    }, [expenseId, familyMembers.length]);


    const fetchFamilyMembers = async () => {
        try {
            const { data: familyIdData } = await supabase.rpc('get_my_family_id');
            const family_id = familyIdData;

            const { data: members } = await supabase.from('profiles')
                .select('*')
                .eq('family_id', family_id)
                .eq('role', 'parent');

            if (members) {
                setFamilyMembers(members);
                // Default select all
                setSelectedMembers(members.map(m => m.id));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchExpenseDetails = async () => {
        if (!expenseId) return;
        setLoading(true);
        const { data: expense } = await supabase.from('expenses').select('*').eq('id', expenseId).single();
        const { data: splits } = await supabase.from('expense_splits').select('*').eq('expense_id', expenseId);

        if (expense) {
            setDescription(expense.description);
            setAmount(expense.amount.toString());
            setCategory(expense.category);
            setDate(expense.date.split('T')[0]);
            setPaidBy(expense.paid_by);

            if (splits && splits.length > 0) {
                const members = splits.map(s => s.profile_id);
                setSelectedMembers(members);

                // Detect split type
                const firstAmount = splits[0].amount;
                const isEqual = splits.every(s => Math.abs(s.amount - firstAmount) < 0.01);

                if (isEqual) {
                    setSplitType('EQUAL');
                } else {
                    setSplitType('EXACT'); // Default to Exact for safety
                    const values: Record<string, string> = {};
                    splits.forEach(s => values[s.profile_id] = s.amount.toString());
                    setSplitValues(values);
                }
            }
        }
        setLoading(false);
    };

    // Effect to reset split values when members or mode changes
    useEffect(() => {
        const count = selectedMembers.length;
        if (count > 0 && splitType === 'PERCENTAGE') {
            const equalShare = (100 / count).toFixed(2);
            const newSplits: Record<string, string> = {};
            selectedMembers.forEach(id => newSplits[id] = equalShare);
            setSplitValues(newSplits);
        } else if (count > 0 && splitType === 'EXACT' && amount) {
            const equalShare = (parseFloat(amount) / count).toFixed(2);
            const newSplits: Record<string, string> = {};
            selectedMembers.forEach(id => newSplits[id] = equalShare);
            setSplitValues(newSplits);
        }
    }, [selectedMembers.length, splitType, amount]);

    const handleSave = async () => {
        if (!amount || !description || selectedMembers.length === 0) {
            Alert.alert('Missing Info', 'Please fill in all fields and select at least one person to split with.');
            return;
        }

        const totalAmount = parseFloat(amount);
        let isValid = true;
        // Validation
        if (splitType === 'PERCENTAGE') {
            let sum = 0;
            selectedMembers.forEach(id => sum += parseFloat(splitValues[id] || '0'));
            if (Math.abs(sum - 100) > 0.1) {
                Alert.alert('Invalid Split', `Percentages must add up to 100%. Current: ${sum.toFixed(1)}%`);
                isValid = false;
            }
        } else if (splitType === 'EXACT') {
            let sum = 0;
            selectedMembers.forEach(id => sum += parseFloat(splitValues[id] || '0'));
            if (Math.abs(sum - totalAmount) > 0.01) {
                Alert.alert('Invalid Split', `Amounts must add up to total (${totalAmount}). Current: ${sum.toFixed(2)}`);
                isValid = false;
            }
        }

        if (!isValid) return;

        try {
            setLoading(true);
            const { data: familyIdData } = await supabase.rpc('get_my_family_id'); // Ensure family ID

            // 1. Calculate Splits
            const splitsToInsert: any[] = [];
            selectedMembers.forEach(memberId => {
                let memberAmount = 0;
                let memberPercentage: number | null = null;

                if (splitType === 'EQUAL') {
                    memberAmount = totalAmount / selectedMembers.length;
                    memberPercentage = 100 / selectedMembers.length;
                } else if (splitType === 'PERCENTAGE') {
                    const percent = parseFloat(splitValues[memberId] || '0');
                    memberAmount = (totalAmount * percent) / 100;
                    memberPercentage = percent;
                } else if (splitType === 'EXACT') {
                    memberAmount = parseFloat(splitValues[memberId] || '0');
                    memberPercentage = (memberAmount / totalAmount) * 100;
                }

                splitsToInsert.push({
                    expense_id: '',
                    profile_id: memberId,
                    amount: memberAmount,
                    percentage: memberPercentage
                });
            });

            // 2. Handle Expense Record
            if (expenseId) {
                // UPDATE
                const { error: updateError } = await supabase.from('expenses').update({
                    description,
                    amount: totalAmount,
                    paid_by: paidBy,
                    date,
                    category
                }).eq('id', expenseId);
                if (updateError) throw updateError;

                // Delete old splits
                await supabase.from('expense_splits').delete().eq('expense_id', expenseId);
                splitsToInsert.forEach(s => s.expense_id = expenseId);

            } else {
                // INSERT
                const { data: expense, error: expenseError } = await supabase.from('expenses').insert({
                    description,
                    amount: totalAmount,
                    paid_by: paidBy,
                    date,
                    category,
                    family_id: familyIdData
                }).select().single();

                if (expenseError) throw expenseError;
                splitsToInsert.forEach(s => s.expense_id = expense.id);
            }

            // 3. Insert Splits
            const { error: splitError } = await supabase.from('expense_splits').insert(splitsToInsert);
            if (splitError) throw splitError;

            navigation.goBack();

        } catch (error: any) {
            console.error(error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    }


    const getValidationResult = () => {
        let isValid = true;
        let message = '';
        let isError = false;

        if (splitType === 'EQUAL') return { isValid: true, message: 'Splits Equally', isError: false };

        let sum = 0;
        selectedMembers.forEach(id => sum += parseFloat(splitValues[id] || '0'));

        if (splitType === 'PERCENTAGE') {
            if (Math.abs(sum - 100) > 0.1) {
                message = `Total: ${sum.toFixed(1)}% (Must be 100%)`;
                isError = true;
                isValid = false;
            } else {
                message = 'Total: 100%';
            }
        } else if (splitType === 'EXACT') {
            const target = parseFloat(amount || '0');
            if (Math.abs(sum - target) > 0.01) {
                message = `Total: ${sum.toFixed(2)} (Must be ${target.toFixed(2)})`;
                isError = true;
                isValid = false;
            } else {
                message = `Total: ${sum.toFixed(2)}`;
            }
        }
        return { isValid, message, isError };
    };

    const validation = getValidationResult();
    const canSave = !loading && (amount && description && selectedMembers.length > 0) && validation.isValid;


    const currency = family?.currency || 'INR';
    const categories = ['General', 'Groceries', 'Food & Dining', 'Utilities', 'Entertainment', 'Transport', 'Kids'];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{expenseId ? 'Edit Expense' : 'Add Expense'}</Text>
                <TouchableOpacity onPress={handleSave} disabled={!canSave}>
                    <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>{loading ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Amount */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Amount ({currency})</Text>
                    <TextInput
                        style={styles.amountInput}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="numeric"
                        placeholder="0.00"
                    />
                </View>

                {/* Description */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Description</Text>
                    <TextInput
                        style={styles.input}
                        value={description}
                        onChangeText={setDescription}
                        placeholder="What is this for?"
                    />
                </View>

                {/* Category & Date Row */}
                <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Category</Text>
                        {/* Simple Select Implementation */}
                        <View style={styles.selectWrapper}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {categories.map(c => (
                                    <TouchableOpacity
                                        key={c}
                                        onPress={() => setCategory(c)}
                                        style={[styles.chip, category === c && styles.chipActive]}
                                    >
                                        <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
                    <TextInput
                        style={styles.input}
                        value={date}
                        onChangeText={setDate}
                        placeholder="YYYY-MM-DD"
                    />
                </View>


                {/* Paid By */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Paid By</Text>
                    <View style={styles.memberRow}>
                        {familyMembers.map(m => (
                            <TouchableOpacity
                                key={m.id}
                                onPress={() => setPaidBy(m.id)}
                                style={[styles.memberChip, paidBy === m.id && styles.memberChipActive]}
                            >
                                <Text style={[styles.memberText, paidBy === m.id && styles.memberTextActive]}>
                                    {m.display_name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Split With */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Split With</Text>
                    <View style={styles.memberRow}>
                        {familyMembers.map(m => (
                            <TouchableOpacity
                                key={m.id}
                                onPress={() => {
                                    if (selectedMembers.includes(m.id)) setSelectedMembers(selectedMembers.filter(id => id !== m.id));
                                    else setSelectedMembers([...selectedMembers, m.id]);
                                }}
                                style={[styles.memberChip, selectedMembers.includes(m.id) && styles.memberChipSelected]}
                            >
                                <Text style={[styles.memberText, selectedMembers.includes(m.id) && styles.memberTextSelected]}>
                                    {m.display_name}
                                </Text>
                                {selectedMembers.includes(m.id) && <Check size={14} color="#1d4ed8" style={{ marginLeft: 4 }} />}
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Split Type Tabs */}
                    <View style={styles.splitTabs}>
                        {(['EQUAL', 'PERCENTAGE', 'EXACT'] as const).map(type => (
                            <TouchableOpacity
                                key={type}
                                onPress={() => setSplitType(type)}
                                style={[styles.splitTab, splitType === type && styles.splitTabActive]}
                            >
                                <Text style={[styles.splitTabText, splitType === type && styles.splitTabTextActive]}>
                                    {type === 'PERCENTAGE' ? '%' : type === 'EXACT' ? '$' : '='} {type}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Custom Split Inputs */}
                    {splitType !== 'EQUAL' && (
                        <View style={styles.customSplitContainer}>

                            {/* Validation / Total Display */}
                            <View style={[styles.validationRow, validation.isError ? styles.validationError : styles.validationSuccess]}>
                                <Text style={[styles.validationText, validation.isError ? styles.textError : styles.textSuccess]}>
                                    {validation.message}
                                </Text>
                            </View>

                            {familyMembers.filter(m => selectedMembers.includes(m.id)).map(m => (
                                <View key={m.id} style={styles.splitRow}>
                                    <Text style={styles.splitName}>{m.display_name}</Text>
                                    <View style={styles.splitInputWrapper}>
                                        <TextInput
                                            style={styles.splitInput}
                                            value={splitValues[m.id] || ''}
                                            onChangeText={text => setSplitValues(prev => ({ ...prev, [m.id]: text }))}
                                            keyboardType="numeric"
                                            placeholder="0"
                                        />
                                        <Text style={styles.splitSuffix}>{splitType === 'PERCENTAGE' ? '%' : currency}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    saveText: { fontSize: 16, fontWeight: 'bold', color: '#4f46e5' },
    saveTextDisabled: { color: '#94a3b8' },
    content: { padding: 20 },

    inputGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 },
    input: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 16, color: '#0f172a' },
    amountInput: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', fontSize: 24, fontWeight: 'bold', color: '#0f172a' },

    row: { flexDirection: 'row', gap: 16 },

    // Chips
    selectWrapper: { flexDirection: 'row' },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    chipActive: { backgroundColor: '#eef2ff', borderColor: '#818cf8' },
    chipText: { fontSize: 14, color: '#64748b' },
    chipTextActive: { color: '#4f46e5', fontWeight: 'bold' },

    memberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    memberChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center' },
    memberChipActive: { backgroundColor: '#eef2ff', borderColor: '#4f46e5' }, // For Paid By
    memberChipSelected: { backgroundColor: '#dbeafe', borderColor: '#2563eb' }, // For Split With
    memberText: { color: '#64748b' },
    memberTextActive: { color: '#4f46e5', fontWeight: 'bold' },
    memberTextSelected: { color: '#1e40af', fontWeight: 'bold' },

    section: { marginTop: 8 },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 12 },

    splitTabs: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 4, borderRadius: 12, marginTop: 12, marginBottom: 12 },
    splitTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
    splitTabActive: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    splitTabText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
    splitTabTextActive: { color: '#0f172a' },

    customSplitContainer: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12 },
    splitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    splitName: { fontSize: 14, color: '#334155', fontWeight: '500' },
    splitInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 8 },
    splitInput: { width: 60, paddingVertical: 4, textAlign: 'right', fontSize: 14, color: '#0f172a' },
    splitSuffix: { marginLeft: 4, color: '#94a3b8', fontSize: 12 },

    validationRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    validationError: {},
    validationSuccess: {},
    validationText: { fontSize: 13, fontWeight: '600' },
    textError: { color: '#ef4444' },
    textSuccess: { color: '#22c55e' }
});
