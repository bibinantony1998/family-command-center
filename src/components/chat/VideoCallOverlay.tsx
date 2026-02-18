import { useEffect, useRef, useState, useCallback } from 'react';
import type { SignalMessage } from '../../lib/callSignaling';
import { CallSignaling, fetchTurnServers } from '../../lib/callSignaling';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Minimize2 } from 'lucide-react';
import type { Profile } from '../../types';

interface VideoCallOverlayProps {
    recipientId: string;
    name: string;
    isCaller: boolean;
    offer?: SignalMessage;
    currentProfile: Profile;
    familyId: string;
    onClose: () => void;
}

export function VideoCallOverlay({
    recipientId,
    name,
    isCaller,
    offer,
    currentProfile,
    familyId,
    onClose
}: VideoCallOverlayProps) {
    // State for incoming call
    const [hasAccepted, setHasAccepted] = useState(isCaller);

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [status, setStatus] = useState<string>(isCaller ? 'Calling...' : 'Incoming call...');

    // Refs
    const pc = useRef<RTCPeerConnection | null>(null);
    const signaling = useRef<CallSignaling | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    // Initialize callId synchronously (not in useEffect to avoid race)
    const callId = useRef<string>(
        isCaller ? crypto.randomUUID() : (offer?.callId ?? '')
    );

    // Buffer ICE candidates that arrive before remoteDescription is set
    const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

    // Use refs for cleanup to avoid dependency cycles in useEffect
    const streamRef = useRef<MediaStream | null>(null);

    const cleanup = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (localStream) {
            setLocalStream(null);
        }
        if (pc.current) {
            pc.current.close();
            pc.current = null;
        }
        if (signaling.current) {
            signaling.current.destroy();
            signaling.current = null;
        }
    }, [localStream]);

    const endCall = useCallback(() => {
        if (signaling.current && recipientId) {
            signaling.current.sendSignal(recipientId, 'call-end', {}, callId.current);
        }
        cleanup();
        onClose();
    }, [recipientId, cleanup, onClose]);

    const handleAccept = () => {
        setHasAccepted(true);
        setStatus('Connecting...');
    };

    const handleDecline = () => {
        // Send a decline signal (optional, but good UX) - for now just close
        // In a real app we might send a 'call-rejected' signal
        if (signaling.current) {
            // We can't send if signaling isn't init yet. 
            // If we really want to send 'reject', we'd need to init signaling earlier.
            // For now, simpler to just close local. The caller will timeout or see 'disconnected'.
            // To do it properly, we could init signaling in a useEffect dependent on nothing, 
            // but keeping it simple for now as requested.
        }
        cleanup();
        onClose();
    };

    // Initialize Call
    useEffect(() => {
        if (!hasAccepted) return; // Wait for accept

        let mounted = true;

        const startCall = async () => {
            if (streamRef.current) return; // Already started

            try {
                // 1. Get User Media - Adapt to screen size
                const isMobile = window.innerWidth <= 1024;
                const constraints = {
                    audio: true,
                    video: {
                        width: isMobile ? { ideal: 720 } : { ideal: 1280 },
                        height: isMobile ? { ideal: 1280 } : { ideal: 720 },
                        facingMode: "user"
                    }
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);

                if (!mounted) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                streamRef.current = stream;
                setLocalStream(stream);

                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                // 2. Peer Connection
                const iceServers = await fetchTurnServers();
                const peerConnection = new RTCPeerConnection({
                    iceServers,
                    iceTransportPolicy: 'all'
                });
                pc.current = peerConnection;

                // Add local tracks
                stream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, stream);
                });

                // Handle remote stream
                peerConnection.ontrack = (event) => {
                    console.log('[WebRTC] Remote Stream received');
                    setRemoteStream(event.streams[0]);
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                    }
                };

                peerConnection.onicecandidate = (event) => {
                    if (event.candidate && signaling.current) {
                        signaling.current.sendSignal(recipientId, 'ice-candidate', { candidate: event.candidate }, callId.current);
                    }
                };

                peerConnection.oniceconnectionstatechange = () => {
                    console.log('[WebRTC] ICE State:', peerConnection.iceConnectionState);
                    if (peerConnection.iceConnectionState === 'disconnected') setStatus('Reconnecting...');
                    if (peerConnection.iceConnectionState === 'failed') {
                        setStatus('Connection Failed');
                        setTimeout(endCall, 2000);
                    }
                    if (peerConnection.iceConnectionState === 'connected') setStatus('Connected');
                };

                // 3. Signaling
                signaling.current = new CallSignaling(currentProfile.id, familyId, async (msg: SignalMessage) => {
                    if (msg.callId && msg.callId !== callId.current && !isCaller) {
                        if (!callId.current) callId.current = msg.callId;
                    }

                    if (msg.type === 'call-end') {
                        alert('Call ended by user');
                        cleanup();
                        onClose();
                    } else if (msg.type === 'answer') {
                        if (pc.current) {
                            await pc.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                        }
                    } else if (msg.type === 'offer') {
                        // ignore if already stable
                    } else if (msg.type === 'ice-candidate') {
                        if (pc.current && pc.current.remoteDescription) {
                            try {
                                await pc.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
                            } catch (e) {
                                console.warn('[WebRTC] addIceCandidate error:', e);
                            }
                        } else {
                            console.log('[WebRTC] Buffering ICE candidate (no remoteDescription yet)');
                            pendingCandidates.current.push(msg.candidate);
                        }
                    }
                });
                signaling.current.subscribe();

                // 4. Connect
                if (isCaller) {
                    setStatus('Calling...');
                    const offerDesc = await peerConnection.createOffer();
                    await peerConnection.setLocalDescription(offerDesc);
                    signaling.current.sendSignal(recipientId, 'offer', { sdp: offerDesc }, callId.current);
                } else {
                    // Callee
                    setStatus('Connecting...');
                    if (offer && offer.sdp) {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer.sdp));
                        const answerDesc = await peerConnection.createAnswer();
                        await peerConnection.setLocalDescription(answerDesc);
                        signaling.current.sendSignal(recipientId, 'answer', { sdp: answerDesc }, callId.current);

                        // Flush buffered ICE candidates
                        console.log(`[WebRTC] Flushing ${pendingCandidates.current.length} buffered ICE candidates`);
                        for (const c of pendingCandidates.current) {
                            try {
                                await peerConnection.addIceCandidate(new RTCIceCandidate(c));
                            } catch (e) {
                                console.warn('[WebRTC] Buffered candidate error:', e);
                            }
                        }
                        pendingCandidates.current = [];
                    }
                }

            } catch (err) {
                console.error('Failed to start call:', err);
                alert('Could not start call. Check permissions.');
                onClose();
            }
        };

        startCall();

        return () => {
            mounted = false;
            // Immediate cleanup on unmount
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
            if (pc.current) pc.current.close();
            if (signaling.current) signaling.current.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasAccepted]); // Dependent on hasAccepted

    // Effect to attach remote stream ref if it changes (e.g. late render)
    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    // Effect to attach local stream ref if it changes (e.g. late render or camera toggle)
    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, isCameraOff]);


    const toggleMic = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
            setIsMuted(!isMuted);
        }
    };

    const toggleCamera = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
            setIsCameraOff(!isCameraOff);
        }
    };

    const togglePiP = async () => {
        if (remoteVideoRef.current && document.pictureInPictureEnabled) {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await remoteVideoRef.current.requestPictureInPicture();
            }
        }
    };

    if (!hasAccepted) {
        return (
            <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center">
                <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4">
                    <div className="w-32 h-32 bg-slate-700 rounded-full mb-6 flex items-center justify-center animate-pulse">
                        <span className="text-6xl">📞</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">{name}</h2>
                    <p className="text-slate-400 mb-8">Incoming Video Call...</p>

                    <div className="flex gap-8 w-full justify-center">
                        <button
                            onClick={handleDecline}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg group-hover:bg-red-600 transition-all transform group-hover:scale-110">
                                <PhoneOff size={32} className="text-white" />
                            </div>
                            <span className="text-slate-300 text-sm">Decline</span>
                        </button>

                        <button
                            onClick={handleAccept}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg group-hover:bg-green-600 transition-all transform group-hover:scale-110 animate-bounce">
                                <Video size={32} className="text-white" />
                            </div>
                            <span className="text-slate-300 text-sm">Answer</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
            {/* Main Remote Video Area */}
            <div className="flex-1 relative bg-black flex items-center justify-center">
                {remoteStream ? (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-contain bg-black transition-all"
                        style={{ filter: 'brightness(1.1) saturate(1.3) contrast(1.1)' }}
                    />
                ) : (
                    <div className="text-center">
                        <div className="animate-pulse mb-4">
                            <div className="w-24 h-24 bg-slate-800 rounded-full mx-auto flex items-center justify-center">
                                <span className="text-4xl">👤</span>
                            </div>
                        </div>
                        <h2 className="text-white text-xl font-bold">{name}</h2>
                        <p className="text-slate-400">{status}</p>
                    </div>
                )}

                {/* Self View (Local Camera) */}
                <div className="absolute top-4 right-4 w-28 h-48 md:w-48 md:h-28 bg-slate-800 rounded-lg overflow-hidden border-2 border-slate-700 shadow-xl ml-4 mt-4">
                    {localStream && !isCameraOff ? (
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover mirror"
                            style={{ transform: 'scaleX(-1)', filter: 'brightness(1.1) saturate(1.3) contrast(1.1)' }} // Mirror local video + beautify
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800">
                            <VideoOff className="text-slate-500" />
                        </div>
                    )}
                </div>
            </div>

            {/* Controls Bar - Floating at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent pb-8 pt-12 px-6 safe-area-bottom">
                <div className="max-w-md mx-auto flex items-center justify-center gap-6">
                    <button
                        onClick={toggleMic}
                        className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-slate-700 text-red-500' : 'bg-slate-700/50 text-white hover:bg-slate-700'} backdrop-blur-sm`}
                    >
                        {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>

                    <button
                        onClick={endCall}
                        className="p-5 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-lg transform hover:scale-105 transition-all"
                    >
                        <PhoneOff size={32} />
                    </button>

                    <button
                        onClick={toggleCamera}
                        className={`p-4 rounded-full transition-colors ${isCameraOff ? 'bg-slate-700 text-red-500' : 'bg-slate-700/50 text-white hover:bg-slate-700'} backdrop-blur-sm`}
                    >
                        {isCameraOff ? <VideoOff size={24} /> : <Video size={24} />}
                    </button>

                    {/* PiP Button (Only if supported) */}
                    {document.pictureInPictureEnabled && (
                        <button
                            onClick={togglePiP}
                            className="p-4 rounded-full bg-slate-700/50 text-white hover:bg-slate-700 transition-colors backdrop-blur-sm"
                            title="Picture in Picture"
                        >
                            <Minimize2 size={24} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// Add global declaration if needed, but normally window.document covers standard PiP
