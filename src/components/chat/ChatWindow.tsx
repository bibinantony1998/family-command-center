import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { ChatMessage, Profile } from '../../types';
import { MessageBubble } from './MessageBubble';
import { Send } from 'lucide-react';
import { KeyManager } from '../../lib/encryption';

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
    const counterpartKeyRef = useRef<string | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        // Scroll on new messages
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!familyId) {
            setLoading(false);
            return;
        }

        const markAsRead = async () => {
            // Optimistic Update: Mark all unread messages from others as read locally immediately
            setMessages(prev => prev.map(msg => {
                if (msg.sender_id !== currentProfile.id) {
                    const readBy = msg.read_by || [];
                    if (!readBy.includes(currentProfile.id)) {
                        return { ...msg, read_by: [...readBy, currentProfile.id] };
                    }
                }
                return msg;
            }));

            // Call RPC to atomically update read_by array for all relevant messages in DB
            const { error } = await supabase.rpc('mark_messages_read', {
                p_family_id: familyId,
                p_recipient_id: recipientId // Optional param for RPC to narrow scope
            });

            if (error) console.error("Error marking read:", error);
        };

        // Fetch initial messages
        const fetchMessages = async () => {
            try {
                setLoading(true);
                let query = supabase
                    .from('chat_messages')
                    .select('*, sender:sender_id(display_name, avatar_url)')
                    .eq('family_id', familyId)
                    .order('created_at', { ascending: true });

                if (recipientId) {
                    // Direct Message: (sender=me & recipient=them) OR (sender=them & recipient=me)
                    query = query.or(`and(sender_id.eq.${currentProfile.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${currentProfile.id})`);
                } else {
                    // Group Message: recipient_id is null
                    query = query.is('recipient_id', null);
                }

                const { data, error } = await query;

                if (error) {
                    console.error('Error fetching messages:', error);
                } else {
                    // Decrypt encrypted messages
                    const rawMessages = (data as unknown as ChatMessage[]) || [];
                    const processed = await Promise.all(rawMessages.map(async (msg) => {
                        if (msg.is_encrypted && counterpartKeyRef.current) {
                            try {
                                const decrypted = await KeyManager.decryptMessage(msg.content, counterpartKeyRef.current);
                                return { ...msg, content: decrypted };
                            } catch {
                                return { ...msg, content: '\ud83d\udd12 Unable to decrypt' };
                            }
                        }
                        return msg;
                    }));
                    setMessages(processed);
                    markAsRead(); // Mark visible messages as read
                }
            } catch (err) {
                console.error("Exception in fetchMessages:", err);
            } finally {
                setLoading(false);
            }
        };

        const initEncryptionAndFetch = async () => {
            // Initialize encryption keys
            await KeyManager.initialize(currentProfile.id);

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
        };
        initEncryptionAndFetch();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('chat_messages')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
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

                    // For INSERT and UPDATE
                    if (!newMsg || newMsg.family_id !== familyId) return;

                    // Manual filter for safety
                    if (newMsg.family_id !== familyId) return;

                    // Filter if relevant to current view
                    let isRelevant = false;
                    if (recipientId) {
                        // Is this a DM between me and this person?
                        const isFromMeToThem = newMsg.sender_id === currentProfile.id && newMsg.recipient_id === recipientId;
                        const isFromThemToMe = newMsg.sender_id === recipientId && newMsg.recipient_id === currentProfile.id;
                        if (isFromMeToThem || isFromThemToMe) isRelevant = true;
                    } else {
                        // Is this a group message?
                        if (newMsg.recipient_id === null) isRelevant = true;
                    }

                    if (isRelevant) {
                        if (eventType === 'INSERT') {
                            // Fetch sender details
                            const { data: senderData } = await supabase
                                .from('profiles')
                                .select('display_name, avatar_url')
                                .eq('id', newMsg.sender_id)
                                .single();

                            // Decrypt if encrypted
                            let displayContent = newMsg.content;
                            if (newMsg.is_encrypted && counterpartKeyRef.current) {
                                try {
                                    displayContent = await KeyManager.decryptMessage(newMsg.content, counterpartKeyRef.current);
                                } catch {
                                    displayContent = '\ud83d\udd12 Unable to decrypt';
                                }
                            }

                            const msgWithSender = { ...newMsg, content: displayContent, sender: senderData as unknown as Profile };

                            setMessages(prev => {
                                if (prev.some(m => m.id === msgWithSender.id)) return prev;
                                return [...prev, msgWithSender];
                            });

                            if (newMsg.sender_id !== currentProfile.id) {
                                markAsRead();
                            }
                        } else if (eventType === 'UPDATE') {
                            // Preserve decrypted content, only update metadata
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
        // UI update handled by realtime subscription
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !familyId) return;

        const plainContent = newMessage.trim();
        setNewMessage('');

        let finalContent = plainContent;
        let isEncrypted = false;

        // Encrypt for DMs if counterpart key is available
        if (recipientId && counterpartKeyRef.current) {
            try {
                finalContent = await KeyManager.encryptMessage(plainContent, counterpartKeyRef.current);
                isEncrypted = true;
            } catch (e) {
                console.error('Encryption failed, sending plaintext:', e);
            }
        }

        const { data, error } = await supabase.from('chat_messages').insert({
            family_id: familyId,
            sender_id: currentProfile.id,
            recipient_id: recipientId, // null for group
            content: finalContent,
            is_encrypted: isEncrypted,
            read_by: [currentProfile.id]
        }).select().single();

        if (error) {
            console.error('Error sending message:', error);
            alert("Failed to send message");
            setNewMessage(plainContent);
        } else if (data) {
            // Optimistic update with PLAINTEXT for display
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

            {/* Input Area - Fixed at bottom of this container */}
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
