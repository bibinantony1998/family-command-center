import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, Zap, Timer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

export default function ReflexChallenge() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'waiting' | 'ready' | 'go' | 'too-early' | 'result' | 'level-up' | 'completed'>('intro');
    const [message, setMessage] = useState('');
    const [reactionTime, setReactionTime] = useState(0);
    // const [attempts, setAttempts] = useState(0);
    // const [avgTime, setAvgTime] = useState(0);

    const startTimeRef = useRef<number>(0);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // const MAX_ATTEMPTS = 3;
    // Target time decreases with level
    const targetTime = 500 - (level * 30); // Lvl 1: 470ms, Lvl 10: 200ms

    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        const fetchProgress = async () => {
            const { data } = await supabase
                .from('game_scores')
                .select('level')
                .eq('game_id', 'reflex-challenge')
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

    const startGame = () => {
        if (highestUnlockedLevel > 10) return;
        setLevel(highestUnlockedLevel);
        startLevel();
    };

    const startLevel = () => {
        // setAttempts(0);
        // setAvgTime(0);
        startRound();
    };

    const startRound = () => {
        setGameState('waiting');
        setMessage('Wait for Green...');

        const delay = 2000 + Math.random() * 3000; // 2-5s random delay

        timeoutRef.current = setTimeout(() => {
            setGameState('go');
            setMessage('CLICK NOW!');
            startTimeRef.current = Date.now();
        }, delay);
    };

    const handleClick = () => {
        if (gameState === 'waiting') {
            // Clicked too early
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setGameState('too-early');
            setMessage('Too Early! ⚠️');
        } else if (gameState === 'go') {
            const time = Date.now() - startTimeRef.current;
            setReactionTime(time);

            // Success logic? 
            if (time <= targetTime) {
                setGameState('result');
                setMessage(`${time}ms - Great!`);
                // Next round logic handled in UI button
            } else {
                setGameState('result');
                setMessage(`${time}ms - Too Slow (Target: ${targetTime}ms)`);
            }
        }
    };

    const handleNext = async () => {
        // Calculate average or just verify pass?
        // Let's require 3 successful fast clicks to pass level?
        // Or just one really good one? 
        // Let's do: Pass if time < target.
        // If passed, next level. If failed, retry round.

        if (reactionTime <= targetTime) {
            // Level passed
            setGameState('level-up');
            if (!profile) return;

            const pointsEarned = level * 2;
            await supabase.from('game_scores').insert({
                game_id: 'reflex-challenge',
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
            // Retry
            startRound();
        }
    };

    const retryRound = () => {
        startRound();
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto mb-4">
                        <Timer size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Reflex Challenge</h1>
                        <p className="text-slate-500 mt-2">Click as soon as the screen turns GREEN.</p>
                    </div>
                    <Button onClick={startGame} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState !== 'intro' && gameState !== 'level-up' && gameState !== 'completed' && (
                <div
                    onClick={handleClick}
                    className={`fixed inset-0 flex flex-col items-center justify-center cursor-pointer select-none transition-colors duration-200
                        ${gameState === 'waiting' ? 'bg-red-500' : ''}
                        ${gameState === 'go' ? 'bg-green-500' : ''}
                        ${gameState === 'too-early' ? 'bg-yellow-500' : ''}
                        ${gameState === 'result' ? 'bg-slate-800' : ''} 
                    `} // Note: result background changed to dark
                >
                    <div className="text-white text-center space-y-4">
                        {gameState === 'waiting' && <Zap size={80} className="mx-auto animate-pulse opacity-50" />}
                        {gameState === 'go' && <Zap size={120} className="mx-auto" />}
                        {gameState === 'result' && <Timer size={80} className="mx-auto" />}

                        <h1 className="text-5xl font-black tracking-tight">{message}</h1>

                        {gameState === 'result' && (
                            <div className="pt-8" onClick={(e) => e.stopPropagation()}>
                                <Button
                                    onClick={handleNext}
                                    className={`h-14 px-8 text-xl font-bold 
                                        ${reactionTime <= targetTime ? 'bg-green-500 hover:bg-green-600' : 'bg-slate-600 hover:bg-slate-500'}
                                    `}
                                >
                                    {reactionTime <= targetTime ? 'Level Compete!' : 'Try Again'}
                                </Button>
                            </div>
                        )}

                        {gameState === 'too-early' && (
                            <div className="pt-8" onClick={(e) => e.stopPropagation()}>
                                <Button onClick={retryRound} className="bg-white text-yellow-600 hover:bg-yellow-50">Try Again</Button>
                            </div>
                        )}

                        <p className="opacity-60 mt-8 text-sm font-medium uppercase tracking-wider">Level {level} • Target: {targetTime}ms</p>
                    </div>
                </div>
            )}

            {gameState === 'level-up' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                        <Trophy size={40} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Fast Fingers!</h2>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 2} Points</p>
                    </div>
                    <Button onClick={() => startLevel()} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">⚡️</div>
                    <h2 className="text-3xl font-bold text-slate-800">Lightning Fast!</h2>
                    <p className="text-slate-500">You have superhuman reflexes!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
