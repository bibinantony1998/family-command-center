import type { ChatMessage } from '../../types';
import { cn } from '../../lib/utils';
import { CheckCheck, Clock, Trash2, Download } from 'lucide-react';

interface MessageBubbleProps {
    message: ChatMessage;
    isOwn: boolean;
    onDelete?: (id: string) => void;
}

export function MessageBubble({ message, isOwn, onDelete }: MessageBubbleProps) {
    const getStatusIcon = () => {
        if (!message.id) return <Clock size={12} className="text-indigo-200" />;

        const readBy = message.read_by || [];
        const isRead = readBy.length > 1;

        if (isRead) {
            return <CheckCheck size={14} className="text-green-400" />;
        }

        return <CheckCheck size={14} className="text-indigo-200" />;
    };

    const hasAttachment = !!message.attachment_type;
    const hasBlobUrl = !!message.attachment_blob_url;

    const renderAttachment = () => {
        if (!hasAttachment) return null;

        // Expired attachment (no blob URL means the file was never received or page was refreshed)
        if (!hasBlobUrl) {
            return (
                <div className={cn(
                    "mt-2 pt-2 border-t text-xs flex items-center gap-1",
                    isOwn ? "border-indigo-400/30 text-indigo-200" : "border-slate-200 text-slate-400"
                )}>
                    📎 {message.attachment_type?.charAt(0).toUpperCase()}{message.attachment_type?.slice(1)} (expired)
                </div>
            );
        }

        return (
            <div className="mt-2">
                {message.attachment_type === 'image' && (
                    <img
                        src={message.attachment_blob_url!}
                        alt={message.attachment_name || 'Image'}
                        className="max-w-full rounded-lg max-h-64 object-cover cursor-pointer"
                        onClick={() => window.open(message.attachment_blob_url!, '_blank')}
                    />
                )}
                {message.attachment_type === 'video' && (
                    <video
                        src={message.attachment_blob_url!}
                        controls
                        className="max-w-full rounded-lg max-h-64"
                    />
                )}
                {message.attachment_type === 'audio' && (
                    <audio
                        src={message.attachment_blob_url!}
                        controls
                        className="w-full mt-1"
                    />
                )}

                {/* File info + Download */}
                <div className={cn(
                    "flex items-center justify-between mt-1.5 text-[11px]",
                    isOwn ? "text-indigo-200" : "text-slate-400"
                )}>
                    <span className="truncate mr-2">
                        {message.attachment_name}
                        {message.attachment_size && ` (${formatFileSize(message.attachment_size)})`}
                    </span>
                    {!isOwn && (
                        <a
                            href={message.attachment_blob_url!}
                            download={message.attachment_name || 'download'}
                            className="flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all w-full mt-2 shadow-sm active:scale-95 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Download size={14} /> Save to Device
                        </a>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={cn("flex w-full mb-4 group", isOwn ? "justify-end" : "justify-start")}>
            {isOwn && (
                <button
                    onClick={() => onDelete && onDelete(message.id)}
                    className="mr-2 opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-400 hover:text-red-500 self-center"
                    title="Delete message"
                >
                    <Trash2 size={16} />
                </button>
            )}

            <div className={cn(
                "flex max-w-[70%] flex-col px-4 py-2 rounded-lg shadow-sm relative",
                isOwn ? "bg-[#6366f1] text-white rounded-br-none" : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
            )}>
                {!isOwn && message.sender && (
                    <span className="text-xs font-bold mb-1 text-slate-500">
                        {message.sender.display_name}
                    </span>
                )}

                {/* Text content (hide if it's just the auto-generated attachment label) */}
                {(!hasAttachment || !message.content.startsWith('📎')) && (
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                )}

                {/* Attachment */}
                {renderAttachment()}

                <div className={cn("flex items-center justify-end gap-1 mt-1", isOwn ? "text-indigo-200" : "text-slate-400")}>
                    <span className="text-[10px]">
                        {new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    {isOwn && getStatusIcon()}
                </div>
            </div>
        </div>
    );
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
