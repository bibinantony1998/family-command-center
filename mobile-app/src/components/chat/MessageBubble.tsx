import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { ChatMessage } from '../../types/schema';
import { CheckCheck, Clock, Download } from 'lucide-react-native';

interface MessageBubbleProps {
    message: ChatMessage & { sender?: { display_name: string; avatar_url?: string } };
    isOwn: boolean;
    showSenderName?: boolean;
    onLongPress?: (message: ChatMessage) => void;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MessageBubble = ({ message, isOwn, showSenderName, onLongPress }: MessageBubbleProps) => {
    const getStatusIcon = () => {
        if (!message.id) return <Clock size={12} color="rgba(255,255,255,0.7)" />;

        const isRead = message.read_by && message.read_by.length > 1;
        if (isRead) {
            return <CheckCheck size={14} color="#4ade80" />;
        }
        return <CheckCheck size={14} color="rgba(255,255,255,0.7)" />;
    };

    const hasAttachment = !!message.attachment_type;
    const hasBlobUrl = !!message.attachment_blob_url;

    const renderAttachment = () => {
        if (!hasAttachment) return null;

        if (!hasBlobUrl) {
            return (
                <Text style={[expiredStyles.text, isOwn ? expiredStyles.ownText : expiredStyles.otherText]}>
                    📎 {message.attachment_type?.charAt(0).toUpperCase()}{message.attachment_type?.slice(1)} (expired)
                </Text>
            );
        }

        return (
            <View style={attachStyles.container}>
                {message.attachment_type === 'image' && (
                    <TouchableOpacity onPress={() => Linking.openURL(message.attachment_blob_url!)}>
                        <Image
                            source={{ uri: message.attachment_blob_url! }}
                            style={attachStyles.image}
                            resizeMode="cover"
                        />
                    </TouchableOpacity>
                )}
                {message.attachment_type === 'video' && (
                    <TouchableOpacity
                        style={attachStyles.mediaPlaceholder}
                        onPress={() => Linking.openURL(message.attachment_blob_url!)}
                    >
                        <Text style={attachStyles.mediaIcon}>🎬</Text>
                        <Text style={attachStyles.mediaLabel}>Tap to play video</Text>
                    </TouchableOpacity>
                )}
                {message.attachment_type === 'audio' && (
                    <TouchableOpacity
                        style={attachStyles.mediaPlaceholder}
                        onPress={() => Linking.openURL(message.attachment_blob_url!)}
                    >
                        <Text style={attachStyles.mediaIcon}>🎵</Text>
                        <Text style={attachStyles.mediaLabel}>Tap to play audio</Text>
                    </TouchableOpacity>
                )}

                <View style={attachStyles.infoRow}>
                    <Text style={[attachStyles.fileName, isOwn ? { color: 'rgba(255,255,255,0.7)' } : { color: '#64748b' }]} numberOfLines={1}>
                        {message.attachment_name}
                        {message.attachment_size ? ` (${formatFileSize(message.attachment_size)})` : ''}
                    </Text>
                </View>

                {!isOwn && (
                    <TouchableOpacity
                        onPress={() => Linking.openURL(message.attachment_blob_url!)}
                        style={[attachStyles.downloadBtn, attachStyles.otherDownloadBtn]}
                    >
                        <Download size={16} color="#6366f1" />
                        <Text style={[attachStyles.downloadText, { color: '#6366f1' }]}>
                            Save to Gallery
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        );
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

                {/* Hide auto-generated attachment label */}
                {(!hasAttachment || !message.content.startsWith('📎')) && (
                    <Text style={[styles.text, isOwn ? styles.ownText : styles.otherText]}>
                        {message.content}
                    </Text>
                )}

                {renderAttachment()}

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
        backgroundColor: '#6366f1',
        borderBottomRightRadius: 4,
    },
    otherBubble: {
        backgroundColor: '#f1f5f9',
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
    },
});

const expiredStyles = StyleSheet.create({
    text: {
        fontSize: 12,
        marginTop: 6,
        paddingTop: 6,
    },
    ownText: {
        color: 'rgba(255,255,255,0.6)',
        borderTopColor: 'rgba(255,255,255,0.2)',
        borderTopWidth: 1,
    },
    otherText: {
        color: '#94a3b8',
        borderTopColor: '#e2e8f0',
        borderTopWidth: 1,
    },
});

const attachStyles = StyleSheet.create({
    container: {
        marginTop: 6,
    },
    image: {
        width: '100%',
        height: 180,
        borderRadius: 12,
    },
    mediaPlaceholder: {
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 12,
        paddingVertical: 24,
        alignItems: 'center',
    },
    mediaIcon: {
        fontSize: 28,
    },
    mediaLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    fileName: {
        fontSize: 11,
        flex: 1,
        marginRight: 8,
    },
    downloadBtn: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 6,
    },
    ownDownloadBtn: {
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    otherDownloadBtn: {
        backgroundColor: '#e0e7ff',
    },
    downloadText: {
        fontSize: 12,
        fontWeight: '600',
    },
});
