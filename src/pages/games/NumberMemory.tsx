import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Trophy, Binary, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';

export default function NumberMemory() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'memorize' | 'recall' | 'level-up' | 'game-over' | 'completed'>('intro');
    const [currentNumber, setCurrentNumber] = useState('');
    const [userAdmitted, setUserInput] = useState('');
    // const [timeLeft, setTimeLeft] = useState(0);
    const [progress, setProgress] = useState(100);

    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!profile) return;
        const fetchProgress = async () => {
            const { data } = await supabase
                .from('game_scores')
                .select('level')
                .eq('game_id', 'number-memory')
                .eq('profile_id', profile.id)
                .order('level', { ascending: false })
                .limit(1);

            const maxLevel = data?.[0]?.level || 0;
            const next = maxLevel + 1;
            setHighestUnlockedLevel(next);
            setIsLoading(false);

            if (next > 10) setGameState('completed');
        };
        fetchProgress();
    }, [profile]);

    const generateNumber = (length: number) => {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += Math.floor(Math.random() * 10);
        }
        return result;
    };

    const startLevel = (lvl: number) => {
        const length = lvl; // Level 1 = 1 digit, Level 5 = 5 digits
        const num = generateNumber(length);
        setCurrentNumber(num);
        setUserInput('');

        // Time to memorize: 2s base + 0.5s per digit
        const duration = 2000 + (length * 1000);
        const startTime = Date.now();

        setGameState('memorize');

        // Progress bar animation loop
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(remaining);

            if (elapsed >= duration) {
                clearInterval(interval);
                setGameState('recall');
            }
        }, 16);

        timerRef.current = interval;
    };

    const startGame = () => {
        if (highestUnlockedLevel > 10) return;
        setLevel(highestUnlockedLevel);
        startLevel(highestUnlockedLevel);
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (userAdmitted === currentNumber) {
            // Correct
            if (!profile) return;
            setGameState('level-up');

            const pointsEarned = level * 2;
            await supabase.from('game_scores').insert({
                game_id: 'number-memory',
                level: level,
                points: pointsEarned,
                profile_id: profile.id,
                family_id: profile.family_id
            });

            const next = level + 1;
            setHighestUnlockedLevel(next);

            if (next > 10) {
                setGameState('completed');
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            } else {
                confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
            }
        } else {
            // Wrong
            setGameState('game-over');
        }
    };

    const handleRetry = () => {
        startLevel(level);
    };

    const nextLevel = () => {
        const next = level + 1;
        setLevel(next);
        startLevel(next);
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-cyan-100 text-cyan-600 flex items-center justify-center mx-auto mb-4">
                        <Binary size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Number Memory</h1>
                        <p className="text-slate-500 mt-2">Memorize the number before it disappears!</p>
                    </div>
                    <Button onClick={startGame} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState === 'memorize' && (
                <div className="w-full space-y-12 text-center">
                    <div>
                        <p className="text-slate-400 uppercase font-bold tracking-wider mb-8">Memorize This</p>
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-6xl md:text-7xl font-black text-slate-800 tracking-widest"
                        >
                            {currentNumber}
                        </motion.div>
                    </div>

                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-cyan-500 transition-all duration-75 ease-linear"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {gameState === 'recall' && (
                <Card className="p-8 w-full space-y-6">
                    <div className="text-center">
                        <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
                            <EyeOff size={24} />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800">What was the number?</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            autoFocus
                            type="number"
                            pattern="\d*"
                            value={userAdmitted}
                            onChange={(e) => setUserInput(e.target.value)}
                            className="text-center text-3xl tracking-widest h-16"
                            placeholder="?"
                        />
                        <Button type="submit" className="w-full h-12 text-lg">Submit</Button>
                    </form>
                </Card>
            )}

            {gameState === 'game-over' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl mb-4">❌</div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Incorrect</h2>
                        <div className="mt-4 space-y-2">
                            <p className="text-slate-500">Correct Number:</p>
                            <p className="text-2xl font-mono font-bold text-green-500 tracking-widest">{currentNumber}</p>
                        </div>
                        <div className="mt-4 space-y-2">
                            <p className="text-slate-500">You Wrote:</p>
                            <p className="text-2xl font-mono font-bold text-red-500 tracking-widest line-through">{userAdmitted}</p>
                        </div>
                    </div>
                    <Button onClick={handleRetry} className="w-full h-12">Try Again</Button>
                </Card>
            )}

            {gameState === 'level-up' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                        <Trophy size={40} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Correct!</h2>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 10} Points</p>
                    </div>
                    <Button onClick={nextLevel} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">🤖</div>
                    <h2 className="text-3xl font-bold text-slate-800">Photographic Memory!</h2>
                    <p className="text-slate-500">You have completed all levels!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
