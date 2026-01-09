import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { LogOut, User, Shield, CreditCard, Users } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

export default function ProfileScreen() {
    const { profile, user, signOut } = useAuth();
    const [loading, setLoading] = useState(false);
    const navigation = useNavigation();

    const handleSignOut = async () => {
        setLoading(true);
        try {
            await signOut();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {profile?.display_name?.charAt(0).toUpperCase() || 'U'}
                    </Text>
                </View>
                <Text style={styles.name}>{profile?.display_name}</Text>
                <Text style={styles.role}>{profile?.role === 'parent' ? 'Parent / Admin' : 'Child Account'}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account</Text>
                <Card style={styles.card}>
                    <View style={styles.row}>
                        <View style={styles.rowIcon}>
                            <User size={20} color="#64748b" />
                        </View>
                        <View style={styles.rowContent}>
                            <Text style={styles.label}>Email / Username</Text>
                            <Text style={styles.value}>{user?.email || profile?.display_name || 'N/A'}</Text>
                        </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.row}>
                        <View style={styles.rowIcon}>
                            <Users size={20} color="#64748b" />
                        </View>
                        <View style={styles.rowContent}>
                            <Text style={styles.label}>Family ID</Text>
                            <Text style={styles.value}>{profile?.family_id || 'Not Joined'}</Text>
                        </View>
                    </View>
                </Card>
            </View>

            <View style={styles.section}>
                <Button
                    title="Sign Out"
                    onPress={handleSignOut}
                    variant="destructive"
                    isLoading={loading}
                    style={styles.signOutBtn}
                />
                <Button
                    title="Back"
                    onPress={() => navigation.goBack()}
                    variant="ghost"
                    style={{ marginTop: 12 }}
                />
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
    header: { alignItems: 'center', marginTop: 40, marginBottom: 40 },
    avatar: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: '#e0e7ff',
        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
        borderWidth: 4, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10
    },
    avatarText: { fontSize: 32, fontWeight: 'bold', color: '#6366f1' },
    name: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    role: { fontSize: 16, color: '#64748b', marginTop: 4 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
    card: { padding: 0, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    rowContent: { flex: 1 },
    label: { fontSize: 12, color: '#64748b', marginBottom: 2 },
    value: { fontSize: 16, color: '#1e293b', fontWeight: '500' },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginLeft: 72 },
    signOutBtn: { marginTop: 8 }
});
