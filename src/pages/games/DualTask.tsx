import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, BrainCircuit } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

const SHAPES = ['●', '■', '▲', '◆', '★'];
const ROUND_TIME = 60;

function getMathQuestion(level: number) {
    const max = 5 + level * 3;
    const a = Math.floor(Math.random() * max) + 1;
    const b = Math.floor(Math.random() * max) + 1;
    const ops = level >= 5 ? ['+', '-', '×'] : ['+', '-'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let answer: number;
    if (op === '-') { answer = Math.max(a, b) - Math.min(a, b); return { q: `${Math.max(a, b)} - ${Math.min(a, b)}`, answer }; }
    if (op === '×') { const n1 = Math.floor(Math.random() * 5) + 1, n2 = Math.floor(Math.random() * 5) + 1; return { q: `${n1} × ${n2}`, answer: n1 * n2 }; }
    return { q: `${a} + ${b}`, answer: a + b };
}

export default function DualTask() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over' | 'completed'>('intro');
    const [level, setLevel] = useState(1);

    const [math, setMath] = useState({ q: '', answer: 0 });
    const [mathInput, setMathInput] = useState('');
    const [mathCorrect, setMathCorrect] = useState(0);

    const [targetShape, setTargetShape] = useState('');
    const [shapeGrid, setShapeGrid] = useState<string[]>([]);
    const [shapeCount, setShapeCount] = useState(0);
    const [shapeInput, setShapeInput] = useState('');
    const [shapeCorrect, setShapeCorrect] = useState(0);

    const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
    const [totalTasks, setTotalTasks] = useState(0);
    const [mathFeedback, setMathFeedback] = useState<'correct' | 'wrong' | null>(null);
    const [shapeFeedback, setShapeFeedback] = useState<'correct' | 'wrong' | null>(null);
    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!profile) return;
        (async () => {
            const { data } = await supabase.from('game_scores').select('level').eq('game_id', 'dual-task').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1);
            const maxLevel = data?.[0]?.level || 0;
            const next = maxLevel + 1;
            setHighestUnlockedLevel(next); setIsLoading(false);
            if (next > 10) setGameState('completed');
        })();
    }, [profile]);

    const generateShapeGrid = (lvl: number) => {
        const gridSize = 9 + lvl;
        const target = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        const count = 2 + Math.floor(Math.random() * (lvl + 2));
        // Fill with non-target shapes only, then place exactly `count` targets
        const nonTargets = SHAPES.filter(s => s !== target);
        const grid: string[] = Array.from({ length: gridSize }, () => nonTargets[Math.floor(Math.random() * nonTargets.length)]);
        const positions = Array.from({ length: gridSize }, (_, i) => i).sort(() => Math.random() - 0.5);
        for (let p = 0; p < count; p++) grid[positions[p]] = target;
        setTargetShape(target); setShapeGrid(grid); setShapeCount(count); setShapeInput('');
    };

    const refreshMath = (lvl: number) => { setMath(getMathQuestion(lvl)); setMathInput(''); };

    const startLevel = (lvl: number) => {
        setLevel(lvl); setTimeLeft(ROUND_TIME); setMathCorrect(0); setShapeCorrect(0); setTotalTasks(0);
        refreshMath(lvl); generateShapeGrid(lvl); setGameState('playing');
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    useEffect(() => {
        if (timeLeft === 0 && gameState === 'playing') {
            const passed = (mathCorrect + shapeCorrect) >= Math.floor(totalTasks * 0.6);
            setGameState(passed ? 'level-up' : 'game-over');
            if (passed) confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeLeft, gameState]);

    useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

    const handleMathInput = (val: string) => {
        const newInput = mathInput + val;
        setMathInput(newInput);
        if (parseInt(newInput) === math.answer) {
            setMathFeedback('correct');
            setMathCorrect(p => p + 1); setTotalTasks(p => p + 1);
            setTimeout(() => { setMathFeedback(null); refreshMath(level); }, 650);
        } else if (newInput.length > String(math.answer).length) {
            setMathFeedback('wrong');
            setTimeout(() => { setMathFeedback(null); setMathInput(''); }, 600);
        }
    };

    const handleShapeSubmit = () => {
        const guess = parseInt(shapeInput);
        const isCorrect = guess === shapeCount;
        setShapeFeedback(isCorrect ? 'correct' : 'wrong');
        if (isCorrect) setShapeCorrect(p => p + 1);
        setTotalTasks(p => p + 1);
        setTimeout(() => { setShapeFeedback(null); generateShapeGrid(level); }, 700);
    };

    const saveAndNext = async () => {
        if (profile) {
            await supabase.from('game_scores').insert({ game_id: 'dual-task', level, points: level * 2, profile_id: profile.id, family_id: profile.family_id });
            setHighestUnlockedLevel(level + 1);
        }
        const next = level + 1;
        if (next > 10) { setGameState('completed'); confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); }
        else startLevel(next);
    };

    return (
        <div className="h-full flex flex-col p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <div className="flex flex-col items-center justify-center h-full">
                    <Card className="text-center p-8 space-y-6">
                        <div className="h-20 w-20 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto"><BrainCircuit size={40} /></div>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-800">Dual Task</h1>
                            <p className="text-slate-500 mt-2">Solve math problems while counting shapes — simultaneously!</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl text-sm text-slate-500 text-left space-y-1">
                            <p>• Top: Solve math problems (tap digits)</p>
                            <p>• Bottom: Count target shapes, enter count, tap ✓</p>
                        </div>
                        <Button onClick={() => startLevel(highestUnlockedLevel)} disabled={isLoading} className="w-full h-12 text-lg">
                            {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                        </Button>
                        <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                    </Card>
                </div>
            )}

            {gameState === 'playing' && (
                <div className="space-y-3 w-full">
                    <div className="flex justify-between text-slate-500 font-medium text-sm">
                        <span>Level {level}</span>
                        <span className={`font-bold ${timeLeft < 10 ? 'text-red-500 animate-pulse' : ''}`}>⏱ {timeLeft}s</span>
                        <span>✓ {mathCorrect + shapeCorrect}/{totalTasks}</span>
                    </div>

                    {/* Math Task */}
                    <Card className={`p-3 border-2 transition-colors ${mathFeedback === 'correct' ? 'border-green-400 bg-green-50' : mathFeedback === 'wrong' ? 'border-red-400 bg-red-50' : 'border-transparent'}`}>
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-bold text-blue-500 uppercase">Math Task</p>
                            {mathFeedback && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${mathFeedback === 'correct' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {mathFeedback === 'correct' ? '✓ Correct!' : '✗ Wrong'}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl font-black text-slate-700">{math.q} =</span>
                            <div className="flex-1 h-10 border-b-2 border-blue-300 text-xl font-bold text-blue-600 flex items-center">{mathInput || <span className="text-slate-300">?</span>}</div>
                        </div>
                        <div className="grid grid-cols-5 gap-1 mt-2">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => (
                                <button key={n} onClick={() => handleMathInput(String(n))} className="h-9 rounded-lg bg-blue-50 text-blue-700 font-bold text-sm active:bg-blue-100">{n}</button>
                            ))}
                        </div>
                    </Card>

                    {/* Shape Task */}
                    <Card className={`p-3 border-2 transition-colors ${shapeFeedback === 'correct' ? 'border-green-400 bg-green-50' : shapeFeedback === 'wrong' ? 'border-red-400 bg-red-50' : 'border-transparent'}`}>
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-bold text-rose-500 uppercase">Count: <span className="text-2xl">{targetShape}</span></p>
                            {shapeFeedback && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${shapeFeedback === 'correct' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {shapeFeedback === 'correct' ? `✓ ${shapeCount} is right!` : `✗ Was ${shapeCount}`}
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-5 gap-1 mb-2">
                            {shapeGrid.map((s, i) => (
                                <div key={i} className="h-9 rounded-lg flex items-center justify-center text-lg bg-slate-50 text-slate-600">{s}</div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input value={shapeInput} onChange={e => setShapeInput(e.target.value)} type="number"
                                className="flex-1 h-9 border-2 border-slate-200 rounded-lg px-2 text-center font-bold text-slate-700 text-sm" placeholder="How many?" />
                            <button onClick={handleShapeSubmit} className="h-9 px-4 rounded-lg bg-rose-500 text-white font-bold active:bg-rose-600">✓</button>
                        </div>
                    </Card>
                </div>
            )}

            {gameState === 'level-up' && (
                <div className="flex items-center justify-center h-full">
                    <Card className="text-center p-8 space-y-6">
                        <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto"><Trophy size={40} /></div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">Level {level} Done!</h2>
                            <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 2} Points</p>
                            <p className="text-slate-400 text-sm">{mathCorrect + shapeCorrect} tasks completed</p>
                        </div>
                        <Button onClick={saveAndNext} className="w-full h-12">Next Level</Button>
                    </Card>
                </div>
            )}

            {gameState === 'game-over' && (
                <div className="flex items-center justify-center h-full">
                    <Card className="text-center p-8 space-y-6">
                        <div className="text-4xl">🤯</div>
                        <h2 className="text-2xl font-bold text-slate-800">Overloaded!</h2>
                        <p className="text-slate-500">Need 60% accuracy to pass</p>
                        <div className="flex gap-4">
                            <Button variant="outline" onClick={() => navigate('/games')} className="flex-1">Exit</Button>
                            <Button onClick={() => startLevel(level)} className="flex-1">Try Again</Button>
                        </div>
                    </Card>
                </div>
            )}

            {gameState === 'completed' && (
                <div className="flex items-center justify-center h-full">
                    <Card className="text-center p-8 space-y-6">
                        <div className="text-6xl">🏆</div>
                        <h2 className="text-3xl font-bold text-slate-800">Multitasker!</h2>
                        <p className="text-slate-500">You completed all 10 levels!</p>
                        <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                    </Card>
                </div>
            )}
        </div>
    );
}
