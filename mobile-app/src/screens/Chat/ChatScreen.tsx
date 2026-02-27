import React, { useState, useEffect, useRef, useCallback } from 'react';
import QuickCrypto from 'react-native-quick-crypto';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Keyboard, Modal, Image, ImageBackground } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ChatMessage } from '../../types/schema';
import { KeyManager, DeviceKey } from '../../lib/encryption';
import { MessageBubble } from '../../components/chat/MessageBubble';
import { ChevronLeft, Send, Paperclip, MoreVertical, Trash2, Download, X, Video, Play, Image as ImageIcon } from 'lucide-react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { usePresence } from '../../hooks/usePresence';

import { launchImageLibrary } from 'react-native-image-picker';
import { sendFileP2P, listenForIncomingFiles } from '../../lib/webrtcTransfer';
import { queueAttachment, getQueuedAttachments, drainQueueForRecipient, setOnQueueDrain, subscribeToQueue, removeFromQueue } from '../../lib/attachmentQueue';
import { useChat } from '../../context/ChatContext';

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;

export default function ChatScreen() {
    const { user, family } = useAuth();
    const { refreshUnreadCounts } = useChat();
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
    const route = useRoute<ChatScreenRouteProp>();


    const recipientId = route.params?.recipientId || null;
    const name = route.params?.name || 'Chat';

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [transferProgress, setTransferProgress] = useState<number | null>(null);
    const [transferStatus, setTransferStatus] = useState<'idle' | 'sending' | 'receiving'>('idle');
    const [hdTransferProgress, setHdTransferProgress] = useState<number | null>(null);
    const [hdTransferStatus, setHdTransferStatus] = useState<'idle' | 'sending' | 'done'>('idle');
    const [pendingAttachment, setPendingAttachment] = useState<{ uri: string; thumbnailUri?: string; fileName: string; fileType: 'image' | 'video' | 'audio'; fileSize?: number } | null>(null);
    const [queuedFiles, setQueuedFiles] = useState(getQueuedAttachments(recipientId || ''));
    const [showQueueModal, setShowQueueModal] = useState(false);
    const abortController = useRef<AbortController | null>(null);
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

    useEffect(() => {
        if (!recipientId) return;
        setQueuedFiles(getQueuedAttachments(recipientId));
        return subscribeToQueue(() => {
            const current = getQueuedAttachments(recipientId);
            setQueuedFiles(current);
            if (current.length === 0) {
                setShowQueueModal(false);
            }
        });
    }, [recipientId]);

    const deleteQueuedItem = (id: string) => {
        removeFromQueue(id);
    };

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
            quality: 1.0, // Always pick at full quality; compression handled separately
            includeBase64: false,
        });

        if (result.didCancel || !result.assets?.[0]) return;
        const asset = result.assets[0];
        if (!asset.uri) return;
        const fileName = asset.fileName || `File_${Date.now()}`;

        let fileType: 'image' | 'video' | 'audio';
        if (asset.type?.startsWith('image/')) fileType = 'image';
        else if (asset.type?.startsWith('video/')) fileType = 'video';
        else if (asset.type?.startsWith('audio/')) fileType = 'audio';
        else {
            Alert.alert('Unsupported', 'Only images, videos, and audio files are supported.');
            return;
        }

        const fileSize = asset.fileSize || 0;

        // For video, use the asset URI as thumbnail (first frame rendered by Image component)
        const thumbnailUri = (fileType === 'video' || fileType === 'image') ? asset.uri : undefined;

        // Show confirmation modal instead of sending immediately
        setPendingAttachment({
            uri: asset.uri,
            thumbnailUri,
            fileName,
            fileType,
            fileSize
        });
    }, [recipientId, user?.id, family?.id]);

    const cancelTransfer = () => {
        if (abortController.current) {
            abortController.current.abort();
            abortController.current = null;
        }
        setTransferProgress(null);
        setTransferStatus('idle');
    };

    const confirmSend = async () => {
        if (!pendingAttachment || !recipientId || !user?.id || !family?.id) return;
        const { uri, fileName, fileType, fileSize } = pendingAttachment;
        setPendingAttachment(null);

        if (isRecipientOnline) {
            const ac = new AbortController();
            abortController.current = ac;

            setSending(true);
            setTransferStatus('sending');
            setTransferProgress(0);

            let messageId = '';
            try {
                messageId = QuickCrypto.randomUUID();

                // Optimistic UI: show message immediately with local URI for preview
                const optimisticMessage: ChatMessage = {
                    id: messageId,
                    family_id: family.id,
                    sender_id: user.id,
                    recipient_id: recipientId,
                    content: `📎 ${fileType.charAt(0).toUpperCase() + fileType.slice(1)}: ${fileName}`,
                    created_at: new Date().toISOString(),
                    attachment_type: fileType,
                    attachment_name: fileName,
                    attachment_size: fileSize || 0,
                    attachment_blob_url: uri, // Local URI for immediate preview
                    is_read: true,
                    read_by: [user.id],
                    sender: {
                        display_name: 'You',
                        avatar_url: null
                    }
                };

                setMessages(prev => [...prev, optimisticMessage]);
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

                // Send full-quality file P2P
                const success = await sendFileP2P(
                    uri, fileName, fileType, fileSize || 0,
                    user.id, recipientId, family.id,
                    messageId,
                    (p) => setTransferProgress(p),
                    ac.signal
                );

                if (success) {
                    // Insert the message record so it persists
                    const { error: insertError } = await supabase
                        .from('chat_messages')
                        .insert({
                            id: messageId,
                            family_id: family.id,
                            sender_id: user.id,
                            recipient_id: recipientId,
                            content: optimisticMessage.content,
                            attachment_type: fileType,
                            attachment_name: fileName,
                            attachment_size: fileSize
                        });

                    if (insertError) throw insertError;

                    // For images: send a compressed preview first is irrelevant after full quality
                    // already sent. WhatsApp-style HD pass is already done since we sent full quality.
                    // Mark HD done for images.
                    if (fileType === 'image') {
                        setHdTransferStatus('done');
                        setTimeout(() => setHdTransferStatus('idle'), 2000);
                    }
                } else {
                    setMessages(prev => prev.filter(m => m.id !== messageId));
                    Alert.alert('Transfer Failed', 'Could not send the file. Recipient may have gone offline.');
                }
            } catch (err) {
                console.error('Send error:', err);
                if (messageId) {
                    setMessages(prev => prev.filter(m => m.id !== messageId));
                }
                Alert.alert('Error', 'Failed to send file.');
            } finally {
                setSending(false);
                setTransferProgress(null);
                setTransferStatus('idle');
                abortController.current = null;
            }
        } else {
            // Queue for delivery when recipient comes online
            await queueAttachment({
                fileUri: uri,
                fileName,
                fileType,
                fileSize: fileSize || 0,
                recipientId,
                familyId: family.id,
                senderId: user.id
            });
            Alert.alert(
                'Queued ☁️',
                `${fileName} will be sent automatically when ${name} comes online.`
            );
        }
    };

    // Listen for incoming files via WebRTC
    useEffect(() => {
        if (!recipientId || !family?.id || !user?.id) return;

        let cleanup: (() => void) | undefined;
        try {
            cleanup = listenForIncomingFiles(
                user.id, family.id, recipientId,
                async (metadata, fileUri) => {
                    console.log(`[MobileAttachment] Received file URI: ${fileUri}`);

                    // Retry logic for race condition
                    let attempts = 0;
                    const maxAttempts = 60; // 30 seconds (500ms * 60)

                    const attemptLoop = setInterval(() => {
                        attempts++;
                        if (attempts > maxAttempts) {
                            clearInterval(attemptLoop);
                            return;
                        }

                        setMessages(prev => {
                            let foundIndex = -1;

                            if (metadata.messageId) {
                                foundIndex = prev.findIndex(m => m.id === metadata.messageId);
                            } else {
                                // Legacy fallback
                                foundIndex = prev.findIndex(m =>
                                    m.attachment_name === metadata.fileName &&
                                    m.sender_id === metadata.senderId &&
                                    !m.attachment_blob_url
                                );
                            }

                            if (foundIndex !== -1) {
                                console.log(`[MobileAttachment] Found msg match (idx=${foundIndex}). Attaching.`);
                                // Check if already attached to avoid unnecessary updates
                                if (prev[foundIndex].attachment_blob_url) {
                                    clearInterval(attemptLoop);
                                    return prev;
                                }

                                const newMessages = [...prev];
                                newMessages[foundIndex] = { ...newMessages[foundIndex], attachment_blob_url: fileUri };
                                clearInterval(attemptLoop);
                                return newMessages;
                            }
                            return prev;
                        });
                    }, 500);
                },
                (p) => {
                    setTransferStatus(prev => prev !== 'receiving' ? 'receiving' : prev);
                    setTransferProgress(p);
                    if (p === 1) {
                        setTimeout(() => {
                            setTransferProgress(null);
                            setTransferStatus('idle');
                        }, 1000);
                    }
                }
            );
        } catch (err) {
            console.error('Failed to start WebRTC listener:', err);
        }

        return () => {
            if (cleanup) cleanup();
            setTransferStatus('idle');
        };
    }, [recipientId, family?.id, user?.id]);

    // Drain queue when recipient comes online
    useEffect(() => {
        if (!recipientId || !isRecipientOnline || !family?.id || !user?.id) return;

        setOnQueueDrain(async (attachment) => {
            setTransferStatus('sending');
            setTransferProgress(0);
            const offlineMessageId = QuickCrypto.randomUUID();

            // Optimistic message for queued item
            const queuedMsg: ChatMessage = {
                id: offlineMessageId,
                family_id: family.id,
                sender_id: user.id,
                recipient_id: recipientId,
                content: `📎 ${attachment.fileType.charAt(0).toUpperCase() + attachment.fileType.slice(1)}: ${attachment.fileName}`,
                created_at: new Date().toISOString(),
                attachment_type: attachment.fileType,
                attachment_name: attachment.fileName,
                attachment_size: attachment.fileSize,
                attachment_blob_url: attachment.fileUri,
                is_read: true,
                read_by: [user.id],
                sender: { display_name: 'You', avatar_url: null }
            };
            setMessages(prev => [...prev, queuedMsg]);

            const success = await sendFileP2P(
                attachment.fileUri, attachment.fileName, attachment.fileType,
                attachment.fileSize,
                user.id, recipientId, family.id,
                offlineMessageId,
                (p: number) => setTransferProgress(p)
            );

            if (success) {
                await supabase.from('chat_messages').insert({
                    id: offlineMessageId,
                    family_id: family.id,
                    sender_id: user.id,
                    recipient_id: recipientId,
                    content: queuedMsg.content,
                    attachment_type: attachment.fileType,
                    attachment_name: attachment.fileName,
                    attachment_size: attachment.fileSize
                });
            } else {
                setMessages(prev => prev.filter(m => m.id !== offlineMessageId));
            }

            setTransferProgress(null);
            setTransferStatus('idle');
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
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <ChevronLeft color="#0f172a" size={24} />
                        </TouchableOpacity>
                    </View>

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

                    <View style={styles.headerRight}>
                        {isDM && (
                            <TouchableOpacity
                                onPress={() => navigation.navigate('VideoCall', {
                                    recipientId: recipientId!,
                                    name: name,
                                    isCaller: true
                                })}
                                style={styles.videoButton}
                            >
                                <Video color="#6366f1" size={24} />
                            </TouchableOpacity>
                        )}
                    </View>
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
                    {/* Queue Banner */}
                    {queuedFiles.length > 0 && (
                        <TouchableOpacity
                            style={styles.queueBanner}
                            onPress={() => setShowQueueModal(true)}
                        >
                            <Text style={styles.queueBannerText}>
                                ☁️ {queuedFiles.length} file{queuedFiles.length > 1 ? 's' : ''} queued for {name}
                            </Text>
                            <ChevronLeft style={{ transform: [{ rotate: '180deg' }] }} size={16} color="#64748b" />
                        </TouchableOpacity>
                    )}
                    {transferProgress !== null && (
                        <View style={styles.uploadContainer}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#6366f1', marginRight: 8, textTransform: 'uppercase' }}>
                                {transferStatus === 'sending' ? '📤 Sending...' : '📥 Receiving...'}
                            </Text>
                            <View style={styles.uploadProgressTrack}>
                                <View style={[styles.uploadProgressBar, { width: `${Math.round(transferProgress * 100)}%` }]} />
                            </View>
                            <Text style={styles.uploadProgressText}>{Math.round(transferProgress * 100)}%</Text>
                            <TouchableOpacity onPress={cancelTransfer} style={styles.stopButton}>
                                <X color="#64748b" size={20} />
                            </TouchableOpacity>
                        </View>
                    )}
                    {hdTransferStatus === 'sending' && (
                        <View style={[styles.uploadContainer, { marginTop: 4 }]}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#8b5cf6', marginRight: 8, textTransform: 'uppercase' }}>
                                ✨ HD Sending...
                            </Text>
                            <View style={[styles.uploadProgressTrack, { backgroundColor: '#ede9fe' }]}>
                                <View style={[styles.uploadProgressBar, { backgroundColor: '#8b5cf6', width: hdTransferProgress != null ? `${Math.round(hdTransferProgress * 100)}%` : '100%' }]} />
                            </View>
                        </View>
                    )}
                    {hdTransferStatus === 'done' && (
                        <View style={{ alignItems: 'center', marginBottom: 4 }}>
                            <Text style={{ fontSize: 11, color: '#8b5cf6', fontWeight: '600' }}>✨ HD delivered!</Text>
                        </View>
                    )}

                    <View style={styles.inputRow}>
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
                </View>
            </KeyboardAvoidingView>

            {/* Attachment Send Confirmation Modal */}
            <Modal
                visible={!!pendingAttachment}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setPendingAttachment(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { paddingHorizontal: 0, paddingTop: 0, overflow: 'hidden' }]}>

                        {/* Image Preview */}
                        {pendingAttachment?.fileType === 'image' && pendingAttachment.thumbnailUri && (
                            <Image
                                source={{ uri: pendingAttachment.thumbnailUri }}
                                style={styles.previewImage}
                                resizeMode="cover"
                            />
                        )}

                        {/* Video Preview with play button overlay */}
                        {pendingAttachment?.fileType === 'video' && pendingAttachment.thumbnailUri && (
                            <View style={styles.videoPreviewContainer}>
                                <Image
                                    source={{ uri: pendingAttachment.thumbnailUri }}
                                    style={StyleSheet.absoluteFillObject}
                                    resizeMode="cover"
                                />
                                <View style={styles.videoPlayOverlay}>
                                    <View style={styles.playButton}>
                                        <Play size={28} color="white" fill="white" />
                                    </View>
                                </View>
                                <View style={styles.videoBadge}>
                                    <Text style={styles.videoBadgeText}>VIDEO</Text>
                                </View>
                            </View>
                        )}

                        {/* Audio placeholder */}
                        {pendingAttachment?.fileType === 'audio' && (
                            <View style={[styles.videoPreviewContainer, { backgroundColor: '#1e1b4b' }]}>
                                <Text style={{ fontSize: 48 }}>🎵</Text>
                                <Text style={{ color: 'white', marginTop: 8, fontWeight: '600' }}>Audio File</Text>
                            </View>
                        )}

                        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, width: '100%' }}>
                            <Text style={styles.modalTitle}>Send to {name}</Text>

                            <Text style={styles.modalText} numberOfLines={2}>
                                {pendingAttachment?.fileName}
                            </Text>

                            {pendingAttachment?.fileSize ? (
                                <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, textAlign: 'center' }}>
                                    {pendingAttachment.fileSize < 1024 * 1024
                                        ? `${Math.round(pendingAttachment.fileSize / 1024)} KB`
                                        : `${(pendingAttachment.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                                </Text>
                            ) : null}

                            <View style={[styles.statusBanner, { backgroundColor: isRecipientOnline ? '#f0fdf4' : '#fff7ed', borderColor: isRecipientOnline ? '#bbf7d0' : '#fed7aa' }]}>
                                <Text style={[styles.statusBannerText, { color: isRecipientOnline ? '#15803d' : '#c2410c' }]}>
                                    {isRecipientOnline
                                        ? '✅ Online — will send directly via P2P'
                                        : '☁️ Offline — will queue and send when online'}
                                </Text>
                            </View>

                            <View style={[styles.modalButtons, { marginTop: 16 }]}>
                                <TouchableOpacity
                                    style={[styles.modalBtn, styles.cancelBtn]}
                                    onPress={() => setPendingAttachment(null)}
                                >
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalBtn, styles.confirmBtn]}
                                    onPress={confirmSend}
                                >
                                    <Text style={styles.confirmBtnText}>
                                        {isRecipientOnline ? '📤 Send Now' : '☁️ Queue'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
            {/* Queue Management Modal */}
            <Modal
                visible={showQueueModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowQueueModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Queued Uploads</Text>
                            <TouchableOpacity onPress={() => setShowQueueModal(false)}>
                                <X size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>
                            Waiting for {name} to come online...
                        </Text>

                        <FlatList
                            data={queuedFiles}
                            keyExtractor={item => item.id}
                            style={{ maxHeight: 300, width: '100%' }}
                            renderItem={({ item }) => (
                                <View style={styles.queueItem}>
                                    <View style={styles.queueItemInfo}>
                                        <Text style={styles.queueItemName} numberOfLines={1}>
                                            {item.fileType === 'image' ? '📷' : item.fileType === 'video' ? '🎥' : '🎵'} {item.fileName || 'Unknown File'}
                                        </Text>
                                        <Text style={styles.queueItemSize}>
                                            {item.fileSize ? `${(item.fileSize / 1024).toFixed(1)} KB` : 'Unknown size'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => deleteQueuedItem(item.id)}
                                        style={styles.deleteBtn}
                                    >
                                        <Trash2 size={18} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 16,
    },
    queueItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        width: '100%',
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    queueItemInfo: {
        flex: 1,
        marginRight: 12,
    },
    queueItemName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#334155',
        marginBottom: 2,
    },
    queueItemSize: {
        fontSize: 12,
        color: '#94a3b8',
    },
    deleteBtn: {
        padding: 8,
        backgroundColor: '#fef2f2',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fee2e2',
    },
    modalText: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
    },
    modalWarning: {
        backgroundColor: '#fff7ed',
        padding: 12,
        borderRadius: 8,
        width: '100%',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#ffedd5',
    },
    modalWarningText: {
        fontSize: 13,
        color: '#c2410c',
        textAlign: 'center',
        fontWeight: '500',
    },
    modalButtons: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelBtn: {
        backgroundColor: '#f1f5f9',
    },
    confirmBtn: {
        backgroundColor: '#6366f1',
    },
    cancelBtnText: {
        color: '#64748b',
        fontWeight: '600',
    },
    confirmBtnText: {
        color: 'white',
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        backgroundColor: 'white',
    },
    headerLeft: {
        width: 48,
        alignItems: 'flex-start',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerRight: {
        width: 48,
        alignItems: 'flex-end',
    },
    backButton: {
        padding: 4,
        marginLeft: -4,
    },
    videoButton: {
        padding: 8,
        marginRight: -8,
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

    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    inputContainer: {
        flexDirection: 'column',
        padding: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        backgroundColor: 'white',
    },
    queueBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8fafc',
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginBottom: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    queueBannerText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    uploadContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 4,
        gap: 12,
        width: '100%',
    },
    uploadProgressTrack: {
        flex: 1,
        height: 6,
        backgroundColor: '#f1f5f9',
        borderRadius: 3,
        overflow: 'hidden',
    },
    uploadProgressBar: {
        height: '100%',
        backgroundColor: '#6366f1',
    },
    uploadProgressText: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '500',
        width: 35,
        textAlign: 'right',
    },
    stopButton: {
        padding: 4,
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
    // --- Send Confirmation Modal Preview Styles ---
    previewImage: {
        width: '100%',
        height: 220,
        backgroundColor: '#f1f5f9',
    },
    videoPreviewContainer: {
        width: '100%',
        height: 220,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoPlayOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    playButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(99, 102, 241, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    videoBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    videoBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    statusBanner: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
        width: '100%',
    },
    statusBannerText: {
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'center',
    },
});
