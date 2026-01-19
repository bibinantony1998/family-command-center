import { useState, useEffect } from 'react';
import type { Profile } from '../../types';
import { cn } from '../../lib/utils';
import { User, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ChatListProps {
    otherParents: Profile[];
    selectedRecipientId: string | null;
    onSelectChat: (recipientId: string | null) => void;
    familyId: string;
    currentUserId: string;
}

export function ChatList({ otherParents, selectedRecipientId, onSelectChat, familyId, currentUserId }: ChatListProps) {
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!familyId || !currentUserId) return;

        const fetchUnread = async () => {
            const { data } = await supabase
                .from('chat_messages')
                .select('sender_id, recipient_id, read_by')
                .eq('family_id', familyId);

            if (data) {
                const counts: Record<string, number> = {};
                let groupCount = 0;

                data.forEach((msg: any) => {
                    const readBy = msg.read_by || [];
                    const isUnread = !readBy.includes(currentUserId);

                    if (isUnread) {
                        // Only count if NOT sent by me (I don't need to read my own messages)
                        if (msg.sender_id === currentUserId) return;

                        if (msg.recipient_id === currentUserId) {
                            // Direct Message to me
                            counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
                        } else if (msg.recipient_id === null) {
                            // Group Message (Global unread)
                            groupCount++;
                        }
                    }
                });

                // Store group count with special key
                counts['GROUP'] = groupCount;
                setUnreadCounts(counts);
            }
        };

        fetchUnread();

        // Subscribe to changes to keep counts fresh
        const channel = supabase
            .channel('chat_list_unread')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `family_id=eq.${familyId}` }, () => {
                // Simple strategy: Re-fetch on any change. Optimizing delta updates is complex.
                fetchUnread();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [familyId, currentUserId]);

    return (
        <div className="space-y-3 p-1">
            {/* Family Board (Group) */}
            <div
                onClick={() => onSelectChat(null)}
                className={cn(
                    "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer relative",
                    selectedRecipientId === null
                        ? "bg-indigo-50 border-indigo-200 shadow-sm"
                        : "bg-white border-slate-100 shadow-sm hover:border-indigo-100"
                )}
            >
                <div className={cn(
                    "flex items-center justify-center h-12 w-12 rounded-full border-2",
                    selectedRecipientId === null ? "bg-indigo-100 border-indigo-200 text-indigo-600" : "bg-slate-50 border-slate-200 text-slate-500"
                )}>
                    <Users size={20} />
                </div>
                <div className="flex-1">
                    <h3 className={cn("font-bold text-lg", selectedRecipientId === null ? "text-indigo-900" : "text-slate-800")}>
                        Family Board
                    </h3>
                    <p className="text-sm text-slate-500">Group chat for everyone</p>
                </div>
                {(unreadCounts['GROUP'] || 0) > 0 && (
                    <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center shadow-sm">
                        {unreadCounts['GROUP']}
                    </div>
                )}
            </div>

            {/* Individual Parents */}
            {otherParents.map(parent => (
                <div
                    key={parent.id}
                    onClick={() => onSelectChat(parent.id)}
                    className={cn(
                        "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer relative",
                        selectedRecipientId === parent.id
                            ? "bg-indigo-50 border-indigo-200 shadow-sm"
                            : "bg-white border-slate-100 shadow-sm hover:border-indigo-100"
                    )}
                >
                    <div className="relative">
                        {parent.avatar_url ? (
                            <img
                                src={parent.avatar_url}
                                alt={parent.display_name || '?'}
                                className="h-12 w-12 rounded-full border-2 border-slate-200 object-cover"
                            />
                        ) : (
                            <div className={cn(
                                "flex items-center justify-center h-12 w-12 rounded-full border-2",
                                selectedRecipientId === parent.id ? "bg-indigo-100 border-indigo-200 text-indigo-600" : "bg-slate-50 border-slate-200 text-slate-500"
                            )}>
                                <User size={20} />
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <h3 className={cn("font-bold text-lg", selectedRecipientId === parent.id ? "text-indigo-900" : "text-slate-800")}>
                            {parent.display_name || 'Parent'}
                        </h3>
                        <p className="text-sm text-slate-500">Direct Message</p>
                    </div>
                    {(unreadCounts[parent.id] || 0) > 0 && (
                        <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center shadow-sm">
                            {unreadCounts[parent.id]}
                        </div>
                    )}
                </div>
            ))}

            {otherParents.length === 0 && (
                <div className="p-4 text-center text-slate-400 text-sm">
                    No other parents found in this family.
                </div>
            )}
        </div>
    );
}
