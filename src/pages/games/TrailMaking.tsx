import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, GitFork } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

function getLevelCount(level: number): number {
    return 10 + (level - 1) * 3; // 10, 13, 16, ... 37
}

function generateDots(count: number, size: number): { x: number; y: number }[] {
    const dots: { x: number; y: number }[] = [];
    const margin = 30;
    for (let i = 0; i < count; i++) {
        let x: number, y: number, tries = 0;
        do {
            x = margin + Math.random() * (size - 2 * margin);
            y = margin + Math.random() * (size - 2 * margin);
            tries++;
        } while (tries < 50 && dots.some(d => Math.hypot(d.x - x, d.y - y) < 35));
        dots.push({ x, y });
    }
    return dots;
}

export default function TrailMaking() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'completed'>('intro');
    const [level, setLevel] = useState(1);
    const [dots, setDots] = useState<{ x: number; y: number }[]>([]);
    const [nextDot, setNextDot] = useState(0);
    const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);
    const [elapsed, setElapsed] = useState(0);
    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const SVG_SIZE = 320;

    useEffect(() => {
        if (!profile) return;
        (async () => {
            const { data } = await supabase.from('game_scores').select('level').eq('game_id', 'trail-making').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1);
            const maxLevel = data?.[0]?.level || 0;
            const next = maxLevel + 1;
            setHighestUnlockedLevel(next); setIsLoading(false);
            if (next > 10) setGameState('completed');
        })();
    }, [profile]);

    const startLevel = (lvl: number) => {
        const count = getLevelCount(lvl);
        setDots(generateDots(count, SVG_SIZE));
        setNextDot(0); setLines([]); setElapsed(0); setLevel(lvl); setGameState('playing');
        if (timerRef.current) clearInterval(timerRef.current);
        const t = Date.now();
        timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - t) / 1000)), 500);
    };

    useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

    const handleDotClick = async (idx: number) => {
        if (idx !== nextDot) return;
        if (nextDot > 0) {
            setLines(prev => [...prev, { x1: dots[nextDot - 1].x, y1: dots[nextDot - 1].y, x2: dots[nextDot].x, y2: dots[nextDot].y }]);
        }
        const newNext = nextDot + 1;
        setNextDot(newNext);

        if (newNext === dots.length) {
            if (timerRef.current) clearInterval(timerRef.current);
            // elapsed is already tracked by the setInterval timer — use it directly
            setElapsed(e => e);
            setGameState('level-up');
            confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
            if (profile) {
                await supabase.from('game_scores').insert({ game_id: 'trail-making', level, points: level * 2, profile_id: profile.id, family_id: profile.family_id });
                setHighestUnlockedLevel(level + 1);
            }
        }
    };

    const nextLevel = () => {
        const next = level + 1;
        if (next > 10) { setGameState('completed'); confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); }
        else startLevel(next);
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center mx-auto"><GitFork size={40} /></div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Trail Making</h1>
                        <p className="text-slate-500 mt-2">Tap the numbered dots in order (1 → 2 → 3...) as fast as possible!</p>
                    </div>
                    <Button onClick={() => startLevel(highestUnlockedLevel)} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState === 'playing' && (
                <div className="w-full space-y-3">
                    <div className="flex justify-between text-slate-500 font-medium">
                        <span>Level {level} • {getLevelCount(level)} dots</span>
                        <span className="font-mono text-indigo-600">{elapsed}s</span>
                    </div>
                    <div className="text-center text-sm text-slate-400"><span className="font-bold text-slate-500">{nextDot}</span> / {dots.length} done</div>

                    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50">
                        <svg width={SVG_SIZE} height={SVG_SIZE} className="w-full h-auto" viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
                            {/* Lines */}
                            {lines.map((l, i) => (
                                <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#6366f1" strokeWidth={2} strokeLinecap="round" />
                            ))}
                            {/* Dots */}
                            {dots.map((d, i) => {
                                const done = i < nextDot;
                                return (
                                    <g key={i} onClick={() => handleDotClick(i)} style={{ cursor: !done ? 'pointer' : 'default' }}>
                                        <circle cx={d.x} cy={d.y} r={14}
                                            fill={done ? '#a5b4fc' : '#fff'}
                                            stroke={done ? '#6366f1' : '#cbd5e1'}
                                            strokeWidth={2}
                                        />
                                        <text x={d.x} y={d.y} textAnchor="middle" dominantBaseline="central" fontSize={10}
                                            fill={done ? 'white' : '#64748b'} fontWeight="bold">
                                            {i + 1}
                                        </text>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                </div>
            )}

            {gameState === 'level-up' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto"><Trophy size={40} /></div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Trail Complete!</h2>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 2} Points</p>
                        <p className="text-slate-400 text-sm mt-1">Finished in {elapsed}s</p>
                    </div>
                    <Button onClick={nextLevel} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">🏆</div>
                    <h2 className="text-3xl font-bold text-slate-800">Trail Blazer!</h2>
                    <p className="text-slate-500">You completed all 10 trail levels!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
