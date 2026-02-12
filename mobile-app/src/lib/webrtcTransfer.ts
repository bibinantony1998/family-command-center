import { supabase } from './supabase';
import { METERED_APP_NAME, METERED_API_KEY } from '@env';

/**
 * WebRTC P2P File Transfer utility for React Native.
 * Uses Supabase Broadcast for signaling and Metered.ca for TURN servers.
 */

const CHUNK_SIZE = 16384; // 16KB chunks

const DEBUG = true;
function log(...args: unknown[]) {
    if (DEBUG) console.log('[WebRTC-RN]', ...args);
}

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
        log('Fetching TURN credentials...');
        const res = await fetch(
            `https://${METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const servers = await res.json();
        log('Got ICE servers:', servers.length);
        return servers;
    } catch (err) {
        console.error('[WebRTC-RN] Failed to fetch TURN credentials:', err);
        return fallback;
    }
}

/** Build the shared signaling channel name for a pair of users */
function getSignalChannelName(familyId: string, userA: string, userB: string): string {
    return `rtc:signal:${familyId}:${[userA, userB].sort().join(':')}`;
}

/**
 * Send a file to a recipient via WebRTC DataChannel.
 */
export async function sendFileP2P(
    fileUri: string,
    fileName: string,
    fileType: 'image' | 'video' | 'audio',
    fileSize: number,
    senderId: string,
    recipientId: string,
    familyId: string,
    onProgress?: TransferProgressCallback
): Promise<boolean> {
    const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = require('react-native-webrtc');

    const transferId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const channelName = getSignalChannelName(familyId, senderId, recipientId);

    log(`📤 SEND START — file="${fileName}" size=${fileSize} to=${recipientId}`);
    log(`   channel="${channelName}" transferId=${transferId}`);

    const iceServers = await fetchIceServers();
    const pc = new RTCPeerConnection({ iceServers });
    const signalChannel = supabase.channel(channelName);

    // Read file
    const response = await fetch(fileUri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();

    return new Promise<boolean>((resolve) => {
        let timeoutHandle: ReturnType<typeof setTimeout>;

        const cleanup = () => {
            clearTimeout(timeoutHandle);
            pc.close();
            supabase.removeChannel(signalChannel);
        };

        timeoutHandle = setTimeout(() => {
            log('❌ Transfer TIMED OUT after 30s');
            cleanup();
            resolve(false);
        }, 30000);

        pc.onconnectionstatechange = () => {
            log(`🔗 Connection state: ${pc.connectionState}`);
        };

        pc.oniceconnectionstatechange = () => {
            log(`🧊 ICE state: ${pc.iceConnectionState}`);
        };

        const dataChannel = pc.createDataChannel('fileTransfer', { ordered: true });

        dataChannel.onopen = async () => {
            log('📡 DataChannel OPEN — sending file...');
            const metadata: FileMetadata = { fileName, fileType, fileSize, senderId, transferId };
            dataChannel.send(JSON.stringify({ type: 'metadata', data: metadata }));

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

            log(`✅ All ${totalChunks} chunks sent, waiting for ACK...`);
            dataChannel.send(JSON.stringify({ type: 'done', transferId }));
        };

        dataChannel.onmessage = (event: any) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'ack' && msg.transferId === transferId) {
                    log('✅ Got ACK — transfer COMPLETE');
                    cleanup();
                    resolve(true);
                }
            } catch { /* binary data */ }
        };

        pc.onicecandidate = (event: any) => {
            if (event.candidate) {
                log('🧊 Sending ICE candidate');
                signalChannel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'ice-candidate', candidate: event.candidate, from: senderId, transferId },
                });
            }
        };

        signalChannel
            .on('broadcast', { event: 'signal' }, async (payload: any) => {
                const msg = payload.payload;
                if (msg.from === senderId) return;

                log(`📨 Signal received: type=${msg.type} from=${msg.from}`);

                if (msg.type === 'answer' && msg.transferId === transferId) {
                    log('📨 Got ANSWER — setting remote description');
                    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                } else if (msg.type === 'ice-candidate' && msg.transferId === transferId) {
                    log('📨 Got remote ICE candidate');
                    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                }
            })
            .subscribe(async (status: string) => {
                log(`📡 Signal channel status: ${status}`);
                if (status === 'SUBSCRIBED') {
                    log('📡 Creating and sending OFFER...');
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
                    log('📡 OFFER sent — waiting for answer...');
                }
            });
    });
}

/**
 * Listen for incoming files from a counterpart.
 * IMPORTANT: Uses THE SAME channel name as the sender (no suffix).
 */
export function listenForIncomingFiles(
    userId: string,
    familyId: string,
    counterpartId: string,
    onFileReceived: FileReceivedCallback,
    onProgress?: TransferProgressCallback
): () => void {
    const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = require('react-native-webrtc');
    const channelName = getSignalChannelName(familyId, userId, counterpartId);

    log(`👂 LISTEN start — userId=${userId} counterpart=${counterpartId}`);
    log(`   channel="${channelName}"`);

    const signalChannel = supabase.channel(channelName);

    signalChannel
        .on('broadcast', { event: 'signal' }, async (payload: any) => {
            const msg = payload.payload;
            if (msg.from === userId) return;
            if (msg.type !== 'offer') return;

            log(`📨 RECV got OFFER from ${msg.from}, transferId=${msg.transferId}`);

            const iceServers = await fetchIceServers();
            const pc = new RTCPeerConnection({ iceServers });

            const receivedChunks: ArrayBuffer[] = [];
            let metadata: FileMetadata | null = null;

            pc.onconnectionstatechange = () => {
                log(`🔗 RECV connection state: ${pc.connectionState}`);
            };

            pc.ondatachannel = (event: any) => {
                const dc = event.channel;
                log('📡 RECV DataChannel opened');

                dc.onmessage = (msgEvent: any) => {
                    if (typeof msgEvent.data === 'string') {
                        try {
                            const parsed = JSON.parse(msgEvent.data);
                            if (parsed.type === 'metadata') {
                                metadata = parsed.data;
                                log(`📦 RECV metadata: file="${metadata!.fileName}" size=${metadata!.fileSize}`);
                            } else if (parsed.type === 'done' && metadata) {
                                log(`✅ RECV all chunks (${receivedChunks.length}), building blob...`);
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const blob = new Blob(receivedChunks.map(ab => new Uint8Array(ab)) as any);
                                onFileReceived(metadata, blob);
                                dc.send(JSON.stringify({ type: 'ack', transferId: parsed.transferId }));
                                log('✅ RECV sent ACK');
                                setTimeout(() => { dc.close(); pc.close(); }, 500);
                            }
                        } catch { /* binary */ }
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
                    log('🧊 RECV sending ICE candidate');
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

            log('📨 RECV sending ANSWER');
            signalChannel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'answer', sdp: answer, from: userId, transferId: msg.transferId },
            });
        })
        .subscribe((status: string) => {
            log(`👂 RECV signal channel status: ${status}`);
        });

    return () => {
        log('👂 LISTEN cleanup');
        supabase.removeChannel(signalChannel);
    };
}

export type { FileMetadata };
