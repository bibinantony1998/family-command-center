import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    family: any | null;
    myFamilies: any[]; // List of families the user belongs to
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    switchFamily: (familyId: string) => Promise<void>;
    leaveFamily: (familyId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [family, setFamily] = useState<any | null>(null);
    const [myFamilies, setMyFamilies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // DEBUG: Verify new code is loaded
    useEffect(() => { console.log("AUTH CONTEXT - MULTI-FAMILY LOADED"); }, []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id).catch(console.error);
            } else {
                setLoading(false);
            }
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id).catch(console.error);
            } else {
                resetState();
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const resetState = () => {
        setProfile(null);
        setFamily(null);
        setMyFamilies([]);
    };

    const fetchProfile = async (userId: string) => {
        try {
            // 1. Fetch Profile
            const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                // Self-Healing: Create if missing
                if (error.code === 'PGRST116') {
                    console.log("Profile missing, creating default...");
                    await createDefaultProfile(userId);
                    return;
                }
                throw error;
            }

            setProfile(profileData);

            // 2. Fetch Current Family
            // Use current_family_id if available, otherwise fallback to legacy family_id
            const activeFamilyId = profileData.current_family_id || profileData.family_id;

            if (activeFamilyId) {
                const { data: familyData } = await supabase
                    .from('families')
                    .select('*')
                    .eq('id', activeFamilyId)
                    .single();
                setFamily(familyData);
            } else {
                setFamily(null);
            }

            // 3. Fetch All Families (via family_members)
            await fetchMyFamilies(userId);

        } catch (err) {
            console.error('Error in fetchProfile:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyFamilies = async (userId: string) => {
        const { data, error } = await supabase
            .from('family_members')
            .select('family:families(*), role')
            .eq('profile_id', userId);

        if (data) {
            // Flatten structure
            const familiesList = data.map((item: any) => ({
                ...item.family,
                membership_role: item.role
            }));
            setMyFamilies(familiesList);
        }
    };

    const createDefaultProfile = async (userId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        const displayName = user?.user_metadata?.display_name || 'New User';
        const role = user?.user_metadata?.role || 'parent';
        const familyId = user?.user_metadata?.family_id || null;

        const { data: newProfile, error } = await supabase
            .from('profiles')
            .insert({
                id: userId,
                display_name: displayName,
                role: role,
                family_id: familyId,
                current_family_id: familyId
            })
            .select()
            .single();

        if (error) {
            console.error("Error creating profile:", error);
            return;
        }

        setProfile(newProfile);

        const activeFamilyId = newProfile.current_family_id || newProfile.family_id;
        if (activeFamilyId) {
            const { data: familyData } = await supabase
                .from('families')
                .select('*')
                .eq('id', activeFamilyId)
                .single();
            setFamily(familyData);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        resetState();
        setUser(null);
        setSession(null);
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id);
        }
    }

    const switchFamily = async (targetFamilyId: string) => {
        try {
            setLoading(true);
            const { error } = await supabase.rpc('switch_family', { target_family_id: targetFamilyId });
            if (error) throw error;

            // Reload profile and family
            await refreshProfile();
        } catch (err: any) {
            console.error("Error switching family:", err);
            throw err; // Let UI handle alert
        } finally {
            setLoading(false);
        }
    }

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
    }

    return (
        <AuthContext.Provider value={{ session, user, profile, family, myFamilies, loading, signOut, refreshProfile, switchFamily, leaveFamily }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
