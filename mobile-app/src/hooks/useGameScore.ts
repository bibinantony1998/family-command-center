import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Alert } from 'react-native';

export const useGameScore = () => {
    const { profile } = useAuth();

    const saveScore = useCallback(async (gameId: string, level: number, points: number) => {
        if (!profile) return;
        try {
            const { error } = await supabase.from('game_scores').insert({
                game_id: gameId,
                level,
                points,
                profile_id: profile.id,
                family_id: profile.family_id
            });

            if (error) throw error;

            // Update local context balance if needed, or let subscription handle it?
            // For now, reliance on real-time or refresh on dashboard is fine.
        } catch (e) {
            console.error('Save Score Error:', e);
            // Silent fail or alert depending on UX preference.
        }
    }, [profile]);

    const getHighestLevel = useCallback(async (gameId: string) => {
        if (!profile) return 1;
        const { data } = await supabase
            .from('game_scores')
            .select('level')
            .eq('game_id', gameId)
            .eq('profile_id', profile.id)
            .order('level', { ascending: false })
            .limit(1);

        return (data?.[0]?.level || 0) + 1;
    }, [profile]);

    return { saveScore, getHighestLevel };
};
