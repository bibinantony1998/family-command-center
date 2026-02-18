import React, { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { CallSignaling, SignalMessage } from '../lib/callSignaling';
import { supabase } from '../lib/supabase';

export function CallListener() {
    const { user, family } = useAuth();
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
    const signaling = useRef<CallSignaling | null>(null);

    useEffect(() => {
        if (!user || !family) return;

        signaling.current = new CallSignaling(user.id, family.id, async (msg: SignalMessage) => {
            if (msg.type === 'offer') {
                console.log('[CallListener] Incoming call offer from:', msg.from);

                // Fetch caller's display name from profiles
                let callerName = 'Incoming Call';
                try {
                    const { data } = await supabase
                        .from('profiles')
                        .select('display_name')
                        .eq('id', msg.from)
                        .single();
                    if (data?.display_name) {
                        callerName = data.display_name;
                    }
                } catch (e) {
                    console.warn('[CallListener] Could not fetch caller name:', e);
                }

                // Navigate to VideoCallScreen — it will show Answer/Decline UI
                navigation.navigate('VideoCall', {
                    recipientId: msg.from,
                    name: callerName,
                    isCaller: false,
                    offer: msg
                });
            }
        });

        signaling.current.subscribe();

        return () => {
            if (signaling.current) {
                signaling.current.destroy();
                signaling.current = null;
            }
        };
    }, [user?.id, family?.id]);

    return null; // Logic only
}
