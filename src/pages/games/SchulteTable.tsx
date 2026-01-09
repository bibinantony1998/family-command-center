import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, Timer, LayoutGrid } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';

export default function SchulteTable() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over' | 'completed'>('intro');
    const [grid, setGrid] = useState<number[]>([]);
    const [nextNumber, setNextNumber] = useState(1);
    const [timer, setTimer] = useState(0);
    const [gridSize, setGridSize] = useState(3);

    const timerRef = useRef<number | null>(null);

    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        const fetchProgress = async () => {
            const { data } = await supabase
                .from('game_scores')
                .select('level')
                .eq('game_id', 'schulte-table')
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

    useEffect(() => {
        if (gameState === 'playing') {
            timerRef.current = window.setInterval(() => {
                setTimer(t => t + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [gameState]);

    const getGridSize = (lvl: number) => {
        if (lvl <= 2) return 3; // 3x3
        if (lvl <= 5) return 4; // 4x4
        return 5; // 5x5
    };

    const startLevel = (lvl: number) => {
        const size = getGridSize(lvl);
        setGridSize(size);
        const total = size * size;

        // Generate numbers 1 to total
        const numbers = Array.from({ length: total }, (_, i) => i + 1);

        // Shuffle
        for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }

        setGrid(numbers);
        setNextNumber(1);
        setTimer(0);
        setGameState('playing');
    };

    const startGame = () => {
        if (highestUnlockedLevel > 10) return;
        setLevel(highestUnlockedLevel);
        startLevel(highestUnlockedLevel);
    };

    const handleNumberClick = async (num: number) => {
        if (gameState !== 'playing') return;

        if (num === nextNumber) {
            // Correct
            const size = getGridSize(level);
            const max = size * size;

            if (num === max) {
                // Level Complete
                setGameState('level-up');
                if (!profile) return;

                const pointsEarned = level * 2;
                await supabase.from('game_scores').insert({
                    game_id: 'schulte-table',
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
                setNextNumber(n => n + 1);
            }
        } else {
            // Wrong click visual feedback?
            // For now just ignore or shake?
        }
    };

    const nextLevel = () => {
        const next = level + 1;
        setLevel(next);
        startLevel(next);
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
                        <LayoutGrid size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Schulte Table</h1>
                        <p className="text-slate-500 mt-2">Find numbers in order (1, 2, 3...) as fast as possible!</p>
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
                        <span>Level {level}</span>
                        <div className="flex items-center gap-2">
                            <Timer size={16} />
                            <span>{timer}s</span>
                        </div>
                    </div>

                    <div className="text-center mb-2">
                        <p className="text-slate-400 text-sm uppercase font-bold tracking-wider">Find Number</p>
                        <div className="text-5xl font-black text-indigo-600 animate-pulse mt-1">{nextNumber}</div>
                    </div>

                    <Card className="p-4 bg-slate-100/50">
                        <div
                            className="grid gap-2 aspect-square"
                            style={{
                                gridTemplateColumns: `repeat(${gridSize}, 1fr)`
                            }}
                        >
                            {grid.map((num, idx) => {
                                const isFound = num < nextNumber;
                                return (
                                    <motion.button
                                        key={idx}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleNumberClick(num)}
                                        className={`
                                            rounded-xl font-bold text-xl md:text-2xl shadow-sm border-b-4 transition-all
                                            flex items-center justify-center
                                            ${isFound
                                                ? 'bg-slate-200 text-slate-400 border-slate-300'
                                                : 'bg-white text-slate-700 border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50'}
                                        `}
                                        disabled={isFound}
                                    >
                                        {num}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </Card>
                </div>
            )}

            {gameState === 'level-up' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                        <Trophy size={40} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Excellent Focus!</h2>
                        <p className="text-slate-500 mt-1">Time: {timer} seconds</p>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 10} Points</p>
                    </div>
                    <Button onClick={nextLevel} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">🦅</div>
                    <h2 className="text-3xl font-bold text-slate-800">Eagle Eye!</h2>
                    <p className="text-slate-500">You've mastered the Schulte Table!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
