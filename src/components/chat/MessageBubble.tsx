import type { ChatMessage } from '../../types';
import { cn } from '../../lib/utils';
import { CheckCheck, Clock, Trash2 } from 'lucide-react';

interface MessageBubbleProps {
    message: ChatMessage;
    isOwn: boolean;
    onDelete?: (id: string) => void;
}

export function MessageBubble({ message, isOwn, onDelete }: MessageBubbleProps) {
    const getStatusIcon = () => {
        if (!message.id) return <Clock size={12} className="text-indigo-200" />;

        // Check read_by array (if it exists on the type, otherwise assume delivered)
        // We need to ensure ChatMessage type allows read_by
        const readBy = message.read_by || [];
        const isRead = readBy.length > 1; // Assuming sender is in read_by, so >1 means someone else read it.

        if (isRead) {
            return <CheckCheck size={14} className="text-green-400" />;
        }

        return <CheckCheck size={14} className="text-indigo-200" />;
    };

    return (
        <div className={cn("flex w-full mb-4 group", isOwn ? "justify-end" : "justify-start")}>
            {/* Delete Action (Left side for own messages, hidden by default, visible on group hover) */}
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
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

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

