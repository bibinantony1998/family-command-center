export type Role = 'parent' | 'child';

export interface Profile {
    id: string; // uuid
    display_name: string | null;
    role: Role | null;
    avatar_url: string | null;
    family_id: string | null; // uuid
    current_family_id?: string | null; // uuid
    date_of_birth?: string | null; // YYYY-MM-DD
    created_at: string;
}

export interface Family {
    id: string; // uuid
    name: string;
    secret_key: string;
    currency?: string;
    created_at: string;
}

export interface Grocery {
    id: string;
    item_name: string;
    quantity?: string;
    category: string | null;
    is_purchased: boolean;
    added_by: string | null;
    family_id: string;
    created_at: string;
}

export interface Note {
    id: string;
    content: string;
    color: string | null; // e.g. 'bg-yellow-200'
    author_id: string | null;
    family_id: string;
    created_at: string;
}

export interface Chore {
    id: string;
    title: string;
    points: number;
    is_completed: boolean;
    assigned_to: string | null; // profile_id
    family_id: string;
    created_at: string;
}

export interface Reward {
    id: string;
    family_id: string;
    name: string;
    cost: number;
    icon: string;
    created_at: string;
}

export type RedemptionStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled';

export interface Redemption {
    id: string;
    family_id: string;
    kid_id: string;
    reward_id: string;
    status: RedemptionStatus;
    redeemed_at?: string; // Optional if pending? No, usually null.
    created_at: string;
    updated_at: string;
    // Joins
    rewards?: Reward;
    profiles?: Profile;
}

export interface ChatMessage {
    id: string;
    family_id: string;
    sender_id: string;
    recipient_id: string | null; // null = group
    content: string;
    is_read: boolean;
    read_by: string[]; // UUIDs
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
    // Join
    sender?: Profile;
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

export interface Asset {
    id: string; // uuid
    family_id: string; // uuid
    type: 'vehicle' | 'property' | 'other';
    details: Record<string, unknown>; // jsonb
    added_by: string; // uuid
    created_at: string;
}

export interface InsurancePolicy {
    id: string; // uuid
    family_id: string; // uuid
    target_id: string | null; // uuid
    type: 'health' | 'life' | 'vehicle' | 'property' | 'medical';
    provider: string;
    premium_amount: number;
    coverage_amount: number | null;
    expiry_date: string; // date
    next_due_date: string | null; // date
    created_at: string;
}

export interface Bill {
    id: string; // uuid
    family_id: string; // uuid
    category: 'electricity' | 'water' | 'gas' | 'broadband' | 'dth' | 'mobile_postpaid' | 'landline' | 'education_fees' | 'credit_card' | 'property_tax' | 'municipal_tax' | 'subscription' | 'other';
    provider_name: string;
    consumer_number: string;
    due_date: string | null; // date
    amount: number;
    status: 'pending' | 'paid' | 'overdue';
    auto_pay: boolean;
    visibility: 'personal' | 'public';
    added_by: string; // uuid
    created_at: string;
}
