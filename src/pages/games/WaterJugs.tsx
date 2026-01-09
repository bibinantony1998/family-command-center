import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, RefreshCw, GlassWater } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';

interface Jug {
    id: number;
    capacity: number;
    current: number;
}

const LEVELS_CONFIG = [
    { target: 4, jugs: [5, 3] },      // Level 1
    { target: 1, jugs: [3, 2] },      // Level 2
    { target: 4, jugs: [8, 5, 3] },   // Level 3
    { target: 5, jugs: [12, 7, 5] },  // Level 4
    { target: 6, jugs: [8, 5] },      // Level 5
    { target: 2, jugs: [9, 4] },      // Level 6
    { target: 7, jugs: [10, 6, 5] },  // Level 7
    { target: 9, jugs: [13, 8, 5] },  // Level 8
    { target: 1, jugs: [5, 2] },      // Level 9
    { target: 12, jugs: [24, 13, 11] }// Level 10
];

export default function WaterJugs() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over' | 'completed'>('intro');
    const [jugs, setJugs] = useState<Jug[]>([]);
    const [selectedJug, setSelectedJug] = useState<number | null>(null);
    // const [message, setMessage] = useState('');
    const [moves, setMoves] = useState(0);

    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        const fetchProgress = async () => {
            const { data } = await supabase
                .from('game_scores')
                .select('level')
                .eq('game_id', 'water-jugs')
                .eq('profile_id', profile.id)
                .order('level', { ascending: false })
                .limit(1);

            const maxLevel = data?.[0]?.level || 0;
            const next = maxLevel + 1;
            setHighestUnlockedLevel(next);
            setIsLoading(false);

            if (next > LEVELS_CONFIG.length) {
                setGameState('completed');
            }
        };
        fetchProgress();
    }, [profile]);

    const startLevel = (lvl: number) => {
        const config = LEVELS_CONFIG[lvl - 1] || LEVELS_CONFIG[0];
        setJugs(config.jugs.map((cap, i) => ({ id: i, capacity: cap, current: 0 })));
        setGameState('playing');
        setMoves(0);
        setSelectedJug(null);
        // setMessage('');
    };

    const startGame = () => {
        if (highestUnlockedLevel > LEVELS_CONFIG.length) return;
        setLevel(highestUnlockedLevel);
        startLevel(highestUnlockedLevel);
    };

    const checkWin = async (currentJugs: Jug[]) => {
        const config = LEVELS_CONFIG[level - 1];
        if (currentJugs.some(j => j.current === config.target)) {
            // Win
            if (!profile) return;

            const pointsEarned = level * 2;
            try {
                await supabase.from('game_scores').insert({
                    game_id: 'water-jugs',
                    level: level,
                    points: pointsEarned,
                    profile_id: profile.id,
                    family_id: profile.family_id
                });
            } catch (err) {
                console.error("Error saving score:", err);
            }

            if (level >= LEVELS_CONFIG.length) {
                setGameState('completed');
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            } else {
                setGameState('level-up');
                confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
            }
        }
    };

    const handleJugClick = (index: number) => {
        if (gameState !== 'playing') return;

        if (selectedJug === null) {
            // Select source
            setSelectedJug(index);
            // setMessage('Select a destination jug to pour, or click action buttons below.');
        } else {
            if (selectedJug === index) {
                // Deselect
                setSelectedJug(null);
                // setMessage('');
            } else {
                // Pour from selected to index
                pour(selectedJug, index);
            }
        }
    };

    const fillJug = () => {
        if (selectedJug === null) return;
        const newJugs = [...jugs];
        newJugs[selectedJug].current = newJugs[selectedJug].capacity;
        setJugs(newJugs);
        setMoves(m => m + 1);
        setSelectedJug(null);
        // setMessage('');
        checkWin(newJugs);
    };

    const emptyJug = () => {
        if (selectedJug === null) return;
        const newJugs = [...jugs];
        newJugs[selectedJug].current = 0;
        setJugs(newJugs);
        setMoves(m => m + 1);
        setSelectedJug(null);
        // setMessage('');
        checkWin(newJugs);
    };

    const pour = (fromIdx: number, toIdx: number) => {
        const newJugs = [...jugs];
        const fromJug = newJugs[fromIdx];
        const toJug = newJugs[toIdx];

        const amountToPour = Math.min(fromJug.current, toJug.capacity - toJug.current);

        if (amountToPour > 0) {
            fromJug.current -= amountToPour;
            toJug.current += amountToPour;
            setJugs(newJugs);
            setMoves(m => m + 1);
        } else {
            // setMessage('Cannot pour (Source empty or Destination full)');
        }

        setSelectedJug(null);
        checkWin(newJugs);
    };

    const nextLevel = () => {
        const next = level + 1;
        setHighestUnlockedLevel(next);
        setLevel(next);
        startLevel(next);
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-teal-100 text-teal-600 flex items-center justify-center mx-auto mb-4">
                        <GlassWater size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Water Jugs</h1>
                        <p className="text-slate-500 mt-2">Measure the exact target amount.</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl text-left text-sm space-y-2">
                        <p className="font-semibold text-slate-700">Rules:</p>
                        <p>• Fill: Fill a jug to top.</p>
                        <p>• Empty: Pour out a jug completely.</p>
                        <p>• Pour: Transfer water until source empty or dest full.</p>
                    </div>
                    <Button onClick={startGame} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState === 'playing' && (
                <div className="w-full space-y-8">
                    <div className="flex justify-between items-center text-slate-500 font-medium">
                        <span>Level {level}</span>
                        <span>Moves: {moves}</span>
                    </div>

                    <div className="text-center mb-4">
                        <p className="text-slate-500 text-sm uppercase tracking-wider font-bold">Goal</p>
                        <h2 className="text-4xl font-bold text-slate-800">Measure {LEVELS_CONFIG[level - 1].target}L</h2>
                    </div>

                    <div className="flex items-end justify-center gap-4 h-48 py-4">
                        {jugs.map((jug, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-2">
                                <motion.button
                                    onClick={() => handleJugClick(idx)}
                                    className={`relative w-24 h-40 rounded-b-xl border-x-4 border-b-4 bg-blue-50/50 overflow-hidden transition-colors
                                        ${selectedJug === idx ? 'border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'border-slate-300'}
                                        ${selectedJug !== null && selectedJug !== idx ? 'hover:border-blue-400 cursor-pointer' : ''}
                                    `}
                                    animate={{
                                        scale: selectedJug === idx ? 1.05 : 1,
                                    }}
                                >
                                    <motion.div
                                        className="absolute bottom-0 w-full bg-blue-400/80"
                                        initial={{ height: 0 }}
                                        animate={{ height: `${(jug.current / jug.capacity) * 100}%` }}
                                        transition={{ type: "spring", stiffness: 100, damping: 20 }}
                                    />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                        <span className="text-lg font-bold text-slate-700 drop-shadow-sm">{jug.current}L</span>
                                        <div className="w-full border-t border-slate-400/30 my-1"></div>
                                        <span className="text-xs font-medium text-slate-500">Max {jug.capacity}L</span>
                                    </div>

                                    {selectedJug === idx && (
                                        <div className="absolute inset-x-0 top-0 bg-indigo-500 text-white text-[10px] font-bold py-1 uppercase tracking-wider">
                                            Selected
                                        </div>
                                    )}

                                    {selectedJug !== null && selectedJug !== idx && (
                                        <div className="absolute inset-0 bg-blue-200/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                            <span className="font-bold text-blue-600 bg-white/80 px-2 py-1 rounded-full text-xs shadow-sm">
                                                Tap to Pour
                                            </span>
                                        </div>
                                    )}
                                </motion.button>
                                <span className="text-xs font-bold text-slate-400">Jug {idx + 1}</span>
                            </div>
                        ))}
                    </div>

                    {selectedJug !== null ? (
                        <div className="space-y-3">
                            <div className="text-center p-2 bg-indigo-50 rounded-lg border border-indigo-100 animate-in fade-in slide-in-from-bottom-2">
                                <p className="text-indigo-800 font-medium text-sm flex items-center justify-center gap-2">
                                    <span className="animate-pulse">👈</span>
                                    Tap another jug to pour water
                                    <span className="animate-pulse">👉</span>
                                </p>
                            </div>
                            <div className="flex gap-2 justify-center">
                                <Button onClick={fillJug} variant="outline" className="flex-1 bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100">
                                    Fill Full
                                </Button>
                                <Button onClick={emptyJug} variant="outline" className="flex-1 bg-red-50 text-red-600 border-red-200 hover:bg-red-100">
                                    Empty It
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-center text-slate-400 text-sm h-14 flex items-center justify-center italic bg-slate-50 rounded-lg mx-4">
                            Select a jug to Fill, Empty, or Pour
                        </p>
                    )}

                    <button onClick={() => { setMoves(0); startLevel(level); }} className="w-full flex items-center justify-center gap-2 text-slate-400 text-sm">
                        <RefreshCw size={14} /> Restart Level
                    </button>
                </div>
            )}

            {gameState === 'level-up' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                        <Trophy size={40} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Target Reached!</h2>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 2} Points</p>
                    </div>
                    <Button onClick={nextLevel} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">🏆</div>
                    <h2 className="text-3xl font-bold text-slate-800">Logic Master!</h2>
                    <p className="text-slate-500">You completed all levels!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
