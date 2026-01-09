import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Image } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen() {
    const [isKidLogin, setIsKidLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!password || (!email && !isKidLogin)) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            let finalEmail = email;

            if (isKidLogin) {
                let cleanUser = email.replace(/\s+/g, '').toLowerCase();
                if (!cleanUser.endsWith('@kids.fcc')) {
                    cleanUser = `${cleanUser}@kids.fcc`;
                }
                finalEmail = cleanUser;
            }

            const { error } = await supabase.auth.signInWithPassword({
                email: finalEmail,
                password,
            });

            if (error) throw error;
        } catch (error: any) {
            Alert.alert('Login Failed', error.message);
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
                    <Text style={styles.title}>Family Command Center</Text>
                    <Text style={styles.subtitle}>
                        {isKidLogin ? 'Kid Login 🎮' : 'Parent Login'}
                    </Text>
                </View>

                <View style={styles.form}>
                    <Input
                        placeholder={isKidLogin ? "Username" : "Email"}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType={isKidLogin ? 'default' : 'email-address'}
                    />

                    <Input
                        placeholder="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <Button
                        title={isKidLogin ? 'Start Playing!' : 'Log In'}
                        onPress={handleLogin}
                        isLoading={loading}
                    />
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity onPress={() => setIsKidLogin(!isKidLogin)}>
                        <Text style={styles.switchText}>
                            {isKidLogin ? 'Switch to Parent Login' : 'Switch to Kid Login 🧸'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logo: {
        width: 120,
        height: 120,
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1e293b',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
    },
    form: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
    },
    footer: {
        marginTop: 24,
        alignItems: 'center',
    },
    switchText: {
        color: '#6366f1',
        fontWeight: '600',
        fontSize: 15,
    },
});
