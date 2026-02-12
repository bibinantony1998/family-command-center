import { supabase } from './supabase';

/**
 * WebRTC P2P File Transfer utility.
 * Uses Supabase Broadcast for signaling and Metered.ca for TURN servers.
 * Files are sent directly between devices via RTCDataChannel.
 */

const CHUNK_SIZE = 16384; // 16KB chunks
const METERED_APP_NAME = import.meta.env.VITE_METERED_APP_NAME || '';
const METERED_API_KEY = import.meta.env.VITE_METERED_API_KEY || '';

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
    // Default STUN fallback
    const fallback: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

    if (!METERED_APP_NAME || !METERED_API_KEY) {
        console.warn('[WebRTC] No Metered.ca credentials — using STUN only');
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
        console.error('[WebRTC] Failed to fetch TURN credentials, falling back to STUN:', err);
        return fallback;
    }
}

/**
 * Send a file to a recipient via WebRTC DataChannel.
 * Signaling is done via Supabase Broadcast (no DB writes).
 */
export async function sendFileP2P(
    file: File | Blob,
    fileName: string,
    fileType: 'image' | 'video' | 'audio',
    senderId: string,
    recipientId: string,
    familyId: string,
    onProgress?: TransferProgressCallback
): Promise<boolean> {
    const transferId = crypto.randomUUID();
    const channelName = `rtc:signal:${familyId}:${[senderId, recipientId].sort().join(':')}`;

    const iceServers = await fetchIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    const signalChannel = supabase.channel(channelName);

    return new Promise<boolean>((resolve) => {
        const cleanup = () => {
            clearTimeout(timeoutHandle);
            pc.close();
            supabase.removeChannel(signalChannel);
        };

        const timeoutHandle = setTimeout(() => {
            console.error('[WebRTC] Transfer timed out');
            cleanup();
            resolve(false);
        }, 30000);

        const dataChannel = pc.createDataChannel('fileTransfer', { ordered: true });

        dataChannel.onopen = async () => {
            // Send metadata first
            const metadata: FileMetadata = { fileName, fileType, fileSize: file.size, senderId, transferId };
            dataChannel.send(JSON.stringify({ type: 'metadata', data: metadata }));

            // Send file in chunks
            const arrayBuffer = await (file instanceof File ? file.arrayBuffer() : file.arrayBuffer());
            const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);
            let sentChunks = 0;

            for (let offset = 0; offset < arrayBuffer.byteLength; offset += CHUNK_SIZE) {
                const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);

                // Wait for buffer to drain if needed
                while (dataChannel.bufferedAmount > CHUNK_SIZE * 8) {
                    await new Promise(r => setTimeout(r, 10));
                }

                dataChannel.send(chunk);
                sentChunks++;
                onProgress?.(sentChunks / totalChunks);
            }

            // Signal end of file
            dataChannel.send(JSON.stringify({ type: 'done', transferId }));
        };

        dataChannel.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'ack' && msg.transferId === transferId) {
                    cleanup();
                    resolve(true);
                }
            } catch { /* binary data, ignore */ }
        };

        dataChannel.onerror = (err) => {
            console.error('[WebRTC] DataChannel error:', err);
            cleanup();
            resolve(false);
        };

        // ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                signalChannel.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'ice-candidate', candidate: event.candidate, from: senderId, transferId },
                });
            }
        };

        // Listen for signaling messages
        signalChannel
            .on('broadcast', { event: 'signal' }, async (payload: { payload: Record<string, unknown> }) => {
                const msg = payload.payload;
                if (msg.from === senderId) return; // Ignore own messages

                if (msg.type === 'answer' && msg.transferId === transferId) {
                    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
                } else if (msg.type === 'ice-candidate' && msg.transferId === transferId) {
                    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit));
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Create and send offer
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
                }
            });
    });
}

/**
 * Listen for incoming file transfers from a specific sender.
 * Sets up a listener on the signaling channel.
 */
export function listenForIncomingFiles(
    userId: string,
    familyId: string,
    counterpartId: string,
    onFileReceived: FileReceivedCallback,
    onProgress?: TransferProgressCallback
): () => void {
    const channelName = `rtc:signal:${familyId}:${[userId, counterpartId].sort().join(':')}`;
    const signalChannel = supabase.channel(channelName + ':recv');

    signalChannel
        .on('broadcast', { event: 'signal' }, async (payload: { payload: Record<string, unknown> }) => {
            const msg = payload.payload;
            if (msg.from === userId) return; // Ignore own
            if (msg.type !== 'offer') return;

            const iceServers = await fetchIceServers();
            const pc = new RTCPeerConnection({ iceServers });

            const receivedChunks: ArrayBuffer[] = [];
            let metadata: FileMetadata | null = null;

            pc.ondatachannel = (event) => {
                const dc = event.channel;

                dc.onmessage = (msgEvent) => {
                    if (typeof msgEvent.data === 'string') {
                        try {
                            const parsed = JSON.parse(msgEvent.data);
                            if (parsed.type === 'metadata') {
                                metadata = parsed.data;
                            } else if (parsed.type === 'done' && metadata) {
                                const blob = new Blob(receivedChunks);
                                onFileReceived(metadata, blob);

                                // Send ack
                                dc.send(JSON.stringify({ type: 'ack', transferId: parsed.transferId }));

                                // Cleanup after ack sent
                                setTimeout(() => {
                                    dc.close();
                                    pc.close();
                                }, 500);
                            }
                        } catch { /* Not JSON, ignore */ }
                    } else {
                        // Binary chunk
                        receivedChunks.push(msgEvent.data);
                        if (metadata && onProgress) {
                            const received = receivedChunks.reduce((sum, c) => sum + c.byteLength, 0);
                            onProgress(received / metadata.fileSize);
                        }
                    }
                };
            };

            // ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    signalChannel.send({
                        type: 'broadcast',
                        event: 'signal',
                        payload: { type: 'ice-candidate', candidate: event.candidate, from: userId, transferId: msg.transferId },
                    });
                }
            };

            // Set remote offer and create answer
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            signalChannel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'answer', sdp: answer, from: userId, transferId: msg.transferId },
            });

            // Handle ice candidates from sender
        })
        .subscribe();

    return () => {
        supabase.removeChannel(signalChannel);
    };
}
