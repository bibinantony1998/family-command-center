import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

type ChatContextType = {
    // Total unread count across all conversations
    totalUnreadCount: number;
    // Map of sender_id -> unread count, plus "GROUP" -> count
    unreadCounts: Record<string, number>;
    // Method to force refresh (e.g. after reading)
    refreshUnreadCounts: () => Promise<void>;
};

const ChatContext = createContext<ChatContextType>({
    totalUnreadCount: 0,
    unreadCounts: {},
    refreshUnreadCounts: async () => { },
});

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
    const { user, family } = useAuth();
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
    const [totalUnreadCount, setTotalUnreadCount] = useState(0);

    const fetchUnreadCounts = async () => {
        if (!family?.id || !user?.id) return;
        try {
            const { data } = await supabase
                .from('chat_messages')
                .select('sender_id, recipient_id, read_by')
                .eq('family_id', family.id);

            if (data) {
                const counts: Record<string, number> = {};
                let groupCount = 0;
                let total = 0;

                data.forEach((msg: any) => {
                    const readBy = msg.read_by || [];
                    const isUnread = !readBy.includes(user.id);

                    if (isUnread) {
                        // Only count if NOT sent by me
                        if (msg.sender_id === user.id) return;

                        total++;

                        if (msg.recipient_id === user.id) {
                            // DM to me
                            counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
                        } else if (msg.recipient_id === null) {
                            // Group
                            groupCount++;
                        }
                    }
                });

                counts['GROUP'] = groupCount;
                setUnreadCounts(counts);
                setTotalUnreadCount(total);
            }
        } catch (e) {
            console.error('Error fetching unread counts:', e);
        }
    };

    useEffect(() => {
        if (family?.id && user?.id) {
            fetchUnreadCounts();

            // Realtime subscription for unread counts
            const channel = supabase
                .channel('chat_unread_global_mobile')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'chat_messages', filter: `family_id=eq.${family.id}` },
                    (payload) => {
                        // Even for UPDATE events (like marking as read), we should refetch
                        fetchUnreadCounts();
                    }
                )
                .subscribe();

            // FCM Registration
            const registerFCM = async () => {
                try {
                    const authStatus = await messaging().requestPermission();
                    const enabled =
                        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

                    if (enabled) {
                        const token = await messaging().getToken();
                        if (token) {
                            await supabase
                                .from('profiles')
                                .update({ fcm_token: token })
                                .eq('id', user.id);
                        }
                    }
                } catch (error) {
                    console.log('FCM Registration failed:', error);
                }
            };
            registerFCM();

            // Handle Token Refresh
            const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (token) => {
                if (user?.id) {
                    await supabase
                        .from('profiles')
                        .update({ fcm_token: token })
                        .eq('id', user.id);
                }
            });

            return () => {
                supabase.removeChannel(channel);
                unsubscribeTokenRefresh();
            };
        } else {
            // Reset if logged out or no family
            setUnreadCounts({});
            setTotalUnreadCount(0);
        }
    }, [family?.id, user?.id]);

    // Refetch on App Resume
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active' && family?.id && user?.id) {
                console.log('App active, refreshing chat counts...');
                fetchUnreadCounts();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [family?.id, user?.id]);

    return (
        <ChatContext.Provider value={{ totalUnreadCount, unreadCounts, refreshUnreadCounts: fetchUnreadCounts }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => useContext(ChatContext);
