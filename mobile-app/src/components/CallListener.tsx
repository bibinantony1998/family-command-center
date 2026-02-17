import React, { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { CallSignaling, SignalMessage } from '../lib/callSignaling';
import { Alert } from 'react-native';

export function CallListener() {
    const { user, family } = useAuth();
    const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
    const signaling = useRef<CallSignaling | null>(null);

    useEffect(() => {
        if (!user || !family) return;

        signaling.current = new CallSignaling(user.id, family.id, (msg: SignalMessage) => {
            if (msg.type === 'offer') {
                // Incoming call!
                console.log('Incoming call offer received:', msg);

                // We should check if we are already in a call?
                // For now, just navigate. The VideoCallScreen will handle the rest (and adopt the callId).
                // We might want to show a "Answer/Decline" customized UI here (like a full screen modal) 
                // but for MVP, navigating to VideoCallScreen acts as "Opening the call UI".
                // The VideoCallScreen logic will see "offer" param and trigger "Connecting..."/Auto-Answer or Wait for user accept.
                // Currently VideoCallScreen logic with `offer` param does:
                // setRemoteDescription -> createAnswer. It auto-answers.
                // Ideally we want to RING first. 
                // But let's stick to simple implementation: Navigate -> Connects.
                // User can "End Call" to reject.

                navigation.navigate('VideoCall', {
                    recipientId: msg.from,
                    name: 'Incoming Call...', // We could fetch name if we had it, or just show "Incoming"
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
