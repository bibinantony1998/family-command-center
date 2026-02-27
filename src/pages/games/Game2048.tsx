import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

const SIZE = 4;
type Grid = number[][];
const TILE_COLORS: Record<number, { bg: string; text: string }> = {
    0: { bg: '#cdc1b4', text: 'transparent' }, 2: { bg: '#eee4da', text: '#776e65' }, 4: { bg: '#ede0c8', text: '#776e65' },
    8: { bg: '#f2b179', text: '#f9f6f2' }, 16: { bg: '#f59563', text: '#f9f6f2' }, 32: { bg: '#f67c5f', text: '#f9f6f2' },
    64: { bg: '#f65e3b', text: '#f9f6f2' }, 128: { bg: '#edcf72', text: '#f9f6f2' }, 256: { bg: '#edcc61', text: '#f9f6f2' },
    512: { bg: '#edc850', text: '#f9f6f2' }, 1024: { bg: '#edc53f', text: '#f9f6f2' }, 2048: { bg: '#edc22e', text: '#f9f6f2' },
};

function emptyGrid(): Grid { return Array.from({ length: SIZE }, () => Array(SIZE).fill(0)); }
function addRandom(g: Grid): Grid {
    const empty: [number, number][] = [];
    for (let r = 0; r < SIZE; r++)for (let c = 0; c < SIZE; c++)if (g[r][c] === 0) empty.push([r, c]);
    if (!empty.length) return g;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    const ng = g.map(row => [...row]); ng[r][c] = Math.random() < 0.9 ? 2 : 4; return ng;
}
function slideRow(row: number[]): { row: number[]; score: number } {
    const f = row.filter(x => x !== 0); let score = 0;
    for (let i = 0; i < f.length - 1; i++) if (f[i] === f[i + 1]) { f[i] *= 2; score += f[i]; f.splice(i + 1, 1); }
    while (f.length < SIZE) f.push(0); return { row: f, score };
}
function moveGrid(g: Grid, dir: 'left' | 'right' | 'up' | 'down'): { grid: Grid; score: number; moved: boolean } {
    let grid = g.map(r => [...r]); let totalScore = 0, moved = false;
    const process = (rows: number[][]) => rows.map(row => { const { row: nr, score } = slideRow(row); totalScore += score; if (nr.some((v, i) => v !== row[i])) moved = true; return nr; });
    if (dir === 'left') grid = process(grid);
    else if (dir === 'right') grid = process(grid.map(r => [...r].reverse())).map(r => r.reverse());
    else if (dir === 'up') { let t = grid[0].map((_, c) => grid.map(r => r[c])); t = process(t); grid = t[0].map((_, c) => t.map(r => r[c])); }
    else { let t = grid[0].map((_, c) => grid.map(r => r[c]).reverse()); t = process(t); grid = t[0].map((_, c) => t.map(r => r[c]).reverse()); }
    return { grid, score: totalScore, moved };
}
function hasWon(g: Grid) { return g.some(r => r.some(v => v >= 2048)); }
function hasLost(g: Grid) {
    for (let r = 0; r < SIZE; r++)for (let c = 0; c < SIZE; c++) {
        if (g[r][c] === 0) return false;
        if (c < SIZE - 1 && g[r][c] === g[r][c + 1]) return false;
        if (r < SIZE - 1 && g[r][c] === g[r + 1][c]) return false;
    } return true;
}

export default function Game2048() {
    const navigate = useNavigate(); const { profile } = useAuth();
    const [grid, setGrid] = useState<Grid>(emptyGrid());
    const [score, setScore] = useState(0); const [best, setBest] = useState(0);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'won' | 'lost'>('intro');
    const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

    const startGame = () => {
        const g = addRandom(addRandom(emptyGrid()));
        setGrid(g); setScore(0); setGameState('playing');
    };

    const handleMove = useCallback((dir: 'left' | 'right' | 'up' | 'down') => {
        setGrid(prev => {
            const { grid: ng, score: pts, moved } = moveGrid(prev, dir);
            if (!moved) return prev;
            setScore(s => { const ns = s + pts; if (ns > best) setBest(ns); return ns; });
            const final = addRandom(ng);
            if (hasWon(final)) {
                supabase.from('game_scores').insert({ game_id: 'game-2048', level: 1, points: score, profile_id: profile?.id, family_id: profile?.family_id });
                confetti({ particleCount: 150, spread: 80 }); setGameState('won');
            } else if (hasLost(final)) setGameState('lost');
            return final;
        });
    }, [best, score, profile]);

    useEffect(() => {
        if (gameState !== 'playing') return;
        const onKey = (e: KeyboardEvent) => {
            const map: Record<string, 'left' | 'right' | 'up' | 'down'> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
            if (map[e.key]) { e.preventDefault(); handleMove(map[e.key]); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [gameState, handleMove]);

    const fontSize = (v: number) => v >= 1024 ? 'text-sm' : v >= 128 ? 'text-lg' : 'text-2xl';

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-sm mx-auto select-none"
            onTouchStart={e => { const t = e.touches[0]; setTouchStart({ x: t.clientX, y: t.clientY }); }}
            onTouchEnd={e => {
                if (!touchStart) return;
                const dx = e.changedTouches[0].clientX - touchStart.x, dy = e.changedTouches[0].clientY - touchStart.y;
                const adx = Math.abs(dx), ady = Math.abs(dy);
                if (Math.max(adx, ady) < 30) return;
                handleMove(adx > ady ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
                setTouchStart(null);
            }}>
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <div className="text-6xl">🔢</div>
                    <h1 className="text-3xl font-bold" style={{ color: '#776e65' }}>2048</h1>
                    <p style={{ color: '#776e65' }}>Swipe or use arrow keys to merge tiles!</p>
                    <div className="bg-slate-50 p-4 rounded-xl text-left text-sm space-y-2">
                        <p>• Tiles with the same number merge</p>
                        <p>• Reach the 2048 tile to win</p>
                        <p>• Use arrow keys or swipe</p>
                    </div>
                    <Button onClick={startGame} className="w-full h-12 text-lg">Start Game</Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back</button>
                </Card>
            )}
            {gameState === 'playing' && (
                <div className="w-full space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="flex gap-3">
                            <div className="rounded-xl px-4 py-2 text-center" style={{ background: '#bbada0' }}>
                                <p className="text-xs font-bold text-amber-100">SCORE</p>
                                <p className="font-bold text-white text-lg">{score}</p>
                            </div>
                            <div className="rounded-xl px-4 py-2 text-center" style={{ background: '#bbada0' }}>
                                <p className="text-xs font-bold text-amber-100">BEST</p>
                                <p className="font-bold text-white text-lg">{best}</p>
                            </div>
                        </div>
                        <button onClick={startGame} className="p-2 rounded-xl bg-slate-100"><RefreshCw size={18} /></button>
                    </div>
                    {/* Board — fills the container; 4 equal columns/rows via CSS grid + aspect-square cells */}
                    <div className="rounded-xl p-2" style={{ background: '#bbada0' }}>
                        <div
                            className="grid gap-2 w-full"
                            style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
                        >
                            {grid.map((row, ri) => row.map((val, ci) => {
                                const tc = TILE_COLORS[val] ?? TILE_COLORS[2048];
                                return (
                                    <div
                                        key={`${ri}-${ci}`}
                                        className={`aspect-square rounded-lg flex items-center justify-center font-extrabold ${fontSize(val)}`}
                                        style={{ backgroundColor: tc.bg, color: tc.text }}
                                    >
                                        {val || ''}
                                    </div>
                                );
                            }))}
                        </div>
                    </div>
                    <p className="text-center text-slate-400 text-sm">Arrow keys or swipe to move</p>
                </div>
            )}
            {(gameState === 'won' || gameState === 'lost') && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <div className="text-6xl">{gameState === 'won' ? '🏆' : '😔'}</div>
                    <h2 className="text-3xl font-bold" style={{ color: '#776e65' }}>{gameState === 'won' ? 'You reached 2048!' : 'No more moves!'}</h2>
                    <p className="text-indigo-600 font-bold text-xl">Score: {score}</p>
                    <Button onClick={startGame} className="w-full h-12">Play Again</Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back to Games</button>
                </Card>
            )}
        </div>
    );
}
