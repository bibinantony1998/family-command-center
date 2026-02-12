import { supabase } from './supabase';

/**
 * WebRTC P2P File Transfer utility.
 * Uses Supabase Broadcast for signaling and Metered.ca for TURN servers.
 * Files are sent directly between devices via RTCDataChannel.
 */

const CHUNK_SIZE = 16384; // 16KB chunks
const METERED_APP_NAME = import.meta.env.VITE_METERED_APP_NAME || '';
const METERED_API_KEY = import.meta.env.VITE_METERED_API_KEY || '';

const DEBUG = true;
function log(...args: unknown[]) {
    if (DEBUG) console.log('[WebRTC]', ...args);
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

async function fetchIceServers(): Promise<RTCIceServer[]> {
    const fallback: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

    if (!METERED_APP_NAME || !METERED_API_KEY) {
        log('⚠️ No Metered.ca credentials — using STUN only');
        return fallback;
    }

    try {
        log('Fetching TURN credentials from Metered.ca...');
        const res = await fetch(
            `https://${METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const servers = await res.json();
        log('Got ICE servers:', servers.length, 'servers');
        return servers;
    } catch (err) {
        console.error('[WebRTC] Failed to fetch TURN credentials:', err);
        return fallback;
    }
}

/** Build the shared signaling channel name for a pair of users */
function getSignalChannelName(familyId: string, userA: string, userB: string): string {
    return `rtc:signal:${familyId}:${[userA, userB].sort().join(':')}`;
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
): Promise<{ success: boolean; error?: string }> {
    const transferId = crypto.randomUUID();
    const channelName = getSignalChannelName(familyId, senderId, recipientId);

    log(`📤 SEND START — file="${fileName}" size=${file.size} to=${recipientId}`);
    log(`   signalChannel="${channelName}" transferId=${transferId}`);

    const iceServers = await fetchIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    const signalChannel = supabase.channel(channelName);

    return new Promise<{ success: boolean; error?: string }>((resolve) => {
        const cleanup = () => {
            clearTimeout(timeoutHandle);
            pc.close();
            supabase.removeChannel(signalChannel);
        };

        const timeoutHandle = setTimeout(() => {
            log('❌ Transfer TIMED OUT after 30s — no answer from recipient');
            cleanup();
            resolve({ success: false, error: 'Transfer timed out — recipient may not have the chat open' });
        }, 30000);

        // Monitor connection state
        pc.onconnectionstatechange = () => {
            log(`🔗 Connection state: ${pc.connectionState}`);
            if (pc.connectionState === 'failed') {
                log('❌ Connection FAILED');
                cleanup();
                resolve({ success: false, error: 'WebRTC connection failed — try again' });
            }
        };

        pc.oniceconnectionstatechange = () => {
            log(`🧊 ICE state: ${pc.iceConnectionState}`);
        };

        pc.onicegatheringstatechange = () => {
            log(`🧊 ICE gathering: ${pc.iceGatheringState}`);
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

            log(`✅ All ${totalChunks} chunks sent, waiting for ACK...`);
            dataChannel.send(JSON.stringify({ type: 'done', transferId }));
        };

        dataChannel.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'ack' && msg.transferId === transferId) {
                    log('✅ Got ACK — transfer COMPLETE');
                    cleanup();
                    resolve({ success: true });
                }
            } catch { /* binary data, ignore */ }
        };

        dataChannel.onerror = (err) => {
            log('❌ DataChannel error:', err);
            cleanup();
            resolve({ success: false, error: 'DataChannel error' });
        };

        // ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                log('🧊 Sending ICE candidate');
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

                log(`📨 Signal received: type=${msg.type} from=${msg.from}`);

                if (msg.type === 'answer' && msg.transferId === transferId) {
                    log('📨 Got ANSWER — setting remote description');
                    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp as RTCSessionDescriptionInit));
                } else if (msg.type === 'ice-candidate' && msg.transferId === transferId) {
                    log('📨 Got remote ICE candidate');
                    await pc.addIceCandidate(new RTCIceCandidate(msg.candidate as RTCIceCandidateInit));
                }
            })
            .subscribe(async (status) => {
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
                            metadata: { fileName, fileType, fileSize: file.size },
                        },
                    });
                    log('📡 OFFER sent — waiting for recipient to answer...');
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
    const channelName = getSignalChannelName(familyId, userId, counterpartId);

    log(`👂 LISTEN start — userId=${userId} counterpart=${counterpartId}`);
    log(`   signalChannel="${channelName}"`);

    const signalChannel = supabase.channel(channelName);

    signalChannel
        .on('broadcast', { event: 'signal' }, async (payload: { payload: Record<string, unknown> }) => {
            const msg = payload.payload;
            if (msg.from === userId) return; // Ignore own
            if (msg.type !== 'offer') return;

            log(`📨 RECV got OFFER from ${msg.from}, transferId=${msg.transferId}`);

            const iceServers = await fetchIceServers();
            const pc = new RTCPeerConnection({ iceServers });

            const receivedChunks: ArrayBuffer[] = [];
            let metadata: FileMetadata | null = null;

            pc.onconnectionstatechange = () => {
                log(`🔗 RECV connection state: ${pc.connectionState}`);
            };

            pc.oniceconnectionstatechange = () => {
                log(`🧊 RECV ICE state: ${pc.iceConnectionState}`);
            };

            pc.ondatachannel = (event) => {
                const dc = event.channel;
                log('📡 RECV DataChannel opened');

                dc.onmessage = (msgEvent) => {
                    if (typeof msgEvent.data === 'string') {
                        try {
                            const parsed = JSON.parse(msgEvent.data);
                            if (parsed.type === 'metadata') {
                                metadata = parsed.data;
                                log(`📦 RECV metadata: file="${metadata!.fileName}" size=${metadata!.fileSize}`);
                            } else if (parsed.type === 'done' && metadata) {
                                log(`✅ RECV all chunks (${receivedChunks.length}), building blob...`);
                                const blob = new Blob(receivedChunks);
                                onFileReceived(metadata, blob);

                                dc.send(JSON.stringify({ type: 'ack', transferId: parsed.transferId }));
                                log('✅ RECV sent ACK');

                                setTimeout(() => {
                                    dc.close();
                                    pc.close();
                                }, 500);
                            }
                        } catch { /* Not JSON */ }
                    } else {
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
                    log('🧊 RECV sending ICE candidate');
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

            log('📨 RECV sending ANSWER');
            signalChannel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'answer', sdp: answer, from: userId, transferId: msg.transferId },
            });
        })
        .subscribe((status) => {
            log(`👂 RECV signal channel status: ${status}`);
        });

    return () => {
        log('👂 LISTEN cleanup');
        supabase.removeChannel(signalChannel);
    };
}
