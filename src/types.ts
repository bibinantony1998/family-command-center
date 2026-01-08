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
    share_code: string; // or secret_key in DB
    created_at: string;
}

export interface Grocery {
    id: string;
    item_name: string;
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
