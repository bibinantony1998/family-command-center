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
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [status, setStatus] = useState<string>('Initializing...');

    // Refs
    const pc = useRef<RTCPeerConnection | null>(null);
    const signaling = useRef<CallSignaling | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    // Initialize callId only once
    const callId = useRef<string>('');
    useEffect(() => {
        if (!callId.current) {
            callId.current = isCaller ? crypto.randomUUID() : (offer ? offer.callId || '' : '');
        }
    }, [isCaller, offer]);

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
    }, [localStream]); // localStream dependency is fine here if cleanup isn't in useEffect dependency

    const endCall = useCallback(() => {
        if (signaling.current && recipientId) {
            signaling.current.sendSignal(recipientId, 'call-end', {}, callId.current);
        }
        cleanup();
        onClose();
    }, [recipientId, cleanup, onClose]);

    // Initialize Call
    useEffect(() => {
        let mounted = true;

        const startCall = async () => {
            if (streamRef.current) return; // Already started

            try {
                // 1. Get User Media
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: { width: 1280, height: 720 }
                });

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
                        if (pc.current) {
                            await pc.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
                        } else {
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

                        pendingCandidates.current.forEach(c => peerConnection.addIceCandidate(new RTCIceCandidate(c)));
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
    }, []); // Run ONCE on mount. VideoCallOverlay is only mounted when call starts.

    // Effect to attach remote stream ref if it changes (e.g. late render)
    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);


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

    return (
        <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col">
            {/* Main Remote Video Area */}
            <div className="flex-1 relative bg-black flex items-center justify-center">
                {remoteStream ? (
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-contain"
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

                {/* Local Video PiP */}
                <div className="absolute top-4 right-4 w-48 aspect-video bg-slate-800 rounded-lg overflow-hidden border-2 border-slate-700 shadow-xl">
                    {localStream && !isCameraOff ? (
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover mirror"
                            style={{ transform: 'scaleX(-1)' }} // Mirror local video
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800">
                            <VideoOff className="text-slate-500" />
                        </div>
                    )}
                </div>
            </div>

            {/* Controls Bar */}
            <div className="bg-slate-900/90 backdrop-blur pb-8 pt-6 px-6">
                <div className="max-w-md mx-auto flex items-center justify-center gap-6">
                    <button
                        onClick={toggleMic}
                        className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-slate-700 text-red-500' : 'bg-slate-700/50 text-white hover:bg-slate-700'}`}
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
                        className={`p-4 rounded-full transition-colors ${isCameraOff ? 'bg-slate-700 text-red-500' : 'bg-slate-700/50 text-white hover:bg-slate-700'}`}
                    >
                        {isCameraOff ? <VideoOff size={24} /> : <Video size={24} />}
                    </button>

                    {/* PiP Button (Only if supported) */}
                    {document.pictureInPictureEnabled && (
                        <button
                            onClick={togglePiP}
                            className="p-4 rounded-full bg-slate-700/50 text-white hover:bg-slate-700 transition-colors"
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
