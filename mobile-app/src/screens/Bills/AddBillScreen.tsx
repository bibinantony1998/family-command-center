import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    TextInput, ActivityIndicator, Alert, Switch
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { createBill } from '../../lib/assets';
import { MOCK_BILLERS, INDIAN_STATES, fetchMockBillFromBBPS, type BillerInfo, type MockBillResponse } from '../../lib/bbps';

type NavProp = StackNavigationProp<RootStackParamList>;
type RoutePropType = RouteProp<RootStackParamList, 'AddBill'>;

const CATEGORY_MAP: Record<string, string> = {
    electricity: 'Electricity',
    water: 'Water',
    gas: 'Gas',
    mobile_postpaid: 'Mobile Postpaid',
    broadband: 'Broadband',
    dth: 'DTH',
};

const CONSUMER_ID_CONFIG: Record<string, { label: string; placeholder: string; hint: string }> = {
    'BESCOM': { label: 'Consumer Number', placeholder: 'e.g. 4001234567', hint: 'Found on your BESCOM bill top-right' },
    'MSEDCL': { label: 'Consumer Number', placeholder: 'e.g. 1234567890', hint: 'Found on top of your MSEDCL bill' },
    'KSEB': { label: 'Consumer Number', placeholder: 'e.g. 2001234567', hint: 'On your KSEB bill, starts with 2' },
    'KSEBL': { label: 'Consumer Number', placeholder: 'e.g. 2001234567', hint: 'On your KSEBL bill, starts with 2' },
    'TPDDL': { label: 'CA Number', placeholder: 'e.g. 302XXXXXXX', hint: '11-digit CA Number on your bill' },
    'BRPL': { label: 'Consumer Account No.', placeholder: 'e.g. 3100XXXXXX', hint: 'On your BSES Rajdhani bill' },
    'BYPL': { label: 'Consumer Account No.', placeholder: 'e.g. 6100XXXXXX', hint: 'On your BSES Yamuna bill' },
    'TANGEDCO': { label: 'Service Connection Number', placeholder: 'e.g. 069000000000', hint: 'SC No. on your TANGEDCO bill' },
    'APEPDCL': { label: 'Service Number', placeholder: 'e.g. 1234567890', hint: 'Service No. on your AP bill' },
    'UPPCL': { label: 'Account Number', placeholder: 'e.g. 12-digit account no.', hint: 'Consumer Account No. on UP bill' },
    'PSPCL': { label: 'Account ID', placeholder: 'e.g. 3214567890', hint: '10-digit Account ID on Punjab bill' },
    'IGL': { label: 'BP Number', placeholder: 'e.g. 10-digit BP No.', hint: 'BP No. on your IGL bill/app' },
    'MGL': { label: 'Consumer Number', placeholder: 'e.g. 10-digit number', hint: 'Consumer No. on your MGL bill' },
    'HPGAS': { label: 'LPG Consumer ID', placeholder: 'e.g. 12-digit ID', hint: 'Found on your HP Gas booklet' },
    'BHARATGAS': { label: 'Consumer No. / CA Number', placeholder: 'e.g. 10-digit number', hint: 'CA No. on your Bharat Gas card' },
    'INDANE': { label: 'Consumer Number', placeholder: 'e.g. 9-digit number', hint: 'Consumer No. on your Indane card' },
    'BWSSB': { label: 'Service Connection No.', placeholder: 'e.g. 10000XXXXX', hint: 'SCN on your BWSSB bill' },
    'DJB': { label: 'Consumer No. (K No.)', placeholder: 'e.g. KX-XXXXXXXX', hint: 'K. No. on your Delhi Jal Board bill' },
    'AIRTEL_BB': { label: 'Account Number', placeholder: 'e.g. 10-digit account no.', hint: 'On your Airtel broadband bill' },
    'JIO_FIBER': { label: 'Account Number', placeholder: 'e.g. 10-digit number', hint: 'Jio Fiber account number' },
    'AIRTEL_POST': { label: 'Mobile Number', placeholder: 'e.g. 10-digit number', hint: 'Your Airtel postpaid mobile number' },
    'JIO_POST': { label: 'Mobile Number', placeholder: 'e.g. 10-digit number', hint: 'Your Jio postpaid mobile number' },
    'VI_POST': { label: 'Mobile Number', placeholder: 'e.g. 10-digit number', hint: 'Your Vi postpaid mobile number' },
    'TATA_PLAY': { label: 'Registered Mobile No.', placeholder: 'e.g. 10-digit number', hint: 'Mobile number registered with Tata Play' },
    'DISH_TV': { label: 'Registered Mobile No.', placeholder: 'e.g. 10-digit number', hint: 'Mobile number registered with Dish TV' },
    'AIRTEL_DTH': { label: 'Registered Mobile No.', placeholder: 'e.g. 10-digit number', hint: 'Mobile number registered with Airtel DTH' },
};

export default function AddBillScreen() {
    const navigation = useNavigation<NavProp>();
    const route = useRoute<RoutePropType>();
    const { user, profile, family } = useAuth() as any;
    const insets = useSafeAreaInsets();

    const initialCategory = (route.params as any)?.category || '';
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedState, setSelectedState] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(CATEGORY_MAP[initialCategory] || '');
    const [selectedBiller, setSelectedBiller] = useState<BillerInfo | null>(null);
    const [consumerNumber, setConsumerNumber] = useState('');
    const [isFetching, setIsFetching] = useState(false);
    const [fetchedBill, setFetchedBill] = useState<MockBillResponse | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [visibility, setVisibility] = useState<'public' | 'personal'>('public');
    const [autoPay, setAutoPay] = useState(false);
    const [billerSearch, setBillerSearch] = useState('');
    const [stateSearch, setStateSearch] = useState('');
    const [categorySearch, setCategorySearch] = useState('');
    const [showBillerPicker, setShowBillerPicker] = useState(false);
    const [showStatePicker, setShowStatePicker] = useState(false);

    const categories = [...new Set(MOCK_BILLERS.map(b => b.biller_category))];

    const filteredBillers = MOCK_BILLERS.filter(b => {
        const catMatch = !selectedCategory || b.biller_category === selectedCategory;
        const stateMatch = !selectedState || b.state === selectedState || b.state === 'National';
        const searchMatch = !billerSearch || b.biller_name.toLowerCase().includes(billerSearch.toLowerCase());
        return catMatch && stateMatch && searchMatch;
    });

    const idConfig = selectedBiller ? CONSUMER_ID_CONFIG[selectedBiller.biller_id] : null;

    const handleFetchBill = async () => {
        if (!selectedBiller || !consumerNumber) {
            Alert.alert('Missing Info', 'Please select a biller and enter consumer number');
            return;
        }
        setIsFetching(true);
        try {
            const bill = await fetchMockBillFromBBPS(selectedBiller.biller_id, consumerNumber);
            setFetchedBill(bill);
            setStep(2);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to fetch bill');
        } finally {
            setIsFetching(false);
        }
    };

    const handleSaveBill = async () => {
        if (!family?.id || !user?.id || !selectedBiller || !fetchedBill) return;
        setIsSaving(true);
        try {
            await createBill(family.id, {
                category: selectedBiller.biller_category.toLowerCase().replace(' ', '_'),
                provider_name: selectedBiller.biller_name,
                consumer_number: consumerNumber,
                due_date: fetchedBill.due_date,
                amount: fetchedBill.amount,
                status: 'pending',
                auto_pay: autoPay,
                visibility,
                added_by: user.id,
            });
            Alert.alert('Success', 'Bill saved successfully!');
            navigation.goBack();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to save bill');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredStates = INDIAN_STATES.filter(s => !stateSearch || s.toLowerCase().includes(stateSearch.toLowerCase()));
    const filteredCategories = categories.filter(c => !categorySearch || c.toLowerCase().includes(categorySearch.toLowerCase()));

    return (
        <View style={styles.container}>
            <View style={[styles.navBar, { paddingTop: insets.top + 16 }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => step === 2 ? setStep(1) : navigation.goBack()}>
                    <ChevronLeft size={28} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.navTitle}>{step === 1 ? 'Add Bill' : 'Confirm Bill'}</Text>
                <View style={{ width: 28 }} />
            </View>

            {/* Step indicators */}
            <View style={styles.stepRow}>
                {[1, 2].map(s => (
                    <View key={s} style={[styles.stepDot, { backgroundColor: step >= s ? '#6366f1' : '#e2e8f0' }]}>
                        <Text style={[styles.stepDotText, { color: step >= s ? 'white' : '#94a3b8' }]}>{s}</Text>
                    </View>
                ))}
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {step === 1 ? (
                    <View style={styles.card}>
                        <Text style={styles.label}>Category</Text>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search category..."
                            value={categorySearch}
                            onChangeText={setCategorySearch}
                        />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                            {filteredCategories.map(cat => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[styles.chip, selectedCategory === cat && styles.chipActive]}
                                    onPress={() => { setSelectedCategory(cat); setSelectedBiller(null); setCategorySearch(''); }}>
                                    <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.label}>State</Text>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search state..."
                            value={stateSearch}
                            onChangeText={setStateSearch}
                        />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                            {filteredStates.slice(0, 15).map(s => (
                                <TouchableOpacity
                                    key={s}
                                    style={[styles.chip, selectedState === s && styles.chipActive]}
                                    onPress={() => { setSelectedState(s); setSelectedBiller(null); setStateSearch(''); }}>
                                    <Text style={[styles.chipText, selectedState === s && styles.chipTextActive]}>{s}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.label}>Search Biller</Text>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name..."
                            value={billerSearch}
                            onChangeText={setBillerSearch}
                        />
                        <View style={styles.billerList}>
                            {filteredBillers.slice(0, 20).map(biller => (
                                <TouchableOpacity
                                    key={biller.biller_id}
                                    style={[styles.billerItem, selectedBiller?.biller_id === biller.biller_id && styles.billerItemActive]}
                                    onPress={() => setSelectedBiller(biller)}>
                                    <Text style={[styles.billerName, selectedBiller?.biller_id === biller.biller_id && { color: '#6366f1' }]}>
                                        {biller.biller_name}
                                    </Text>
                                    <Text style={styles.billerState}>{biller.state}</Text>
                                </TouchableOpacity>
                            ))}
                            {filteredBillers.length > 20 && (
                                <Text style={styles.moreText}>+ {filteredBillers.length - 20} more billers. Refine your search.</Text>
                            )}
                        </View>

                        {selectedBiller && (
                            <>
                                <Text style={[styles.label, { marginTop: 16 }]}>{idConfig?.label || 'Consumer Number'}</Text>
                                {idConfig?.hint && <Text style={styles.hint}>💡 {idConfig.hint}</Text>}
                                <TextInput
                                    style={styles.input}
                                    placeholder={idConfig?.placeholder || 'Enter consumer/account number'}
                                    value={consumerNumber}
                                    onChangeText={setConsumerNumber}
                                    keyboardType="default"
                                />
                            </>
                        )}

                        <TouchableOpacity
                            style={[styles.primaryBtn, (!selectedBiller || !consumerNumber) && styles.primaryBtnDisabled]}
                            onPress={handleFetchBill}
                            disabled={!selectedBiller || !consumerNumber || isFetching}>
                            {isFetching ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>🔍 Fetch Bill from BBPS</Text>}
                        </TouchableOpacity>
                    </View>
                ) : fetchedBill ? (
                    <View style={styles.card}>
                        {fetchedBill.amount === 0 || fetchedBill.status === 'PAID' ? (
                            <View style={styles.paidCard}>
                                <Text style={styles.paidIcon}>✅</Text>
                                <Text style={styles.paidTitle}>No Outstanding Bill</Text>
                                <Text style={styles.paidText}>All previous bills are fully paid for {selectedBiller?.biller_name}</Text>
                            </View>
                        ) : (
                            <>
                                <Text style={styles.confirmTitle}>Confirm Bill</Text>
                                <View style={styles.infoRow}><Text style={styles.infoLabel}>Provider</Text><Text style={styles.infoValue}>{selectedBiller?.biller_name}</Text></View>
                                <View style={styles.infoRow}><Text style={styles.infoLabel}>Consumer ID</Text><Text style={styles.infoValue}>{consumerNumber}</Text></View>
                                <View style={styles.infoRow}><Text style={styles.infoLabel}>Due Date</Text><Text style={styles.infoValue}>{fetchedBill.due_date}</Text></View>
                                <View style={styles.infoRow}><Text style={styles.infoLabel}>Amount</Text><Text style={[styles.infoValue, { fontSize: 22, fontWeight: '800', color: '#0f172a' }]}>₹{fetchedBill.amount}</Text></View>

                                <View style={styles.toggleRow}>
                                    <Text style={styles.toggleLabel}>Visible to whole family</Text>
                                    <Switch
                                        value={visibility === 'public'}
                                        onValueChange={v => setVisibility(v ? 'public' : 'personal')}
                                        trackColor={{ true: '#6366f1' }}
                                    />
                                </View>
                                <View style={styles.toggleRow}>
                                    <Text style={styles.toggleLabel}>Auto-pay enabled</Text>
                                    <Switch value={autoPay} onValueChange={setAutoPay} trackColor={{ true: '#6366f1' }} />
                                </View>

                                <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveBill} disabled={isSaving}>
                                    {isSaving ? <ActivityIndicator color="white" /> : <Text style={styles.primaryBtnText}>💾 Save Bill</Text>}
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                ) : null}
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
    stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingVertical: 12, backgroundColor: 'white' },
    stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    stepDotText: { fontSize: 13, fontWeight: '700' },
    scroll: { flex: 1 },
    card: { backgroundColor: 'white', margin: 16, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
    hint: { fontSize: 12, color: '#6366f1', marginBottom: 8 },
    searchInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, fontSize: 14, marginBottom: 8 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 12 },
    chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9', marginRight: 8, borderWidth: 1, borderColor: '#e2e8f0' },
    chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
    chipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    chipTextActive: { color: 'white' },
    billerList: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, overflow: 'hidden', maxHeight: 280 },
    billerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    billerItemActive: { backgroundColor: '#eef2ff' },
    billerName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
    billerState: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
    moreText: { fontSize: 12, color: '#94a3b8', padding: 10, textAlign: 'center' },
    primaryBtn: { backgroundColor: '#6366f1', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 12 },
    primaryBtnDisabled: { backgroundColor: '#cbd5e1' },
    primaryBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
    confirmTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 16 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    infoLabel: { fontSize: 14, color: '#64748b' },
    infoValue: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    toggleLabel: { fontSize: 14, color: '#374151', fontWeight: '500' },
    paidCard: { alignItems: 'center', padding: 24 },
    paidIcon: { fontSize: 48, marginBottom: 12 },
    paidTitle: { fontSize: 20, fontWeight: '700', color: '#065f46', marginBottom: 6 },
    paidText: { fontSize: 14, color: '#64748b', textAlign: 'center' },
});
