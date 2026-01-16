import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';

export default function JoinFamily() {
    const { user, refreshProfile, myFamilies } = useAuth();
    const navigate = useNavigate();
    const [mode, setMode] = useState<'join' | 'create'>('join');
    const [familyName, setFamilyName] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSuccess = () => {
        // If they already had families before this action, go back to profile
        // If this is their first family, go to dashboard
        if (myFamilies && myFamilies.length > 0) {
            navigate('/profile');
        } else {
            navigate('/');
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const generatedKey = Math.random().toString(36).substring(2, 8).toUpperCase();

            // 1. Create Family
            const { data: family, error: familyError } = await supabase
                .from('families')
                .insert([{ name: familyName, secret_key: generatedKey }])
                .select()
                .single();

            if (familyError) throw familyError;

            // 2. Add as Member (Parent) & Set Current Family
            if (user && family) {
                // Insert into family_members
                const { error: memberError } = await supabase
                    .from('family_members')
                    .insert({
                        profile_id: user.id,
                        family_id: family.id,
                        role: 'parent'
                    });

                if (memberError) {
                    console.error("Error adding member:", memberError);
                }

                // Update Profile Context
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        current_family_id: family.id,
                        family_id: family.id // Keep legacy sync
                    })
                    .eq('id', user.id);

                if (profileError) throw profileError;

                await refreshProfile();
                handleSuccess();
            }

        } catch (err: any) {
            console.error("Create Family Error:", err);
            setError(err.message || "Failed to create family");
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.rpc('join_family_by_code', {
                secret_key_input: secretKey
            });

            if (error) throw error;

            if (data && !data.success) {
                throw new Error(data.error || 'Failed to join family');
            }

            await refreshProfile();
            handleSuccess();

        } catch (err: any) {
            console.error("Join Family Error:", err);
            setError(err.message || 'Failed to join family');
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
