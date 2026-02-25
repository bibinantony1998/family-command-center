import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, FlaskConical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

const COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-400', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500'];
const COLOR_LABELS = ['red', 'blue', 'green', 'yellow', 'purple', 'pink', 'orange'];

const TUBE_CAPACITY = 4;

function getLevelConfig(level: number) {
    const numColors = Math.min(2 + Math.floor((level - 1) / 2), 6);
    const numTubes = numColors + 2;
    return { numColors, numTubes };
}

function generatePuzzle(numColors: number, numTubes: number): string[][] {
    const allBalls: string[] = [];
    for (let c = 0; c < numColors; c++) {
        for (let i = 0; i < TUBE_CAPACITY; i++) allBalls.push(COLOR_LABELS[c]);
    }
    // Shuffle
    for (let i = allBalls.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allBalls[i], allBalls[j]] = [allBalls[j], allBalls[i]];
    }
    const tubes: string[][] = Array.from({ length: numTubes }, () => []);
    let idx = 0;
    for (let t = 0; t < numColors; t++) {
        for (let i = 0; i < TUBE_CAPACITY; i++) tubes[t].push(allBalls[idx++]);
    }
    return tubes;
}

function isSolved(tubes: string[][]): boolean {
    return tubes.every(tube => tube.length === 0 || (tube.length === TUBE_CAPACITY && tube.every(b => b === tube[0])));
}

export default function BallSort() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'completed'>('intro');
    const [level, setLevel] = useState(1);
    const [tubes, setTubes] = useState<string[][]>([]);
    const [selected, setSelected] = useState<number | null>(null);
    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [moves, setMoves] = useState(0);

    useEffect(() => {
        if (!profile) return;
        (async () => {
            const { data } = await supabase.from('game_scores').select('level').eq('game_id', 'ball-sort').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1);
            const maxLevel = data?.[0]?.level || 0;
            const next = maxLevel + 1;
            setHighestUnlockedLevel(next);
            setIsLoading(false);
            if (next > 10) setGameState('completed');
        })();
    }, [profile]);

    const startLevel = (lvl: number) => {
        const { numColors, numTubes } = getLevelConfig(lvl);
        setTubes(generatePuzzle(numColors, numTubes));
        setSelected(null);
        setMoves(0);
        setGameState('playing');
        setLevel(lvl);
    };

    const handleTubeClick = async (idx: number) => {
        if (gameState !== 'playing') return;

        if (selected === null) {
            if (tubes[idx].length > 0) setSelected(idx);
            return;
        }

        if (selected === idx) { setSelected(null); return; }

        const src = tubes[selected];
        const dst = tubes[idx];
        const ball = src[src.length - 1];

        const canPlace = dst.length < TUBE_CAPACITY && (dst.length === 0 || dst[dst.length - 1] === ball);
        if (!canPlace) { setSelected(idx); return; }

        const newTubes = tubes.map(t => [...t]);
        newTubes[selected].pop();
        newTubes[idx].push(ball);
        setTubes(newTubes);
        setSelected(null);
        setMoves(m => m + 1);

        if (isSolved(newTubes)) {
            setGameState('level-up');
            confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
            if (profile) {
                await supabase.from('game_scores').insert({ game_id: 'ball-sort', level, points: level * 2, profile_id: profile.id, family_id: profile.family_id });
                setHighestUnlockedLevel(level + 1);
            }
        }
    };

    const nextLevel = () => {
        const next = level + 1;
        if (next > 10) { setGameState('completed'); confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); return; }
        startLevel(next);
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-lg mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto">
                        <FlaskConical size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Ball Sort</h1>
                        <p className="text-slate-500 mt-2">Sort colored balls so each tube has one color.</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl text-left text-sm text-slate-600 space-y-1">
                        <p>• Tap a tube to pick up the top ball</p>
                        <p>• Tap another tube to place it</p>
                        <p>• You can only stack same-colored balls</p>
                    </div>
                    <Button onClick={() => startLevel(highestUnlockedLevel)} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState === 'playing' && (
                <div className="w-full space-y-6">
                    <div className="flex justify-between items-center text-slate-500 font-medium">
                        <span>Level {level}</span>
                        <span>{moves} moves</span>
                    </div>
                    <div className="flex gap-3 justify-center flex-wrap">
                        {tubes.map((tube, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleTubeClick(idx)}
                                className={`flex flex-col-reverse gap-1 items-center px-2 pt-2 pb-1 rounded-xl border-2 transition-all min-h-[160px] w-14
                                    ${selected === idx ? 'border-indigo-500 bg-indigo-50 scale-105 shadow-lg' : 'border-slate-200 bg-slate-50'}`}
                            >
                                {tube.map((ball, bi) => (
                                    <div key={bi} className={`w-10 h-10 rounded-full ${COLORS[COLOR_LABELS.indexOf(ball)]} shadow-sm transition-all`} />
                                ))}
                                {tube.length === 0 && <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-300 opacity-30" />}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => startLevel(level)} className="text-slate-400 text-sm font-medium w-full text-center">↺ Reset Level</button>
                </div>
            )}

            {gameState === 'level-up' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                        <Trophy size={40} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Sorted! 🎉</h2>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 2} Points</p>
                        <p className="text-slate-400 text-sm mt-1">Completed in {moves} moves</p>
                    </div>
                    <Button onClick={nextLevel} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">🏆</div>
                    <h2 className="text-3xl font-bold text-slate-800">Master Sorter!</h2>
                    <p className="text-slate-500">You completed all 10 levels!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
