import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * WebRTC P2P File Transfer utility.
 * Uses Supabase Broadcast for signaling and Metered.ca for TURN servers.
 * Implements a Channel Manager to handle shared signaling channels.
 */

const CHUNK_SIZE = 16384; // 16KB chunks
const METERED_APP_NAME = import.meta.env.VITE_METERED_APP_NAME || '';
const METERED_API_KEY = import.meta.env.VITE_METERED_API_KEY || '';

const DEBUG = true;
function log(...args: unknown[]) {
    if (DEBUG) console.log('[WebRTC]', ...args);
}

// --- Channel Manager ---
type SignalCallback = (payload: any) => void;

interface SharedChannel {
    channel: RealtimeChannel;
    refCount: number;
    subscribers: Set<SignalCallback>;
    status: string;
}

const channelCache = new Map<string, SharedChannel>();

function acquireChannel(topic: string, onSignal: SignalCallback): () => void {
    let shared = channelCache.get(topic);

    if (!shared) {
        log(`Create NEW channel manager for: ${topic}`);
        const channel = supabase.channel(topic);
        shared = {
            channel,
            refCount: 0,
            subscribers: new Set(),
            status: 'INITIALIZING'
        };
        channelCache.set(topic, shared);

        // Setup single master listener
        channel
            .on('broadcast', { event: 'signal' }, (payload) => {
                const msg = payload.payload;
                // Dispatch to all internal subscribers
                shared!.subscribers.forEach(cb => cb(msg));
            })
            .subscribe((status) => {
                log(`📡 Channel ${topic} status: ${status}`);
                if (shared) shared.status = status;
            });
    }

    shared.refCount++;
    shared.subscribers.add(onSignal);
    log(`Acquired channel ${topic} (refs: ${shared.refCount})`);

    // Return cleanup function
    return () => {
        const item = channelCache.get(topic);
        if (!item) return;

        item.subscribers.delete(onSignal);
        item.refCount--;
        log(`Released channel ${topic} (refs: ${item.refCount})`);

        if (item.refCount <= 0) {
            log(`Closing channel ${topic} as refCount is 0`);
            supabase.removeChannel(item.channel);
            channelCache.delete(topic);
        }
    };
}

// Helper to wait for channel to be ready
async function waitForChannelReady(topic: string): Promise<boolean> {
    const shared = channelCache.get(topic);
    if (!shared) return false;

    if (shared.status === 'SUBSCRIBED') return true;

    return new Promise((resolve) => {
        const check = setInterval(() => {
            const item = channelCache.get(topic);
            if (!item) {
                clearInterval(check);
                resolve(false);
            } else if (item.status === 'SUBSCRIBED') {
                clearInterval(check);
                resolve(true);
            } else if (item.status === 'CLOSED' || item.status === 'CHANNEL_ERROR') {
                clearInterval(check);
                resolve(false);
            }
        }, 100);
        setTimeout(() => {
            clearInterval(check);
            resolve(false);
        }, 10000); // 10s timeout for subscription
    });
}
// -----------------------

interface FileMetadata {
    fileName: string;
    fileType: 'image' | 'video' | 'audio';
    fileSize: number;
    senderId: string;
    transferId: string;
}

type TransferProgressCallback = (progress: number) => void;
type FileReceivedCallback = (metadata: FileMetadata, blob: Blob) => void;

async function fetchIceServers(): Promise<RTCIceServer[]> {
    const fallback: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

    if (!METERED_APP_NAME || !METERED_API_KEY) {
        log('⚠️ No Metered.ca credentials — using STUN only');
        return fallback;
    }

    try {
        const res = await fetch(
            `https://${METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const servers = await res.json();
        return servers;
    } catch (err) {
        console.error('[WebRTC] Failed to fetch TURN credentials:', err);
        return fallback;
    }
}

function getSignalChannelName(familyId: string, userA: string, userB: string): string {
    return `rtc:signal:${familyId}:${[userA, userB].sort().join(':')}`;
}

export async function sendFileP2P(
    file: File | Blob,
    fileName: string,
    fileType: 'image' | 'video' | 'audio',
    senderId: string,
    recipientId: string,
    familyId: string,
    onProgress?: TransferProgressCallback
): Promise<{ success: boolean; error?: string }> {
    const transferId = crypto.randomUUID();
    const channelName = getSignalChannelName(familyId, senderId, recipientId);

    log(`📤 SEND START — file="${fileName}" size=${file.size} to=${recipientId}`);

    const iceServers = await fetchIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    // Acquire shared channel
    let releaseChannel: (() => void) | null = null;
    let hasResolved = false;

    return new Promise<{ success: boolean; error?: string }>(async (resolve) => {
        const cleanup = () => {
            if (hasResolved) return;
            hasResolved = true;
            clearTimeout(timeoutHandle);
            pc.close();
            releaseChannel?.(); // Release the shared channel ref
        };

        const timeoutHandle = setTimeout(() => {
            log('❌ Transfer TIMED OUT after 30s');
            cleanup();
            resolve({ success: false, error: 'Transfer timed out — recipient may not have the chat open' });
        }, 30000);

        // Define signal handler for this specific transfer
        const onSignal = async (msg: any) => {
            if (msg.from === senderId) return;
            // Only care about messages for THIS transfer
            if (msg.transferId !== transferId) return;

            log(`📨 SEND context received: type=${msg.type}`);

            if (msg.type === 'answer') {
                log('📨 Got ANSWER');
                await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
            } else if (msg.type === 'ice-candidate') {
                log('📨 Got remote ICE candidate');
                await pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit));
            }
        };

        // 1. Acquire Channel
        releaseChannel = acquireChannel(channelName, onSignal);

        // 2. Wait for it to be SUBSCRIBED
        const ready = await waitForChannelReady(channelName);
        if (!ready) {
            cleanup();
            resolve({ success: false, error: 'Signaling channel failed to connect' });
            return;
        }

        const shared = channelCache.get(channelName);
        if (!shared) {
            cleanup();
            resolve({ success: false, error: 'Channel lost' });
            return;
        }
        const signalChannel = shared.channel;

        // PC Callbacks
        pc.onconnectionstatechange = () => {
            log(`🔗 Connection state: ${pc.connectionState}`);
            if (pc.connectionState === 'failed') {
                cleanup();
                resolve({ success: false, error: 'WebRTC connection failed' });
            }
        };

        const dataChannel = pc.createDataChannel('fileTransfer', { ordered: true });

        dataChannel.onopen = async () => {
            log('📡 DataChannel OPEN — sending file...');
            const metadata: FileMetadata = { fileName, fileType, fileSize: file.size, senderId, transferId };
            dataChannel.send(JSON.stringify({ type: 'metadata', data: metadata }));

            const arrayBuffer = await file.arrayBuffer();
            const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);
            let sentChunks = 0;

            for (let offset = 0; offset < arrayBuffer.byteLength; offset += CHUNK_SIZE) {
                const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
                while (dataChannel.bufferedAmount > CHUNK_SIZE * 8) {
                    await new Promise(r => setTimeout(r, 10));
                }
                dataChannel.send(chunk);
                sentChunks++;
                onProgress?.(sentChunks / totalChunks);
            }

            log(`✅ All chunks sent`);
            dataChannel.send(JSON.stringify({ type: 'done', transferId }));
        };

        dataChannel.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'ack' && msg.transferId === transferId) {
                    log('✅ Got ACK');
                    cleanup();
                    resolve({ success: true });
                }
            } catch { /* ignore */ }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                signalChannel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'ice-candidate', candidate: event.candidate, from: senderId, transferId },
                });
            }
        };

        // Create Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        signalChannel.send({
            type: 'broadcast',
            event: 'signal',
            payload: {
                type: 'offer',
                sdp: offer,
                from: senderId,
                transferId,
                metadata: { fileName, fileType, fileSize: file.size },
            },
        });
        log('📡 OFFER sent');
    });
}

export function listenForIncomingFiles(
    userId: string,
    familyId: string,
    counterpartId: string,
    onFileReceived: FileReceivedCallback,
    onProgress?: TransferProgressCallback
): () => void {
    const channelName = getSignalChannelName(familyId, userId, counterpartId);

    log(`👂 LISTEN start on ${channelName}`);

    const onSignal = async (msg: any) => {
        if (msg.from === userId) return;
        if (msg.type !== 'offer') return;

        log(`📨 RECV got OFFER form ${msg.from}, transferId=${msg.transferId}`);

        const iceServers = await fetchIceServers();
        const pc = new RTCPeerConnection({ iceServers });
        const receivedChunks: ArrayBuffer[] = [];
        let metadata: FileMetadata | null = null;

        // We need to send answers back on the same shared channel
        // But we don't 'acquire' it again here, we assume the listener IS the one holding it open?
        // Actually, we should just use the channel instance if we can get it, OR just acquire it momentarily?
        // But `pc.onicecandidate` needs to send signals.
        // It's safer to acquire it? No, if we acquire it inside the callback, we increase ref count.
        // Let's use `channelCache.get(channelName)` which MUST exist because we are in the listener callback.

        const shared = channelCache.get(channelName);
        if (!shared) {
            console.error('Channel lost during incoming offer handling');
            return;
        }
        const signalChannel = shared.channel;

        pc.ondatachannel = (event) => {
            const dc = event.channel;
            dc.onmessage = (msgEvent) => {
                if (typeof msgEvent.data === 'string') {
                    try {
                        const parsed = JSON.parse(msgEvent.data);
                        if (parsed.type === 'metadata') {
                            metadata = parsed.data;
                            log(`📦 RECV metadata: size=${metadata!.fileSize}`);
                        } else if (parsed.type === 'done' && metadata) {
                            const blob = new Blob(receivedChunks);
                            onFileReceived(metadata, blob);
                            dc.send(JSON.stringify({ type: 'ack', transferId: parsed.transferId }));
                            log('✅ RECV sent ACK');
                            setTimeout(() => { dc.close(); pc.close(); }, 500);
                        }
                    } catch { /* ignore */ }
                } else {
                    receivedChunks.push(msgEvent.data);
                    if (metadata && onProgress) {
                        const received = receivedChunks.reduce((sum, c) => sum + c.byteLength, 0);
                        onProgress(received / metadata.fileSize);
                    }
                }
            };
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                signalChannel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'ice-candidate', candidate: event.candidate, from: userId, transferId: msg.transferId },
                });
            }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        signalChannel.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'answer', sdp: answer, from: userId, transferId: msg.transferId },
        });
    };

    const release = acquireChannel(channelName, onSignal);

    return () => {
        log('👂 LISTEN cleanup');
        release();
    };
}
