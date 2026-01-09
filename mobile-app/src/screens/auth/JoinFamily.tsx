import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';

export default function JoinFamilyScreen() {
    const { user, refreshProfile, signOut } = useAuth();
    const [mode, setMode] = useState<'join' | 'create'>('join');
    const [familyName, setFamilyName] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!familyName) return;
        setLoading(true);
        try {
            const generatedKey = Math.random().toString(36).substring(2, 8).toUpperCase();

            const { data: family, error: familyError } = await supabase
                .from('families')
                .insert([{ name: familyName, secret_key: generatedKey }])
                .select()
                .maybeSingle();

            if (familyError) throw familyError;
            if (!family) throw new Error("Family created but could not retrieve data.");

            if (user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ family_id: family.id })
                    .eq('id', user.id);

                if (profileError) throw profileError;

                await refreshProfile();
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!secretKey) return;
        setLoading(true);
        try {
            const { data: family, error: familyError } = await supabase
                .from('families')
                .select('*')
                .eq('secret_key', secretKey)
                .maybeSingle();

            if (familyError) throw familyError;
            if (!family) throw new Error('Invalid Secret Key');

            if (user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ family_id: family.id })
                    .eq('id', user.id);

                if (profileError) throw profileError;

                await refreshProfile();
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>Setup Family</Text>
                    <Text style={styles.subtitle}>Join an existing family or start a new one.</Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.toggleContainer}>
                        <TouchableOpacity
                            style={[styles.toggleButton, mode === 'join' && styles.activeToggle]}
                            onPress={() => setMode('join')}
                        >
                            <Text style={[styles.toggleText, mode === 'join' && styles.activeToggleText]}>Join Family</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.toggleButton, mode === 'create' && styles.activeToggle]}
                            onPress={() => setMode('create')}
                        >
                            <Text style={[styles.toggleText, mode === 'create' && styles.activeToggleText]}>Create New</Text>
                        </TouchableOpacity>
                    </View>

                    {mode === 'join' ? (
                        <View style={styles.form}>
                            <Input
                                label="Family Secret Key"
                                placeholder="Enter 6-character key"
                                value={secretKey}
                                onChangeText={(t) => setSecretKey(t.toUpperCase())}
                            />
                            <Text style={styles.hint}>Ask your family member for the key.</Text>
                            <Button title="Join Family" onPress={handleJoin} isLoading={loading} style={styles.marginTop} />
                        </View>
                    ) : (
                        <View style={styles.form}>
                            <Input
                                label="Family Name"
                                placeholder="The Smiths"
                                value={familyName}
                                onChangeText={setFamilyName}
                            />
                            <Button title="Create Family" onPress={handleCreate} isLoading={loading} style={styles.marginTop} />
                        </View>
                    )}
                </View>

                <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
                    <Text style={styles.logoutText}>Sign Out</Text>
                </TouchableOpacity>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    header: { alignItems: 'center', marginBottom: 32 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#64748b', textAlign: 'center' },
    card: { backgroundColor: 'white', padding: 24, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
    toggleContainer: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 24 },
    toggleButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    activeToggle: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    toggleText: { color: '#64748b', fontWeight: '500' },
    activeToggleText: { color: '#6366f1' },
    form: {},
    hint: { fontSize: 12, color: '#94a3b8', marginTop: -12, marginBottom: 16 },
    marginTop: { marginTop: 16 },
    logoutButton: { marginTop: 24, alignItems: 'center' },
    logoutText: { color: '#ef4444', fontWeight: '600' }
});
