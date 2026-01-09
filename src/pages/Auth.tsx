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

    const [isKidLogin, setIsKidLogin] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            if (isKidLogin) {
                // Kid Login (Username + Password only)
                // Kid Login (Username + Password only)
                let cleanUser = email.replace(/\s+/g, '').toLowerCase();

                // If user entered full email "bob@kids.fcc", don't append it again
                if (!cleanUser.endsWith('@kids.fcc')) {
                    cleanUser = `${cleanUser}@kids.fcc`;
                }

                const constructedEmail = cleanUser;
                const { error } = await supabase.auth.signInWithPassword({
                    email: constructedEmail,
                    password,
                });
                if (error) throw error;
            } else if (isSignUp) {
                const { error, data } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            display_name: displayName,
                            role: 'parent' // Parents sign up explicitly
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
                    <p className="text-slate-500">
                        {isKidLogin ? 'Kid Login 🎮' : isSignUp ? 'Create Parent Account' : 'Parent Login'}
                    </p>
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
                    {/* Kid Login Fields */}
                    {isKidLogin && (
                        <>
                            <Input
                                placeholder="Username"
                                value={email} // reuse email state
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </>
                    )}

                    {/* Parent Sign Up Fields */}
                    {isSignUp && !isKidLogin && (
                        <Input
                            placeholder="Your Name (e.g. Mom)"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            required
                        />
                    )}

                    {/* Standard Email Field (Parent Only) */}
                    {!isKidLogin && (
                        <Input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    )}

                    <Input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    <Button type="submit" className={`w-full ${isKidLogin ? 'bg-indigo-500 hover:bg-indigo-600' : ''}`} isLoading={loading}>
                        {isKidLogin ? 'Start Playing!' : isSignUp ? 'Sign Up' : 'Log In'}
                    </Button>
                </form>

                <div className="flex flex-col gap-2 text-center text-sm">
                    {!isKidLogin && (
                        <button
                            type="button"
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError(null);
                                setSuccessMessage(null);
                            }}
                            className="text-slate-500 hover:text-slate-800"
                        >
                            {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            setIsKidLogin(!isKidLogin);
                            setIsSignUp(false);
                            setEmail('');
                            setPassword('');
                            setError(null);
                            setSuccessMessage(null);
                        }}
                        className="font-medium text-indigo-600 hover:underline"
                    >
                        {isKidLogin ? 'Switch to Parent Login' : 'Switch to Kid Login 🧸'}
                    </button>
                </div>
            </Card>
        </div>
    );
}
