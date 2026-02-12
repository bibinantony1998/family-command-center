import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ChatMessage } from '../../types/schema';
import { KeyManager, DeviceKey } from '../../lib/encryption';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { Send, ArrowLeft, Paperclip } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import { usePresence } from '../../hooks/usePresence';
import { launchImageLibrary } from 'react-native-image-picker';
import { sendFileP2P, listenForIncomingFiles } from '../../lib/webrtcTransfer';
import { queueAttachment, getQueuedAttachments, drainQueueForRecipient, setOnQueueDrain } from '../../lib/attachmentQueue';
import { useChat } from '../../context/ChatContext';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

export default function ChatScreen() {
    const { user, family } = useAuth();
    const { refreshUnreadCounts } = useChat();
    const navigation = useNavigation();
    const route = useRoute<ChatScreenRouteProp>();

    const recipientId = route.params?.recipientId || null;
    const name = route.params?.name || 'Chat';

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [transferProgress, setTransferProgress] = useState<number | null>(null);
    const flatListRef = useRef<FlatList>(null);
    const PAGE_SIZE = 20;

    const isDM = recipientId !== null;
    const { isUserOnline } = usePresence(family?.id || null, user?.id || null);
    const isRecipientOnline = recipientId ? isUserOnline(recipientId) : false;

    // Multi-device: store ALL device keys for recipient + sender
    const recipientDeviceKeysRef = useRef<DeviceKey[]>([]);
    const senderDeviceKeysRef = useRef<DeviceKey[]>([]);
    // Map of deviceId -> publicKey for quick lookup during decryption
    const deviceKeyMapRef = useRef<Map<string, string>>(new Map());

    /**
     * Decrypt a message using the appropriate strategy:
     * - New multi-device format: has encrypted_keys
     * - Legacy single-key format: no encrypted_keys
     */
    const decryptMessage = async (msg: ChatMessage): Promise<ChatMessage> => {
        if (!msg.is_encrypted) return msg;

        try {
            // New multi-device format
            if (msg.encrypted_keys && Object.keys(msg.encrypted_keys).length > 0) {
                // Find sender's device public key
                let senderDevicePubKey = msg.sender_device_id
                    ? deviceKeyMapRef.current.get(msg.sender_device_id)
                    : null;

                if (!senderDevicePubKey && msg.sender_device_id) {
                    // Try to fetch the sender's device key
                    const { data } = await supabase
                        .from('user_devices')
                        .select('public_key')
                        .eq('device_id', msg.sender_device_id)
                        .single();

                    if (data?.public_key) {
                        deviceKeyMapRef.current.set(msg.sender_device_id, data.public_key);
                        senderDevicePubKey = data.public_key;
                    }
                }

                if (!senderDevicePubKey) {
                    return { ...msg, content: '🔒 Encrypted on another device' };
                }

                const decrypted = await KeyManager.decryptMultiDevice(
                    msg.content, msg.encrypted_keys, senderDevicePubKey
                );
                return { ...msg, content: decrypted };
            }

            // Legacy format: try old single-key decryption
            const { data: profileData } = await supabase
                .from('profiles')
                .select('public_key')
                .eq('id', msg.sender_id)
                .single();

            if (profileData?.public_key) {
                const decrypted = await KeyManager.decryptLegacy(msg.content, profileData.public_key);
                return { ...msg, content: decrypted };
            }

            return { ...msg, content: '🔒 Encrypted on another device' };
        } catch {
            return { ...msg, content: '🔒 Unable to decrypt' };
        }
    };

    useEffect(() => {
        if (!family?.id) return;

        const initEncryptionAndFetch = async () => {
            // Initialize encryption keys & register device
            if (user?.id) {
                await KeyManager.initialize(user.id);
            }

            // Fetch device keys for DM counterpart and self
            if (recipientId && user?.id) {
                const [recipientKeys, senderKeys] = await Promise.all([
                    KeyManager.fetchDeviceKeys(recipientId),
                    KeyManager.fetchDeviceKeys(user.id)
                ]);
                recipientDeviceKeysRef.current = recipientKeys;
                senderDeviceKeysRef.current = senderKeys;

                // Build device key map for decryption
                const map = new Map<string, string>();
                [...recipientKeys, ...senderKeys].forEach(dk => {
                    map.set(dk.device_id, dk.public_key);
                });
                deviceKeyMapRef.current = map;
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
                            // Decrypt the new message
                            const processedMsg = await decryptMessage(newMsg);

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
            .order('created_at', { ascending: false })
            .range(0, PAGE_SIZE - 1);

        if (recipientId) {
            query = query.or(`and(sender_id.eq.${user?.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user?.id})`);
        } else {
            query = query.is('recipient_id', null);
        }

        const { data, error } = await query;
        if (data) {
            const rawMessages = (data as ChatMessage[]).reverse();
            const processed = await Promise.all(rawMessages.map(decryptMessage));
            setMessages(processed as any);
            setHasMore(data.length >= PAGE_SIZE);
            // Only scroll to end on initial load
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
        }
    };

    const loadMoreMessages = async () => {
        if (!family?.id || loadingMore || !hasMore) return;
        setLoadingMore(true);

        try {
            const offset = messages.length;
            let query = supabase
                .from('chat_messages')
                .select('*, sender:profiles!sender_id(display_name, avatar_url)')
                .eq('family_id', family.id)
                .order('created_at', { ascending: false })
                .range(offset, offset + PAGE_SIZE - 1);

            if (recipientId) {
                query = query.or(`and(sender_id.eq.${user?.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user?.id})`);
            } else {
                query = query.is('recipient_id', null);
            }

            const { data } = await query;
            if (data && data.length > 0) {
                const rawMessages = (data as ChatMessage[]).reverse();
                const processed = await Promise.all(rawMessages.map(decryptMessage));
                setMessages(prev => [...(processed as any), ...prev]);
                setHasMore(data.length >= PAGE_SIZE);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error('Error loading more messages:', error);
        } finally {
            setLoadingMore(false);
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
        setInputText('');

        let finalContent = content;
        let isEncrypted = false;
        let encrypted_keys: Record<string, string> | null = null;
        const senderDeviceId = KeyManager.getDeviceId();

        // Multi-device encrypt for DMs — always fetch fresh device keys
        if (recipientId) {
            try {
                const [freshRecipientKeys, freshSenderKeys] = await Promise.all([
                    KeyManager.fetchDeviceKeys(recipientId),
                    KeyManager.fetchDeviceKeys(user.id)
                ]);

                // Update refs and map for future decryption
                recipientDeviceKeysRef.current = freshRecipientKeys;
                senderDeviceKeysRef.current = freshSenderKeys;
                const map = new Map<string, string>();
                [...freshRecipientKeys, ...freshSenderKeys].forEach(dk => {
                    map.set(dk.device_id, dk.public_key);
                });
                deviceKeyMapRef.current = map;

                const allDeviceKeys = [...freshRecipientKeys, ...freshSenderKeys];

                if (allDeviceKeys.length > 0) {
                    const result = await KeyManager.encryptForDevices(content, allDeviceKeys);
                    finalContent = result.content;
                    encrypted_keys = result.encrypted_keys;
                    isEncrypted = true;
                }
            } catch (e) {
                console.error('Multi-device encryption failed, sending plaintext:', e);
            }
        }

        const { error } = await supabase.from('chat_messages').insert({
            family_id: family.id,
            sender_id: user.id,
            recipient_id: recipientId,
            content: finalContent,
            is_encrypted: isEncrypted,
            encrypted_keys: encrypted_keys,
            sender_device_id: senderDeviceId,
            read_by: [user.id]
        });

        if (error) {
            Alert.alert('Error', 'Failed to send');
            setInputText(content);
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

                        if (error) {
                            Alert.alert("Error", "Could not delete message");
                        } else {
                            setMessages(prev => prev.filter(m => m.id !== message.id));
                            refreshUnreadCounts();
                        }
                    }
                }
            ]
        );
    };

    // --- ATTACHMENT HANDLING ---
    const handleAttachmentPick = useCallback(async () => {
        if (!recipientId || !user?.id || !family?.id) return;

        const result = await launchImageLibrary({
            mediaType: 'mixed',
            quality: 0.8,
        });

        if (result.didCancel || !result.assets?.[0]) return;
        const asset = result.assets[0];
        if (!asset.uri || !asset.fileName) return;

        let fileType: 'image' | 'video' | 'audio';
        if (asset.type?.startsWith('image/')) fileType = 'image';
        else if (asset.type?.startsWith('video/')) fileType = 'video';
        else if (asset.type?.startsWith('audio/')) fileType = 'audio';
        else {
            Alert.alert('Unsupported', 'Only images, videos, and audio files are supported.');
            return;
        }

        const fileSize = asset.fileSize || 0;

        if (isRecipientOnline) {
            setTransferProgress(0);
            const success = await sendFileP2P(
                asset.uri, asset.fileName, fileType, fileSize,
                user.id, recipientId, family.id,
                (p: number) => setTransferProgress(p)
            );
            setTransferProgress(null);

            if (success) {
                // Insert into DB
                const { data } = await supabase.from('chat_messages').insert({
                    family_id: family.id,
                    sender_id: user.id,
                    recipient_id: recipientId,
                    content: `📎 ${fileType.charAt(0).toUpperCase() + fileType.slice(1)}: ${asset.fileName}`,
                    attachment_type: fileType,
                    attachment_name: asset.fileName,
                    attachment_size: fileSize,
                    read_by: [user.id]
                }).select().single();

                // Optimistically update local state with the local URI so it renders immediately
                if (data) {
                    setMessages(prev => [
                        { ...data, attachment_blob_url: asset.uri, sender: { display_name: 'Me', avatar_url: null } },
                        ...prev
                    ]);
                }
            } else {
                Alert.alert('Transfer Failed', 'File queued for when recipient comes online.');
                queueAttachment({
                    fileUri: asset.uri, fileName: asset.fileName, fileType,
                    fileSize, recipientId, familyId: family.id, senderId: user.id
                });
            }
        } else {
            queueAttachment({
                fileUri: asset.uri, fileName: asset.fileName, fileType,
                fileSize, recipientId, familyId: family.id, senderId: user.id
            });
            Alert.alert('Offline', 'Recipient is offline. File queued for auto-send.');
        }
    }, [recipientId, isRecipientOnline, family?.id, user?.id]);

    // Listen for incoming files via WebRTC
    useEffect(() => {
        if (!recipientId || !family?.id || !user?.id) return;

        let cleanup: (() => void) | undefined;
        try {
            cleanup = listenForIncomingFiles(
                user.id, family.id, recipientId,
                async (metadata, blob) => {
                    // React Native Image component doesn't support 'blob:' URLs directly.
                    // We must convert to Base64 Data URL.
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = reader.result as string;
                        console.log(`[MobileAttachment] Converted blob to base64, length=${base64data.length}`);

                        // Retry logic for race condition
                        let attempts = 0;
                        const maxAttempts = 10;
                        const attemptLoop = setInterval(() => {
                            attempts++;
                            if (attempts > maxAttempts) {
                                clearInterval(attemptLoop);
                                return;
                            }

                            setMessages(prev => {
                                const foundIndex = prev.findIndex(m =>
                                    m.attachment_name === metadata.fileName &&
                                    m.sender_id === metadata.senderId &&
                                    !m.attachment_blob_url
                                );

                                if (foundIndex !== -1) {
                                    console.log(`[MobileAttachment] Found msg match, attaching.`);
                                    const newMessages = [...prev];
                                    newMessages[foundIndex] = { ...newMessages[foundIndex], attachment_blob_url: base64data };
                                    clearInterval(attemptLoop);
                                    return newMessages;
                                }
                                return prev;
                            });
                        }, 500);
                    };
                    reader.readAsDataURL(blob);
                },
                (p) => setTransferProgress(p)
            );
        } catch (err) {
            console.error('Failed to start WebRTC listener:', err);
        }

        return () => {
            if (cleanup) cleanup();
        };
    }, [recipientId, family?.id, user?.id]);

    // Drain queue when recipient comes online
    useEffect(() => {
        if (!recipientId || !isRecipientOnline || !family?.id || !user?.id) return;

        setOnQueueDrain(async (attachment) => {
            setTransferProgress(0);
            await sendFileP2P(
                attachment.fileUri, attachment.fileName, attachment.fileType,
                attachment.fileSize,
                user.id, recipientId, family.id,
                (p: number) => setTransferProgress(p)
            );
            setTransferProgress(null);
        });

        const queued = getQueuedAttachments(recipientId);
        if (queued.length > 0) {
            drainQueueForRecipient(recipientId);
        }
    }, [recipientId, isRecipientOnline, family?.id, user?.id]);
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
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>{name}</Text>
                        {isDM && (
                            <View style={styles.statusRow}>
                                <View style={[styles.statusDot, { backgroundColor: isRecipientOnline ? '#22c55e' : '#94a3b8' }]} />
                                <Text style={[styles.statusText, { color: isRecipientOnline ? '#22c55e' : '#94a3b8' }]}>
                                    {isRecipientOnline ? 'Online' : 'Offline'}
                                </Text>
                            </View>
                        )}
                    </View>
                    <View style={{ width: 24 }} />
                </View>

                {/* Transfer Progress Bar */}
                {transferProgress !== null && (
                    <View style={styles.progressContainer}>
                        <View style={[styles.progressBar, { width: `${Math.round(transferProgress * 100)}%` }]} />
                        <Text style={styles.progressText}>{Math.round(transferProgress * 100)}%</Text>
                    </View>
                )}

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
                    onContentSizeChange={(w, h) => {
                        // Only scroll to bottom if we are not loading more history
                        // This is a heuristic; deeper logic requires knowing if it was a new message vs load more
                        if (!loadingMore && messages.length <= PAGE_SIZE + 2) {
                            flatListRef.current?.scrollToEnd({ animated: true });
                        }
                    }}
                    onScroll={({ nativeEvent }) => {
                        if (nativeEvent.contentOffset.y <= 0 && hasMore && !loadingMore && messages.length > 0) {
                            loadMoreMessages();
                        }
                    }}
                    scrollEventThrottle={16}
                    ListHeaderComponent={
                        loadingMore ? <ActivityIndicator size="small" color="#6366f1" style={{ padding: 10 }} /> : null
                    }
                    maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                    style={{ flex: 1 }}
                />

                <View style={styles.inputContainer}>
                    {isDM && (
                        <TouchableOpacity
                            style={styles.attachButton}
                            onPress={handleAttachmentPick}
                        >
                            <Paperclip color="#64748b" size={22} />
                        </TouchableOpacity>
                    )}
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
    headerCenter: {
        alignItems: 'center',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        marginRight: 4,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '500',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 4,
        backgroundColor: '#eef2ff',
    },
    progressBar: {
        height: 4,
        backgroundColor: '#6366f1',
        borderRadius: 2,
    },
    progressText: {
        fontSize: 11,
        color: '#6366f1',
        marginLeft: 8,
        fontWeight: '600',
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
    attachButton: {
        padding: 8,
        marginRight: 4,
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
