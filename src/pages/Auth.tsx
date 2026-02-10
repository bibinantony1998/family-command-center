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
                    {/* Google Login for Parents */}
                    {!isKidLogin && (
                        <>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={async () => {
                                    try {
                                        const { error } = await supabase.auth.signInWithOAuth({
                                            provider: 'google',
                                            options: {
                                                redirectTo: `${window.location.origin}/`,
                                            }
                                        });
                                        if (error) throw error;
                                    } catch (err: any) {
                                        setError(err.message);
                                    }
                                }}
                                className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                            >
                                <svg className="h-5 w-5" viewBox="0 0 24 24">
                                    <path
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        fill="#4285F4"
                                    />
                                    <path
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        fill="#34A853"
                                    />
                                    <path
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26-.19-.58z"
                                        fill="#FBBC05"
                                    />
                                    <path
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        fill="#EA4335"
                                    />
                                </svg>
                                Continue with Google
                            </Button>
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-slate-200" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white px-2 text-slate-500">Or continue with email</span>
                                </div>
                            </div>
                        </>
                    )}

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
