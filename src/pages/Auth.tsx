import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';

export default function Auth() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            if (isSignUp) {
                const { error, data } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            display_name: displayName,
                        },
                    },
                });
                if (error) throw error;
                if (data.user && !data.session) {
                    setSuccessMessage("Account created! Please check your email to confirm.");
                    return;
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('An unexpected error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-indigo-50 p-4">
            <Card className="w-full max-w-sm space-y-6 p-8">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-800">Family Command Center</h1>
                    <p className="text-slate-500">{isSignUp ? 'Create your account' : 'Welcome back!'}</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm border border-green-100">
                        {successMessage}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && (
                        <Input
                            placeholder="Your Name (e.g. Mom)"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            required
                        />
                    )}

                    <Input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <Input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    <Button type="submit" className="w-full" isLoading={loading}>
                        {isSignUp ? 'Sign Up' : 'Log In'}
                    </Button>
                </form>

                <div className="text-center">
                    <button
                        type="button"
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError(null);
                            setSuccessMessage(null);
                        }}
                        className="text-sm text-indigo-600 hover:underline"
                    >
                        {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
                    </button>
                </div>
            </Card>
        </div>
    );
}
