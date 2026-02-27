import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Trophy, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

const PUZZLES_4x4 = [
    { puzzle: [1, 0, 0, 4, 0, 4, 1, 0, 0, 1, 4, 0, 4, 0, 0, 1], solution: [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1] },
    { puzzle: [0, 2, 0, 4, 4, 0, 2, 0, 0, 3, 0, 2, 2, 0, 3, 0], solution: [1, 2, 3, 4, 4, 1, 2, 3, 3, 4, 1, 2, 2, 3, 4, 1] },
    { puzzle: [0, 0, 3, 0, 3, 0, 0, 1, 0, 4, 0, 0, 1, 0, 0, 4], solution: [4, 2, 3, 1, 3, 1, 4, 2, 2, 4, 1, 3, 1, 3, 2, 4] },
    { puzzle: [2, 0, 0, 3, 0, 3, 2, 0, 0, 2, 3, 0, 3, 0, 0, 2], solution: [2, 1, 4, 3, 4, 3, 2, 1, 1, 2, 3, 4, 3, 4, 1, 2] },
    { puzzle: [0, 1, 0, 0, 2, 0, 0, 3, 3, 0, 0, 2, 0, 0, 1, 0], solution: [4, 1, 3, 2, 2, 4, 1, 3, 3, 2, 4, 1, 1, 3, 2, 4] },
    { puzzle: [4, 0, 0, 2, 0, 2, 3, 0, 0, 3, 1, 0, 2, 0, 0, 4], solution: [4, 3, 1, 2, 1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3] },
];
const PUZZLES_9x9 = [{
    puzzle: [5, 3, 0, 0, 7, 0, 0, 0, 0, 6, 0, 0, 1, 9, 5, 0, 0, 0, 0, 9, 8, 0, 0, 0, 0, 6, 0, 8, 0, 0, 0, 6, 0, 0, 0, 3, 4, 0, 0, 8, 0, 3, 0, 0, 1, 7, 0, 0, 0, 2, 0, 0, 0, 6, 0, 6, 0, 0, 0, 0, 2, 8, 0, 0, 0, 0, 4, 1, 9, 0, 0, 5, 0, 0, 0, 0, 8, 0, 0, 7, 9],
    solution: [5, 3, 4, 6, 7, 8, 9, 1, 2, 6, 7, 2, 1, 9, 5, 3, 4, 8, 1, 9, 8, 3, 4, 2, 5, 6, 7, 8, 5, 9, 7, 6, 1, 4, 2, 3, 4, 2, 6, 8, 5, 3, 7, 9, 1, 7, 1, 3, 9, 2, 4, 8, 5, 6, 9, 6, 1, 5, 3, 7, 2, 8, 4, 2, 8, 7, 4, 1, 9, 6, 3, 5, 3, 4, 5, 2, 8, 6, 1, 7, 9],
}];

export default function Sudoku() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'won'>('intro');
    const [gridSize, setGridSize] = useState(4);
    const [board, setBoard] = useState<number[]>([]);
    const [solution, setSolution] = useState<number[]>([]);
    const [fixed, setFixed] = useState<Set<number>>(new Set());
    const [errors, setErrors] = useState<Set<number>>(new Set());
    const [selected, setSelected] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        supabase
            .from('game_scores')
            .select('level')
            .eq('game_id', 'sudoku')
            .eq('profile_id', profile.id)
            .order('level', { ascending: false })
            .limit(1)
            .then(({ data }) => { const lv = (data?.[0]?.level || 0) + 1; setLevel(lv); setIsLoading(false); });
    }, [profile]);

    const startLevel = (lvl: number) => {
        const is9 = lvl > 6;
        const size = is9 ? 9 : 4;
        setGridSize(size);
        const p = is9 ? PUZZLES_9x9[(lvl - 7) % PUZZLES_9x9.length] : PUZZLES_4x4[(lvl - 1) % PUZZLES_4x4.length];
        setBoard([...p.puzzle]);
        setSolution([...p.solution]);
        setFixed(new Set(p.puzzle.map((v, i) => v !== 0 ? i : -1).filter(i => i >= 0)));
        setErrors(new Set());
        setSelected(null);
        setGameState('playing');
    };

    const handleNum = useCallback((num: number, overrideIdx?: number) => {
        const idx = overrideIdx !== undefined ? overrideIdx : selected;
        setBoard(prev => {
            if (idx === null || idx === undefined || fixed.has(idx)) return prev;
            const nb = [...prev];
            nb[idx] = num;
            const ne = new Set<number>();
            nb.forEach((v, i) => { if (v !== 0 && v !== solution[i]) ne.add(i); });
            setErrors(ne);
            if (nb.every((v, i) => v !== 0 && v === solution[i])) {
                supabase.from('game_scores').insert({ game_id: 'sudoku', level, points: level * 3, profile_id: profile?.id, family_id: profile?.family_id });
                confetti({ particleCount: 100, spread: 70 });
                setGameState('won');
            }
            return nb;
        });
    }, [selected, fixed, solution, level, profile]);

    // ── Keyboard handler ────────────────────────────────────────────
    useEffect(() => {
        if (gameState !== 'playing') return;
        const onKey = (e: KeyboardEvent) => {
            // Digits 1–9 (and 0 = delete)
            const digit = parseInt(e.key, 10);
            if (!isNaN(digit) && digit <= gridSize) {
                handleNum(digit);
                return;
            }
            if (e.key === 'Backspace' || e.key === 'Delete') {
                handleNum(0);
                return;
            }
            // Arrow navigation
            const dirs: Record<string, number> = { ArrowUp: -gridSize, ArrowDown: gridSize, ArrowLeft: -1, ArrowRight: 1 };
            if (dirs[e.key] === undefined) return;
            e.preventDefault();
            setSelected(prev => {
                if (prev === null) return 0;
                const row = Math.floor(prev / gridSize);
                const col = prev % gridSize;
                if (e.key === 'ArrowUp' && row === 0) return prev;
                if (e.key === 'ArrowDown' && row === gridSize - 1) return prev;
                if (e.key === 'ArrowLeft' && col === 0) return prev;
                if (e.key === 'ArrowRight' && col === gridSize - 1) return prev;
                return prev + dirs[e.key];
            });
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [gameState, gridSize, handleNum]);

    const getBoxBorder = (idx: number) => {
        const boxSize = gridSize === 4 ? 2 : 3;
        const col = idx % gridSize;
        const row = Math.floor(idx / gridSize);
        return { right: (col + 1) % boxSize === 0 && col < gridSize - 1, bottom: (row + 1) % boxSize === 0 && row < gridSize - 1 };
    };

    const cellSize = gridSize === 4 ? 80 : 52;

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-lg mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <div className="text-6xl">🧩</div>
                    <h1 className="text-3xl font-bold text-slate-800">Sudoku</h1>
                    <p className="text-slate-500">Fill the grid so every row, column &amp; box has each number once.</p>
                    <div className="bg-slate-50 p-4 rounded-xl text-left text-sm space-y-2">
                        <p className="font-semibold text-slate-700">Controls:</p>
                        <p>• Click a cell, then type a number on your keyboard</p>
                        <p>• Arrow keys ← → ↑ ↓ to navigate between cells</p>
                        <p>• Backspace / Delete to erase</p>
                        <p>• Or use the number pad below the grid</p>
                        <p className="pt-1 font-semibold text-slate-700">Levels:</p>
                        <p>• Levels 1–6: 4×4 grid (numbers 1–4)</p>
                        <p>• Level 7+: 9×9 classic Sudoku</p>
                        <p>• 🔴 Red cell = wrong number</p>
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
                        <span className="text-slate-500 font-medium">Level {level} • {gridSize}×{gridSize}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 hidden sm:block">Type numbers · arrows to move</span>
                            <button onClick={() => startLevel(level)} className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
                                <RefreshCw size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-center">
                        <div className="border-2 border-slate-700 inline-grid" style={{ gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)` }}>
                            {board.map((val, idx) => {
                                const box = getBoxBorder(idx);
                                const isSel = selected === idx;
                                const isErr = errors.has(idx);
                                const isFix = fixed.has(idx);
                                const selRow = selected !== null ? Math.floor(selected / gridSize) : -1;
                                const selCol = selected !== null ? selected % gridSize : -1;
                                const isSameRC = selected !== null && !isSel && (Math.floor(idx / gridSize) === selRow || idx % gridSize === selCol);
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => !isFix && setSelected(idx)}
                                        style={{
                                            width: cellSize, height: cellSize,
                                            borderRight: box.right ? '2px solid #334155' : undefined,
                                            borderBottom: box.bottom ? '2px solid #334155' : undefined,
                                        }}
                                        className={[
                                            'border border-slate-200 flex items-center justify-center text-xl font-bold transition-colors outline-none',
                                            isSel ? 'bg-indigo-200 text-indigo-900 ring-2 ring-indigo-400' : '',
                                            isErr && !isSel ? 'bg-red-50 text-red-600' : '',
                                            isSameRC && !isErr ? 'bg-indigo-50' : '',
                                            isFix ? 'text-slate-800 font-extrabold' : 'text-indigo-600',
                                            !isSel && !isErr && !isFix && !isSameRC ? 'hover:bg-slate-50 cursor-pointer' : '',
                                            isFix ? 'cursor-default' : '',
                                        ].join(' ')}
                                    >
                                        {val !== 0 ? val : ''}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {Array.from({ length: gridSize }, (_, i) => i + 1).map(n => (
                            <button
                                key={n}
                                onClick={() => handleNum(n)}
                                className="w-12 h-12 rounded-xl bg-slate-100 hover:bg-indigo-100 text-slate-800 font-bold text-lg transition-colors"
                            >
                                {n}
                            </button>
                        ))}
                        <button onClick={() => handleNum(0)} className="w-12 h-12 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-lg">✕</button>
                    </div>
                    <p className="text-center text-slate-400 text-sm">Click a cell → type or click a number · arrow keys to move</p>
                </div>
            )}

            {gameState === 'won' && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <Trophy className="mx-auto text-yellow-400" size={56} />
                    <h2 className="text-3xl font-bold text-slate-800">Solved! 🎉</h2>
                    <p className="text-indigo-600 font-bold text-xl">+{level * 3} Points</p>
                    <Button onClick={() => { const n = level + 1; setLevel(n); startLevel(n); }} className="w-full h-12">Next Level</Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back to Games</button>
                </Card>
            )}
        </div>
    );
}
