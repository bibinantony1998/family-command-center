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
        log(`🍦 Fetched ${servers.length} ICE servers`);
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
    onProgress?: TransferProgressCallback,
    abortSignal?: AbortSignal
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

        if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
                log('🛑 Transfer ABORTED by user');
                cleanup();
                resolve({ success: false, error: 'Transfer cancelled by user' });
            });
        }

        let timeoutHandle: ReturnType<typeof setTimeout>;

        const resetTimeout = () => {
            clearTimeout(timeoutHandle);
            timeoutHandle = setTimeout(() => {
                log('❌ Transfer TIMED OUT due to inactivity');
                cleanup();
                resolve({ success: false, error: 'Transfer timed out (stalled)' });
            }, 10000); // 10s inactivity timeout
        };

        // Initial setup timeout (longer for handshake)
        timeoutHandle = setTimeout(() => {
            log('❌ Handshake TIMED OUT');
            cleanup();
            resolve({ success: false, error: 'Connection setup timed out' });
        }, 60000);

        // Define signal handler for this specific transfer
        const onSignal = async (msg: any) => {
            if (msg.from === senderId) return;
            // Only care about messages for THIS transfer
            if (msg.transferId !== transferId) return;

            resetTimeout(); // Reset on any signal activity

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
            resetTimeout();
            if (pc.connectionState === 'failed') {
                cleanup();
                resolve({ success: false, error: 'WebRTC connection failed' });
            }
        };

        const dataChannel = pc.createDataChannel('fileTransfer', { ordered: true });

        dataChannel.onopen = async () => {
            log('📡 DataChannel OPEN — sending file...');
            resetTimeout();
            const metadata: FileMetadata = { fileName, fileType, fileSize: file.size, senderId, transferId };
            dataChannel.send(JSON.stringify({ type: 'metadata', data: metadata }));

            const arrayBuffer = await file.arrayBuffer();
            const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);
            let sentChunks = 0;

            for (let offset = 0; offset < arrayBuffer.byteLength; offset += CHUNK_SIZE) {
                if (hasResolved) break; // Stop if failed/closed
                resetTimeout(); // Reset timer for every chunk

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
            resetTimeout();
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

    const transfers = new Map<string, RTCPeerConnection>();
    const pendingCandidates = new Map<string, any[]>();

    const onSignal = async (msg: any) => {
        try {
            if (msg.from === userId) return;

            // Handle ICE Candidates
            if (msg.type === 'ice-candidate') {
                // Check if we have an active transfer for this ID
                const pc = transfers.get(msg.transferId);
                if (pc) {
                    log(`❄️ RECV ICE candidate for ${msg.transferId}:`, msg.candidate);
                    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                } else {
                    // Buffer candidate if PC not ready yet (race condition with fetchIceServers)
                    log(`⏳ Buffering ICE candidate for ${msg.transferId}`);
                    if (!pendingCandidates.has(msg.transferId)) {
                        pendingCandidates.set(msg.transferId, []);
                    }
                    pendingCandidates.get(msg.transferId)!.push(msg.candidate);
                }
                return;
            }

            if (msg.type !== 'offer') return;

            log(`📨 RECV got OFFER form ${msg.from}, transferId=${msg.transferId}`);

            try {
                // Determine ICE servers (turn/stun)
                const iceServers = await fetchIceServers();
                const pc = new RTCPeerConnection({ iceServers });

                transfers.set(msg.transferId, pc);

                // Add buffered ICE candidates
                if (pendingCandidates.has(msg.transferId)) {
                    const buffered = pendingCandidates.get(msg.transferId)!;
                    log(`Processing ${buffered.length} buffered candidates for ${msg.transferId}`);
                    for (const candidate of buffered) {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (e) {
                            console.error(`Failed to add buffered candidate:`, e);
                        }
                    }
                    pendingCandidates.delete(msg.transferId);
                }

                const shared = channelCache.get(channelName);
                if (!shared) {
                    console.error('Channel lost during incoming offer handling');
                    transfers.delete(msg.transferId);
                    return;
                }
                const signalChannel = shared.channel;

                let cleanupCalled = false;
                const endTransfer = () => {
                    if (cleanupCalled) return;
                    cleanupCalled = true;
                    // Remove from active transfers map
                    transfers.delete(msg.transferId);

                    // Delay close to ensure ACK sends
                    setTimeout(() => {
                        log(`Closing transfer ${msg.transferId}`);
                        try { if (pc.signalingState !== 'closed') pc.close(); } catch (e) { console.warn('Error closing PC:', e); }
                    }, 2000);
                };

                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        log(`❄️ SEND ICE candidate (${event.candidate.type})`);
                        signalChannel.send({
                            type: 'broadcast',
                            event: 'signal',
                            payload: {
                                type: 'ice-candidate',
                                candidate: event.candidate,
                                from: userId,
                                transferId: msg.transferId
                            },
                        }).catch(err => console.error('Failed to send ICE candidate:', err));
                    }
                };

                pc.onconnectionstatechange = () => {
                    log(`Connection state changed: ${pc.connectionState}`);
                    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
                        // Only cleanup on failure/close, not unstable
                        if (pc.connectionState !== 'closed') endTransfer();
                    }
                };

                pc.ondatachannel = (event) => {
                    const dc = event.channel;
                    log(`Rx DataChannel open: ${dc.label}`);

                    let receivedChunks: ArrayBuffer[] = [];
                    let metadata: FileMetadata | null = null;
                    let receivedBytes = 0;

                    dc.onopen = () => log('DataChannel OPEN on receiver side');
                    dc.onerror = (err: any) => {
                        if (cleanupCalled) return;
                        if (err.error?.message === 'User-Initiated Abort, reason=Close called') return;
                        console.error('DataChannel ERROR:', err);
                    };

                    dc.onmessage = (msgEvent: any) => {
                        const data = msgEvent.data;
                        if (typeof data === 'string') {
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.type === 'metadata') {
                                    metadata = parsed.data;
                                    receivedBytes = 0;
                                    receivedChunks = [];
                                    log(`📦 RECV metadata: ${metadata?.fileName}, size=${metadata?.fileSize}`);
                                } else if (parsed.type === 'done' && metadata) {
                                    log('✅ RECV DONE signal. Assembling file...');
                                    const blob = new Blob(receivedChunks); // type depends on metadata
                                    if (onFileReceived) onFileReceived(metadata, blob);

                                    // Send ACK
                                    try {
                                        dc.send(JSON.stringify({ type: 'ack', transferId: parsed.transferId }));
                                        log('Sent ACK');
                                    } catch (e) {
                                        console.error('Failed to send ACK:', e);
                                    }

                                    endTransfer();
                                }
                            } catch (e) {
                                console.error('Error parsing signaling message:', e);
                            }
                        } else {
                            // Binary chunk
                            receivedChunks.push(data);
                            receivedBytes += (data.byteLength || data.size || 0);

                            if (metadata && onProgress) {
                                onProgress(receivedBytes / metadata.fileSize);
                            }
                        }
                    };
                };

                // Set Remote Description (Offer)
                log(`Setting Remote Description...`);
                await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));

                // Create Answer
                log(`Creating Answer...`);
                const answer = await pc.createAnswer();

                // Set Local Description (Answer)
                log(`Setting Local Description...`);
                await pc.setLocalDescription(answer);

                // Send Answer
                log(`Sending ANSWER...`);
                await signalChannel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: {
                        type: 'answer',
                        sdp: answer,
                        from: userId,
                        transferId: msg.transferId
                    },
                });
                log(`✅ ANSWER sent for ${msg.transferId}`);

            } catch (err) {
                console.error('❌ Error handling OFFER:', err);
                // We should probably inform the sender, but for now just log
            }

        } catch (err) {
            console.error('❌ Error in onSignal (Receiver):', err);
            // Ensure we clean up if initial setup fails
            if (msg.type === 'offer') {
                transfers.delete(msg.transferId);
            }
        }
    };

    const release = acquireChannel(channelName, onSignal);

    return () => {
        log('👂 LISTEN cleanup');
        release();
    };
}
