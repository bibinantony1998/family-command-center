import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import type { SignalMessage } from '../lib/callSignaling';
import { CallSignaling } from '../lib/callSignaling';
import { VideoCallOverlay } from '../components/chat/VideoCallOverlay';

interface CallContextType {
    startCall: (recipientId: string, name: string) => void;
    isInCall: boolean;
}

const CallContext = createContext<CallContextType>({
    startCall: () => { },
    isInCall: false,
});

export function CallProvider({ children }: { children: React.ReactNode }) {
    const { profile, family } = useAuth(); // Correct property names from AuthContext

    // Call State
    const [callState, setCallState] = useState<'idle' | 'incoming' | 'outgoing' | 'active'>('idle');
    const [recipientId, setRecipientId] = useState<string | null>(null);
    const [recipientName, setRecipientName] = useState<string>('');
    const [incomingOffer, setIncomingOffer] = useState<SignalMessage | null>(null);

    const signaling = useRef<CallSignaling | null>(null);

    // Call Actions
    const startCall = useCallback((recId: string, name: string) => {
        setRecipientId(recId);
        setRecipientName(name);
        setCallState('outgoing');
    }, []);

    const endCall = useCallback(() => {
        setCallState('idle');
        setRecipientId(null);
        setIncomingOffer(null);
    }, []);

    // Listen for incoming calls
    useEffect(() => {
        if (!profile?.id || !family?.id) return;

        signaling.current = new CallSignaling(profile.id, family.id, (msg: SignalMessage) => {
            if (msg.type === 'offer') {
                if (callState === 'idle') {
                    console.log('Incoming call from', msg.from);
                    setRecipientId(msg.from);
                    setIncomingOffer(msg);
                    setCallState('incoming');
                    // Play ringtone here if desired
                } else {
                    // Busy
                    // generic signaling should probably have a 'busy' type, but for now just ignore
                }
            }
        });

        signaling.current.subscribe();

        return () => {
            if (signaling.current) {
                // We don't destroy here because we want to persist if possible, 
                // but usually component unmounts on logout.
                signaling.current.destroy();
                signaling.current = null;
            }
        };
    }, [profile?.id, family?.id, callState]);

    return (
        <CallContext.Provider value={{ startCall, isInCall: callState !== 'idle' }}>
            {children}
            {callState !== 'idle' && recipientId && (
                <VideoCallOverlay
                    recipientId={recipientId}
                    name={recipientName || 'Unknown'}
                    isCaller={callState === 'outgoing'}
                    offer={incomingOffer || undefined}
                    onClose={endCall}
                    currentProfile={profile!}
                    familyId={family!.id}
                />
            )}
        </CallContext.Provider>
    );
}

export const useCall = () => useContext(CallContext);
