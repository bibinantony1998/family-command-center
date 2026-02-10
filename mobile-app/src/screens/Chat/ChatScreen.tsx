import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ChatMessage } from '../../types/schema';
import { KeyManager } from '../../lib/encryption';
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
    const counterpartKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (!family?.id) return;

        const initEncryptionAndFetch = async () => {
            // Initialize encryption keys
            if (user?.id) {
                await KeyManager.initialize(user.id);
            }
            // Fetch counterpart's public key for DMs
            if (recipientId) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('public_key')
                    .eq('id', recipientId)
                    .single();
                counterpartKeyRef.current = profileData?.public_key || null;
            }
            await fetchMessages();
            markAsRead();
        };
        initEncryptionAndFetch();

        const channel = supabase
            .channel(`chat:${recipientId || 'group'}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'chat_messages', filter: `family_id=eq.${family.id}` },
                async (payload) => {
                    const eventType = payload.eventType;
                    const newMsg = payload.new as ChatMessage;
                    const oldMsg = payload.old as ChatMessage;

                    if (eventType === 'INSERT') {
                        // Filter: Only add if it belongs to this chat context
                        let isRelevant = false;
                        if (recipientId) {
                            const isFromCounterpart = newMsg.sender_id === recipientId && newMsg.recipient_id === user?.id;
                            const isFromMeToCounterpart = newMsg.sender_id === user?.id && newMsg.recipient_id === recipientId;
                            if (isFromCounterpart || isFromMeToCounterpart) {
                                isRelevant = true;
                            }
                        } else {
                            if (newMsg.recipient_id === null) {
                                isRelevant = true;
                            }
                        }

                        if (isRelevant) {
                            // Decrypt if encrypted
                            let processedMsg = newMsg;
                            if (newMsg.is_encrypted && counterpartKeyRef.current) {
                                try {
                                    const decrypted = await KeyManager.decryptMessage(newMsg.content, counterpartKeyRef.current);
                                    processedMsg = { ...newMsg, content: decrypted };
                                } catch (e) {
                                    processedMsg = { ...newMsg, content: '🔒 Unable to decrypt' };
                                }
                            }
                            setMessages((prev) => {
                                if (prev.some(m => m.id === processedMsg.id)) return prev;
                                const updated = [...prev, processedMsg];
                                if (processedMsg.sender_id !== user?.id) {
                                    markAsRead();
                                }
                                return updated;
                            });
                            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                        }
                    } else if (eventType === 'DELETE') {
                        setMessages((prev) => prev.filter(m => m.id !== oldMsg.id));
                    } else if (eventType === 'UPDATE') {
                        // Preserve decrypted content, only update metadata
                        setMessages((prev) => prev.map(m => {
                            if (m.id === newMsg.id) {
                                const { content: _enc, ...metadata } = newMsg;
                                return { ...m, ...metadata };
                            }
                            return m;
                        }));
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
            .order('created_at', { ascending: true });

        if (recipientId) {
            query = query.or(`and(sender_id.eq.${user?.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user?.id})`);
        } else {
            query = query.is('recipient_id', null);
        }

        const { data, error } = await query;
        if (data) {
            // Decrypt encrypted messages
            const processed = await Promise.all((data as ChatMessage[]).map(async (msg: ChatMessage) => {
                if (msg.is_encrypted && counterpartKeyRef.current) {
                    try {
                        const decrypted = await KeyManager.decryptMessage(msg.content, counterpartKeyRef.current);
                        return { ...msg, content: decrypted };
                    } catch (e) {
                        return { ...msg, content: '🔒 Unable to decrypt' };
                    }
                }
                return msg;
            }));
            setMessages(processed as any);
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

        let finalContent = content;
        let isEncrypted = false;

        // Encrypt for DMs if counterpart key is available
        if (recipientId && counterpartKeyRef.current) {
            try {
                finalContent = await KeyManager.encryptMessage(content, counterpartKeyRef.current);
                isEncrypted = true;
            } catch (e) {
                console.error('Encryption failed, sending plaintext:', e);
            }
        }

        const { error } = await supabase.from('chat_messages').insert({
            family_id: family.id,
            sender_id: user.id,
            recipient_id: recipientId,
            content: finalContent,
            is_encrypted: isEncrypted,
            read_by: [user.id]
        });

        if (error) {
            Alert.alert('Error', 'Failed to send');
            setInputText(content); // Restore
        }
        setSending(false);
    };

    const handleDeleteMessage = async (message: ChatMessage) => {
        if (message.sender_id !== user?.id) return;

        Alert.alert(
            "Delete Message",
            "Are you sure you want to delete this message?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        const { error } = await supabase
                            .from('chat_messages')
                            .delete()
                            .eq('id', message.id);

                        if (error) Alert.alert("Error", "Could not delete message");
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
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
                            onLongPress={handleDeleteMessage}
                        />
                    )}
                    contentContainerStyle={styles.listContent}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
                    style={{ flex: 1 }}
                />

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
