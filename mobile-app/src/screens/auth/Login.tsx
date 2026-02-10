import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, Image, Linking } from 'react-native';
import { Svg, Path, G } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useNavigation } from '@react-navigation/native';

export default function LoginScreen() {
    const navigation = useNavigation<any>();
    const [isKidLogin, setIsKidLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        try {
            // Initiate OAuth flow
            // Note: User must configure deep linking for 'family-command-center://' or similar scheme
            const { error, data } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: 'family-command-center://google-auth',
                    skipBrowserRedirect: false,
                },
            });

            if (error) throw error;
            if (data?.url) {
                // Open the auth URL manually
                try {
                    await Linking.openURL(data.url);
                } catch (err) {
                    Alert.alert('Error', 'Could not open URL: ' + data.url);
                }
            }
        } catch (error: any) {
            Alert.alert('Google Login Failed', error.message);
        }
    };

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
                    {/* Google Login for Parents */}
                    {!isKidLogin && (
                        <>
                            <TouchableOpacity onPress={handleGoogleLogin} style={styles.googleButton}>
                                <Svg width={24} height={24} viewBox="0 0 24 24">
                                    <Path
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        fill="#4285F4"
                                    />
                                    <Path
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        fill="#34A853"
                                    />
                                    <Path
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26-.19-.58z"
                                        fill="#FBBC05"
                                    />
                                    <Path
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        fill="#EA4335"
                                    />
                                </Svg>
                                <Text style={styles.googleButtonText}>Continue with Google</Text>
                            </TouchableOpacity>

                            <View style={styles.dividerContainer}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>Or continue with email</Text>
                                <View style={styles.dividerLine} />
                            </View>
                        </>
                    )}

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
                    <TouchableOpacity onPress={() => setIsKidLogin(!isKidLogin)} style={styles.switchButton}>
                        <Text style={styles.switchText}>
                            {isKidLogin ? 'Switch to Parent Login' : 'Switch to Kid Login 🧸'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.registerButton}>
                        <Text style={styles.linkText}>
                            Don't have an account? <Text style={styles.linkTextBold}>Sign Up</Text>
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
    switchButton: {
        marginBottom: 24,
    },
    registerButton: {
        padding: 8,
    },
    linkText: {
        color: '#64748b',
        fontSize: 14,
    },
    linkTextBold: {
        color: '#6366f1',
        fontWeight: '600',
    },
    googleButton: {
        backgroundColor: 'white',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 24,
    },
    googleButtonText: {
        color: '#334155',
        fontWeight: '600',
        fontSize: 16,
        marginLeft: 12,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e2e8f0',
    },
    dividerText: {
        marginHorizontal: 16,
        color: '#94a3b8',
        fontSize: 12,
        textTransform: 'uppercase',
        fontWeight: '600',
    },
});
