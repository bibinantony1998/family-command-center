import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { ChatMessage, Profile } from '../../types';
import { MessageBubble } from './MessageBubble';
import { Send, Paperclip } from 'lucide-react';
import { KeyManager, type DeviceKey } from '../../lib/encryption';
import { sendFileP2P, listenForIncomingFiles } from '../../lib/webrtcTransfer';
import { queueAttachment, getQueuedAttachments, drainQueueForRecipient, setOnQueueDrain } from '../../lib/attachmentQueue';

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
    const [transferError, setTransferError] = useState<string | null>(null);
    const [showOfflineTooltip, setShowOfflineTooltip] = useState(false);
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
                    query = query.or(`and(sender_id.eq.${currentProfile.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${currentProfile.id})`);
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

            await fetchMessages();
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
                query = query.or(`and(sender_id.eq.${currentProfile.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${currentProfile.id})`);
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
        if (!isRecipientOnline) {
            setShowOfflineTooltip(true);
            setTimeout(() => setShowOfflineTooltip(false), 3000);
        }
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

        if (isRecipientOnline) {
            // Send directly via WebRTC
            setTransferProgress(0);
            setTransferError(null);
            const result = await sendFileP2P(
                file, file.name, fileType,
                currentProfile.id, recipientId, familyId,
                (p) => setTransferProgress(p)
            );
            setTransferProgress(null);

            if (result.success) {
                setTransferError(null);
                // Insert metadata message into DB
                const blobUrl = URL.createObjectURL(file);
                const { data } = await supabase.from('chat_messages').insert({
                    family_id: familyId,
                    sender_id: currentProfile.id,
                    recipient_id: recipientId,
                    content: `📎 ${fileType.charAt(0).toUpperCase() + fileType.slice(1)}: ${file.name}`,
                    attachment_type: fileType,
                    attachment_name: file.name,
                    attachment_size: file.size,
                    read_by: [currentProfile.id]
                }).select().single();

                if (data) {
                    setMessages(prev => [...prev, { ...data, attachment_blob_url: blobUrl, sender: currentProfile }]);
                }
            } else {
                const errMsg = result.error || 'File transfer failed';
                setTransferError(errMsg);
                console.error('[Attachment]', errMsg);
                queueAttachment({
                    file, fileName: file.name, fileType,
                    recipientId, familyId, senderId: currentProfile.id
                });
            }
        } else {
            // Queue for later
            queueAttachment({
                file, fileName: file.name, fileType,
                recipientId, familyId, senderId: currentProfile.id
            });
            setShowOfflineTooltip(true);
            setTimeout(() => setShowOfflineTooltip(false), 3000);
        }
    }, [recipientId, isRecipientOnline, familyId, currentProfile]);

    // Listen for incoming files via WebRTC
    useEffect(() => {
        if (!recipientId || !familyId) return;

        const cleanup = listenForIncomingFiles(
            currentProfile.id,
            familyId,
            recipientId,
            async (metadata, blob) => {
                const blobUrl = URL.createObjectURL(blob);
                console.log(`[Attachment] Received file ${metadata.fileName}, size=${metadata.fileSize}. Blob created: ${blobUrl}`);

                // Retry logic: The message metadata might arrive slightly AFTER the file transfer finishes.
                let attempts = 0;
                const maxAttempts = 10;

                const tryAttach = () => {
                    setMessages(prev => {
                        // Check if we have the message
                        const foundIndex = prev.findIndex(m =>
                            m.attachment_name === metadata.fileName &&
                            m.sender_id === metadata.senderId &&
                            !m.attachment_blob_url
                        );

                        if (foundIndex !== -1) {
                            console.log(`[Attachment] Found matching message at index ${foundIndex}. Attaching blob.`);
                            const newMessages = [...prev];
                            newMessages[foundIndex] = { ...newMessages[foundIndex], attachment_blob_url: blobUrl };
                            return newMessages;
                        }

                        // Not found yet
                        return prev;
                    });

                    // Check if it was attached (we can't easily check the result of setMessages inside here without a ref or another effect)
                    // So we'll trigger a check in the next tick via another specific timeout or just blindly retry?
                    // Better approach: use a ref to track if we handled this transferId? 
                    // Or just simplified: Check if we found it. If not, schedule next try.

                    // Actually, setMessages is async. We can't know if it worked inside the updater immediately for the retry logic.
                    // But we can check `messages` ref if we had one.
                    // Let's just blindly retry a few times.
                };

                const attemptLoop = setInterval(() => {
                    attempts++;
                    // We need to check if it's already attached to avoid useless updates?
                    // Actually, the `findIndex` check `!m.attachment_blob_url` handles ensuring we don't overwrite or do confirmed ones.

                    if (attempts > maxAttempts) {
                        console.warn(`[Attachment] Failed to find message meta for ${metadata.fileName} after ${maxAttempts} attempts.`);
                        clearInterval(attemptLoop);
                        return;
                    }

                    tryAttach();
                }, 500);

                // Try immediately once
                tryAttach();
            },
            (p) => setTransferProgress(p)
        );

        return cleanup;
    }, [recipientId, familyId, currentProfile.id]);

    // Drain queue when recipient comes online
    useEffect(() => {
        if (!recipientId || !isRecipientOnline) return;

        setOnQueueDrain(async (attachment) => {
            setTransferProgress(0);
            await sendFileP2P(
                attachment.file, attachment.fileName, attachment.fileType,
                currentProfile.id, recipientId, familyId,
                (p) => setTransferProgress(p)
            );
            setTransferProgress(null);
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
            {transferProgress !== null && (
                <div className="bg-indigo-50 px-4 py-1 text-xs text-indigo-600 flex items-center gap-2">
                    <div className="flex-1 bg-indigo-100 rounded-full h-1.5">
                        <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.round(transferProgress * 100)}%` }}></div>
                    </div>
                    <span>{Math.round(transferProgress * 100)}%</span>
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
            <form onSubmit={handleSend} className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-white border-t border-slate-200 flex gap-2 shrink-0 relative">
                {/* Offline Tooltip */}
                {showOfflineTooltip && (
                    <div className="absolute -top-10 left-4 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg">
                        Recipient is offline. File queued for auto-send.
                    </div>
                )}

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
        </div>
    );
}
