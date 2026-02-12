

/**
 * In-memory queue for attachments waiting to be sent to an offline recipient.
 * Queue is lost on page refresh (by design — no server storage).
 */

interface QueuedAttachment {
    id: string;
    file: File | Blob;
    fileName: string;
    fileType: 'image' | 'video' | 'audio';
    recipientId: string;
    familyId: string;
    senderId: string;
    queuedAt: number;
}

const queue: QueuedAttachment[] = [];
let onQueueDrainCallback: ((attachment: QueuedAttachment) => Promise<void>) | null = null;

export function queueAttachment(attachment: Omit<QueuedAttachment, 'id' | 'queuedAt'>): string {
    const id = crypto.randomUUID();
    const entry: QueuedAttachment = { ...attachment, id, queuedAt: Date.now() };
    queue.push(entry);
    return id;
}

export function getQueuedAttachments(recipientId: string): QueuedAttachment[] {
    return queue.filter(a => a.recipientId === recipientId);
}

export function removeFromQueue(id: string): void {
    const idx = queue.findIndex(a => a.id === id);
    if (idx !== -1) queue.splice(idx, 1);
}

export function getQueueLength(): number {
    return queue.length;
}

export function setOnQueueDrain(callback: (attachment: QueuedAttachment) => Promise<void>): void {
    onQueueDrainCallback = callback;
}

/**
 * Called when a recipient comes online — drains their queued attachments.
 */
export async function drainQueueForRecipient(recipientId: string): Promise<void> {
    if (!onQueueDrainCallback) return;

    const pending = getQueuedAttachments(recipientId);
    for (const attachment of pending) {
        try {
            await onQueueDrainCallback(attachment);
            removeFromQueue(attachment.id);
        } catch (err) {
            console.error('[AttachmentQueue] Failed to send queued attachment:', err);
            // Keep in queue for next retry
        }
    }
}

export type { QueuedAttachment };
