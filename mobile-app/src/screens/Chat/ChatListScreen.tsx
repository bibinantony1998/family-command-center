import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { supabase } from '../../lib/supabase';
import { Users, User } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';

// Define navigation prop type since we are navigating to RootStack
type ChatListNavigationProp = StackNavigationProp<RootStackParamList>;

export default function ChatListScreen() {
    const { user, family, profile } = useAuth();
    const navigation = useNavigation<ChatListNavigationProp>();

    const [parents, setParents] = useState<any[]>([]);
    const { unreadCounts, refreshUnreadCounts } = useChat();
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (family?.id && user?.id) {
            fetchParents();
        }
    }, [family?.id, user?.id]);

    const fetchData = async () => {
        setRefreshing(true);
        await Promise.all([fetchParents(), refreshUnreadCounts()]);
        setRefreshing(false);
    };

    const fetchParents = async () => {
        if (!family?.id) return;
        try {
            // Use family_members to be accurate
            const { data } = await supabase
                .from('family_members')
                .select('profile:profiles(*)')
                .eq('family_id', family.id);

            if (data) {
                const parentProfiles = data
                    .map((m: any) => m.profile)
                    .filter((p: any) => p && p.role === 'parent' && p.id !== user?.id);
                setParents(parentProfiles);
            }
        } catch (e) {
            console.error(e);
        }
    };



    const navigateToChat = (recipientId: string | null, name: string) => {
        navigation.navigate('Chat', { recipientId, name });
    };

    const renderHeader = () => (
        <View>
            <TouchableOpacity
                style={styles.groupCard}
                onPress={() => navigateToChat(null, 'Family Board')}
            >
                <View style={[styles.avatarContainer, { backgroundColor: '#e0e7ff', borderColor: '#c7d2fe' }]}>
                    <Users size={24} color="#4f46e5" />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.name}>Family Board</Text>
                    <Text style={styles.subtext}>Group chat for everyone</Text>
                </View>
                {(unreadCounts['GROUP'] || 0) > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{unreadCounts['GROUP']}</Text>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigateToChat(item.id, item.display_name)}
        >
            <View style={styles.avatarContainer}>
                {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                    <View style={[styles.placeholderAvatar, { backgroundColor: '#f1f5f9' }]}>
                        <User size={24} color="#94a3b8" />
                    </View>
                )}
            </View>
            <View style={styles.textContainer}>
                <Text style={styles.name}>{item.display_name || 'Parent'}</Text>
                <Text style={styles.subtext}>Direct Message</Text>
            </View>
            {(unreadCounts[item.id] || 0) > 0 && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCounts[item.id]}</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Messages</Text>
            </View>

            <FlatList
                data={parents}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                ListHeaderComponent={renderHeader}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} />}
                ListEmptyComponent={
                    parents.length === 0 ? (
                        <Text style={styles.emptyText}>No other parents found.</Text>
                    ) : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    content: {
        padding: 16,
        gap: 16,
    },
    groupCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#eef2ff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e0e7ff',
        marginBottom: 16,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 8,
        elevation: 1,
    },
    avatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    placeholderAvatar: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    textContainer: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
    },
    subtext: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    badge: {
        backgroundColor: '#ef4444',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        minWidth: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyText: {
        textAlign: 'center',
        color: '#94a3b8',
        marginTop: 40,
    },
});
