import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';

// Helper to timeout a promise
const withTimeout = <T,>(promise: Promise<T>, ms: number = 7000, fallbackValue?: T): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            if (fallbackValue !== undefined) resolve(fallbackValue);
            else reject(new Error('Operation timed out'));
        }, ms);

        promise
            .then((val) => {
                clearTimeout(timer);
                resolve(val);
            })
            .catch((err) => {
                clearTimeout(timer);
                reject(err);
            });
    });
};

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

    const fetchProfile = async (userId: string, retries = 2) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);

                // Self-healing: If profile doesn't exist, create it
                if (error.code === 'PGRST116') {
                    console.log('Profile missing, creating default profile...');
                    const { error: createError } = await supabase.from('profiles').insert([{
                        id: userId,
                        display_name: 'User',
                        role: 'parent'
                    }]);

                    if (!createError) {
                        // Retry fetch ONCE more, prevent infinite loop
                        return fetchProfile(userId, 0);
                    } else {
                        console.error('Failed to auto-create profile:', createError);
                    }
                }
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
        } catch (e: any) {
            console.error('Exception fetching profile:', e);
            Alert.alert('Profile Exception', e.message || JSON.stringify(e));
            if (retries > 0) {
                await new Promise(resolve => setTimeout(() => resolve(null), 500));
                return fetchProfile(userId, retries - 1);
            }
        }
    };

    const fetchFamily = async (familyId: string, retries = 2) => {
        try {
            console.log(`Fetching family: ${familyId}`);
            const { data, error } = await supabase.from('families').select('*').eq('id', familyId).single();

            // DEBUGGING: Trace fetchFamily
            console.log('FetchFamily Result:', { data, error });
            if (error || !data) {
                Alert.alert('Debug Family API', `Failed to load family ${familyId}: ${error?.message || 'No data'}`);
            }

            if (error) {
                console.error('Error fetching family:', error);

                if (retries > 0) {
                    console.log(`Retrying fetchFamily... (${retries} left)`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    return fetchFamily(familyId, retries - 1); // Retry recursively
                } else {
                    Alert.alert('Data Error', 'Could not load your family details. Please try again.');
                }
                return;
            }
            if (data) setFamily(data);
        } catch (e: any) {
            console.error('Exception fetching family:', e);
            Alert.alert('Family Exception', e.message || JSON.stringify(e));
            if (retries > 0) {
                await new Promise(resolve => setTimeout(() => resolve(null), 500));
                return fetchFamily(familyId, retries - 1);
            }
        }
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
        try {
            if (user) {
                await fetchProfile(user.id);
            }
        } catch (e) {
            console.error('Error refreshing profile:', e);
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
        let mounted = true;

        // Safety timeout to prevent infinite loading
        // Safety timeout to prevent infinite loading
        // Safety timeout to prevent infinite loading
        const safetyTimeout = setTimeout(() => {
            if (mounted && loading) {
                setLoading(false);
            }
        }, 10000); // 10 seconds max loading time

        const initSession = async () => {
            try {
                // Wrap session fetching in timeout
                const { data, error } = await withTimeout(
                    supabase.auth.getSession(),
                    5000
                );

                if (error) throw error;
                const session = data?.session;

                if (mounted) {
                    setSession(session);
                    setUser(session?.user ?? null);
                    if (session?.user) {
                        // Attempt to fetch profile with timeout, ignore errors
                        await withTimeout(fetchProfile(session.user.id), 5000).catch(() => { });
                    }
                }
            } catch (e) {
                // Ignore session errors
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            try {
                if (!mounted) return;

                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    setLoading(true);
                    await withTimeout(fetchProfile(session.user.id), 5000).catch(() => { });
                } else {
                    setProfile(null);
                    setFamily(null);
                    setMyFamilies([]);
                }
            } catch (e) {
                // Ignore auth state errors
            } finally {
                if (mounted) setLoading(false);
            }
        });

        return () => {
            mounted = false;
            clearTimeout(safetyTimeout);
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) console.error('Error signing out:', error);
        } catch (e) {
            console.error('Exception signing out:', e);
        } finally {
            setProfile(null);
            setFamily(null);
            setMyFamilies([]);
            setUser(null);
            setSession(null);
        }
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
