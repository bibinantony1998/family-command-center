import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, Hammer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

export default function WhackAMole() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over' | 'completed'>('intro');
    const [score, setScore] = useState(0);
    const scoreRef = useRef(0);
    const [timeLeft, setTimeLeft] = useState(30);
    const [activeMole, setActiveMole] = useState<number | null>(null);
    const activeMoleRef = useRef<number | null>(null); // Ref to avoid dependency cycle

    // Grid size 3x3 = 9 holes
    const HOLES = 9;

    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const moleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!profile) return;
        const fetchProgress = async () => {
            const { data } = await supabase
                .from('game_scores')
                .select('level')
                .eq('game_id', 'whack-a-mole')
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

    const clearTimers = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
    }, []);

    const gameOver = useCallback(() => {
        clearTimers();
        setGameState('game-over');
    }, [clearTimers]);

    const spawnMoleRef = useRef<(() => void) | null>(null);

    const spawnMole = useCallback(() => {
        if (gameState !== 'playing') return;

        const duration = Math.max(400, 1000 - (level * 50)); // Faster per level

        // Pick random hole, different from current
        let nextHole;
        do {
            nextHole = Math.floor(Math.random() * HOLES);
        } while (nextHole === activeMoleRef.current);

        setActiveMole(nextHole);
        activeMoleRef.current = nextHole;

        moleTimerRef.current = setTimeout(() => {
            if (spawnMoleRef.current) spawnMoleRef.current(); // Use ref to avoid circular dependency
        }, duration);
    }, [gameState, level]); // Removed activeMole dependency

    // Keep ref updated
    useEffect(() => {
        spawnMoleRef.current = spawnMole;
    }, [spawnMole]);

    // Game Loop
    useEffect(() => {
        if (gameState === 'playing') {
            // Game Timer
            timerRef.current = setInterval(() => {
                setTimeLeft((t) => {
                    if (t <= 1) {
                        gameOver();
                        return 0;
                    }
                    return t - 1;
                });
            }, 1000);

            // Mole Spawner (delayed to avoid sync state update warning)
            const spawnId = setTimeout(() => {
                spawnMole();
            }, 0);

            return () => {
                clearTimers();
                clearTimeout(spawnId);
            };

        } else {
            clearTimers();
        }

        return () => clearTimers();
    }, [gameState, spawnMole, gameOver, clearTimers]);

    const startLevel = () => {
        setScore(0);
        scoreRef.current = 0;
        setTimeLeft(30); // 30 seconds per round
        setGameState('playing');
    };

    const startGame = () => {
        if (highestUnlockedLevel > 10) return;
        setLevel(highestUnlockedLevel);
        startLevel();
    };

    const winLevel = async () => {
        clearTimers();
        setGameState('level-up');

        if (!profile) return;

        // Small delay for UX
        setTimeout(async () => {
            const pointsEarned = level * 2;
            await supabase.from('game_scores').insert({
                game_id: 'whack-a-mole',
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
        }, 500);
    };

    const handleWhack = (index: number) => {
        if (activeMole === index) {
            const newScore = score + 1;
            setScore(newScore);
            scoreRef.current = newScore;

            setActiveMole(null);
            activeMoleRef.current = null;

            const targetScore = 10 + (level * 2);
            if (newScore >= targetScore) {
                winLevel();
                return;
            }

            // Force immediate respawn slightly faster to reward hits
            if (moleTimerRef.current) clearTimeout(moleTimerRef.current);
            if (spawnMoleRef.current) spawnMoleRef.current();
        }
    };

    const nextLevel = () => {
        const next = level + 1;
        setLevel(next);
        startLevel();
    };

    const retryLevel = () => {
        startLevel();
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
                        <Hammer size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Whack-a-Mole</h1>
                        <p className="text-slate-500 mt-2">Tap the moles before they disappear!</p>
                    </div>
                    <Button onClick={startGame} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState === 'playing' && (
                <div className="w-full space-y-6">
                    <div className="flex justify-between items-center text-slate-500 font-medium px-4">
                        <div className="flex flex-col">
                            <span className="text-xs uppercase font-bold tracking-wider">Score</span>
                            <span className="text-2xl font-bold text-slate-800">{score}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-xs uppercase font-bold tracking-wider">Time</span>
                            <span className={`text-2xl font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-800'}`}>{timeLeft}s</span>
                        </div>
                    </div>

                    <div className="text-center mb-2">
                        <p className="text-slate-400 text-sm">Target: {10 + (level * 2)} hits</p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 p-4">
                        {Array.from({ length: 9 }).map((_, idx) => (
                            <div key={idx} className="aspect-square relative flex items-center justify-center">
                                {/* Hole */}
                                <div className="absolute inset-0 bg-amber-900/10 rounded-full scale-90 border-4 border-amber-900/5 shadow-inner" />

                                {/* Mole */}
                                <AnimatePresence>
                                    {activeMole === idx && (
                                        <motion.button
                                            initial={{ y: 50, scale: 0 }}
                                            animate={{ y: 0, scale: 1 }}
                                            exit={{ y: 50, scale: 0 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                            onClick={() => handleWhack(idx)}
                                            className="relative z-10 w-full h-full flex items-center justify-center -mt-2 cursor-pointer active:scale-90 transition-transform"
                                        >
                                            <div className="w-[85%] h-[85%] bg-amber-600 rounded-full border-b-4 border-amber-800 shadow-lg flex items-center justify-center relative">
                                                {/* Face */}
                                                <div className="space-y-1">
                                                    <div className="flex gap-4">
                                                        <div className="w-2 h-2 bg-black rounded-full" />
                                                        <div className="w-2 h-2 bg-black rounded-full" />
                                                    </div>
                                                    <div className="w-4 h-2 bg-pink-300 rounded-full mx-auto" />
                                                </div>
                                            </div>
                                        </motion.button>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {gameState === 'game-over' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl mb-4">⏰</div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Time's Up!</h2>
                        <p className="text-slate-500 mt-2">Score: {score}</p>
                        <p className="text-sm text-red-500 font-medium mt-1">Target needed: {10 + (level * 2)}</p>
                    </div>
                    <Button onClick={retryLevel} className="w-full h-12">Try Again</Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Exit</button>
                </Card>
            )}

            {gameState === 'level-up' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                        <Trophy size={40} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Great Job!</h2>
                        <p className="text-slate-500 mt-1">Score: {score}</p>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 10} Points</p>
                    </div>
                    <Button onClick={nextLevel} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">🔨</div>
                    <h2 className="text-3xl font-bold text-slate-800">Mole Master!</h2>
                    <p className="text-slate-500">You are the champion of the garden!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
