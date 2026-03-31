import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { createAsset } from '../../lib/assets';

type NavProp = StackNavigationProp<RootStackParamList>;

const VEHICLE_FIELDS = [
    { key: 'name', label: 'Name / Nickname', placeholder: 'e.g. Family Car' },
    { key: 'make', label: 'Make', placeholder: 'e.g. Maruti, Hyundai' },
    { key: 'model', label: 'Model', placeholder: 'e.g. Swift, Creta' },
    { key: 'year', label: 'Year', placeholder: 'e.g. 2022', keyboardType: 'numeric' as const },
    { key: 'registration_number', label: 'Registration Number', placeholder: 'e.g. KA 01 AB 1234' },
    { key: 'fuel_type', label: 'Fuel Type', placeholder: 'Petrol / Diesel / EV' },
];

const PROPERTY_FIELDS = [
    { key: 'name', label: 'Name / Nickname', placeholder: 'e.g. Home, Plot' },
    { key: 'address', label: 'Address', placeholder: 'Full address' },
    { key: 'type', label: 'Property Type', placeholder: 'Apartment / House / Plot / Commercial' },
    { key: 'area', label: 'Area (sq ft)', placeholder: 'e.g. 1200', keyboardType: 'numeric' as const },
    { key: 'market_value', label: 'Approx. Market Value (₹)', placeholder: 'e.g. 5000000', keyboardType: 'numeric' as const },
    { key: 'purchase_year', label: 'Purchase Year', placeholder: 'e.g. 2020', keyboardType: 'numeric' as const },
];

const OTHER_FIELDS = [
    { key: 'name', label: 'Item Name', placeholder: 'e.g. Gold Jewellery' },
    { key: 'description', label: 'Description', placeholder: 'Brief description' },
    { key: 'estimated_value', label: 'Estimated Value (₹)', placeholder: 'e.g. 200000', keyboardType: 'numeric' as const },
];

export default function AddAssetScreen() {
    const navigation = useNavigation<NavProp>();
    const { user, family } = useAuth() as any;
    const insets = useSafeAreaInsets();
    const [assetType, setAssetType] = useState<'vehicle' | 'property' | 'other'>('vehicle');
    const [fields, setFields] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    const fieldDefs = assetType === 'vehicle' ? VEHICLE_FIELDS : assetType === 'property' ? PROPERTY_FIELDS : OTHER_FIELDS;

    const handleSave = async () => {
        if (!family?.id || !user?.id) return;
        if (!fields.name) { Alert.alert('Required', 'Please enter a name for this asset'); return; }
        setIsSaving(true);
        try {
            await createAsset(family.id, { type: assetType, details: fields }, user.id);
            Alert.alert('Success', 'Asset saved successfully!');
            navigation.goBack();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to save asset');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={[styles.navBar, { paddingTop: insets.top + 16 }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <ChevronLeft size={28} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.navTitle}>Add Asset</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Asset Type</Text>
                    <View style={styles.typeRow}>
                        {([['vehicle', '🚗', 'Vehicle'], ['property', '🏠', 'Property'], ['other', '📦', 'Other']] as const).map(([type, icon, label]) => (
                            <TouchableOpacity
                                key={type}
                                style={[styles.typeBtn, assetType === type && styles.typeBtnActive]}
                                onPress={() => { setAssetType(type); setFields({}); }}>
                                <Text style={{ fontSize: 24, marginBottom: 4 }}>{icon}</Text>
                                <Text style={[styles.typeBtnLabel, assetType === type && { color: '#6366f1' }]}>{label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>{assetType.charAt(0).toUpperCase() + assetType.slice(1)} Details</Text>
                    {fieldDefs.map(field => (
                        <View key={field.key} style={styles.fieldGroup}>
                            <Text style={styles.label}>{field.label}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={field.placeholder}
                                value={fields[field.key] || ''}
                                onChangeText={v => setFields(prev => ({ ...prev, [field.key]: v }))}
                                keyboardType={field.keyboardType || 'default'}
                            />
                        </View>
                    ))}
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator color="white" /> : <Text style={styles.saveBtnText}>💾 Save Asset</Text>}
                </TouchableOpacity>
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
    scroll: { flex: 1 },
    card: { backgroundColor: 'white', margin: 16, marginBottom: 0, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
    typeRow: { flexDirection: 'row', gap: 12 },
    typeBtn: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    typeBtnActive: { backgroundColor: '#eef2ff', borderColor: '#6366f1' },
    typeBtnLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
    fieldGroup: { marginBottom: 12 },
    label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 5 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 15 },
    saveBtn: { backgroundColor: '#6366f1', margin: 16, borderRadius: 14, padding: 16, alignItems: 'center' },
    saveBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
});
