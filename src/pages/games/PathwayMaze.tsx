import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

type Cell = 0 | 1 | 2 | 3 | 4; // 0=empty,1=wall,2=start,3=end,4=player

function getLevelSize(level: number) {
    return 5 + Math.floor(level / 2) * 2; // 5,5,7,7,9,9,11,11,13,13
}

function generateMaze(rows: number, cols: number): Cell[][] {
    const grid: Cell[][] = Array.from({ length: rows }, () => Array(cols).fill(1) as Cell[]);

    function carve(r: number, c: number) {
        const dirs = [[0, 2], [0, -2], [2, 0], [-2, 0]].sort(() => Math.random() - 0.5);
        for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;
            if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && grid[nr][nc] === 1) {
                grid[r + dr / 2][c + dc / 2] = 0;
                grid[nr][nc] = 0;
                carve(nr, nc);
            }
        }
    }

    grid[1][1] = 0;
    carve(1, 1);
    grid[1][1] = 2;
    grid[rows - 2][cols - 2] = 3;
    return grid;
}

export default function PathwayMaze() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'completed'>('intro');
    const [level, setLevel] = useState(1);
    const [grid, setGrid] = useState<Cell[][]>([]);
    const [playerPos, setPlayerPos] = useState({ r: 1, c: 1 });
    const [moves, setMoves] = useState(0);
    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        (async () => {
            const { data } = await supabase.from('game_scores').select('level').eq('game_id', 'pathway-maze').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1);
            const maxLevel = data?.[0]?.level || 0;
            const next = maxLevel + 1;
            setHighestUnlockedLevel(next);
            setIsLoading(false);
            if (next > 10) setGameState('completed');
        })();
    }, [profile]);

    const startLevel = (lvl: number) => {
        const size = getLevelSize(lvl);
        const newGrid = generateMaze(size, size);
        setGrid(newGrid);
        setPlayerPos({ r: 1, c: 1 });
        setMoves(0);
        setLevel(lvl);
        setGameState('playing');
    };

    const movePlayer = useCallback((dr: number, dc: number) => {
        setPlayerPos(prev => {
            const nr = prev.r + dr, nc = prev.c + dc;
            if (!grid[nr] || !grid[nr][nc] || grid[nr][nc] === 1) return prev;
            setMoves(m => m + 1);
            if (grid[nr][nc] === 3) {
                setGameState('level-up');
                confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
            }
            return { r: nr, c: nc };
        });
    }, [grid]);

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

    const cellSize = grid.length ? Math.min(36, Math.floor(320 / grid.length)) : 24;

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-teal-100 text-teal-600 flex items-center justify-center mx-auto"><MapPin size={40} /></div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Pathway Maze</h1>
                        <p className="text-slate-500 mt-2">Navigate through the maze to reach the goal!</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl text-sm text-slate-500">Use arrow buttons or keyboard arrows to move</div>
                    <Button onClick={() => startLevel(highestUnlockedLevel)} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState === 'playing' && grid.length > 0 && (
                <div className="flex flex-col items-center space-y-4 w-full">
                    <div className="flex justify-between w-full text-slate-500 font-medium">
                        <span>Level {level}</span><span>{moves} moves</span>
                    </div>

                    <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-800"
                        style={{ display: 'grid', gridTemplateColumns: `repeat(${grid[0].length}, ${cellSize}px)` }}>
                        {grid.map((row, r) => row.map((cell, c) => {
                            const isPlayer = playerPos.r === r && playerPos.c === c;
                            return (
                                <div key={`${r}-${c}`} style={{ width: cellSize, height: cellSize }}
                                    className={`flex items-center justify-center text-xs
                                        ${cell === 1 ? 'bg-slate-700' : 'bg-slate-100'}
                                        ${cell === 3 ? 'bg-yellow-300' : ''}
                                        ${cell === 2 ? 'bg-teal-100' : ''}
                                    `}>
                                    {isPlayer ? '🙂' : cell === 3 ? '⭐' : ''}
                                </div>
                            );
                        }))}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-2">
                        <div />
                        <button onClick={() => movePlayer(-1, 0)} className="h-12 w-12 rounded-xl bg-slate-100 text-slate-700 text-xl font-bold flex items-center justify-center active:bg-slate-200">↑</button>
                        <div />
                        <button onClick={() => movePlayer(0, -1)} className="h-12 w-12 rounded-xl bg-slate-100 text-slate-700 text-xl font-bold flex items-center justify-center active:bg-slate-200">←</button>
                        <button onClick={() => startLevel(level)} className="h-12 w-12 rounded-xl bg-slate-200 text-slate-500 text-xs font-bold flex items-center justify-center active:bg-slate-300">↺</button>
                        <button onClick={() => movePlayer(0, 1)} className="h-12 w-12 rounded-xl bg-slate-100 text-slate-700 text-xl font-bold flex items-center justify-center active:bg-slate-200">→</button>
                        <div />
                        <button onClick={() => movePlayer(1, 0)} className="h-12 w-12 rounded-xl bg-slate-100 text-slate-700 text-xl font-bold flex items-center justify-center active:bg-slate-200">↓</button>
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
                    <Button onClick={saveAndNext} className="w-full h-12">Next Level</Button>
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
