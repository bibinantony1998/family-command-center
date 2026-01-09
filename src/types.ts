export type Role = 'parent' | 'child';

export interface Profile {
    id: string; // uuid
    display_name: string | null;
    role: Role | null;
    avatar_url: string | null;
    family_id: string | null; // uuid
    created_at: string;
}

export interface Family {
    id: string; // uuid
    name: string;
    secret_key: string;
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
