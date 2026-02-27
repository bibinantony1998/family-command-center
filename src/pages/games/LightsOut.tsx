import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { RefreshCw, Trophy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

const PUZZLES = [
    [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1],
    [1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1],
    [0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0],
    [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1],
    [1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1, 1],
    [0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0],
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    [0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0],
];

const SIZE = 5;

function applyToggle(grid: number[], idx: number): number[] {
    const row = Math.floor(idx / SIZE), col = idx % SIZE;
    const ng = [...grid];
    const candidates = [idx];
    if (row > 0) candidates.push(idx - SIZE);
    if (row < SIZE - 1) candidates.push(idx + SIZE);
    if (col > 0) candidates.push(idx - 1);
    if (col < SIZE - 1) candidates.push(idx + 1);
    for (const n of candidates) ng[n] = ng[n] === 1 ? 0 : 1;
    return ng;
}

export default function LightsOut() {
    const navigate = useNavigate(); const { profile } = useAuth();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'won'>('intro');
    const [grid, setGrid] = useState<number[]>([]);
    const [moves, setMoves] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        supabase.from('game_scores').select('level').eq('game_id', 'lights-out').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1)
            .then(({ data }) => { setLevel((data?.[0]?.level || 0) + 1); setIsLoading(false); });
    }, [profile]);

    const startLevel = (lvl: number) => {
        setGrid([...PUZZLES[(lvl - 1) % PUZZLES.length]]); setMoves(0); setGameState('playing');
    };

    const handleClick = (idx: number) => {
        const ng = applyToggle(grid, idx);
        const nm = moves + 1; setGrid(ng); setMoves(nm);
        if (ng.every(v => v === 0)) {
            const pts = Math.max(1, 50 - nm) * level;
            supabase.from('game_scores').insert({ game_id: 'lights-out', level, points: pts, profile_id: profile?.id, family_id: profile?.family_id });
            confetti({ particleCount: 80, spread: 60 }); setGameState('won');
        }
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-sm mx-auto" style={{ background: '#0f172a', minHeight: '100%' }}>
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6 w-full" style={{ background: '#1e293b', borderColor: '#334155' }}>
                    <div className="text-6xl">💡</div>
                    <h1 className="text-3xl font-bold text-slate-100">Lights Out</h1>
                    <p className="text-slate-400">Turn off all the lights by tapping them!</p>
                    <div className="text-left text-sm space-y-2 text-slate-400">
                        <p>• Tap a cell to toggle it and its neighbors</p>
                        <p>• Goal: make ALL lights go dark</p>
                        <p>• Fewer moves = more points</p>
                    </div>
                    <Button onClick={() => startLevel(level)} disabled={isLoading} className="w-full h-12 text-lg">{isLoading ? 'Loading...' : `Start Level ${level}`}</Button>
                    <button onClick={() => navigate('/games')} className="text-slate-500 text-sm">Back</button>
                </Card>
            )}
            {gameState === 'playing' && (
                <div className="w-full space-y-6">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Level {level}</span>
                        <span className="text-slate-400">Moves: {moves}</span>
                        <button onClick={() => startLevel(level)} className="p-2 rounded-xl bg-slate-800 text-slate-400"><RefreshCw size={16} /></button>
                    </div>
                    <div className="grid gap-3 mx-auto" style={{ gridTemplateColumns: 'repeat(5,1fr)', width: 'min(320px,100%)' }}>
                        {grid.map((val, idx) => (
                            <button key={idx} onClick={() => handleClick(idx)}
                                className={`aspect-square rounded-xl transition-all ${val === 1 ? 'scale-95' : ''}`}
                                style={{
                                    background: val === 1 ? '#fbbf24' : '#1e293b',
                                    border: val === 1 ? '2px solid #f59e0b' : '2px solid #334155',
                                    boxShadow: val === 1 ? '0 0 16px #fbbf24' : 'none',
                                }}>
                                {val === 1 && <span className="text-2xl">💡</span>}
                            </button>
                        ))}
                    </div>
                    <p className="text-center text-slate-500 text-sm">{grid.filter(v => v === 1).length} lights remaining</p>
                </div>
            )}
            {gameState === 'won' && (
                <Card className="text-center p-8 space-y-6 w-full" style={{ background: '#1e293b', borderColor: '#334155' }}>
                    <Trophy className="mx-auto text-yellow-400" size={56} />
                    <h2 className="text-3xl font-bold text-slate-100">All Dark! 🌚</h2>
                    <p className="text-yellow-400 font-bold text-xl">+{Math.max(1, 50 - moves) * level} Points</p>
                    <p className="text-slate-400">Solved in {moves} moves</p>
                    <Button onClick={() => { const n = level + 1; setLevel(n); startLevel(n); }} className="w-full h-12">Next Level</Button>
                    <button onClick={() => navigate('/games')} className="text-slate-500 text-sm">Back to Games</button>
                </Card>
            )}
        </div>
    );
}
