import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { ChatMessage } from '../../types/schema';
import { Check, CheckCheck, Clock } from 'lucide-react-native';

interface MessageBubbleProps {
    message: ChatMessage & { sender?: { display_name: string; avatar_url?: string } };
    isOwn: boolean;
    showSenderName?: boolean;
    onLongPress?: (message: ChatMessage) => void;
}

export const MessageBubble = ({ message, isOwn, showSenderName, onLongPress }: MessageBubbleProps) => {
    // Determine status for own messages
    const getStatusIcon = () => {
        if (!message.id) return <Clock size={12} color="rgba(255,255,255,0.7)" />;

        // Check if read by anyone else (assuming recipient_id is handled or group logic)
        // Simplified: Since we know read_by acts as 'seen', check length or specific recipient
        // For 1:1, if read_by > 1, it is read.
        // For Group, maybe different logic, but let's stick to > 1 for now or check if it contains others.
        // Actually, read_by usually starts with just [sender_id] (or empty until read? Context says created with [user.id])
        // So if read_by.length > 1 => Read by someone.

        const isRead = message.read_by && message.read_by.length > 1;

        if (isRead) {
            return <CheckCheck size={14} color="#4ade80" />; // Green for read
        }

        // If not read, show delivered (Double Grey) or Sent (Single Grey)
        // Since we don't have a 'delivered' column, we'll simulate 'delivered' if it's saved (id exists)
        // To make it distinct, let's say:
        // 1 Tick = Just Sent (sent but maybe not pushed) - hard to distinguish in Supabase
        // 2 Ticks = Delivered (on server)
        // For now, let's just use Double Tick Grey for "Sent & Delivered to Server"
        // and Blue/Green for Read.

        return <CheckCheck size={14} color="rgba(255,255,255,0.7)" />;
    };

    return (
        <TouchableOpacity
            onLongPress={() => onLongPress && onLongPress(message)}
            activeOpacity={0.9}
            style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}
        >
            {!isOwn && (
                <View style={styles.avatarContainer}>
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
                <View style={styles.footer}>
                    <Text style={[styles.time, isOwn ? styles.ownTime : styles.otherTime]}>
                        {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {isOwn && (
                        <View style={styles.statusContainer}>
                            {getStatusIcon()}
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
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
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
        gap: 4,
    },
    time: {
        fontSize: 10,
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
    statusContainer: {
        marginLeft: 2,
    }
});
