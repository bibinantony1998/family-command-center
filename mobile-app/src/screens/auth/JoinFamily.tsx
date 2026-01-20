import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

export default function JoinFamilyScreen() {
    const { user, refreshProfile, signOut, myFamilies } = useAuth();
    const navigation = useNavigation<StackNavigationProp<any>>();
    const [mode, setMode] = useState<'join' | 'create'>('join');
    const [familyName, setFamilyName] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSuccess = () => {
        // Check if we had families BEFORE the new one was added (using stale closure state)
        if (myFamilies && myFamilies.length > 0) {
            // Already had families, so we are in the Main stack. Go back to Profile.
            navigation.navigate('Profile');
        } else {
            // This was the first family.
            // Explicitly navigate to Main because JoinFamily exists in both navigators
            // so React Navigation might not auto-switch us away.
            navigation.replace('Main');
        }
    };

    const handleCreate = async () => {
        if (!familyName) return;
        setLoading(true);
        try {
            const generatedKey = Math.random().toString(36).substring(2, 8).toUpperCase();

            // 1. Create Family
            const { data: family, error: familyError } = await supabase
                .from('families')
                .insert([{ name: familyName, secret_key: generatedKey }])
                .select()
                .single();

            if (familyError) throw familyError;

            // 2. Add as Member (Parent) & Set Current Family
            if (user && family) {
                // Insert into family_members
                const { error: memberError } = await supabase
                    .from('family_members')
                    .insert({
                        profile_id: user.id,
                        family_id: family.id,
                        role: 'parent'
                    });

                if (memberError) {
                    console.error("Error adding member:", memberError);
                }

                // Update Profile Context
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        current_family_id: family.id,
                        family_id: family.id // Keep legacy sync
                    })
                    .eq('id', user.id);

                if (profileError) throw profileError;

                await refreshProfile();
                handleSuccess();
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
            const { data, error } = await supabase.rpc('join_family_by_code', {
                secret_key_input: secretKey
            });

            if (error) throw error;

            if (data && !data.success) {
                throw new Error(data.error || 'Failed to join family');
            }

            await refreshProfile();
            handleSuccess();
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
                    <Text style={styles.title}>Welcome!</Text>
                    <Text style={styles.subtitle}>Join your family or create a new one to get started.</Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.tabs}>
                        <TouchableOpacity
                            style={[styles.tab, mode === 'join' && styles.activeTab]}
                            onPress={() => setMode('join')}
                        >
                            <Text style={[styles.tabText, mode === 'join' && styles.activeTabText]}>Join Family</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, mode === 'create' && styles.activeTab]}
                            onPress={() => setMode('create')}
                        >
                            <Text style={[styles.tabText, mode === 'create' && styles.activeTabText]}>Create New</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.form}>
                        {mode === 'join' ? (
                            <>
                                <Input
                                    label="Family Secret Key"
                                    placeholder="Enter 6-character key"
                                    value={secretKey}
                                    onChangeText={(t) => setSecretKey(t.toUpperCase())}
                                    autoCapitalize="characters"
                                />
                                <Text style={styles.helperText}>Ask your family member for the key found in their profile.</Text>
                                <Button
                                    title="Join Family"
                                    onPress={handleJoin}
                                    isLoading={loading}
                                />
                            </>
                        ) : (
                            <>
                                <Input
                                    label="Family Name"
                                    placeholder=" The Smiths"
                                    value={familyName}
                                    onChangeText={setFamilyName}
                                />
                                <Button
                                    title="Create Family"
                                    onPress={handleCreate}
                                    isLoading={loading}
                                />
                            </>
                        )}
                    </View>
                </View>

                <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    header: { alignItems: 'center', marginBottom: 30 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#64748b', textAlign: 'center' },
    card: { backgroundColor: 'white', borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, overflow: 'hidden' },
    tabs: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 4 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 16 },
    activeTab: { backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
    tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
    activeTabText: { color: '#4f46e5' },
    form: { padding: 24, gap: 16 },
    helperText: { fontSize: 12, color: '#94a3b8', marginTop: -12, marginBottom: 8 },
    signOutBtn: { marginTop: 24, padding: 12, alignItems: 'center' },
    signOutText: { color: '#ef4444', fontWeight: '600' }
});
