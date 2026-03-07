import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ShoppingCart, StickyNote, User, ChevronRight, LogOut, Gift } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../components/ui/Card';

export default function MenuScreen() {
    const navigation = useNavigation<any>();
    const { signOut } = useAuth();

    const menuItems = [
        {
            title: 'Rewards',
            icon: Gift,
            color: '#7e22ce',
            bg: '#faf5ff',
            route: 'Rewards'
        },
        {
            title: 'Family Notes',
            icon: StickyNote,
            color: '#b45309',
            bg: '#fffbeb',
            route: 'Notes'
        },
        {
            title: 'My Profile',
            icon: User,
            color: '#6366f1',
            bg: '#e0e7ff',
            route: 'Profile'
        },
    ];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Menu</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.sectionTitle}>Apps</Text>
                {menuItems.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.menuItem}
                        onPress={() => navigation.navigate(item.route)}
                    >
                        <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                            <item.icon size={24} color={item.color} />
                        </View>
                        <Text style={styles.menuText}>{item.title}</Text>
                        <ChevronRight size={20} color="#cbd5e1" />
                    </TouchableOpacity>
                ))}

                <View style={styles.divider} />

                <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut()}>
                    <LogOut size={20} color="#ef4444" />
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>

                <Text style={styles.version}>Version 2.1</Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: 'white' },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    content: { padding: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#64748b', marginBottom: 16 },
    menuItem: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
        padding: 16, borderRadius: 16, marginBottom: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1
    },
    iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    menuText: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1e293b' },
    divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 24 },
    signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#fef2f2', borderRadius: 16 },
    signOutText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
    version: { textAlign: 'center', color: '#94a3b8', marginTop: 24, fontSize: 12 }
});
