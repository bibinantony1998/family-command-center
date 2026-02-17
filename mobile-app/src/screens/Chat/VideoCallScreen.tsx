import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, Platform } from 'react-native';
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, RTCView, mediaDevices, MediaStream } from 'react-native-webrtc';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import { CallSignaling, fetchTurnServers, SignalMessage, CALL_CONFIG } from '../../lib/callSignaling';
import { useAuth } from '../../context/AuthContext';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, SwitchCamera, Minimize2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Polyfill/Fix for RN WebRTC types if needed
declare module 'react-native-webrtc' {
    interface RTCPeerConnection {
        oniceconnectionstatechange: ((event: Event) => void) | null;
        ontrack: ((event: any) => void) | null;
        onicecandidate: ((event: any) => void) | null;
    }
}

type VideoCallRouteProp = RouteProp<RootStackParamList, 'VideoCall'>;

export default function VideoCallScreen() {
    const navigation = useNavigation();
    const route = useRoute<VideoCallRouteProp>();
    const { recipientId, name, isCaller, offer } = route.params;
    const { user, family } = useAuth();

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [status, setStatus] = useState<string>('Initializing...');

    // WebRTC Refs
    const pc = useRef<RTCPeerConnection | null>(null);
    const signaling = useRef<CallSignaling | null>(null);
    const pendingCandidates = useRef<any[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    const callId = useRef<string>(isCaller ? `${Date.now()}-${Math.random()}` : (offer ? offer.callId : ''));

    // --- Cleanup ---
    const cleanup = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current.release();
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
        navigation.goBack();
    }, [recipientId, cleanup, navigation]);

    // --- WebRTC Setup ---
    useEffect(() => {
        if (!user || !family) return;

        let started = false;

        const startCall = async () => {
            if (started || streamRef.current) return;
            started = true;

            // 1. Setup Stream
            try {
                const stream = await mediaDevices.getUserMedia({
                    audio: true,
                    video: {
                        width: 640, height: 480, frameRate: 30, facingMode: 'user'
                    }
                });

                streamRef.current = stream;
                setLocalStream(stream);

                // 2. Setup PC
                const iceServers = await fetchTurnServers();
                const configuration = { iceServers, iceTransportPolicy: 'all' as const };

                const peerConnection = new RTCPeerConnection(configuration);
                pc.current = peerConnection;

                // Add Trace for bandwidth/connection state
                peerConnection.oniceconnectionstatechange = () => {
                    console.log('[WebRTC] ICE State:', peerConnection.iceConnectionState);
                    if (peerConnection.iceConnectionState === 'disconnected') {
                        setStatus('Reconnecting...');
                    } else if (peerConnection.iceConnectionState === 'failed') {
                        setStatus('Connection Failed');
                        Alert.alert('Call Failed', 'Connection lost.', [{ text: 'OK', onPress: endCall }]);
                    } else if (peerConnection.iceConnectionState === 'connected') {
                        setStatus('Connected');
                    }
                };

                // Add local tracks
                stream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, stream);
                });

                // Handle remote stream
                peerConnection.ontrack = (event) => {
                    if (event.streams && event.streams[0]) {
                        console.log('[WebRTC] User stream received');
                        setRemoteStream(event.streams[0]);
                    }
                };

                peerConnection.onicecandidate = (event) => {
                    if (event.candidate && signaling.current) {
                        signaling.current.sendSignal(recipientId, 'ice-candidate', { candidate: event.candidate }, callId.current);
                    }
                };

                // 3. Setup Signaling
                signaling.current = new CallSignaling(user.id, family.id, async (msg: SignalMessage) => {
                    if (msg.callId && msg.callId !== callId.current && !isCaller) {
                        if (!callId.current) callId.current = msg.callId;
                    }

                    if (msg.type === 'call-end') {
                        Alert.alert('Call Ended', 'The other user ended the call.');
                        cleanup();
                        navigation.goBack();
                    } else if (msg.type === 'answer') {
                        if (pc.current) {
                            await pc.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                        }
                    } else if (msg.type === 'offer') {
                        if (pc.current && pc.current.signalingState === 'stable') {
                            // Renegotiation
                        }
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
                    const offerDescription = await peerConnection.createOffer({});
                    await peerConnection.setLocalDescription(offerDescription);
                    signaling.current.sendSignal(recipientId, 'offer', { sdp: offerDescription }, callId.current);
                } else {
                    // Callee
                    setStatus('Connecting...');
                    if (offer && offer.sdp) {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer.sdp));
                        const answerDescription = await peerConnection.createAnswer();
                        await peerConnection.setLocalDescription(answerDescription);
                        signaling.current.sendSignal(recipientId, 'answer', { sdp: answerDescription }, callId.current);

                        pendingCandidates.current.forEach(c => peerConnection.addIceCandidate(new RTCIceCandidate(c)));
                        pendingCandidates.current = [];
                    }
                }

            } catch (err) {
                console.error('Call setup failed:', err);
                Alert.alert('Error', 'Failed to start call');
                navigation.goBack();
            }
        };

        startCall();

        return () => {
            // Immediate cleanup on unmount
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current.release();
            }
            if (pc.current) pc.current.close();
            if (signaling.current) signaling.current.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run ONCE on mount

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

    const switchCamera = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                // react-native-webrtc specific method
                // @ts-ignore
                track._switchCamera();
            });
        }
    };

    return (
        <View style={styles.container}>
            {/* Remote Video (Full Screen) */}
            {remoteStream ? (
                <RTCView
                    streamURL={remoteStream.toURL()}
                    style={styles.remoteVideo}
                    objectFit="cover"
                    zOrder={0}
                />
            ) : (
                <View style={styles.remotePlaceholder}>
                    <Text style={styles.statusText}>{status}</Text>
                    <Text style={styles.nameText}>{name}</Text>
                </View>
            )}

            {/* Local Video (Floating PiP-like) */}
            <View style={styles.localVideoContainer}>
                {localStream && !isCameraOff ? (
                    <RTCView
                        streamURL={localStream.toURL()}
                        style={styles.localVideo}
                        objectFit="cover"
                        zOrder={1}
                    />
                ) : (
                    <View style={[styles.localVideo, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                        <VideoOff color="white" size={20} />
                    </View>
                )}
            </View>

            {/* Controls Overlay */}
            <SafeAreaView style={styles.controlsContainer}>
                <TouchableOpacity style={styles.controlButton} onPress={toggleMic}>
                    {isMuted ? <MicOff color="white" size={24} /> : <Mic color="white" size={24} />}
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
                    {isCameraOff ? <VideoOff color="white" size={24} /> : <VideoIcon color="white" size={24} />}
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
                    <SwitchCamera color="white" size={24} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.controlButton, styles.endButton]} onPress={endCall}>
                    <PhoneOff color="white" size={30} />
                </TouchableOpacity>
            </SafeAreaView>

            {/* Minimize/Back Button */}
            <TouchableOpacity style={styles.minimizeButton} onPress={() => {
                // Just go back to chat, effectively minimizing call UI if we handled background state
                // For now, this just warns user or works as PiP entry trigger if implemented
                navigation.goBack();
            }}>
                <Minimize2 color="white" size={24} />
            </TouchableOpacity>
        </View>
    );
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    remoteVideo: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    remotePlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusText: {
        color: '#94a3b8',
        fontSize: 16,
        marginBottom: 8,
    },
    nameText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    localVideoContainer: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 100,
        height: 150,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#334155',
        shadowColor: 'black',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 10,
    },
    localVideo: {
        width: '100%',
        height: '100%',
    },
    controlsContainer: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    controlButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(51, 65, 85, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    endButton: {
        backgroundColor: '#ef4444',
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    minimizeButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10
    }
});
