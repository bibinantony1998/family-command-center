import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Hook to track online presence for family members using Supabase Realtime Presence.
 * Joins a presence channel scoped to the family and tracks which users are online.
 */
export function usePresence(familyId: string | null, userId: string | null) {
    const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        if (!familyId || !userId) return;

        const channel = supabase.channel(`presence:family:${familyId}`, {
            config: { presence: { key: userId } },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const ids = new Set<string>();
                for (const key of Object.keys(state)) {
                    ids.add(key);
                }
                setOnlineUserIds(ids);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ user_id: userId, online_at: new Date().toISOString() });
                }
            });

        channelRef.current = channel;

        return () => {
            channel.untrack();
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [familyId, userId]);

    const isUserOnline = (targetUserId: string): boolean => {
        return onlineUserIds.has(targetUserId);
    };

    return { onlineUserIds, isUserOnline };
}
