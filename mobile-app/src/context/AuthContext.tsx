import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Profile = {
    id: string;
    display_name: string;
    role: 'parent' | 'child';
    avatar_url: string | null;
    family_id: string | null;
    current_family_id: string | null; // Added current_family_id
    balance: number;
};

type Family = {
    id: string;
    name: string;
    secret_key: string; // Added secret_key
    currency: string;
    membership_role?: string; // Optional role in this family
};

type AuthContextType = {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    family: Family | null;
    myFamilies: Family[]; // New: List of families
    loading: boolean;
    refreshProfile: () => Promise<void>;
    signOut: () => Promise<void>;
    switchFamily: (familyId: string) => Promise<void>; // New: Switch function
    leaveFamily: (familyId: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    profile: null,
    family: null,
    myFamilies: [],
    loading: true,
    refreshProfile: async () => { },
    signOut: async () => { },
    switchFamily: async () => { },
    leaveFamily: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [family, setFamily] = useState<Family | null>(null);
    const [myFamilies, setMyFamilies] = useState<Family[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
            } else {
                setProfile(data);

                // Determine active family ID
                const activeFamilyId = data.current_family_id || data.family_id;

                if (activeFamilyId) {
                    await fetchFamily(activeFamilyId);
                } else {
                    setFamily(null);
                }

                // Fetch all families
                await fetchMyFamilies(userId);
            }
        } catch (e) {
            console.error('Exception fetching profile:', e);
        }
    };

    const fetchFamily = async (familyId: string) => {
        const { data } = await supabase.from('families').select('*').eq('id', familyId).single();
        if (data) setFamily(data);
    };

    const fetchMyFamilies = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('family_members')
                .select('family:families(*), role')
                .eq('profile_id', userId);

            if (data) {
                const familiesList = data.map((item: any) => ({
                    ...item.family,
                    membership_role: item.role
                }));
                setMyFamilies(familiesList);
            }
        } catch (e) {
            console.error('Error fetching families list:', e);
        }
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id);
        }
    };

    const switchFamily = async (targetFamilyId: string) => {
        try {
            setLoading(true);
            const { error } = await supabase.rpc('switch_family', { target_family_id: targetFamilyId });
            if (error) throw error;

            await refreshProfile();
        } catch (err: any) {
            console.error("Error switching family:", err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const initSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.user) {
                    await fetchProfile(session.user.id);
                }
            } catch (e) {
                console.error('Error getting session:', e);
            } finally {
                setLoading(false);
            }
        };

        initSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                setLoading(true); // Ensure loading is true while fetching profile
                await fetchProfile(session.user.id);
            } else {
                setProfile(null);
                setFamily(null);
                setMyFamilies([]);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setFamily(null);
        setMyFamilies([]);
        setUser(null);
        setSession(null);
    };

    const leaveFamily = async (targetFamilyId: string) => {
        try {
            setLoading(true);
            const { error } = await supabase.rpc('leave_family', { target_family_id: targetFamilyId });
            if (error) throw error;

            await refreshProfile();
        } catch (err: any) {
            console.error("Error leaving family:", err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthContext.Provider value={{ session, user, profile, family, myFamilies, loading, refreshProfile, signOut, switchFamily, leaveFamily }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
