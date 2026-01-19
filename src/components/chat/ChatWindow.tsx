import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { ChatMessage, Profile } from '../../types';
import { MessageBubble } from './MessageBubble';
import { Send } from 'lucide-react';

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
            // Call RPC to atomically update read_by array for all relevant messages
            // This works for both DMs and Group chats
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
                    setMessages((data as unknown as ChatMessage[]) || []);
                    markAsRead(); // Mark visible messages as read
                }
            } catch (err) {
                console.error("Exception in fetchMessages:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('chat_messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages'
                },
                async (payload) => {
                    console.log("Realtime event received (Raw):", payload);
                    const newMsg = payload.new as ChatMessage;

                    // Manual filter for safety
                    if (newMsg.family_id !== familyId) {
                        console.log("Ignoring message from other family:", newMsg.family_id);
                        return;
                    }

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
                        // Start: Fetch sender details for the new message to display name correctly
                        const { data: senderData } = await supabase
                            .from('profiles')
                            .select('display_name, avatar_url')
                            .eq('id', newMsg.sender_id)
                            .single();

                        // Type assertion for sender data
                        const msgWithSender = { ...newMsg, sender: senderData as unknown as Profile };

                        setMessages(prev => {
                            if (prev.some(m => m.id === msgWithSender.id)) return prev;
                            return [...prev, msgWithSender];
                        });

                        // Mark this new message as read immediately if I am viewing it
                        if (newMsg.sender_id !== currentProfile.id) {
                            markAsRead();
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };

    }, [familyId, currentProfile.id, recipientId]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !familyId) return;

        const content = newMessage.trim();
        setNewMessage('');

        const { data, error } = await supabase.from('chat_messages').insert({
            family_id: familyId,
            sender_id: currentProfile.id,
            recipient_id: recipientId, // null for group
            content: content
        }).select().single();

        if (error) {
            console.error('Error sending message:', error);
            alert("Failed to send message");
            setNewMessage(content);
        } else if (data) {
            // Instant update
            const newMsgObj: ChatMessage = {
                ...data,
                sender: currentProfile // We know the sender is us
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
