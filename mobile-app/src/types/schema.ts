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
    created_at: string;
}
