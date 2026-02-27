import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Trophy, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

const SIZES: Record<number, number> = { 1: 3, 2: 3, 3: 3, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4 };

type Grid = number[];

function makeGrid(n: number): Grid {
    const total = n * n;
    const arr = Array.from({ length: total }, (_, i) => i);
    for (let i = total - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return isSolvable(arr, n) ? arr : fixParity(arr);
}

function fixParity(arr: Grid): Grid {
    const a = [...arr];
    // Swap two non-blank tiles to flip parity
    const i1 = a[0] !== 0 ? 0 : 1;
    const i2 = a[i1 + 1] !== 0 ? i1 + 1 : i1 + 2;
    [a[i1], a[i2]] = [a[i2], a[i1]];
    return a;
}

function isSolvable(arr: Grid, n: number): boolean {
    let inv = 0;
    const flat = arr.filter(x => x !== 0);
    for (let i = 0; i < flat.length; i++)
        for (let j = i + 1; j < flat.length; j++)
            if (flat[i] > flat[j]) inv++;
    const blankRow = Math.floor(arr.indexOf(0) / n);
    if (n % 2 === 1) return inv % 2 === 0;
    return (inv + blankRow) % 2 === 0;
}

function isSolved(arr: Grid): boolean {
    return arr.every((v, i) => v === (i === arr.length - 1 ? 0 : i + 1));
}

export default function SlidingPuzzle() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'won'>('intro');
    const [grid, setGrid] = useState<Grid>([]);
    const [n, setN] = useState(3);
    const [moves, setMoves] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        supabase.from('game_scores').select('level').eq('game_id', 'sliding-puzzle').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1)
            .then(({ data }) => { setLevel((data?.[0]?.level || 0) + 1); setIsLoading(false); });
    }, [profile]);

    const startLevel = (lvl: number) => {
        const size = SIZES[Math.min(lvl, 8)] ?? 4;
        setN(size);
        setGrid(makeGrid(size));
        setMoves(0);
        setGameState('playing');
    };

    const handleTap = useCallback((idx: number) => {
        setGrid(prev => {
            const blank = prev.indexOf(0);
            const row = Math.floor(idx / n), col = idx % n;
            const bRow = Math.floor(blank / n), bCol = blank % n;
            const adjacent = (Math.abs(row - bRow) === 1 && col === bCol) || (Math.abs(col - bCol) === 1 && row === bRow);
            if (!adjacent) return prev;
            const ng = [...prev];
            [ng[idx], ng[blank]] = [ng[blank], ng[idx]];
            setMoves(m => {
                const nm = m + 1;
                if (isSolved(ng)) {
                    supabase.from('game_scores').insert({ game_id: 'sliding-puzzle', level, points: Math.max(1, 200 - nm) * level, profile_id: profile?.id, family_id: profile?.family_id });
                    confetti({ particleCount: 120, spread: 70 });
                    setGameState('won');
                }
                return nm;
            });
            return ng;
        });
    }, [n, level, profile]);

    // Keyboard arrow support
    useEffect(() => {
        if (gameState !== 'playing') return;
        const onKey = (e: KeyboardEvent) => {
            const blank = grid.indexOf(0);
            const bRow = Math.floor(blank / n), bCol = blank % n;
            let target = -1;
            if (e.key === 'ArrowUp' && bRow < n - 1) target = blank + n;
            if (e.key === 'ArrowDown' && bRow > 0) target = blank - n;
            if (e.key === 'ArrowLeft' && bCol < n - 1) target = blank + 1;
            if (e.key === 'ArrowRight' && bCol > 0) target = blank - 1;
            if (target >= 0) { e.preventDefault(); handleTap(target); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [gameState, grid, n, handleTap]);

    const pts = Math.max(1, 200 - moves) * level;
    const isCorrect = (val: number, idx: number) => val !== 0 && val === idx + 1;

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <div className="text-6xl">🔢</div>
                    <h1 className="text-3xl font-bold text-slate-800">Sliding Puzzle</h1>
                    <p className="text-slate-500">Slide tiles into order — fewest moves wins!</p>
                    <div className="bg-slate-50 p-4 rounded-xl text-left text-sm space-y-2">
                        <p>• Click (or use arrow keys) to slide a tile into the blank space</p>
                        <p>• Arrange tiles 1 → {n * n - 1} in order left-to-right, top-to-bottom</p>
                        <p>• Levels 1–3: 3×3 &nbsp;|&nbsp; Level 4+: 4×4</p>
                        <p>• Fewer moves = more points</p>
                    </div>
                    <Button onClick={() => startLevel(level)} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${level}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back</button>
                </Card>
            )}

            {gameState === 'playing' && (
                <div className="w-full space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Level {level} · {n}×{n} · Moves: {moves}</span>
                        <button onClick={() => startLevel(level)} className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
                            <RefreshCw size={16} />
                        </button>
                    </div>

                    {/* Grid */}
                    <div className="bg-slate-200 p-2 rounded-2xl">
                        <div
                            className="grid gap-2"
                            style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
                        >
                            {grid.map((val, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleTap(idx)}
                                    className={[
                                        'aspect-square rounded-xl flex items-center justify-center font-extrabold text-xl transition-all',
                                        val === 0 ? 'bg-slate-300 cursor-default' : '',
                                        val !== 0 && !isCorrect(val, idx) ? 'bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer shadow-md active:scale-95' : '',
                                        isCorrect(val, idx) ? 'bg-emerald-500 text-white shadow-md' : '',
                                    ].join(' ')}
                                >
                                    {val !== 0 ? val : ''}
                                </button>
                            ))}
                        </div>
                    </div>
                    <p className="text-center text-slate-400 text-sm">Click a tile adjacent to the blank · arrow keys also work</p>
                    <div className="bg-indigo-50 rounded-xl p-3 text-center">
                        <p className="text-indigo-600 text-sm font-semibold">🟢 Green = correct position</p>
                    </div>
                </div>
            )}

            {gameState === 'won' && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <Trophy className="mx-auto text-yellow-400" size={56} />
                    <h2 className="text-3xl font-bold text-slate-800">Solved! 🎉</h2>
                    <p className="text-slate-500">{moves} moves</p>
                    <p className="text-indigo-600 font-bold text-2xl">+{pts} Points</p>
                    <Button onClick={() => { const nxt = level + 1; setLevel(nxt); startLevel(nxt); }} className="w-full h-12">Next Level</Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back to Games</button>
                </Card>
            )}
        </div>
    );
}
