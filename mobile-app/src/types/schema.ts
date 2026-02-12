export interface Profile {
    id: string;
    display_name: string;
    role: 'parent' | 'child';
    family_id: string;
    balance: number;
    avatar_url?: string;
}

export interface Chore {
    id: string;
    title: string;
    points: number;
    is_completed: boolean;
    assigned_to?: string;
    family_id: string;
    assignee?: { display_name: string; avatar_url?: string };
}

export interface Reward {
    id: string;
    name: string;
    cost: number;
    icon: string;
}

export interface Redemption {
    id: string;
    kid_id: string;
    reward_id: string;
    status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
    created_at: string;
    rewards?: { name: string; cost: number };
    profiles?: { display_name: string };
}

export interface Note {
    id: string;
    content: string;
    color: string;
    created_at: string;
}

export interface Grocery {
    id: string;
    item_name: string;
    is_purchased: boolean;
    quantity?: string;
}

export interface ChatMessage {
    id: string;
    family_id: string;
    sender_id: string;
    recipient_id: string | null;
    content: string;
    is_read: boolean;
    read_by: string[];
    is_encrypted?: boolean;
    nonce?: string;
    encrypted_keys?: Record<string, string> | null; // { deviceId: encryptedSymKey }
    sender_device_id?: string | null;
    // P2P Attachment metadata (actual file sent via WebRTC, not stored)
    attachment_type?: 'image' | 'video' | 'audio' | null;
    attachment_name?: string | null;
    attachment_size?: number | null;
    attachment_blob_url?: string | null; // Temporary in-session blob URL (not persisted to DB)
    created_at: string;
}

export interface UserDevice {
    id: string;
    user_id: string;
    device_id: string;
    device_name: string;
    public_key: string;
    created_at: string;
    last_active: string;
}
