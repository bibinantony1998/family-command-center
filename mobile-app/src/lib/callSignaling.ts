import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { METERED_APP_NAME, METERED_API_KEY } from '@env';

// Configuration
export const CALL_CONFIG = {
    // Default to unlimited/platform default (High Quality).
    // Set to 500000 for 500kbps constraints if bandwidth saving is needed.
    VIDEO_BITRATE_BPS: undefined as number | undefined,
    ICE_SERVERS_FALLBACK: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const DEBUG = true;
function log(...args: unknown[]) {
    if (DEBUG) console.log('[CallSignalingRN]', ...args);
}

// Types
export type SignalType = 'offer' | 'answer' | 'ice-candidate' | 'call-start' | 'call-end' | 'busy';

export interface SignalMessage {
    type: SignalType;
    callId: string;
    from: string;
    to: string;
    payload?: any;
    sdp?: any;
    candidate?: any;
}

export type SignalCallback = (message: SignalMessage) => void;

interface SharedChannel {
    channel: RealtimeChannel;
    subscribers: Set<SignalCallback>;
    status: string;
}

const channelCache = new Map<string, SharedChannel>();

function getChannelName(familyId: string, userId: string) {
    return `rtc:calls:${familyId}:${userId}`;
}

export class CallSignaling {
    private cleanupResults: (() => void)[] = [];

    constructor(
        private userId: string,
        private familyId: string,
        private onSignal: SignalCallback
    ) { }

    public subscribe() {
        const channelName = getChannelName(this.familyId, this.userId);
        log(`Subscribing to signaling channel: ${channelName}`);

        let shared = channelCache.get(channelName);

        if (!shared) {
            const channel = supabase.channel(channelName);
            shared = {
                channel,
                subscribers: new Set(),
                status: 'INITIALIZING'
            };
            channelCache.set(channelName, shared);

            channel
                .on('broadcast', { event: 'signal' }, (payload) => {
                    const msg = payload.payload as SignalMessage;
                    if (msg.to === this.userId) {
                        shared!.subscribers.forEach(cb => cb(msg));
                    }
                })
                .subscribe((status) => {
                    log(`Channel ${channelName} status: ${status}`);
                    if (shared) shared.status = status;
                });
        }

        shared.subscribers.add(this.onSignal);

        this.cleanupResults.push(() => {
            if (shared) {
                shared.subscribers.delete(this.onSignal);
                if (shared.subscribers.size === 0) {
                    supabase.removeChannel(shared.channel);
                    channelCache.delete(channelName);
                }
            }
        });
    }

    public async sendSignal(toUserId: string, type: SignalType, data: any = {}, callId: string) {
        const targetChannelName = getChannelName(this.familyId, toUserId);

        const payload: SignalMessage = {
            type,
            callId,
            from: this.userId,
            to: toUserId,
            ...data
        };

        log(`Sending ${type} to ${toUserId} (CallID: ${callId})`);

        const channel = supabase.channel(targetChannelName);
        await channel.subscribe();
        await channel.send({
            type: 'broadcast',
            event: 'signal',
            payload
        });
        supabase.removeChannel(channel);
    }

    public destroy() {
        this.cleanupResults.forEach(fn => fn());
        this.cleanupResults = [];
    }
}

export async function fetchTurnServers() {
    if (!METERED_APP_NAME || !METERED_API_KEY) {
        return CALL_CONFIG.ICE_SERVERS_FALLBACK;
    }

    try {
        const res = await fetch(`https://${METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`);
        if (!res.ok) throw new Error('Failed to fetch TURN');
        return await res.json();
    } catch (e) {
        console.warn('TURN fetch failed, using STUN fallback', e);
        return CALL_CONFIG.ICE_SERVERS_FALLBACK;
    }
}
