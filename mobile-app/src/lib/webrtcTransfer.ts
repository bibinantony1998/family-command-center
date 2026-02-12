import { supabase } from './supabase';

// NOTE: Add METERED_APP_NAME and METERED_API_KEY to your .env file
let METERED_APP_NAME = '';
let METERED_API_KEY = '';
try {
    const env = require('@env');
    METERED_APP_NAME = env.METERED_APP_NAME || '';
    METERED_API_KEY = env.METERED_API_KEY || '';
} catch { /* env vars not yet configured */ }

/**
 * WebRTC P2P File Transfer utility for React Native.
 * Uses Supabase Broadcast for signaling and Metered.ca for TURN servers.
 * 
 * NOTE: Requires 'react-native-webrtc' package to be installed.
 * If not yet installed, the WebRTC APIs (RTCPeerConnection, etc.) won't be available.
 */

const CHUNK_SIZE = 16384; // 16KB chunks

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
        console.warn('[WebRTC] No Metered.ca credentials — using STUN only');
        return fallback;
    }

    try {
        const res = await fetch(
            `https://${METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('[WebRTC] Failed to fetch TURN credentials:', err);
        return fallback;
    }
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
    // React Native: Read file as base64 then convert to ArrayBuffer
    const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = require('react-native-webrtc');

    const transferId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const channelName = `rtc:signal:${familyId}:${[senderId, recipientId].sort().join(':')}`;

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
            cleanup();
            resolve(false);
        }, 30000);

        const dataChannel = pc.createDataChannel('fileTransfer', { ordered: true });

        dataChannel.onopen = async () => {
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

            dataChannel.send(JSON.stringify({ type: 'done', transferId }));
        };

        dataChannel.onmessage = (event: any) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'ack' && msg.transferId === transferId) {
                    cleanup();
                    resolve(true);
                }
            } catch { /* binary data */ }
        };

        pc.onicecandidate = (event: any) => {
            if (event.candidate) {
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

                if (msg.type === 'answer' && msg.transferId === transferId) {
                    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                } else if (msg.type === 'ice-candidate' && msg.transferId === transferId) {
                    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
                }
            })
            .subscribe(async (status: string) => {
                if (status === 'SUBSCRIBED') {
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
                }
            });
    });
}

/**
 * Listen for incoming files from a counterpart.
 */
export function listenForIncomingFiles(
    userId: string,
    familyId: string,
    counterpartId: string,
    onFileReceived: FileReceivedCallback,
    onProgress?: TransferProgressCallback
): () => void {
    const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = require('react-native-webrtc');
    const channelName = `rtc:signal:${familyId}:${[userId, counterpartId].sort().join(':')}`;
    const signalChannel = supabase.channel(channelName + ':recv');

    signalChannel
        .on('broadcast', { event: 'signal' }, async (payload: any) => {
            const msg = payload.payload;
            if (msg.from === userId || msg.type !== 'offer') return;

            const iceServers = await fetchIceServers();
            const pc = new RTCPeerConnection({ iceServers });

            const receivedChunks: ArrayBuffer[] = [];
            let metadata: FileMetadata | null = null;

            pc.ondatachannel = (event: any) => {
                const dc = event.channel;
                dc.onmessage = (msgEvent: any) => {
                    if (typeof msgEvent.data === 'string') {
                        try {
                            const parsed = JSON.parse(msgEvent.data);
                            if (parsed.type === 'metadata') {
                                metadata = parsed.data;
                            } else if (parsed.type === 'done' && metadata) {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const blob = new Blob(receivedChunks.map(ab => new Uint8Array(ab)) as any);
                                onFileReceived(metadata, blob);
                                dc.send(JSON.stringify({ type: 'ack', transferId: parsed.transferId }));
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
        })
        .subscribe();

    return () => { supabase.removeChannel(signalChannel); };
}

export type { FileMetadata };
