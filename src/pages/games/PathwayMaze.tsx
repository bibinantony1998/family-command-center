import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

type Cell = 0 | 1 | 2 | 3;

function getLevelSize(level: number) { return 9 + Math.floor(level / 2) * 2; }
function getDemonCount(level: number) { return Math.min(1 + Math.floor((level - 1) / 2), 5); }
function getDemonSpeed(level: number) { return Math.max(250, 700 - level * 55); }

function generateMaze(rows: number, cols: number): Cell[][] {
    const grid: Cell[][] = Array.from({ length: rows }, () => Array(cols).fill(1) as Cell[]);
    function carve(r: number, c: number) {
        const dirs = [[0, 2], [0, -2], [2, 0], [-2, 0]].sort(() => Math.random() - 0.5);
        for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;
            if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && grid[nr][nc] === 1) {
                grid[r + dr / 2][c + dc / 2] = 0; grid[nr][nc] = 0; carve(nr, nc);
            }
        }
    }
    grid[1][1] = 0; carve(1, 1);
    grid[1][1] = 2; grid[rows - 2][cols - 2] = 3;
    return grid;
}

type Demon = { r: number; c: number; pr: number; pc: number };

function placeDemonsOnGrid(grid: Cell[][], count: number): Demon[] {
    const rows = grid.length, cols = grid[0].length;
    const candidates: { r: number; c: number }[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c] !== 1 && grid[r][c] !== 2 && (Math.abs(r - 1) + Math.abs(c - 1)) > 5) {
                candidates.push({ r, c });
            }
        }
    }
    candidates.sort(() => Math.random() - 0.5);
    return candidates.slice(0, count).map(p => ({ r: p.r, c: p.c, pr: -1, pc: -1 }));
}

const SAFE_RADIUS = 3;

function pathReachable(from: { r: number; c: number }, to: { r: number; c: number }, grid: Cell[][], maxDist: number): boolean {
    if (Math.abs(from.r - to.r) + Math.abs(from.c - to.c) > maxDist * 2) return false;
    const queue: { r: number; c: number; d: number }[] = [{ ...from, d: 0 }];
    const visited = new Set<string>([`${from.r},${from.c}`]);
    while (queue.length > 0) {
        const { r, c, d } = queue.shift()!;
        if (r === to.r && c === to.c) return true;
        if (d >= maxDist) continue;
        for (const { dr, dc } of [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }]) {
            const nr = r + dr, nc = c + dc, key = `${nr},${nc}`;
            if (!visited.has(key) && grid[nr] && grid[nr][nc] !== undefined && grid[nr][nc] !== 1) {
                visited.add(key); queue.push({ r: nr, c: nc, d: d + 1 });
            }
        }
    }
    return false;
}

function demonStep(demon: Demon, grid: Cell[][]): Demon {
    const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
    const valid = dirs
        .map(d => ({ r: demon.r + d.dr, c: demon.c + d.dc }))
        .filter(p =>
            grid[p.r] !== undefined &&
            grid[p.r][p.c] !== undefined &&
            grid[p.r][p.c] !== 1 &&
            (Math.abs(p.r - 1) + Math.abs(p.c - 1)) > SAFE_RADIUS
        );
    const preferred = valid.filter(p => p.r !== demon.pr || p.c !== demon.pc);
    const choices = preferred.length > 0 ? preferred : valid;
    if (choices.length === 0) return demon;
    const next = choices[Math.floor(Math.random() * choices.length)];
    return { r: next.r, c: next.c, pr: demon.r, pc: demon.c };
}

export default function PathwayMaze() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'completed'>('intro');
    const [level, setLevel] = useState(1);
    const [grid, setGrid] = useState<Cell[][]>([]);
    const [playerPos, setPlayerPos] = useState({ r: 1, c: 1 });
    const [demons, setDemons] = useState<Demon[]>([]);
    const [moves, setMoves] = useState(0);
    const [caught, setCaught] = useState(false);
    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const gridRef = useRef<Cell[][]>([]);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!profile) return;
        (async () => {
            const { data } = await supabase.from('game_scores').select('level').eq('game_id', 'pathway-maze').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1);
            const maxLevel = data?.[0]?.level || 0;
            const next = maxLevel + 1;
            setHighestUnlockedLevel(next); setIsLoading(false);
            if (next > 10) setGameState('completed');
        })();
    }, [profile]);

    useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

    const startLevel = (lvl: number) => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        const size = getLevelSize(lvl);
        const newGrid = generateMaze(size, size);
        gridRef.current = newGrid;
        const newDemons = placeDemonsOnGrid(newGrid, getDemonCount(lvl));
        setGrid(newGrid); setPlayerPos({ r: 1, c: 1 }); setDemons(newDemons);
        setMoves(0); setCaught(false); setLevel(lvl); setGameState('playing');
        intervalRef.current = setInterval(() => {
            setDemons(prev => prev.map(d => demonStep(d, gridRef.current)));
        }, getDemonSpeed(lvl));
    };

    // Demon collision — handled inside movePlayer and the demon interval's callback
    useEffect(() => {
        if (gameState !== 'playing') return;
        const isCaught = demons.some(d => d.r === playerPos.r && d.c === playerPos.c);
        if (isCaught && !caught) {
            setCaught(true);
            setMoves(m => m + 5);
            setTimeout(() => { setPlayerPos({ r: 1, c: 1 }); setCaught(false); }, 700);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [demons, gameState]);

    const movePlayer = useCallback((dr: number, dc: number) => {
        if (caught) return;
        setPlayerPos(prev => {
            const nr = prev.r + dr, nc = prev.c + dc;
            if (!gridRef.current[nr] || gridRef.current[nr][nc] === undefined || gridRef.current[nr][nc] === 1) return prev;
            setMoves(m => m + 1);
            if (gridRef.current[nr][nc] === 3) {
                if (intervalRef.current) clearInterval(intervalRef.current);
                setGameState('level-up');
                confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
            }
            return { r: nr, c: nc };
        });
    }, [caught]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (gameState !== 'playing') return;
            if (e.key === 'ArrowUp') movePlayer(-1, 0);
            if (e.key === 'ArrowDown') movePlayer(1, 0);
            if (e.key === 'ArrowLeft') movePlayer(0, -1);
            if (e.key === 'ArrowRight') movePlayer(0, 1);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [gameState, movePlayer]);

    const saveAndNext = async () => {
        if (profile) {
            await supabase.from('game_scores').insert({ game_id: 'pathway-maze', level, points: level * 2, profile_id: profile.id, family_id: profile.family_id });
            setHighestUnlockedLevel(level + 1);
        }
        const next = level + 1;
        if (next > 10) { setGameState('completed'); confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); }
        else startLevel(next);
    };

    const cellSize = grid.length ? Math.min(32, Math.floor(360 / grid.length)) : 24;
    const demonNearby = !caught && demons.some(d => pathReachable(d, playerPos, grid, 5));

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-teal-100 text-teal-600 flex items-center justify-center mx-auto"><MapPin size={40} /></div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Pathway Maze</h1>
                        <p className="text-slate-500 mt-2">Navigate 🙂 to the ⭐ goal — dodge the 👺 demons! Getting caught sends you back to start (+5 moves).</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl text-sm text-slate-500 text-left space-y-1">
                        <p>• Arrow keys or buttons to move</p>
                        <p>• Demons get faster each level</p>
                        <p>• Getting caught = back to start + 5 move penalty</p>
                    </div>
                    <Button onClick={() => startLevel(highestUnlockedLevel)} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState === 'playing' && grid.length > 0 && (
                <div className="flex flex-col items-center space-y-3 w-full">
                    <div className="flex justify-between w-full text-slate-500 font-medium text-sm">
                        <span>Level {level}</span>
                        <span>{moves} moves</span>
                        <span>👺×{getDemonCount(level)}</span>
                    </div>

                    {/* Fixed height banner — no layout shift */}
                    <div className="h-6 flex items-center justify-center">
                        {caught
                            ? <div className="text-red-500 font-bold text-sm">😱 Caught! Back to start (+5 moves)</div>
                            : demonNearby
                                ? <div className="text-amber-500 font-bold text-sm">⚠️ Danger nearby — time your move!</div>
                                : null}
                    </div>

                    <div className={`rounded-xl overflow-hidden border-2 transition-colors ${caught ? 'border-red-400' : 'border-slate-200'}`}
                        style={{ display: 'grid', gridTemplateColumns: `repeat(${grid[0].length}, ${cellSize}px)` }}>
                        {grid.map((row, r) => row.map((cell, c) => {
                            const isPlayer = playerPos.r === r && playerPos.c === c;
                            const isDemon = demons.some(d => d.r === r && d.c === c);
                            return (
                                <div key={`${r}-${c}`} style={{ width: cellSize, height: cellSize }}
                                    className={`flex items-center justify-center
                                        ${cell === 1 ? 'bg-slate-700' : cell === 3 ? 'bg-yellow-200' : cell === 2 ? 'bg-teal-50' : 'bg-slate-100'}
                                    `}>
                                    {isPlayer ? <span style={{ fontSize: cellSize * 0.6 }}>🙂</span>
                                        : isDemon ? <span style={{ fontSize: cellSize * 0.6 }}>👺</span>
                                            : cell === 3 ? <span style={{ fontSize: cellSize * 0.6 }}>⭐</span> : null}
                                </div>
                            );
                        }))}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-1">
                        <div />
                        <button onClick={() => movePlayer(-1, 0)} className="h-12 w-12 rounded-xl bg-slate-100 text-slate-700 text-xl font-bold flex items-center justify-center hover:bg-slate-200">↑</button>
                        <div />
                        <button onClick={() => movePlayer(0, -1)} className="h-12 w-12 rounded-xl bg-slate-100 text-slate-700 text-xl font-bold flex items-center justify-center hover:bg-slate-200">←</button>
                        <button onClick={() => startLevel(level)} className="h-12 w-12 rounded-xl bg-slate-200 text-slate-500 text-xs font-bold flex items-center justify-center hover:bg-slate-300">↺</button>
                        <button onClick={() => movePlayer(0, 1)} className="h-12 w-12 rounded-xl bg-slate-100 text-slate-700 text-xl font-bold flex items-center justify-center hover:bg-slate-200">→</button>
                        <div />
                        <button onClick={() => movePlayer(1, 0)} className="h-12 w-12 rounded-xl bg-slate-100 text-slate-700 text-xl font-bold flex items-center justify-center hover:bg-slate-200">↓</button>
                        <div />
                    </div>
                </div>
            )}

            {gameState === 'level-up' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto"><Trophy size={40} /></div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Escaped! 🎉</h2>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 2} Points</p>
                        <p className="text-slate-400 text-sm mt-1">Solved in {moves} moves</p>
                    </div>
                    <Button onClick={saveAndNext} className="w-full h-12">Next Level →</Button>
                </Card>
            )}

            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">🏆</div>
                    <h2 className="text-3xl font-bold text-slate-800">Maze Master!</h2>
                    <p className="text-slate-500">You completed all 10 mazes!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
