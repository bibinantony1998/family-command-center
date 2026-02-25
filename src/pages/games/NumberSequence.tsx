import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, Hash, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

interface Sequence { terms: number[]; answer: number; hint: string; }

function generateSequence(level: number): Sequence {
    const type = Math.floor(Math.random() * Math.min(level, 5));
    const start = Math.floor(Math.random() * 5) + 1;
    if (type === 0) {
        const d = Math.floor(Math.random() * (level + 2)) + 1;
        return { terms: [start, start + d, start + 2 * d, start + 3 * d], answer: start + 4 * d, hint: `+${d} each step` };
    }
    if (type === 1) {
        const r = Math.floor(Math.random() * 2) + 2;
        return { terms: [start, start * r, start * r * r, start * r * r * r], answer: start * r * r * r * r, hint: `×${r} each step` };
    }
    if (type === 2) {
        const a = Math.floor(Math.random() * 3) + 1, b = Math.floor(Math.random() * 3) + 2;
        return { terms: [a, b, a + b, a + 2 * b], answer: 2 * a + 3 * b, hint: 'Sum of previous two' };
    }
    if (type === 3) {
        return { terms: [1, 4, 9, 16], answer: 25, hint: 'Perfect squares (1²,2²,3²...)' };
    }
    return { terms: [2, 4, 8, 16], answer: 32, hint: 'Powers of 2' };
}

const QUESTIONS_PER_LEVEL = 5;

export default function NumberSequence() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over' | 'completed'>('intro');
    const [level, setLevel] = useState(1);
    const [seq, setSeq] = useState<Sequence | null>(null);
    const [userInput, setUserInput] = useState('');
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
    const [qNum, setQNum] = useState(0);
    const [correct, setCorrect] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        (async () => {
            const { data } = await supabase.from('game_scores').select('level').eq('game_id', 'number-sequence').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1);
            const maxLevel = data?.[0]?.level || 0;
            const next = maxLevel + 1;
            setHighestUnlockedLevel(next);
            setIsLoading(false);
            if (next > 10) setGameState('completed');
        })();
    }, [profile]);

    const nextQuestion = (lvl: number, num: number, c: number) => {
        if (num >= QUESTIONS_PER_LEVEL) {
            if (c >= Math.ceil(QUESTIONS_PER_LEVEL * 0.8)) setGameState('level-up');
            else setGameState('game-over');
            return;
        }
        setSeq(generateSequence(lvl));
        setUserInput(''); setFeedback(null); setShowHint(false); setQNum(num);
    };

    const startLevel = (lvl: number) => {
        setLevel(lvl); setCorrect(0); setQNum(0); setGameState('playing');
        setSeq(generateSequence(lvl)); setUserInput(''); setFeedback(null); setShowHint(false);
    };

    const handleInput = (val: string) => {
        if (feedback) return;
        const newInput = userInput + val;
        setUserInput(newInput);
        if (parseInt(newInput) === seq!.answer) {
            setFeedback('correct');
            const newCorrect = correct + 1;
            setCorrect(newCorrect);
            if (newCorrect >= QUESTIONS_PER_LEVEL) confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
            setTimeout(() => nextQuestion(level, qNum + 1, newCorrect), 600);
        } else if (newInput.length >= String(seq!.answer).length) {
            setFeedback('wrong');
            setTimeout(() => { setUserInput(''); setFeedback(null); }, 500);
        }
    };

    const saveAndNext = async () => {
        if (profile) {
            await supabase.from('game_scores').insert({ game_id: 'number-sequence', level, points: level * 2, profile_id: profile.id, family_id: profile.family_id });
            setHighestUnlockedLevel(level + 1);
        }
        const next = level + 1;
        if (next > 10) { setGameState('completed'); confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); }
        else startLevel(next);
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto"><Hash size={40} /></div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Number Sequence</h1>
                        <p className="text-slate-500 mt-2">Find the pattern and enter the next number!</p>
                    </div>
                    <Button onClick={() => startLevel(highestUnlockedLevel)} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState === 'playing' && seq && (
                <div className="w-full space-y-6">
                    <div className="flex justify-between items-center text-slate-500 font-medium">
                        <span>Level {level}</span><span>{qNum + 1}/{QUESTIONS_PER_LEVEL}</span>
                    </div>
                    <Card className={`p-6 text-center transition-colors ${feedback === 'correct' ? 'bg-green-50' : feedback === 'wrong' ? 'bg-red-50' : ''}`}>
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                            {seq.terms.map((t, i) => <span key={i} className="text-3xl font-black text-slate-700">{t} ,</span>)}
                            <div className={`w-20 h-12 rounded-xl border-b-4 flex items-center justify-center text-2xl font-black
                                ${feedback === 'correct' ? 'border-green-400 text-green-600' : feedback === 'wrong' ? 'border-red-400 text-red-500' : 'border-indigo-200 text-indigo-600'}`}>
                                {userInput || <span className="text-slate-300">?</span>}
                            </div>
                        </div>
                        {showHint && <p className="text-slate-400 text-sm mt-3">💡 {seq.hint}</p>}
                    </Card>
                    <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button key={num} onClick={() => handleInput(String(num))}
                                className="h-14 rounded-2xl bg-white shadow-sm border-b-4 border-slate-100 text-xl font-bold text-slate-700 active:border-b-0 active:translate-y-1 transition-all">{num}</button>
                        ))}
                        <button onClick={() => setUserInput('')} className="h-14 rounded-2xl bg-red-50 text-red-400 flex items-center justify-center"><X size={20} /></button>
                        <button onClick={() => handleInput('0')} className="h-14 rounded-2xl bg-white shadow-sm border-b-4 border-slate-100 text-xl font-bold text-slate-700 active:border-b-0 active:translate-y-1 transition-all">0</button>
                        <button onClick={() => setShowHint(true)} className="h-14 rounded-2xl bg-amber-50 text-amber-500 text-sm font-bold">Hint</button>
                    </div>
                </div>
            )}

            {gameState === 'level-up' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto"><Trophy size={40} /></div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Level {level} Complete!</h2>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 2} Points</p>
                    </div>
                    <Button onClick={saveAndNext} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'game-over' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-4xl">🔢</div>
                    <h2 className="text-2xl font-bold text-slate-800">Keep Practicing!</h2>
                    <p className="text-slate-500">{correct}/{QUESTIONS_PER_LEVEL} correct — need 80%</p>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={() => navigate('/games')} className="flex-1">Exit</Button>
                        <Button onClick={() => startLevel(level)} className="flex-1">Try Again</Button>
                    </div>
                </Card>
            )}

            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">🏆</div>
                    <h2 className="text-3xl font-bold text-slate-800">Pattern Pro!</h2>
                    <p className="text-slate-500">You mastered all 10 levels!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
