import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';

export default function JoinFamily() {
    const { user, refreshProfile } = useAuth();
    const [mode, setMode] = useState<'join' | 'create'>('join');
    const [familyName, setFamilyName] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const generatedKey = Math.random().toString(36).substring(2, 8).toUpperCase();

            // 1. Create Family
            // Use maybeSingle() to avoid crashing if RLS hides the result
            const { data: family, error: familyError } = await supabase
                .from('families')
                .insert([{ name: familyName, secret_key: generatedKey }])
                .select()
                .maybeSingle();

            if (familyError) throw familyError;

            if (!family) {
                throw new Error("Family created, but RLS blocked reading it. Run the 'fix_rls.sql' script in Supabase.");
            }

            if (user) {
                // 2. Update Profile to link to Family
                const { data: updatedProfile, error: profileError } = await supabase
                    .from('profiles')
                    .update({ family_id: family.id })
                    .eq('id', user.id)
                    .select()
                    .maybeSingle();

                if (profileError) throw profileError;

                // 3. Auto-Heal: If profile update returned nothing, the profile might be missing.
                if (!updatedProfile) {
                    console.log("Profile update returned no data. Attempting to create profile...");

                    // Try to insert the profile (Upsert)
                    const { error: insertError } = await supabase
                        .from('profiles')
                        .insert({
                            id: user.id,
                            display_name: user.user_metadata?.display_name || 'Parent',
                            role: 'parent',
                            family_id: family.id
                        })
                        .select()
                        .maybeSingle();

                    if (insertError) {
                        console.error("Auto-heal failed:", insertError);
                        throw new Error("Could not update or create profile. Please run 'nuclear_fix_profiles.sql' in Supabase.");
                    }
                }

                await refreshProfile();
            }

        } catch (err: any) {
            console.error("JoinFamily Error:", err);
            if (err instanceof Error) {
                setError(err.message);
            } else if (typeof err === 'object' && err !== null && 'message' in err) {
                setError(err.message);
            } else {
                setError("An unexpected error occurred");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data: family, error: familyError } = await supabase
                .from('families')
                .select('*')
                .eq('secret_key', secretKey)
                .maybeSingle();

            if (familyError) throw familyError;
            if (!family) throw new Error('Invalid Secret Key');

            if (user) {
                const { data: updatedProfile, error: profileError } = await supabase
                    .from('profiles')
                    .update({ family_id: family.id })
                    .eq('id', user.id)
                    .select()
                    .maybeSingle();

                if (profileError) throw profileError;

                if (!updatedProfile) {
                    // Auto-heal for Join as well
                    const { error: insertError } = await supabase
                        .from('profiles')
                        .insert({
                            id: user.id,
                            display_name: user.user_metadata?.display_name || 'Parent',
                            role: 'parent',
                            family_id: family.id
                        });

                    if (insertError) {
                        throw new Error("Could not join family. Profile missing.");
                    }
                }

                await refreshProfile();
            }

        } catch (err: any) {
            console.error("JoinFamily Error:", err);
            if (err instanceof Error) {
                setError(err.message || 'Failed to join family');
            } else if (typeof err === 'object' && err !== null && 'message' in err) {
                setError(err.message);
            } else {
                setError('Failed to join family');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-indigo-50 p-4">
            <Card className="w-full max-w-sm space-y-6 p-8">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-800">Setup Family</h1>
                    <p className="text-slate-500">Join an existing family or start a new one.</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                        {error}
                    </div>
                )}

                <div className="flex rounded-xl bg-slate-100 p-1">
                    <button
                        type="button"
                        className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${mode === 'join' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                        onClick={() => setMode('join')}
                    >
                        Join Family
                    </button>
                    <button
                        type="button"
                        className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${mode === 'create' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                        onClick={() => setMode('create')}
                    >
                        Create New
                    </button>
                </div>

                {mode === 'join' ? (
                    <form onSubmit={handleJoin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Family Secret Key</label>
                            <Input
                                placeholder="Enter 6-character key"
                                value={secretKey}
                                onChange={(e) => setSecretKey(e.target.value.toUpperCase())}
                                required
                            />
                            <p className="text-xs text-slate-400">Ask your family member for the key.</p>
                        </div>
                        <Button type="submit" className="w-full" isLoading={loading}>
                            Join Family
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Family Name</label>
                            <Input
                                placeholder="The Smiths"
                                value={familyName}
                                onChange={(e) => setFamilyName(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full" isLoading={loading}>
                            Create Family
                        </Button>
                    </form>
                )}
            </Card>
        </div>
    );
}
