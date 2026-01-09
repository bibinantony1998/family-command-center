import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, Grid3X3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';

export default function PatternMemory() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'memorize' | 'recall' | 'level-up' | 'game-over' | 'completed'>('intro');
    const [gridSize, setGridSize] = useState(3);
    const [pattern, setPattern] = useState<number[]>([]);
    const [selectedCells, setSelectedCells] = useState<number[]>([]);

    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        const fetchProgress = async () => {
            const { data } = await supabase
                .from('game_scores')
                .select('level')
                .eq('game_id', 'pattern-memory')
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
        startLevel(highestUnlockedLevel);
    };

    const startLevel = (lvl: number) => {
        // Calculate Grid Size and Pattern Length
        // Lvl 1-3: 3x3, 3-5 cells
        // Lvl 4-6: 4x4, 5-8 cells
        // Lvl 7-10: 5x5, 8-12 cells

        let size = 3;
        let count = 3 + (lvl - 1); // Simple linear increase?

        if (lvl > 3) size = 4;
        if (lvl > 6) size = 5;

        // Adjust count slightly to be reasonable
        if (size === 4) count = 5 + (lvl - 4);
        if (size === 5) count = 8 + (lvl - 7);

        setGridSize(size);
        generatePattern(size, count);
    };

    const generatePattern = (size: number, count: number) => {
        const totalCells = size * size;
        const newPattern: number[] = [];

        while (newPattern.length < count) {
            const r = Math.floor(Math.random() * totalCells);
            if (!newPattern.includes(r)) {
                newPattern.push(r);
            }
        }

        setPattern(newPattern);
        setSelectedCells([]);
        setGameState('memorize');

        // Show pattern for 2 seconds, then hide
        setTimeout(() => {
            setGameState('recall');
        }, 2000);
    };

    const handleCellClick = (index: number) => {
        if (gameState !== 'recall') return;
        if (selectedCells.includes(index)) return; // Already selected

        // Correct?
        if (pattern.includes(index)) {
            // Correct selection
            const newSelected = [...selectedCells, index];
            setSelectedCells(newSelected);

            // Check win
            if (newSelected.length === pattern.length) {
                winLevel();
            }
        } else {
            // Wrong selection -> Game Over
            setGameState('game-over');
        }
    };

    const winLevel = async () => {
        setGameState('level-up');
        if (!profile) return;

        const pointsEarned = level * 2;
        await supabase.from('game_scores').insert({
            game_id: 'pattern-memory',
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
    };

    const retryLevel = () => {
        startLevel(level);
    };

    const nextLevel = () => {
        startLevel(level + 1);
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                        <Grid3X3 size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Pattern Memory</h1>
                        <p className="text-slate-500 mt-2">Memorize the pattern, then recreate it.</p>
                    </div>
                    <Button onClick={startGame} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {(gameState === 'memorize' || gameState === 'recall' || gameState === 'game-over') && (
                <div className="w-full space-y-8 flex flex-col items-center">
                    <div className="text-center space-y-2">
                        <h2 className="text-2xl font-bold text-slate-800">Level {level}</h2>
                        <p className={`font-medium ${gameState === 'memorize' ? 'text-indigo-600 animate-pulse' : 'text-slate-500'}`}>
                            {gameState === 'memorize' ? 'Memorize Pattern...' : 'Repeat Pattern!'}
                        </p>
                    </div>

                    <div
                        className="grid gap-2 bg-slate-100 p-4 rounded-2xl shadow-inner"
                        style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
                    >
                        {Array.from({ length: gridSize * gridSize }).map((_, i) => {
                            const isPattern = pattern.includes(i);
                            const isSelected = selectedCells.includes(i);
                            const showActive = (gameState === 'memorize' && isPattern) || (gameState === 'recall' && isSelected);
                            // const showWrong = gameState === 'game-over' && !isPattern && i === selectedCells[selectedCells.length]; 

                            return (
                                <motion.button
                                    key={i}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleCellClick(i)}
                                    disabled={gameState !== 'recall'}
                                    className={`w-16 h-16 rounded-xl transition-all duration-200
                                        ${showActive
                                            ? 'bg-indigo-500 shadow-lg shadow-indigo-500/30'
                                            : 'bg-white shadow-sm hover:bg-slate-50'
                                        }
                                        ${gameState === 'game-over' && isPattern ? 'bg-indigo-200' : ''} 
                                    `}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {gameState === 'game-over' && (
                <Card className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 text-center p-8 space-y-6 shadow-2xl z-50">
                    <div className="text-4xl">🧠</div>
                    <h2 className="text-2xl font-bold text-slate-800">Memory Slip!</h2>
                    <p className="text-slate-500">You missed a spot.</p>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={() => navigate('/games')} className="flex-1">Exit</Button>
                        <Button onClick={retryLevel} className="flex-1">Try Again</Button>
                    </div>
                </Card>
            )}

            {gameState === 'level-up' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                        <Trophy size={40} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Sharp Mind!</h2>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 2} Points</p>
                    </div>
                    <Button onClick={nextLevel} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">🧩</div>
                    <h2 className="text-3xl font-bold text-slate-800">Pattern Pro!</h2>
                    <p className="text-slate-500">You have photographic memory!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
