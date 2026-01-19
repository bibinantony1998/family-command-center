import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { ChatMessage } from '../../types/schema'; // We need to update schema.ts to include ChatMessage
import { useAuth } from '../../context/AuthContext';

interface MessageBubbleProps {
    message: ChatMessage & { sender?: { display_name: string; avatar_url?: string } };
    isOwn: boolean;
    showSenderName?: boolean;
}

export const MessageBubble = ({ message, isOwn, showSenderName }: MessageBubbleProps) => {
    return (
        <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
            {!isOwn && (
                <View style={styles.avatarContainer}>
                    {/* Placeholder or Image */}
                    {message.sender?.avatar_url ? (
                        <Image source={{ uri: message.sender.avatar_url }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>{message.sender?.display_name?.[0] || '?'}</Text>
                        </View>
                    )}
                </View>
            )}

            <View style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
                {!isOwn && showSenderName && (
                    <Text style={styles.senderName}>{message.sender?.display_name}</Text>
                )}
                <Text style={[styles.text, isOwn ? styles.ownText : styles.otherText]}>
                    {message.content}
                </Text>
                <Text style={[styles.time, isOwn ? styles.ownTime : styles.otherTime]}>
                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'flex-end',
    },
    ownContainer: {
        justifyContent: 'flex-end',
    },
    otherContainer: {
        justifyContent: 'flex-start',
    },
    avatarContainer: {
        marginRight: 8,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    avatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#64748b',
    },
    bubble: {
        maxWidth: '75%',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
    },
    ownBubble: {
        backgroundColor: '#6366f1', // Indigo
        borderBottomRightRadius: 4,
    },
    otherBubble: {
        backgroundColor: '#f1f5f9', // Slate 100
        borderBottomLeftRadius: 4,
    },
    text: {
        fontSize: 16,
        lineHeight: 22,
    },
    ownText: {
        color: 'white',
    },
    otherText: {
        color: '#1e293b',
    },
    time: {
        fontSize: 10,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    ownTime: {
        color: 'rgba(255,255,255,0.7)',
    },
    otherTime: {
        color: '#94a3b8',
    },
    senderName: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#6366f1',
        marginBottom: 2,
    },
});
