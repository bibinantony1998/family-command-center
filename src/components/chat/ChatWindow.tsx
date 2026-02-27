import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { ChatMessage, Profile } from '../../types';
import { MessageBubble } from './MessageBubble';
import { Send, Paperclip, Trash2, X, Play } from 'lucide-react';
import { KeyManager, type DeviceKey } from '../../lib/encryption';
import { sendFileP2P, listenForIncomingFiles } from '../../lib/webrtcTransfer';
import { queueAttachment, getQueuedAttachments, drainQueueForRecipient, setOnQueueDrain, subscribeToQueue, removeFromQueue } from '../../lib/attachmentQueue';

interface ChatWindowProps {
    recipientId: string | null; // null = group
    currentProfile: Profile;
    familyId: string;
    isRecipientOnline?: boolean;
}

export function ChatWindow({ recipientId, currentProfile, familyId, isRecipientOnline }: ChatWindowProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [transferProgress, setTransferProgress] = useState<number | null>(null);
    const [transferStatus, setTransferStatus] = useState<'idle' | 'sending' | 'receiving'>('idle');
    const [transferError, setTransferError] = useState<string | null>(null);
    const [hdTransferStatus, setHdTransferStatus] = useState<'idle' | 'done'>('idle');
    const [pendingAttachment, setPendingAttachment] = useState<{ file: File; fileName: string; fileType: 'image' | 'video' | 'audio'; thumbnailUrl?: string } | null>(null);
    const [queuedFiles, setQueuedFiles] = useState(getQueuedAttachments(recipientId || ''));
    const [showQueueModal, setShowQueueModal] = useState(false);
    const [recipientProfile, setRecipientProfile] = useState<Profile | null>(null);

    const abortController = useRef<AbortController | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; messageId: string | null }>({ isOpen: false, messageId: null });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const PAGE_SIZE = 20;

    // Multi-device: store ALL device keys for the recipient + sender
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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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
                const senderDevicePubKey = msg.sender_device_id
                    ? deviceKeyMapRef.current.get(msg.sender_device_id)
                    : null;

                if (!senderDevicePubKey) {
                    const { data } = await supabase
                        .from('user_devices')
                        .select('public_key')
                        .eq('device_id', msg.sender_device_id || '')
                        .single();

                    if (data?.public_key) {
                        deviceKeyMapRef.current.set(msg.sender_device_id!, data.public_key);
                        const decrypted = await KeyManager.decryptMultiDevice(
                            msg.content, msg.encrypted_keys, data.public_key
                        );
                        return { ...msg, content: decrypted };
                    }
                    return { ...msg, content: '🔒 Encrypted on another device' };
                }

                const decrypted = await KeyManager.decryptMultiDevice(
                    msg.content, msg.encrypted_keys, senderDevicePubKey
                );
                return { ...msg, content: decrypted };
            }

            // Legacy format
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
        if (!familyId) {
            setLoading(false);
            return;
        }

        const markAsRead = async () => {
            setMessages(prev => prev.map(msg => {
                if (msg.sender_id !== currentProfile.id) {
                    const readBy = msg.read_by || [];
                    if (!readBy.includes(currentProfile.id)) {
                        return { ...msg, read_by: [...readBy, currentProfile.id] };
                    }
                }
                return msg;
            }));

            const { error } = await supabase.rpc('mark_messages_read', {
                p_family_id: familyId,
                p_recipient_id: recipientId
            });

            if (error) console.error("Error marking read:", error);
        };

        const fetchMessages = async () => {
            try {
                setLoading(true);
                let query = supabase
                    .from('chat_messages')
                    .select('*, sender:sender_id(display_name, avatar_url)')
                    .eq('family_id', familyId)
                    .order('created_at', { ascending: false })
                    .range(0, PAGE_SIZE - 1);

                if (recipientId) {
                    query = query.or(`and(sender_id.eq.${currentProfile.id}, recipient_id.eq.${recipientId}), and(sender_id.eq.${recipientId}, recipient_id.eq.${currentProfile.id})`);
                } else {
                    query = query.is('recipient_id', null);
                }

                const { data, error } = await query;

                if (error) {
                    console.error('Error fetching messages:', error);
                } else {
                    const rawMessages = ((data as unknown as ChatMessage[]) || []).reverse();
                    const processed = await Promise.all(rawMessages.map(decryptMessage));
                    setMessages(processed);
                    setHasMore(rawMessages.length >= PAGE_SIZE);
                    markAsRead();
                }
            } catch (err) {
                console.error("Exception in fetchMessages:", err);
            } finally {
                setLoading(false);
            }
        };



        const fetchRecipientProfile = async () => {
            if (!recipientId) {
                setRecipientProfile(null);
                return;
            }
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', recipientId)
                .single();
            if (data) setRecipientProfile(data as Profile);
        };

        const initEncryptionAndFetch = async () => {
            await KeyManager.initialize(currentProfile.id);

            if (recipientId) {
                const [recipientKeys, senderKeys] = await Promise.all([
                    KeyManager.fetchDeviceKeys(recipientId),
                    KeyManager.fetchDeviceKeys(currentProfile.id)
                ]);
                recipientDeviceKeysRef.current = recipientKeys;
                senderDeviceKeysRef.current = senderKeys;

                const map = new Map<string, string>();
                [...recipientKeys, ...senderKeys].forEach(dk => {
                    map.set(dk.device_id, dk.public_key);
                });
                deviceKeyMapRef.current = map;
            }

            await Promise.all([fetchMessages(), fetchRecipientProfile()]);
        };
        initEncryptionAndFetch();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('chat_messages')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chat_messages'
                },
                async (payload) => {
                    const eventType = payload.eventType;
                    const newMsg = payload.new as ChatMessage;
                    const oldMsg = payload.old as ChatMessage;

                    if (eventType === 'DELETE') {
                        setMessages(prev => prev.filter(m => m.id !== oldMsg.id));
                        return;
                    }

                    if (!newMsg || newMsg.family_id !== familyId) return;

                    let isRelevant = false;
                    if (recipientId) {
                        const isFromMeToThem = newMsg.sender_id === currentProfile.id && newMsg.recipient_id === recipientId;
                        const isFromThemToMe = newMsg.sender_id === recipientId && newMsg.recipient_id === currentProfile.id;
                        if (isFromMeToThem || isFromThemToMe) isRelevant = true;
                    } else {
                        if (newMsg.recipient_id === null) isRelevant = true;
                    }

                    if (isRelevant) {
                        if (eventType === 'INSERT') {
                            const { data: senderData } = await supabase
                                .from('profiles')
                                .select('display_name, avatar_url')
                                .eq('id', newMsg.sender_id)
                                .single();

                            // Decrypt the new message
                            const decryptedMsg = await decryptMessage(newMsg);
                            const msgWithSender = { ...decryptedMsg, sender: senderData as unknown as Profile };

                            setMessages(prev => {
                                if (prev.some(m => m.id === msgWithSender.id)) return prev;
                                return [...prev, msgWithSender];
                            });

                            if (newMsg.sender_id !== currentProfile.id) {
                                markAsRead();
                            }
                        } else if (eventType === 'UPDATE') {
                            setMessages(prev => prev.map(m => {
                                if (m.id === newMsg.id) {
                                    const { content: _unusedEncContent, ...metadata } = newMsg; void _unusedEncContent;
                                    return { ...m, ...metadata, sender: m.sender };
                                }
                                return m;
                            }));
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };

    }, [familyId, currentProfile.id, recipientId]);

    const loadMoreMessages = async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);

        const container = messagesContainerRef.current;
        const prevScrollHeight = container?.scrollHeight || 0;

        try {
            const offset = messages.length;
            let query = supabase
                .from('chat_messages')
                .select('*, sender:sender_id(display_name, avatar_url)')
                .eq('family_id', familyId)
                .order('created_at', { ascending: false })
                .range(offset, offset + PAGE_SIZE - 1);

            if (recipientId) {
                query = query.or(`and(sender_id.eq.${currentProfile.id}, recipient_id.eq.${recipientId}), and(sender_id.eq.${recipientId}, recipient_id.eq.${currentProfile.id})`);
            } else {
                query = query.is('recipient_id', null);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error loading more messages:', error);
            } else {
                const rawMessages = ((data as unknown as ChatMessage[]) || []).reverse();
                const processed = await Promise.all(rawMessages.map(decryptMessage));
                setMessages(prev => [...processed, ...prev]);
                setHasMore(rawMessages.length >= PAGE_SIZE);

                // Preserve scroll position after prepending
                requestAnimationFrame(() => {
                    if (container) {
                        container.scrollTop = container.scrollHeight - prevScrollHeight;
                    }
                });
            }
        } catch (err) {
            console.error('Exception in loadMoreMessages:', err);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleDeleteMessage = (messageId: string) => {
        setDeleteModal({ isOpen: true, messageId });
    };

    const confirmDeleteMessage = async () => {
        if (!deleteModal.messageId) return;

        const { error } = await supabase
            .from('chat_messages')
            .delete()
            .eq('id', deleteModal.messageId);

        if (error) {
            console.error("Error deleting message:", error);
        } else {
            // Optimistic removal in case realtime is slow
            setMessages(prev => prev.filter(m => m.id !== deleteModal.messageId));
        }
        setDeleteModal({ isOpen: false, messageId: null });
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !familyId) return;

        const plainContent = newMessage.trim();
        setNewMessage('');

        let finalContent = plainContent;
        let isEncrypted = false;
        let encrypted_keys: Record<string, string> | null = null;
        const senderDeviceId = KeyManager.getDeviceId();

        // Multi-device encrypt for DMs — always fetch fresh device keys
        if (recipientId) {
            try {
                const [freshRecipientKeys, freshSenderKeys] = await Promise.all([
                    KeyManager.fetchDeviceKeys(recipientId),
                    KeyManager.fetchDeviceKeys(currentProfile.id)
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
                    const result = await KeyManager.encryptForDevices(plainContent, allDeviceKeys);
                    finalContent = result.content;
                    encrypted_keys = result.encrypted_keys;
                    isEncrypted = true;
                }
            } catch (e) {
                console.error('Multi-device encryption failed, sending plaintext:', e);
            }
        }

        const { data, error } = await supabase.from('chat_messages').insert({
            family_id: familyId,
            sender_id: currentProfile.id,
            recipient_id: recipientId,
            content: finalContent,
            is_encrypted: isEncrypted,
            encrypted_keys: encrypted_keys,
            sender_device_id: senderDeviceId,
            read_by: [currentProfile.id]
        }).select().single();

        if (error) {
            console.error('Error sending message:', error);
            alert("Failed to send message");
            setNewMessage(plainContent);
        } else if (data) {
            const newMsgObj: ChatMessage = {
                ...data,
                content: plainContent, // Show plaintext locally
                sender: currentProfile
            };
            setMessages(prev => [...prev, newMsgObj]);
        }
    };

    // --- ATTACHMENT HANDLING ---
    const handleAttachmentClick = () => {
        if (!recipientId) return; // Only for DMs
        fileInputRef.current?.click();
    };

    const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !recipientId) return;

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';

        // Determine file type
        let fileType: 'image' | 'video' | 'audio';
        if (file.type.startsWith('image/')) fileType = 'image';
        else if (file.type.startsWith('video/')) fileType = 'video';
        else if (file.type.startsWith('audio/')) fileType = 'audio';
        else {
            alert('Only images, videos, and audio files are supported.');
            return;
        }

        // Generate a thumbnail objectURL for image/video preview in the modal
        const thumbnailUrl = fileType === 'image' || fileType === 'video'
            ? URL.createObjectURL(file)
            : undefined;

        // Show confirmation modal instead of sending immediately
        setPendingAttachment({
            file,
            fileName: file.name,
            fileType,
            thumbnailUrl
        });
    }, [recipientId]);

    const cancelTransfer = () => {
        if (abortController.current) {
            abortController.current.abort();
            abortController.current = null;
        }
        setTransferProgress(null);
        setTransferStatus('idle');
    };

    const confirmSend = async () => {
        if (!pendingAttachment || !recipientId) return;
        const { file, fileName, fileType, thumbnailUrl } = pendingAttachment;
        setPendingAttachment(null); // Close modal

        if (isRecipientOnline) {
            const ac = new AbortController();
            abortController.current = ac;

            setTransferStatus('sending');
            setTransferProgress(0);
            setTransferError(null);

            // Generate message ID first
            const messageId = crypto.randomUUID();

            // Optimistic UI: show message immediately while sending
            const blobUrl = thumbnailUrl || URL.createObjectURL(file);
            const optimisticMsg = {
                id: messageId,
                family_id: familyId,
                sender_id: currentProfile.id,
                recipient_id: recipientId,
                content: `📎 ${fileType.charAt(0).toUpperCase() + fileType.slice(1)}: ${fileName}`,
                created_at: new Date().toISOString(),
                attachment_type: fileType,
                attachment_name: fileName,
                attachment_size: file.size,
                attachment_blob_url: blobUrl,
                is_read: true,
                read_by: [currentProfile.id],
                is_encrypted: false,
                encrypted_keys: null,
                sender_device_id: null,
                sender: currentProfile
            };
            setMessages(prev => [...prev, optimisticMsg]);

            const { success, error } = await sendFileP2P(
                file, fileName, fileType,
                currentProfile.id, recipientId, familyId,
                messageId,
                (p) => setTransferProgress(p),
                ac.signal
            );

            setTransferProgress(null);
            setTransferStatus('idle');
            abortController.current = null;

            if (success) {
                // Insert message into DB
                const { data } = await supabase.from('chat_messages').insert({
                    id: messageId,
                    family_id: familyId,
                    sender_id: currentProfile.id,
                    recipient_id: recipientId,
                    content: `📎 ${fileType.charAt(0).toUpperCase() + fileType.slice(1)}: ${fileName}`,
                    attachment_type: fileType,
                    attachment_name: fileName,
                    attachment_size: file.size,
                    read_by: [currentProfile.id]
                }).select('*, sender:sender_id(display_name, avatar_url)').single();

                if (data) {
                    // Replace optimistic message with DB record (keep blobUrl for sender)
                    const sentMsg = { ...(data as unknown as import('../../types').ChatMessage), attachment_blob_url: blobUrl };
                    setMessages(prev => prev.map(m => m.id === messageId ? sentMsg : m));
                    // Show HD delivered toast for image/video
                    if (fileType === 'image' || fileType === 'video') {
                        setHdTransferStatus('done');
                        setTimeout(() => setHdTransferStatus('idle'), 3000);
                    }
                }
            } else {
                // Remove optimistic message on failure
                setMessages(prev => prev.filter(m => m.id !== messageId));
                if (error !== 'Transfer cancelled by user') {
                    setTransferError(error || 'Transfer failed');
                }
            }
        } else {
            // Offline queue logic
            await queueAttachment({
                file, fileName, fileType,
                recipientId, familyId,
                senderId: currentProfile.id
            });
        }
    };

    // Listen for incoming files via WebRTC
    useEffect(() => {
        if (!recipientId || !familyId) return;

        const cleanup = listenForIncomingFiles(
            currentProfile.id,
            familyId,
            recipientId,
            async (metadata, blob) => {
                const blobUrl = URL.createObjectURL(blob);
                console.log(`[Attachment] Received file ${metadata.fileName}, size=${metadata.fileSize}, msgId=${metadata.messageId}`);

                // Retry logic:
                // 1. If messageId exists, look for specific ID.
                // 2. Fallback to filename+sender match if no ID (legacy support).
                let attempts = 0;
                const maxAttempts = 60; // 30 seconds (500ms * 60)

                const tryAttach = () => {
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
                            console.log(`[Attachment] Found matching message (idx=${foundIndex}). Attaching.`);
                            // Check if already attached to avoid unnecessary updates
                            if (prev[foundIndex].attachment_blob_url) return prev;

                            const newMessages = [...prev];
                            newMessages[foundIndex] = { ...newMessages[foundIndex], attachment_blob_url: blobUrl };
                            return newMessages;
                        }
                        return prev;
                    });
                };

                const attemptLoop = setInterval(() => {
                    attempts++;
                    if (attempts > maxAttempts) {
                        console.warn(`[Attachment] Failed to find message meta for ${metadata.fileName} after ${maxAttempts} attempts.`);
                        clearInterval(attemptLoop);
                        return;
                    }
                    tryAttach();
                }, 500);

                tryAttach();
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

        return () => {
            cleanup();
            setTransferStatus('idle');
        };
    }, [recipientId, familyId, currentProfile.id]);

    // Drain queue when recipient comes online
    useEffect(() => {
        if (!recipientId || !isRecipientOnline) return;

        setOnQueueDrain(async (attachment) => {
            setTransferStatus('sending');
            setTransferProgress(0);
            const offlineMessageId = crypto.randomUUID();

            // Optimistic message for queued item
            const blobUrl = URL.createObjectURL(attachment.file);
            const optimisticMsg = {
                id: offlineMessageId,
                family_id: familyId,
                sender_id: currentProfile.id,
                recipient_id: recipientId,
                content: `📎 ${attachment.fileType.charAt(0).toUpperCase() + attachment.fileType.slice(1)}: ${attachment.fileName}`,
                created_at: new Date().toISOString(),
                attachment_type: attachment.fileType,
                attachment_name: attachment.fileName,
                attachment_size: attachment.file.size,
                attachment_blob_url: blobUrl,
                is_read: true,
                read_by: [currentProfile.id],
                is_encrypted: false,
                encrypted_keys: null,
                sender_device_id: null,
                sender: currentProfile
            };
            setMessages(prev => [...prev, optimisticMsg]);

            const { success } = await sendFileP2P(
                attachment.file, attachment.fileName, attachment.fileType,
                currentProfile.id, recipientId, familyId,
                offlineMessageId,
                (p) => setTransferProgress(p)
            );

            if (success) {
                await supabase.from('chat_messages').insert({
                    id: offlineMessageId,
                    family_id: familyId,
                    sender_id: currentProfile.id,
                    recipient_id: recipientId,
                    content: optimisticMsg.content,
                    attachment_type: attachment.fileType,
                    attachment_name: attachment.fileName,
                    attachment_size: attachment.file.size,
                    read_by: [currentProfile.id]
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
    }, [recipientId, isRecipientOnline, familyId, currentProfile.id]);

    const isDM = recipientId !== null;

    return (
        <div className="flex flex-col overflow-hidden bg-slate-50 h-[calc(100%-100px)]">
            {/* Transfer Progress Bar */}
            {/* Debug: Transfer Error Banner */}
            {transferError && (
                <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700 flex items-center justify-between">
                    <span>⚠️ Transfer Error: {transferError}</span>
                    <button onClick={() => setTransferError(null)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
                </div>
            )}


            {/* Messages Area */}
            <div
                ref={messagesContainerRef}
                className={`flex-1 overflow-y-auto p-4 bg-slate-50 ${messages.length > 0 ? 'space-y-4' : ''}`}
                onScroll={(e) => {
                    const el = e.currentTarget;
                    if (el.scrollTop < 50 && hasMore && !loadingMore) {
                        loadMoreMessages();
                    }
                }}
            >
                {loadingMore && (
                    <div className="flex justify-center py-2 text-slate-400 text-xs">Loading older messages...</div>
                )}
                {loading ? (
                    <div className="flex justify-center items-center h-full text-slate-400">Loading messages...</div>
                ) : messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full text-slate-400 text-sm">
                        No messages yet. Say hello!
                    </div>
                ) : (
                    messages.map(msg => (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            isOwn={msg.sender_id === currentProfile.id}
                            onDelete={handleDeleteMessage}
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {transferProgress !== null && (
                <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-t border-slate-200">
                    <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider w-24 shrink-0">
                        {transferStatus === 'sending' ? '📤 Sending...' : '📥 Receiving...'}
                    </span>
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                            style={{ width: `${Math.round(transferProgress * 100)}%` }}
                        />
                    </div>
                    <span className="text-xs font-medium text-slate-500 w-8 text-right">
                        {Math.round(transferProgress * 100)}%
                    </span>
                    <button
                        onClick={cancelTransfer}
                        className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-red-500 transition"
                        title="Cancel Upload"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}
            {hdTransferStatus === 'done' && (
                <div className="px-4 py-1.5 bg-violet-50 border-t border-violet-100 text-center">
                    <span className="text-xs font-semibold text-violet-600">✨ Delivered in full quality!</span>
                </div>
            )}
            {/* Queue Banner */}
            {queuedFiles.length > 0 && (
                <div
                    onClick={() => setShowQueueModal(true)}
                    className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                    <span className="text-xs font-medium text-slate-500">
                        ☁️ {queuedFiles.length} file{queuedFiles.length > 1 ? 's' : ''} queued for auto-send
                    </span>
                    <span className="text-xs text-indigo-600 font-medium">View Queue</span>
                </div>
            )}
            <form onSubmit={handleSend} className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-white border-t border-slate-200 flex gap-2 shrink-0 relative">

                {/* Attachment Button (DM only) */}
                {isDM && (
                    <button
                        type="button"
                        onClick={handleAttachmentClick}
                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                        title="Send attachment"
                    >
                        <Paperclip size={20} />
                    </button>
                )}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*"
                    className="hidden"
                    onChange={handleFileSelected}
                />

                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
                <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Send size={20} />
                </button>
            </form>

            {/* Delete Confirmation Modal */}
            {deleteModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Message?</h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete this message? This cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setDeleteModal({ isOpen: false, messageId: null })}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteMessage}
                                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Queue Management Modal */}
            {showQueueModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Queued Uploads</h3>
                            <button onClick={() => setShowQueueModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <p className="text-gray-600 text-sm mb-4">
                            Waiting for recipient to come online...
                        </p>

                        <div className="max-h-64 overflow-y-auto space-y-2 mb-2">
                            {queuedFiles.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className="flex-1 mr-3 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg leading-none">
                                                {item.fileType === 'image' ? '📷' : item.fileType === 'video' ? '🎥' : '🎵'}
                                            </span>
                                            <p className="text-sm font-medium text-slate-700 truncate">
                                                {item.fileName}
                                            </p>
                                        </div>
                                        <p className="text-xs text-slate-400 ml-7">
                                            {formatFileSize(item.file.size)}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => deleteQueuedItem(item.id)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Remove from queue"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Attachment Confirmation Modal */}
            {pendingAttachment && (
                <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in slide-in-from-bottom-4 sm:fade-in sm:zoom-in duration-200">

                        {/* Image thumbnail */}
                        {pendingAttachment.fileType === 'image' && pendingAttachment.thumbnailUrl && (
                            <div className="w-full h-52 bg-slate-100 overflow-hidden">
                                <img
                                    src={pendingAttachment.thumbnailUrl}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}

                        {/* Video thumbnail with play button overlay */}
                        {pendingAttachment.fileType === 'video' && pendingAttachment.thumbnailUrl && (
                            <div className="relative w-full h-52 bg-slate-900 overflow-hidden">
                                <video
                                    src={pendingAttachment.thumbnailUrl}
                                    className="w-full h-full object-cover opacity-80"
                                    muted
                                    playsInline
                                />
                                {/* Gradient overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                                {/* Play button */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-16 h-16 rounded-full bg-indigo-600/90 flex items-center justify-center shadow-lg shadow-indigo-600/30 backdrop-blur-sm">
                                        <Play size={28} className="text-white fill-white ml-1" />
                                    </div>
                                </div>
                                {/* Video badge */}
                                <span className="absolute top-3 right-3 bg-black/60 text-white text-[10px] font-bold tracking-widest px-2 py-0.5 rounded">
                                    VIDEO
                                </span>
                            </div>
                        )}

                        {/* Audio placeholder */}
                        {pendingAttachment.fileType === 'audio' && (
                            <div className="w-full h-32 bg-indigo-950 flex flex-col items-center justify-center gap-2">
                                <span className="text-4xl">🎵</span>
                                <span className="text-white/70 text-sm font-medium">Audio File</span>
                            </div>
                        )}

                        <div className="p-5">
                            <h3 className="text-base font-bold text-gray-900 mb-1">
                                Send to {recipientProfile?.display_name || 'Recipient'}
                            </h3>
                            <p className="text-sm text-slate-500 truncate mb-1">{pendingAttachment.fileName}</p>
                            <p className="text-xs text-slate-400 mb-4">{formatFileSize(pendingAttachment.file.size)}</p>

                            <div className={`rounded-xl border px-4 py-2.5 mb-4 text-sm font-medium text-center ${isRecipientOnline
                                    ? 'bg-green-50 border-green-200 text-green-700'
                                    : 'bg-amber-50 border-amber-200 text-amber-700'
                                }`}>
                                {isRecipientOnline
                                    ? '✅ Online — will send directly via P2P'
                                    : '☁️ Offline — will queue and send when online'}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setPendingAttachment(null)}
                                    className="flex-1 px-4 py-2.5 text-gray-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmSend}
                                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-medium transition shadow-sm text-sm"
                                >
                                    {isRecipientOnline ? '📤 Send Now' : '☁️ Queue'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
