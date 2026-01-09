import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, RefreshCw, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';

// Disk colors for visual distinction
const DISK_COLORS = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500'
];

export default function TowerOfHanoi() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [level, setLevel] = useState(1);
    const [rods, setRods] = useState<number[][]>([[], [], []]);
    const [selectedRod, setSelectedRod] = useState<number | null>(null);
    const [moves, setMoves] = useState(0);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over' | 'completed'>('intro');
    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    // Number of disks = Level + 2 (Level 1 = 3 disks)
    const numDisks = level + 2;

    useEffect(() => {
        if (!profile) return;
        const fetchProgress = async () => {
            const { data } = await supabase
                .from('game_scores')
                .select('level')
                .eq('game_id', 'tower-hanoi')
                .eq('profile_id', profile.id)
                .order('level', { ascending: false })
                .limit(1);

            const maxLevel = data?.[0]?.level || 0;
            const next = maxLevel + 1;
            setHighestUnlockedLevel(next);
            setIsLoading(false);

            if (next > 6) { // Cap at Level 6 (8 disks) for sanity
                setGameState('completed');
            }
        };
        fetchProgress();
    }, [profile]);

    const startLevel = (lvl: number) => {
        const disksCount = lvl + 2;
        // Create disks [0, 1, 2...] where 0 is smallest
        const disks = Array.from({ length: disksCount }, (_, i) => i).reverse(); // [2, 1, 0] big at bottom
        setRods([disks, [], []]);
        setMoves(0);
        setSelectedRod(null);
        setGameState('playing');
    };

    const startGame = () => {
        if (highestUnlockedLevel > 6) return;
        setLevel(highestUnlockedLevel);
        startLevel(highestUnlockedLevel);
    };

    const handleRodClick = (rodIndex: number) => {
        if (gameState !== 'playing') return;

        if (selectedRod === null) {
            // Select rod if it has disks
            if (rods[rodIndex].length > 0) {
                setSelectedRod(rodIndex);
            }
        } else {
            // Move from selectedRod to rodIndex
            if (selectedRod === rodIndex) {
                // Deselect
                setSelectedRod(null);
            } else {
                moveDisk(selectedRod, rodIndex);
            }
        }
    };

    const moveDisk = async (fromIdx: number, toIdx: number) => {
        const newRods = [...rods].map(r => [...r]);
        const sourceRod = newRods[fromIdx];
        const targetRod = newRods[toIdx];

        if (sourceRod.length === 0) return; // Should not happen

        const diskToMove = sourceRod[sourceRod.length - 1]; // Top disk
        const targetTopDisk = targetRod.length > 0 ? targetRod[targetRod.length - 1] : Infinity;

        if (diskToMove < targetTopDisk) {
            // Valid move
            sourceRod.pop();
            targetRod.push(diskToMove);
            setRods(newRods);
            setMoves(m => m + 1);
            setSelectedRod(null);
            checkWin(newRods);
        } else {
            // Invalid move
            // Maybe shake animation later
            setSelectedRod(null);
        }
    };

    const checkWin = async (currentRods: number[][]) => {
        // Win if all disks are on rod 2 (index 2)
        // Or rod 1 (index 1)? Usually usually target is last rod.
        if (currentRods[2].length === numDisks) {
            if (!profile) return;

            const pointsEarned = level * 2;
            try {
                await supabase.from('game_scores').insert({
                    game_id: 'tower-hanoi',
                    level: level,
                    points: pointsEarned,
                    profile_id: profile.id,
                    family_id: profile.family_id
                });
            } catch (err) { console.error(err) }

            const next = level + 1;
            setHighestUnlockedLevel(next);

            if (next > 6) {
                setGameState('completed');
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            } else {
                setGameState('level-up');
                confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
            }
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
                    <div className="h-20 w-20 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-4">
                        <Layers size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Tower of Hanoi</h1>
                        <p className="text-slate-500 mt-2">Move the stack to the last rod.</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl text-left text-sm space-y-2">
                        <p className="font-semibold text-slate-700">Rules:</p>
                        <p>1. Move one disk at a time.</p>
                        <p>2. Never place a larger disk on a smaller one.</p>
                    </div>
                    <Button onClick={startGame} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState === 'playing' && (
                <div className="w-full">
                    <div className="flex justify-between items-center text-slate-500 font-medium mb-8">
                        <span>Level {level} ({numDisks} Disks)</span>
                        <span>Moves: {moves}</span>
                    </div>

                    <div className="flex justify-between items-end h-64 border-b-8 border-slate-300 mb-8 px-4 relative">
                        {/* Rods */}
                        {[0, 1, 2].map(rodIdx => (
                            <div
                                key={rodIdx}
                                onClick={() => handleRodClick(rodIdx)}
                                className={`relative w-28 h-full flex flex-col-reverse items-center cursor-pointer group rounded-xl transition-all border-2
                                    ${selectedRod === rodIdx ? 'bg-indigo-50 border-indigo-300 shadow-inner' : 'bg-slate-100/50 border-slate-200 hover:border-slate-300'}
                                `}
                            >
                                {/* The vertical pole */}
                                <div className="absolute bottom-0 w-2 h-[85%] bg-slate-300 rounded-t-xl -z-10 group-hover:bg-slate-400 transition-colors"></div>

                                {/* Disks */}
                                {rods[rodIdx].map((diskSize, i) => (
                                    <motion.div
                                        key={diskSize}
                                        layoutId={`disk-${diskSize}`}
                                        className={`h-6 rounded-full border border-black/10 shadow-sm ${DISK_COLORS[diskSize]} ${selectedRod === rodIdx && i === rods[rodIdx].length - 1 ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                        style={{
                                            width: `${30 + ((diskSize + 1) * 10)}%`, // 30% base + 10% per size unit
                                            marginBottom: '2px'
                                        }}
                                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    />
                                ))}

                                {/* Floating Ghost Disk for Selection */}
                                {selectedRod === rodIdx && rods[rodIdx].length > 0 && (
                                    <div className="absolute -top-8 animate-bounce text-indigo-500 font-bold text-xs uppercase tracking-wider">
                                        Selected
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <p className="text-center text-slate-400 text-sm h-10">
                        {selectedRod !== null ? 'Tap destination rod' : 'Tap a rod to pick up top disk'}
                    </p>

                    <button onClick={() => { setMoves(0); startLevel(level); }} className="w-full flex items-center justify-center gap-2 text-slate-400 text-sm mt-8">
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
                        <h2 className="text-2xl font-bold text-slate-800">Puzzle Solved!</h2>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 2} Points</p>
                    </div>
                    <Button onClick={nextLevel} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">🧘</div>
                    <h2 className="text-3xl font-bold text-slate-800">Zen Master!</h2>
                    <p className="text-slate-500">You completed the Tower of Hanoi!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
