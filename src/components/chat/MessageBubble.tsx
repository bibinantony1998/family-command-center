import type { ChatMessage } from '../../types';
import { cn } from '../../lib/utils';

interface MessageBubbleProps {
    message: ChatMessage;
    isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
    return (
        <div className={cn("flex w-full mb-4", isOwn ? "justify-end" : "justify-start")}>
            <div className={cn(
                "flex max-w-[70%] flex-col px-4 py-2 rounded-lg shadow-sm",
                isOwn ? "bg-indigo-600 text-white rounded-br-none" : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
            )}>
                {!isOwn && message.sender && (
                    <span className="text-xs font-bold mb-1 text-slate-500">
                        {message.sender.display_name}
                    </span>
                )}
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                <div className={cn("text-[10px] mt-1 text-right", isOwn ? "text-indigo-200" : "text-slate-400")}>
                    {new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </div>
            </div>
        </div>
    );
}
