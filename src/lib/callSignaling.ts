import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// Configuration
export const CALL_CONFIG = {
    // Default to High Quality (unlimited/browser default). 
    // Set to 500000 for 500kbps constraints if bandwidth saving is needed.
    VIDEO_BITRATE_BPS: undefined as number | undefined,
    ICE_SERVERS_FALLBACK: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const DEBUG = true;
function log(...args: unknown[]) {
    if (DEBUG) console.log('[CallSignaling]', ...args);
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

// Channel Manager (Shared with other WebRTC modules logic effectively)
interface SharedChannel {
    channel: RealtimeChannel;
    subscribers: Set<SignalCallback>;
    status: string;
}

const channelCache = new Map<string, SharedChannel>();

function getChannelName(familyId: string, userId: string) {
    // Each user listens on their OWN personal channel for incoming calls
    // Channel name: rtc:calls:{familyId}:{userId}
    return `rtc:calls:${familyId}:${userId}`;
}

export class CallSignaling {
    private cleanupResults: (() => void)[] = [];
    private userId: string;
    private familyId: string;
    private onSignal: SignalCallback;

    constructor(userId: string, familyId: string, onSignal: SignalCallback) {
        this.userId = userId;
        this.familyId = familyId;
        this.onSignal = onSignal;
    }

    /**
     * Start listening for generic incoming signals (offers, answers, candidates) 
     * targeted at this user.
     */
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

    /**
     * Send a signal to a specific target user
     */
    public async sendSignal(toUserId: string, type: SignalType, data: any = {}, callId: string) {
        const targetChannelName = getChannelName(this.familyId, toUserId);

        // We broadcast to the TARGET's channel
        // Note: Supabase Realtime Broadcasts are "fire and forget" to anyone subscribed to that topic

        const payload: SignalMessage = {
            type,
            callId,
            from: this.userId,
            to: toUserId,
            ...data
        };

        log(`Sending ${type} to ${toUserId} (CallID: ${callId})`);

        // To send to a channel, we technically don't need to be subscribed to it if we use 
        // a throwaway channel object, but it's better to reuse if possible.
        // However, standard Supabase pattern is: You send on a channel you are attached to? 
        // Implementation detail: You can publish to any topic.

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
    // Re-use the metering logic from env
    const appName = import.meta.env.VITE_METERED_APP_NAME;
    const apiKey = import.meta.env.VITE_METERED_API_KEY;

    if (!appName || !apiKey) {
        return CALL_CONFIG.ICE_SERVERS_FALLBACK;
    }

    try {
        const res = await fetch(`https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`);
        if (!res.ok) throw new Error('Failed to fetch TURN');
        return await res.json();
    } catch (e) {
        console.warn('TURN fetch failed, using STUN fallback', e);
        return CALL_CONFIG.ICE_SERVERS_FALLBACK;
    }
}
