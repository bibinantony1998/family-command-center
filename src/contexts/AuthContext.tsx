import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    family: any | null; // Added family
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [family, setFamily] = useState<any | null>(null); // Added family state
    const [loading, setLoading] = useState(true);

    // DEBUG: Verify new code is loaded
    useEffect(() => { console.log("AUTH CONTEXT - FAMILY CURRENCY LOADED"); }, []);

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
                setProfile(null);
                setFamily(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                // Self-Healing
                if (error.code === 'PGRST116') {
                    // ... existing create logic ...
                    // (Omitting full recreation logic here for brevity in replace, but ideally should be kept. 
                    // Since I am replacing the whole function, I must check if I can keep it or if I should just use the existing logic.)
                    // Actually, I will just modify the SELECT in fetchProfile to also get family? No, family is a separate table, profile has family_id.

                    // RE-INSERTING THE EXISTING LOGIC PROPERLY:
                    console.log("Profile missing, creating default profile...");
                    const { data: { user } } = await supabase.auth.getUser();
                    const displayName = user?.user_metadata?.display_name || 'New User';
                    const role = user?.user_metadata?.role || 'parent';
                    const familyId = user?.user_metadata?.family_id || null;

                    const { data: newProfile, error: insertError } = await supabase
                        .from('profiles')
                        .insert({
                            id: userId,
                            display_name: displayName,
                            role: role,
                            family_id: familyId
                        })
                        .select()
                        .single();

                    if (insertError) throw insertError;
                    setProfile(newProfile);

                    if (newProfile.family_id) {
                        const { data: familyData } = await supabase.from('families').select('*').eq('id', newProfile.family_id).single();
                        setFamily(familyData);
                    }
                    return;
                }
                throw error;
            } else {
                setProfile(data);
                if (data.family_id) {
                    const { data: familyData } = await supabase.from('families').select('*').eq('id', data.family_id).single();
                    setFamily(familyData);
                }
            }
        } catch (err) {
            console.error('Error in fetchProfile:', err);
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setFamily(null);
        setUser(null);
        setSession(null);
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id);
        }
    }

    return (
        <AuthContext.Provider value={{ session, user, profile, family, loading, signOut, refreshProfile }}>
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
