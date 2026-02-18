import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, RTCView, mediaDevices, MediaStream } from 'react-native-webrtc';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import { CallSignaling, fetchTurnServers, SignalMessage } from '../../lib/callSignaling';
import { useAuth } from '../../context/AuthContext';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, SwitchCamera, Volume2, VolumeX } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import InCallManager from 'react-native-incall-manager';

type VideoCallRouteProp = RouteProp<RootStackParamList, 'VideoCall'>;

// Extend react-native-webrtc types to include event handlers missing from @types
declare module 'react-native-webrtc' {
    interface RTCPeerConnection {
        oniceconnectionstatechange: ((event: Event) => void) | null;
        ontrack: ((event: any) => void) | null;
        onicecandidate: ((event: any) => void) | null;
    }
}

export default function VideoCallScreen() {
    const navigation = useNavigation();
    const route = useRoute<VideoCallRouteProp>();
    const { recipientId, name, isCaller, offer } = route.params;
    const { user, family } = useAuth();

    // Callee must tap Accept before WebRTC starts; caller auto-accepts
    const [hasAccepted, setHasAccepted] = useState(isCaller);

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(true); // Default to loudspeaker
    const [status, setStatus] = useState<string>(isCaller ? 'Calling...' : 'Incoming call...');

    // WebRTC Refs
    const pc = useRef<RTCPeerConnection | null>(null);
    const signaling = useRef<CallSignaling | null>(null);
    // Buffer ICE candidates that arrive before PC is ready
    const pendingCandidates = useRef<any[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const callId = useRef<string>(
        isCaller ? `${Date.now()}-${Math.random()}` : (offer?.callId ?? '')
    );

    // --- Cleanup ---
    const cleanup = useCallback(() => {
        InCallManager.stop();
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            // @ts-ignore
            if (streamRef.current.release) streamRef.current.release();
            streamRef.current = null;
        }
        setLocalStream(null);
        if (pc.current) {
            pc.current.close();
            pc.current = null;
        }
        if (signaling.current) {
            signaling.current.destroy();
            signaling.current = null;
        }
    }, []);

    const endCall = useCallback(() => {
        if (signaling.current && recipientId) {
            signaling.current.sendSignal(recipientId, 'call-end', {}, callId.current);
        }
        cleanup();
        navigation.goBack();
    }, [recipientId, cleanup, navigation]);

    // ---------------------------------------------------------------
    // STEP 1: Subscribe to signaling IMMEDIATELY on mount (before accept)
    // This ensures we buffer ICE candidates that arrive right after the offer.
    // ---------------------------------------------------------------
    useEffect(() => {
        if (!user || !family) return;

        const sig = new CallSignaling(user.id, family.id, async (msg: SignalMessage) => {
            // Sync callId from first message if we don't have it yet
            if (msg.callId && !callId.current) {
                callId.current = msg.callId;
            }

            if (msg.type === 'call-end') {
                Alert.alert('Call Ended', 'The other user ended the call.');
                cleanup();
                navigation.goBack();
            } else if (msg.type === 'answer') {
                if (pc.current) {
                    await pc.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                }
            } else if (msg.type === 'ice-candidate') {
                if (pc.current && pc.current.remoteDescription) {
                    // PC is ready, add immediately
                    try {
                        await pc.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
                    } catch (e) {
                        console.warn('[WebRTC] addIceCandidate error:', e);
                    }
                } else {
                    // Buffer until PC is ready
                    console.log('[WebRTC] Buffering ICE candidate');
                    pendingCandidates.current.push(msg.candidate);
                }
            }
        });

        sig.subscribe();
        signaling.current = sig;

        return () => {
            sig.destroy();
            if (signaling.current === sig) signaling.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, family?.id]);

    // ---------------------------------------------------------------
    // STEP 2: Start WebRTC only after user accepts
    // ---------------------------------------------------------------
    useEffect(() => {
        if (!hasAccepted || !user || !family) return;

        let mounted = true;

        const startCall = async () => {
            if (streamRef.current) return;

            try {
                // Get local media
                const stream = await mediaDevices.getUserMedia({
                    audio: true,
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 30 },
                        facingMode: 'user',
                    }
                }) as MediaStream;

                if (!mounted) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                streamRef.current = stream;
                setLocalStream(stream);

                // Start InCallManager - route audio to loudspeaker by default
                InCallManager.start({ media: 'video' });
                InCallManager.setForceSpeakerphoneOn(true);
                InCallManager.setSpeakerphoneOn(true);

                // Setup Peer Connection
                const iceServers = await fetchTurnServers();
                const peerConnection = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'all' });
                pc.current = peerConnection;

                // Add local tracks
                stream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, stream);
                });

                // Handle remote stream
                peerConnection.ontrack = (event: any) => {
                    if (event.streams && event.streams[0]) {
                        console.log('[WebRTC] Remote stream received');
                        setRemoteStream(event.streams[0]);
                        setStatus('Connected');
                    }
                };

                peerConnection.onicecandidate = (event: any) => {
                    if (event.candidate && signaling.current) {
                        signaling.current.sendSignal(
                            recipientId,
                            'ice-candidate',
                            { candidate: event.candidate },
                            callId.current
                        );
                    }
                };

                peerConnection.oniceconnectionstatechange = () => {
                    const state = peerConnection.iceConnectionState;
                    console.log('[WebRTC] ICE State:', state);
                    if (state === 'disconnected') setStatus('Reconnecting...');
                    if (state === 'failed') {
                        setStatus('Connection Failed');
                        Alert.alert('Call Failed', 'Could not connect. Check your network.', [
                            { text: 'OK', onPress: endCall }
                        ]);
                    }
                    if (state === 'connected') setStatus('Connected');
                };

                if (isCaller) {
                    // Create and send offer
                    setStatus('Calling...');
                    const offerDesc = await peerConnection.createOffer({});
                    await peerConnection.setLocalDescription(offerDesc);
                    signaling.current?.sendSignal(recipientId, 'offer', { sdp: offerDesc }, callId.current);
                } else {
                    // Callee: process the offer we received
                    setStatus('Connecting...');
                    if (offer?.sdp) {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer.sdp));
                        const answerDesc = await peerConnection.createAnswer();
                        await peerConnection.setLocalDescription(answerDesc);
                        signaling.current?.sendSignal(recipientId, 'answer', { sdp: answerDesc }, callId.current);

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
                console.error('Call setup failed:', err);
                Alert.alert('Error', 'Failed to start call. Check camera/mic permissions.');
                navigation.goBack();
            }
        };

        startCall();

        return () => {
            mounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasAccepted]);

    const handleAccept = () => {
        setHasAccepted(true);
        setStatus('Connecting...');
    };

    const handleDecline = () => {
        // Send decline signal so caller knows
        signaling.current?.sendSignal(recipientId, 'call-end', {}, callId.current);
        cleanup();
        navigation.goBack();
    };

    const toggleSpeaker = () => {
        const next = !isSpeakerOn;
        InCallManager.setSpeakerphoneOn(next);
        InCallManager.setForceSpeakerphoneOn(next);
        setIsSpeakerOn(next);
    };

    const toggleMic = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
            setIsMuted(prev => !prev);
        }
    };

    const toggleCamera = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
            setIsCameraOff(prev => !prev);
        }
    };

    const switchCamera = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                // @ts-ignore - react-native-webrtc specific
                if (track._switchCamera) track._switchCamera();
            });
        }
    };

    // ---- INCOMING CALL SCREEN ----
    if (!hasAccepted) {
        return (
            <View style={styles.incomingContainer}>
                <View style={styles.incomingCard}>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarEmoji}>📞</Text>
                    </View>
                    <Text style={styles.incomingName}>{name}</Text>
                    <Text style={styles.incomingSubtitle}>Incoming Video Call...</Text>

                    <View style={styles.incomingButtons}>
                        <View style={styles.btnWrapper}>
                            <TouchableOpacity style={styles.declineButton} onPress={handleDecline}>
                                <PhoneOff color="white" size={32} />
                            </TouchableOpacity>
                            <Text style={styles.btnLabel}>Decline</Text>
                        </View>

                        <View style={styles.btnWrapper}>
                            <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
                                <VideoIcon color="white" size={32} />
                            </TouchableOpacity>
                            <Text style={styles.btnLabel}>Answer</Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    // ---- ACTIVE CALL SCREEN ----
    return (
        <View style={styles.container}>
            {/* Remote Video (Full Screen) */}
            {remoteStream ? (
                <RTCView
                    streamURL={remoteStream.toURL()}
                    style={styles.remoteVideo}
                    objectFit="contain"
                    zOrder={0}
                />
            ) : (
                <View style={styles.remotePlaceholder}>
                    <Text style={styles.nameText}>{name}</Text>
                    <Text style={styles.statusText}>{status}</Text>
                </View>
            )}

            {/* Local Video (Self View - Portrait) */}
            <View style={styles.localVideoContainer}>
                {localStream && !isCameraOff ? (
                    <RTCView
                        streamURL={localStream.toURL()}
                        style={styles.localVideo}
                        objectFit="cover"
                        zOrder={1}
                        mirror={true}
                    />
                ) : (
                    <View style={[styles.localVideo, styles.cameraOffPlaceholder]}>
                        <VideoOff color="white" size={20} />
                    </View>
                )}
            </View>

            {/* Controls */}
            <SafeAreaView style={styles.controlsContainer} edges={['bottom']}>
                <TouchableOpacity style={styles.controlButton} onPress={toggleMic}>
                    {isMuted ? <MicOff color="white" size={24} /> : <Mic color="white" size={24} />}
                </TouchableOpacity>

                <TouchableOpacity style={[styles.controlButton, styles.endButton]} onPress={endCall}>
                    <PhoneOff color="white" size={30} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
                    {isCameraOff ? <VideoOff color="white" size={24} /> : <VideoIcon color="white" size={24} />}
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
                    <SwitchCamera color="white" size={24} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.controlButton, !isSpeakerOn && styles.activeButton]}
                    onPress={toggleSpeaker}
                >
                    {isSpeakerOn ? <Volume2 color="white" size={24} /> : <VolumeX color="#94a3b8" size={24} />}
                </TouchableOpacity>
            </SafeAreaView>

            {/* Status badge */}
            <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{status}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    // Incoming Call
    incomingContainer: {
        flex: 1,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    incomingCard: {
        backgroundColor: '#1e293b',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        maxWidth: 340,
    },
    avatarCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    avatarEmoji: { fontSize: 48 },
    incomingName: {
        fontSize: 26,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
    },
    incomingSubtitle: {
        fontSize: 15,
        color: '#94a3b8',
        marginBottom: 40,
    },
    incomingButtons: {
        flexDirection: 'row',
        gap: 48,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    btnWrapper: {
        alignItems: 'center',
        gap: 8,
    },
    declineButton: {
        backgroundColor: '#ef4444',
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptButton: {
        backgroundColor: '#22c55e',
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    btnLabel: {
        color: 'white',
        fontSize: 13,
        fontWeight: '600',
    },

    // Active Call
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    remoteVideo: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
    },
    remotePlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0f172a',
    },
    statusText: {
        color: '#94a3b8',
        fontSize: 16,
        marginTop: 8,
    },
    nameText: {
        color: 'white',
        fontSize: 28,
        fontWeight: 'bold',
    },
    localVideoContainer: {
        position: 'absolute',
        top: 60,
        right: 16,
        width: 90,
        height: 140,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#334155',
        elevation: 5,
        zIndex: 10,
    },
    localVideo: {
        width: '100%',
        height: '100%',
    },
    cameraOffPlaceholder: {
        backgroundColor: '#1e293b',
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlsContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    controlButton: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: 'rgba(51, 65, 85, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    endButton: {
        backgroundColor: '#ef4444',
        width: 64,
        height: 64,
        borderRadius: 32,
    },
    activeButton: {
        backgroundColor: 'rgba(148, 163, 184, 0.3)',
    },
    statusBadge: {
        position: 'absolute',
        top: 16,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 12,
    },
    statusBadgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '500',
    },
});
