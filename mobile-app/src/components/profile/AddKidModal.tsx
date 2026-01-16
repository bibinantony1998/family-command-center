import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';
import { X } from 'lucide-react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';

interface AddKidModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const AddKidModal: React.FC<AddKidModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { profile, family } = useAuth();
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAddKid = async () => {
        if (!name || !username || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (!family?.id) {
            Alert.alert('Error', 'Family ID not found');
            return;
        }

        setLoading(true);
        try {
            // Create a temporary client to avoid logging out the parent
            const tempSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false,
                },
            });

            // Format username
            let finalEmail = username.replace(/\s+/g, '').toLowerCase();
            if (!finalEmail.endsWith('@kids.fcc')) {
                finalEmail = `${finalEmail}@kids.fcc`;
            }

            const { error, data } = await tempSupabase.auth.signUp({
                email: finalEmail,
                password: password,
                options: {
                    data: {
                        display_name: name,
                        role: 'child',
                        family_id: family.id,
                    },
                },
            });

            if (error) throw error;

            if (data.user) {
                Alert.alert('Success', `Child account for ${name} created!`, [
                    {
                        text: 'OK', onPress: () => {
                            resetForm();
                            onSuccess();
                            onClose();
                        }
                    }
                ]);
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName('');
        setUsername('');
        setPassword('');
    };

    return (
        <Modal visible={isOpen} animationType="slide" transparent>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Add Child Account</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X color="#64748b" size={24} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.form}>
                        <View style={styles.infoBox}>
                            <Text style={styles.infoText}>
                                Create a separate login for your child. They will log in using their username and the family code.
                            </Text>
                        </View>

                        <Input
                            placeholder="Child's Name (e.g. Leo)"
                            value={name}
                            onChangeText={setName}
                        />

                        <Input
                            placeholder="Username"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />

                        <Input
                            placeholder="Password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />

                        <Button
                            title="Create Account"
                            onPress={handleAddKid}
                            isLoading={loading}
                            style={{ marginTop: 12 }}
                        />
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '80%',
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    closeBtn: {
        padding: 4,
    },
    form: {
        gap: 16,
        paddingBottom: 40,
    },
    infoBox: {
        backgroundColor: '#e0e7ff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    infoText: {
        color: '#4338ca',
        fontSize: 14,
        lineHeight: 20,
    },
});
