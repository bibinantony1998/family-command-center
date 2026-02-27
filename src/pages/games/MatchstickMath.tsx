import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

interface MCPuzzle {
    broken: string;
    choices: string[];
    correct: number;
    hint: string;
    explanation: string;
}

const PUZZLES: MCPuzzle[] = [
    { broken: '6 + 4 = 4', choices: ['6 + 4 = 10', '6 – 4 = 2', '9 + 4 = 4', '6 + 4 = 14'], correct: 0, hint: 'Move one matchstick from the = sign.', explanation: 'Turn = into ≠ is not valid — move the extra line to turn 4 into 10.' },
    { broken: '5 + 3 = 6', choices: ['5 + 3 = 8', '5 – 3 = 6', '5 + 3 = 9', '5 × 3 = 6'], correct: 0, hint: 'The result looks off by exactly 2.', explanation: 'Move one matchstick from the 6 to turn it into 8.' },
    { broken: '8 – 4 = 5', choices: ['9 – 4 = 5', '8 – 4 = 4', '8 – 4 = 9', '8 – 3 = 5'], correct: 0, hint: 'Change the number on the left side.', explanation: 'Move one matchstick on the 8 to make it a 9: 9–4=5 ✓' },
    { broken: '2 + 3 = 4', choices: ['2 + 3 = 5', '2 + 2 = 4', '2 – 3 = 4', '2 + 3 = 14'], correct: 0, hint: 'The result is one too few.', explanation: 'Move one matchstick from 4 to extend it to 5.' },
    { broken: '1 × 0 = 9', choices: ['1 × 9 = 9', '1 × 0 = 0', '1 + 0 = 9', '7 × 0 = 9'], correct: 0, hint: 'What single-digit number × 9 = 9?', explanation: 'Slide one matchstick to turn the 0 after × into a 9: 1×9=9 ✓' },
    { broken: '9 – 5 = 5', choices: ['9 – 4 = 5', '9 – 5 = 4', '9 + 5 = 5', '9 – 5 = 9'], correct: 0, hint: 'Change the subtrahend by one.', explanation: 'Move one matchstick on the 5 after – to make 4: 9–4=5 ✓' },
    { broken: '3 + 3 = 9', choices: ['3 + 3 = 6', '3 – 3 = 9', '3 + 9 = 9', '3 + 3 = 3'], correct: 0, hint: 'Turn 9 into the correct result.', explanation: 'Move one matchstick on 9 to make it 6: 3+3=6 ✓' },
    { broken: '7 – 2 = 4', choices: ['7 – 2 = 5', '1 – 2 = 4', '7 – 2 = 9', '7 + 2 = 4'], correct: 0, hint: 'The result needs just one extra segment.', explanation: 'Add a matchstick to 4 to form 5: 7–2=5 ✓' },
    { broken: '6 ÷ 2 = 4', choices: ['6 ÷ 2 = 3', '0 ÷ 2 = 4', '6 + 2 = 4', '6 ÷ 2 = 1'], correct: 0, hint: 'The result should be half of 6.', explanation: 'Move one matchstick on the 4 to make it 3: 6÷2=3 ✓' },
    { broken: '4 + 5 = 8', choices: ['4 + 5 = 9', '4 – 5 = 8', '4 × 5 = 8', '4 + 5 = 0'], correct: 0, hint: '4+5 is just one away from 8.', explanation: 'Move one matchstick on the 8 to turn it into 9: 4+5=9 ✓' },
    { broken: '3 × 5 = 9', choices: ['3 × 5 = 15', '3 – 5 = 9', '3 × 5 = 19', '8 × 5 = 9'], correct: 0, hint: 'Move a matchstick to fix the result digit.', explanation: 'Move one stick on 9 to form 15 (two digits): 3×5=15 ✓' },
    { broken: '1 + 7 = 6', choices: ['1 + 7 = 8', '1 – 7 = 6', '1 + 7 = 16', '4 + 7 = 6'], correct: 0, hint: 'The sum of 1 and 7 is straightforward.', explanation: '6 needs one more stick to become 8: 1+7=8 ✓' },
];

export default function MatchstickMath() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'result'>('intro');
    const [pidx, setPidx] = useState(0);
    const [selected, setSelected] = useState<number | null>(null);
    const [hintShown, setHintShown] = useState(false);
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        supabase.from('game_scores').select('level').eq('game_id', 'matchstick-math').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1)
            .then(({ data }) => { setLevel((data?.[0]?.level || 0) + 1); setIsLoading(false); });
    }, [profile]);

    const puzzle = PUZZLES[pidx % PUZZLES.length];

    const startLevel = (lvl: number) => {
        setPidx((lvl - 1) % PUZZLES.length);
        setSelected(null);
        setHintShown(false);
        setScore(0);
        setStreak(0);
        setLastCorrect(null);
        setGameState('playing');
    };

    const submit = () => {
        if (selected === null) return;
        const correct = selected === puzzle.correct;
        const pts = correct ? (hintShown ? level : level * 2) : 0;
        if (correct) {
            setScore(s => s + pts);
            setStreak(s => s + 1);
            supabase.from('game_scores').insert({ game_id: 'matchstick-math', level, points: pts, profile_id: profile?.id, family_id: profile?.family_id });
            if (streak + 1 >= 3) confetti({ particleCount: 80, spread: 60 });
        } else {
            setStreak(0);
        }
        setLastCorrect(correct);
        setGameState('result');
    };

    const next = () => {
        setPidx(i => i + 1);
        setSelected(null);
        setHintShown(false);
        setLastCorrect(null);
        setGameState('playing');
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <div className="text-6xl">🔥</div>
                    <h1 className="text-3xl font-bold text-slate-800">Matchstick Math</h1>
                    <p className="text-slate-500">Move exactly <strong>one matchstick</strong> to fix the broken equation!</p>
                    <div className="bg-slate-50 p-4 rounded-xl text-left text-sm space-y-2">
                        <p>• You see a broken equation</p>
                        <p>• Pick the correct fixed version from 4 choices</p>
                        <p>• Answer without the hint → <strong>2× points</strong></p>
                        <p>• 3+ in a row → bonus confetti 🎉</p>
                    </div>
                    <Button onClick={() => startLevel(level)} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${level}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back</button>
                </Card>
            )}

            {gameState === 'playing' && (
                <div className="w-full space-y-5">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 text-sm font-medium">Score: {score} {streak >= 2 ? `🔥 ×${streak}` : ''}</span>
                        <button onClick={() => startLevel(level)} className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"><RefreshCw size={15} /></button>
                    </div>

                    {/* Broken equation */}
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 text-center">
                        <p className="text-xs font-bold text-amber-700 tracking-widest mb-3">BROKEN — MOVE 1 MATCHSTICK</p>
                        <p className="text-5xl font-black text-slate-800 tracking-widest">{puzzle.broken}</p>
                        <p className="text-xs text-amber-600 mt-3">This equation is wrong. Which fix is correct?</p>
                    </div>

                    {/* Choices */}
                    <div className="grid grid-cols-2 gap-3">
                        {puzzle.choices.map((ch, i) => (
                            <button key={i} onClick={() => setSelected(i)}
                                className={`py-4 rounded-2xl border-2 text-2xl font-black tracking-widest transition-all ${selected === i ? 'bg-indigo-600 border-indigo-700 text-white scale-95 shadow-lg' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'}`}>
                                {ch}
                            </button>
                        ))}
                    </div>

                    {hintShown && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
                            💡 {puzzle.hint}
                        </div>
                    )}

                    <div className="flex gap-3">
                        {!hintShown && (
                            <button onClick={() => setHintShown(true)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50">
                                Show Hint (½ pts)
                            </button>
                        )}
                        <Button onClick={submit} disabled={selected === null} className={`${hintShown ? 'w-full' : 'flex-1'} h-12`}>
                            Submit
                        </Button>
                    </div>
                </div>
            )}

            {gameState === 'result' && (
                <Card className="text-center p-8 space-y-5 w-full">
                    <div className="text-6xl">{lastCorrect ? '✅' : '❌'}</div>
                    <h2 className="text-2xl font-bold text-slate-800">{lastCorrect ? 'Correct!' : 'Not quite...'}</h2>
                    {!lastCorrect && (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-left space-y-2">
                            <p className="text-sm font-semibold text-green-800">The correct fix is:</p>
                            <p className="text-3xl font-black text-green-700 tracking-widest">{puzzle.choices[puzzle.correct]}</p>
                            <p className="text-xs text-green-700">{puzzle.explanation}</p>
                        </div>
                    )}
                    {lastCorrect && (
                        <p className="text-indigo-600 font-bold text-xl">+{hintShown ? level : level * 2} Points &nbsp;|&nbsp; Total: {score}</p>
                    )}
                    <Button onClick={next} className="w-full h-12">Next Puzzle →</Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back to Games</button>
                </Card>
            )}
        </div>
    );
}
