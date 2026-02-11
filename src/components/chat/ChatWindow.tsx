import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { ChatMessage, Profile } from '../../types';
import { MessageBubble } from './MessageBubble';
import { Send } from 'lucide-react';
import { KeyManager, type DeviceKey } from '../../lib/encryption';

interface ChatWindowProps {
    recipientId: string | null; // null = group
    currentProfile: Profile;
    familyId: string;
}

export function ChatWindow({ recipientId, currentProfile, familyId }: ChatWindowProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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
                    const senderDevicePubKey = msg.sender_device_id
                        ? deviceKeyMapRef.current.get(msg.sender_device_id)
                        : null;

                    if (!senderDevicePubKey) {
                        // Try to fetch the sender's device key
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

                // Legacy format: try old single-key decryption
                // Fetch sender's legacy public_key from profiles
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

        const fetchMessages = async () => {
            try {
                setLoading(true);
                let query = supabase
                    .from('chat_messages')
                    .select('*, sender:sender_id(display_name, avatar_url)')
                    .eq('family_id', familyId)
                    .order('created_at', { ascending: true });

                if (recipientId) {
                    query = query.or(`and(sender_id.eq.${currentProfile.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${currentProfile.id})`);
                } else {
                    query = query.is('recipient_id', null);
                }

                const { data, error } = await query;

                if (error) {
                    console.error('Error fetching messages:', error);
                } else {
                    const rawMessages = (data as unknown as ChatMessage[]) || [];
                    const processed = await Promise.all(rawMessages.map(decryptMessage));
                    setMessages(processed);
                    markAsRead();
                }
            } catch (err) {
                console.error("Exception in fetchMessages:", err);
            } finally {
                setLoading(false);
            }
        };

        const initEncryptionAndFetch = async () => {
            // Initialize encryption keys & register device
            await KeyManager.initialize(currentProfile.id);

            // Fetch device keys for DM counterpart and self
            if (recipientId) {
                const [recipientKeys, senderKeys] = await Promise.all([
                    KeyManager.fetchDeviceKeys(recipientId),
                    KeyManager.fetchDeviceKeys(currentProfile.id)
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

    const handleDeleteMessage = async (messageId: string) => {
        if (!confirm("Are you sure you want to delete this message?")) return;

        const { error } = await supabase
            .from('chat_messages')
            .delete()
            .eq('id', messageId);

        if (error) {
            console.error("Error deleting message:", error);
            alert("Failed to delete message");
        }
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

    return (
        <div className="flex flex-col overflow-hidden bg-slate-50 h-[calc(100%-100px)]">
            {/* Messages Area */}
            <div className={`flex-1 overflow-y-auto p-4 bg-slate-50 ${messages.length > 0 ? 'space-y-4' : ''}`}>
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
            <form onSubmit={handleSend} className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-white border-t border-slate-200 flex gap-2 shrink-0">
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
        </div>
    );
}
