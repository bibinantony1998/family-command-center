import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    // DEBUG: Verify new code is loaded
    useEffect(() => { console.log("AUTH CONTEXT - SELF HEALING V2 LOADED"); }, []);

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
                // Self-Healing: If profile is missing (PGRST116), create it.
                if (error.code === 'PGRST116') {
                    console.log("Profile missing, creating default profile...");

                    // Retrieve user metadata to get display name
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

                    if (insertError) {
                        console.error('Failed to auto-create profile:', insertError);
                        throw insertError;
                    }

                    setProfile(newProfile);
                    return;
                }

                console.error('Error fetching profile:', error);
                throw error;
            } else {
                setProfile(data);
            }
        } catch (err) {
            console.error('Error in fetchProfile:', err);
            // Don't re-throw, just let profile be null so user can potentially try again or we can handle it in UI
            // throwing err here causes the Auth component to crash or show error state loop
        } finally {
            setLoading(false);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setUser(null);
        setSession(null);
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id);
        }
    }

    return (
        <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
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
