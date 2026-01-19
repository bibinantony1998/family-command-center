import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ChatMessage } from '../../types/schema';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { Send, ArrowLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

export default function ChatScreen() {
    const { user, family } = useAuth();
    const navigation = useNavigation();
    const route = useRoute<ChatScreenRouteProp>();

    // Params might be undefined if not strictly typed in some nav setups, safe check
    const recipientId = route.params?.recipientId || null;
    const name = route.params?.name || 'Chat';

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        if (!family?.id) return;

        fetchMessages();
        markAsRead();

        const channel = supabase
            .channel(`chat:${recipientId || 'group'}`)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `family_id=eq.${family.id}` },
                (payload) => {
                    const newMsg = payload.new as ChatMessage;

                    // Filter: Only add if it belongs to this chat context
                    let isRelevant = false;
                    if (recipientId) {
                        // DM: Sender is recipient, OR Recipient is recipient (my sent msg from other device)
                        // AND Sender is ME
                        // Actually:
                        // If I am viewing DM with User B:
                        // Show msgs where (sender=Me AND recipient=B) OR (sender=B AND recipient=Me)
                        const isFromCounterpart = newMsg.sender_id === recipientId && newMsg.recipient_id === user?.id;
                        const isFromMeToCounterpart = newMsg.sender_id === user?.id && newMsg.recipient_id === recipientId;
                        if (isFromCounterpart || isFromMeToCounterpart) {
                            isRelevant = true;
                        }
                    } else {
                        // Group: recipient is NULL
                        if (newMsg.recipient_id === null) {
                            isRelevant = true;
                        }
                    }

                    if (isRelevant) {
                        setMessages((prev) => {
                            if (prev.some(m => m.id === newMsg.id)) return prev;
                            const updated = [...prev, newMsg];
                            // Mark read immediately if relevant
                            if (newMsg.sender_id !== user?.id) {
                                markAsRead();
                            }
                            return updated;
                        });
                        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [family?.id, recipientId]);

    const fetchMessages = async () => {
        if (!family?.id) return;

        let query = supabase
            .from('chat_messages')
            .select('*, sender:profiles!sender_id(display_name, avatar_url)')
            .eq('family_id', family.id)
            .order('created_at', { ascending: true }); // Oldest first for chat log

        if (recipientId) {
            // DM
            query = query.or(`and(sender_id.eq.${user?.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user?.id})`);
        } else {
            // Group
            query = query.is('recipient_id', null);
        }

        const { data, error } = await query;
        if (data) {
            setMessages(data as any);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
        }
    };

    const markAsRead = async () => {
        if (!family?.id) return;

        const { error } = await supabase.rpc('mark_messages_read', {
            p_family_id: family.id,
            p_recipient_id: recipientId
        });

        if (error) console.error('Error marking read:', error);
    };

    const handleSend = async () => {
        if (!inputText.trim() || !family?.id || !user?.id) return;
        setSending(true);

        const content = inputText.trim();
        setInputText(''); // Optimistic clear

        const { error } = await supabase.from('chat_messages').insert({
            family_id: family.id,
            sender_id: user.id,
            recipient_id: recipientId,
            content: content,
            read_by: [user.id]
        });

        if (error) {
            Alert.alert('Error', 'Failed to send');
            setInputText(content); // Restore
        }
        setSending(false);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color="#0f172a" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{name}</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <MessageBubble
                        message={item}
                        isOwn={item.sender_id === user?.id}
                        showSenderName={!recipientId && item.sender_id !== user?.id}
                    />
                )}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
            >
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type a message..."
                        placeholderTextColor="#94a3b8"
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.disabledButton]}
                        onPress={handleSend}
                        disabled={!inputText.trim() || sending}
                    >
                        {sending ? <ActivityIndicator color="white" size="small" /> : <Send color="white" size={20} />}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        backgroundColor: 'white',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        backgroundColor: 'white',
    },
    input: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
        color: '#0f172a',
        maxHeight: 100,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#6366f1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#cbd5e1',
    },
});
