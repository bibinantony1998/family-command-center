import { supabase } from './supabase';
import { Platform } from 'react-native';
import { METERED_APP_NAME, METERED_API_KEY } from '@env';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * WebRTC P2P File Transfer utility for React Native.
 * Uses Supabase Broadcast for signaling and Metered.ca for TURN servers.
 * Implements a Channel Manager to handle shared signaling channels.
 */

const CHUNK_SIZE = 16384; // 16KB chunks

const DEBUG = true;
function log(...args: unknown[]) {
    if (DEBUG) console.log('[WebRTC-RN-DEBUG]', ...args);
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
        }, 10000);
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

async function fetchIceServers(): Promise<any[]> {
    const fallback = [{ urls: 'stun:stun.l.google.com:19302' }];

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
        console.error('[WebRTC-RN] Failed to fetch TURN credentials:', err);
        return fallback;
    }
}

function getSignalChannelName(familyId: string, userA: string, userB: string): string {
    return `rtc:signal:${familyId}:${[userA, userB].sort().join(':')}`;
}

export async function sendFileP2P(
    fileUri: string,
    fileName: string,
    fileType: 'image' | 'video' | 'audio',
    fileSize: number,
    senderId: string,
    recipientId: string,
    familyId: string,
    onProgress?: TransferProgressCallback,
    abortSignal?: AbortSignal
): Promise<boolean> {
    const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = require('react-native-webrtc');

    const transferId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const channelName = getSignalChannelName(familyId, senderId, recipientId);

    log(`📤 SEND START — file="${fileName}" size=${fileSize} to=${recipientId}`);

    const iceServers = await fetchIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    let releaseChannel: (() => void) | null = null;
    let hasResolved = false;

    // Read file ahead of time
    let arrayBuffer: ArrayBuffer;
    try {
        const ReactNativeBlobUtil = require('react-native-blob-util').default;
        const { Buffer } = require('buffer');

        let uriToRead = fileUri;
        if (Platform.OS === 'android' && fileUri.startsWith('content://')) {
            // react-native-blob-util handles content:// URIs directly
        } else {
            uriToRead = fileUri.replace('file://', '');
        }

        const base64 = await ReactNativeBlobUtil.fs.readFile(uriToRead, 'base64');
        arrayBuffer = Buffer.from(base64, 'base64').buffer;
        log(`📂 File read success: ${arrayBuffer.byteLength} bytes`);
    } catch (err) {
        log('❌ Failed to read file:', err);
        return false;
    }

    return new Promise<boolean>(async (resolve) => {
        const cleanup = () => {
            if (hasResolved) return;
            hasResolved = true;
            clearTimeout(timeoutHandle);
            pc.close();
            releaseChannel?.();
        };

        if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
                log('🛑 Transfer ABORTED by user');
                cleanup();
                resolve(false);
            });
        }

        let timeoutHandle: ReturnType<typeof setTimeout>;

        const resetTimeout = () => {
            clearTimeout(timeoutHandle);
            timeoutHandle = setTimeout(() => {
                log('❌ Transfer TIMED OUT due to inactivity');
                cleanup();
                resolve(false);
            }, 10000); // 10s inactivity
        };

        // Initial setup timeout
        timeoutHandle = setTimeout(() => {
            log('❌ Handshake TIMED OUT');
            cleanup();
            resolve(false);
        }, 60000);

        const onSignal = async (msg: any) => {
            if (msg.from === senderId) return;
            if (msg.transferId !== transferId) return;

            resetTimeout();

            log(`📨 SEND context received: type=${msg.type}`);

            if (msg.type === 'answer') {
                log('📨 Got ANSWER');
                await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            } else if (msg.type === 'ice-candidate') {
                log('📨 Got remote ICE candidate');
                await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
            }
        };

        releaseChannel = acquireChannel(channelName, onSignal);

        const ready = await waitForChannelReady(channelName);
        if (!ready) {
            cleanup();
            resolve(false);
            return;
        }

        const shared = channelCache.get(channelName);
        if (!shared) {
            cleanup();
            resolve(false);
            return;
        }
        const signalChannel = shared.channel;

        pc.onconnectionstatechange = () => {
            log(`🔗 Connection state: ${pc.connectionState}`);
            resetTimeout();
            if (pc.connectionState === 'failed') {
                cleanup();
                resolve(false);
            }
        };

        const dataChannel = pc.createDataChannel('fileTransfer', { ordered: true });

        dataChannel.onopen = async () => {
            log('📡 DataChannel OPEN — sending file...');
            resetTimeout();
            const metadata: FileMetadata = { fileName, fileType, fileSize, senderId, transferId };
            dataChannel.send(JSON.stringify({ type: 'metadata', data: metadata }));

            const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);
            let sentChunks = 0;

            for (let offset = 0; offset < arrayBuffer.byteLength; offset += CHUNK_SIZE) {
                if (hasResolved) break;
                resetTimeout();

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

        dataChannel.onmessage = (event: any) => {
            resetTimeout();
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'ack' && msg.transferId === transferId) {
                    log('✅ Got ACK');
                    cleanup();
                    resolve(true);
                }
            } catch { /* ignore */ }
        };

        pc.onicecandidate = (event: any) => {
            if (event.candidate) {
                log(`❄️ SEND ICE candidate (${event.candidate.type})`);
                signalChannel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'ice-candidate', candidate: event.candidate, from: senderId, transferId },
                });
            }
        };

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
                metadata: { fileName, fileType, fileSize },
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
    const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = require('react-native-webrtc');
    const channelName = getSignalChannelName(familyId, userId, counterpartId);

    log(`👂 LISTEN start on ${channelName}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transfers = new Map<string, any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

            log(`📨 RECV got OFFER from ${msg.from}, transferId=${msg.transferId}`);

            const iceServers = await fetchIceServers();
            const pc = new RTCPeerConnection({ iceServers });
            transfers.set(msg.transferId, pc);

            // Process buffered candidates
            if (pendingCandidates.has(msg.transferId)) {
                const buffered = pendingCandidates.get(msg.transferId)!;
                log(`Processing ${buffered.length} buffered candidates for ${msg.transferId}`);
                for (const candidate of buffered) {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                }
                pendingCandidates.delete(msg.transferId);
            }

            const receivedChunks: ArrayBuffer[] = [];
            let metadata: FileMetadata | null = null;
            let cleanupCalled = false;

            const shared = channelCache.get(channelName);
            if (!shared) {
                console.error('Channel lost during incoming offer');
                transfers.delete(msg.transferId);
                return;
            }
            const signalChannel = shared.channel;

            // Helper to cleanup
            const endTransfer = () => {
                if (cleanupCalled) return;
                cleanupCalled = true;
                transfers.delete(msg.transferId);
                setTimeout(() => {
                    try { dc?.close(); } catch { /* ignore */ }
                    try { pc.close(); } catch { /* ignore */ }
                }, 1000);
            };

            let dc: any = null;

            pc.ondatachannel = (event: any) => {
                const dc = event.channel;
                dc.onmessage = (msgEvent: any) => {
                    if (typeof msgEvent.data === 'string') {
                        try {
                            const parsed = JSON.parse(msgEvent.data);
                            if (parsed.type === 'metadata') {
                                metadata = parsed.data;
                                log(`📦 RECV metadata: size=${metadata!.fileSize}`);
                            } else if (parsed.type === 'done' && metadata) {
                                // Write to file instead of Blob
                                const ReactNativeBlobUtil = require('react-native-blob-util').default;
                                const { Buffer } = require('buffer');
                                const dirs = ReactNativeBlobUtil.fs.dirs;
                                const filePath = `${dirs.CacheDir}/${metadata.fileName}`;

                                // Combine chunks and write
                                const combinedBuffer = Buffer.concat(receivedChunks.map(ab => Buffer.from(ab)));
                                const base64 = combinedBuffer.toString('base64');

                                ReactNativeBlobUtil.fs.writeFile(filePath, base64, 'base64')
                                    .then(() => {
                                        log(`💾 File saved to: ${filePath}`);
                                        const fileUri = `file://${filePath}`;
                                        if (metadata) {
                                            onFileReceived(metadata, fileUri as any);
                                        }
                                        endTransfer();
                                    })
                                    .catch((err: any) => {
                                        console.error('File write error:', err);
                                        endTransfer();
                                    });

                                dc.send(JSON.stringify({ type: 'ack', transferId: parsed.transferId }));
                                log('✅ RECV sent ACK');
                            }
                        } catch { /* ignore */ }
                    } else {
                        receivedChunks.push(msgEvent.data);
                        if (metadata && onProgress) {
                            const received = receivedChunks.reduce((sum: number, c: ArrayBuffer) => sum + c.byteLength, 0);
                            onProgress(received / metadata.fileSize);
                        }
                    }
                };
            };

            pc.onicecandidate = (event: any) => {
                if (event.candidate) {
                    signalChannel.send({
                        type: 'broadcast',
                        event: 'signal',
                        payload: { type: 'ice-candidate', candidate: event.candidate, from: userId, transferId: msg.transferId },
                    });
                }
            };

            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            signalChannel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'answer', sdp: answer, from: userId, transferId: msg.transferId },
            });
        } catch (err) {
            console.error('❌ Error in onSignal (Mobile Receiver):', err);
        }
    };

    const release = acquireChannel(channelName, onSignal);

    return () => {
        log('👂 LISTEN cleanup');
        release();
    };
}

export type { FileMetadata };
