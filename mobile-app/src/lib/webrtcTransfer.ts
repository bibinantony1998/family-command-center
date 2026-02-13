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
    messageId?: string; // New field for pre-generated Message ID
}

type TransferProgressCallback = (progress: number) => void;
type FileReceivedCallback = (metadata: FileMetadata, fileUri: string) => void;

async function fetchIceServers(): Promise<any[]> {
    const fallback = [{ urls: 'stun:stun.l.google.com:19302' }];

    if (!METERED_APP_NAME || !METERED_API_KEY) {
        log('⚠️ No Metered.ca credentials — using STUN only');
        return fallback;
    }

    try {
        log(`🍦 Fetching ICE servers for app: ${METERED_APP_NAME}`);
        const res = await fetch(
            `https://${METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const servers = await res.json();
        log(`🍦 Fetched ${servers.length} ICE servers. Example: ${JSON.stringify(servers[0])}`);
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
    messageId: string, // New arg
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
            }, 30000); // 30s inactivity
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
                log('❌ Connection failed. ICE Connection State:', pc.iceConnectionState);
                log('❌ Signaling State:', pc.signalingState);
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

                // throttling to prevent buffer overflow
                while (dataChannel.bufferedAmount > CHUNK_SIZE * 8) {
                    await new Promise(r => setTimeout(r, 10));
                }

                // React Native WebRTC handles ArrayBuffer directly
                dataChannel.send(chunk);
                sentChunks++;
                onProgress?.(sentChunks / totalChunks);
            }

            log(`✅ All chunks sent`);

            // Give the receiver a moment to process the last binary chunk
            await new Promise(r => setTimeout(r, 100));

            dataChannel.send(JSON.stringify({ type: 'done', transferId }));
            resetTimeout(); // Reset again after done signal to wait for ACK
        };

        dataChannel.onmessage = (event: any) => {
            resetTimeout();
            try {
                // Handle both string and potentially binary ACKs if we ever switch
                const data = event.data;
                if (typeof data === 'string') {
                    const msg = JSON.parse(data);
                    if (msg.type === 'ack' && msg.transferId === transferId) {
                        log('✅ Got ACK');
                        cleanup();
                        resolve(true);
                    }
                }
            } catch { /* ignore */ }
        };

        pc.onicecandidate = (event: any) => {
            if (event.candidate) {
                // RTCIceCandidate in RN might not have 'type', use candidate string or generic log
                log(`❄️ SEND ICE candidate`);
                signalChannel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'ice-candidate', candidate: event.candidate, from: senderId, transferId },
                });
            } else {
                log('❄️ End of candidates (null)');
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
            // Strict check: Ignore own messages to prevent feedback loops
            if (msg.from === userId) {
                // log(`Ignoring own signal from ${msg.from}`);
                return;
            }

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

            try {
                const iceServers = await fetchIceServers();
                const pc = new RTCPeerConnection({ iceServers });
                transfers.set(msg.transferId, pc);

                // Process buffered candidates
                if (pendingCandidates.has(msg.transferId)) {
                    const buffered = pendingCandidates.get(msg.transferId)!;
                    if (buffered && buffered.length > 0) {
                        log(`Processing ${buffered.length} buffered candidates for ${msg.transferId}`);
                        for (const candidate of buffered) {
                            try {
                                if (candidate) {
                                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                                }
                            } catch (e) {
                                console.warn(`Failed to add buffered candidate:`, e);
                            }
                        }
                    }
                    pendingCandidates.delete(msg.transferId);
                }

                const ReactNativeBlobUtil = require('react-native-blob-util').default;
                const { Buffer } = require('buffer');

                let metadata: FileMetadata | null = null;
                let cleanupCalled = false;
                let writeStream: any = null;
                let receivedBytes = 0;

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

                    if (writeStream) {
                        try { writeStream.close(); } catch { }
                        writeStream = null;
                    }

                    setTimeout(() => {
                        try { dc?.close(); } catch { /* ignore */ }
                        try { pc.close(); } catch { /* ignore */ }
                    }, 1000);
                };

                let dc: any = null;

                pc.ondatachannel = (event: any) => {
                    const dc = event.channel;
                    log(`Rx DataChannel open: ${dc.label}`);

                    dc.onopen = () => log('DataChannel OPEN on receiver side');
                    dc.onerror = (err: any) => {
                        if (cleanupCalled) return;
                        console.error('DataChannel ERROR:', err);
                    };

                    dc.onmessage = async (msgEvent: any) => {
                        if (typeof msgEvent.data === 'string') {
                            try {
                                const parsed = JSON.parse(msgEvent.data);
                                if (parsed.type === 'metadata') {
                                    metadata = parsed.data;
                                    log(`📦 RECV metadata: size=${metadata!.fileSize}`);

                                    // Initialize Write Stream
                                    const dirs = ReactNativeBlobUtil.fs.dirs;
                                    const filePath = `${dirs.CacheDir}/${metadata!.fileName}`;

                                    // Delete existing if any
                                    if (await ReactNativeBlobUtil.fs.exists(filePath)) {
                                        await ReactNativeBlobUtil.fs.unlink(filePath);
                                    }

                                    try {
                                        writeStream = await ReactNativeBlobUtil.fs.writeStream(filePath, 'base64');
                                    } catch (e) {
                                        console.error('Failed to create write stream:', e);
                                        endTransfer();
                                    }

                                } else if (parsed.type === 'done' && metadata) {
                                    log('✅ RECV DONE signal. Finalizing...');

                                    if (writeStream) {
                                        writeStream.close();
                                        writeStream = null;
                                    }

                                    // Send ACK immediately
                                    try {
                                        dc.send(JSON.stringify({ type: 'ack', transferId: parsed.transferId }));
                                        log('Sent ACK');
                                    } catch (e) {
                                        console.warn('Failed to send ACK:', e);
                                    }

                                    const dirs = ReactNativeBlobUtil.fs.dirs;
                                    const filePath = `${dirs.CacheDir}/${metadata.fileName}`;
                                    const fileUri = `file://${filePath}`;

                                    log(`💾 File saved to: ${filePath}`);
                                    if (onFileReceived) {
                                        // Run on next tick
                                        setTimeout(() => onFileReceived(metadata!, fileUri), 0);
                                    }

                                    endTransfer();
                                }
                            } catch { /* ignore */ }
                        } else {
                            // Binary chunk
                            if (writeStream) {
                                try {
                                    const chunkBase64 = Buffer.from(msgEvent.data).toString('base64');
                                    writeStream.write(chunkBase64);
                                    receivedBytes += (msgEvent.data.byteLength || msgEvent.data.size || 0);

                                    if (metadata && onProgress) {
                                        onProgress(receivedBytes / metadata.fileSize);
                                    }
                                } catch (e) {
                                    console.error('Write stream error:', e);
                                    endTransfer();
                                }
                            }
                        }
                    };
                };

                pc.onicecandidate = (event: any) => {
                    if (event.candidate) {
                        try {
                            log(`❄️ SEND ICE candidate (${event.candidate.type})`);
                            signalChannel.send({
                                type: 'broadcast',
                                event: 'signal',
                                payload: { type: 'ice-candidate', candidate: event.candidate, from: userId, transferId: msg.transferId },
                            }).catch(e => console.warn('Failed to send ICE:', e));
                        } catch (e) {
                            console.warn('Error handling ICE candidate:', e);
                        }
                    }
                };

                pc.onconnectionstatechange = () => {
                    log(`Connection state: ${pc.connectionState}`);
                    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                        endTransfer();
                    }
                };

                log(`Setting Remote Description...`);
                await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));

                log(`Creating Answer...`);
                const answer = await pc.createAnswer();

                log(`Setting Local Description...`);
                await pc.setLocalDescription(answer);

                log(`Sending ANSWER...`);
                await signalChannel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'answer', sdp: answer, from: userId, transferId: msg.transferId },
                });
                log(`✅ ANSWER sent for ${msg.transferId}`);

            } catch (err) {
                console.error('❌ Error handling OFFER logic:', err);
                // Clean up if we failed during setup
                transfers.delete(msg.transferId);
            }
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
