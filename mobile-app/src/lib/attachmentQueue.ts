/**
 * In-memory queue for attachments waiting to be sent to an offline recipient.
 * Queue is lost on app restart (by design — no server storage).
 */

interface QueuedAttachment {
    id: string;
    fileUri: string;
    fileName: string;
    fileType: 'image' | 'video' | 'audio';
    fileSize: number;
    recipientId: string;
    familyId: string;
    senderId: string;
    queuedAt: number;
}

const queue: QueuedAttachment[] = [];
let onQueueDrainCallback: ((attachment: QueuedAttachment) => Promise<void>) | null = null;
const listeners = new Set<() => void>();

export function subscribeToQueue(callback: () => void): () => void {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

function notifyListeners() {
    listeners.forEach(cb => cb());
}

export function queueAttachment(attachment: Omit<QueuedAttachment, 'id' | 'queuedAt'>): string {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const entry: QueuedAttachment = { ...attachment, id, queuedAt: Date.now() };
    queue.push(entry);
    notifyListeners();
    return id;
}

export function getQueuedAttachments(recipientId: string): QueuedAttachment[] {
    return queue.filter(a => a.recipientId === recipientId);
}

export function removeFromQueue(id: string): void {
    const idx = queue.findIndex(a => a.id === id);
    if (idx !== -1) {
        queue.splice(idx, 1);
        notifyListeners();
    }
}

export function getQueueLength(): number {
    return queue.length;
}

export function setOnQueueDrain(callback: (attachment: QueuedAttachment) => Promise<void>): void {
    onQueueDrainCallback = callback;
}

export async function drainQueueForRecipient(recipientId: string): Promise<void> {
    if (!onQueueDrainCallback) return;

    const pending = getQueuedAttachments(recipientId);
    for (const attachment of pending) {
        try {
            await onQueueDrainCallback(attachment);
            removeFromQueue(attachment.id);
        } catch (err) {
            console.error('[AttachmentQueue] Failed to send queued attachment:', err);
        }
    }
}

export type { QueuedAttachment };
