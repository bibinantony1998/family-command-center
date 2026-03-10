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

const DIGIT_STICKS = [
    [0, 1, 2, 3, 4, 5],     // 0
    [1, 2],             // 1
    [0, 1, 3, 4, 6],       // 2
    [0, 1, 2, 3, 6],       // 3
    [1, 2, 5, 6],         // 4
    [0, 2, 3, 5, 6],       // 5
    [0, 2, 3, 4, 5, 6],     // 6
    [0, 1, 2],           // 7
    [0, 1, 2, 3, 4, 5, 6],   // 8
    [0, 1, 2, 3, 5, 6],     // 9
];

const TRANSFORMS: Record<string, { add: string[], remove: string[], internal: string[] }> = {};
for (let i = 0; i <= 9; i++) {
    const d = i.toString();
    TRANSFORMS[d] = {
        add: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(x => DIGIT_STICKS[x].length === DIGIT_STICKS[i].length + 1 && DIGIT_STICKS[i].every(s => DIGIT_STICKS[x].includes(s))).map(String),
        remove: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(x => DIGIT_STICKS[x].length === DIGIT_STICKS[i].length - 1 && DIGIT_STICKS[x].every(s => DIGIT_STICKS[i].includes(s))).map(String),
        internal: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(x => x !== i && DIGIT_STICKS[x].length === DIGIT_STICKS[i].length && DIGIT_STICKS[i].filter(s => DIGIT_STICKS[x].includes(s)).length === DIGIT_STICKS[i].length - 1).map(String)
    };
}
TRANSFORMS['+'] = { add: [], remove: ['–'], internal: [] };
TRANSFORMS['–'] = { add: ['+'], remove: [], internal: [] };

const GENERATED_PUZZLES: MCPuzzle[] = [];

(() => {
    for (let i = 0; i <= 9; i++) {
        for (let j = 0; j <= 9; j++) {
            const valid = [];
            if (i + j <= 9) valid.push({ a: i.toString(), op: '+', b: j.toString(), c: (i + j).toString() });
            if (i - j >= 0) valid.push({ a: i.toString(), op: '–', b: j.toString(), c: (i - j).toString() });

            for (const eq of valid) {
                const fixEq = `${eq.a} ${eq.op} ${eq.b} = ${eq.c}`;
                const parts = [
                    { key: 'a', val: eq.a, name: 'first number' },
                    { key: 'op', val: eq.op, name: 'operator' },
                    { key: 'b', val: eq.b, name: 'second number' },
                    { key: 'c', val: eq.c, name: 'result' }
                ];

                const processBroken = (brokenParts: { a: string, op: string, b: string, c: string }, hint: string, explanation: string) => {
                    const brokenEq = `${brokenParts.a} ${brokenParts.op} ${brokenParts.b} = ${brokenParts.c}`;
                    const isTrue = brokenParts.op === '+'
                        ? parseInt(brokenParts.a) + parseInt(brokenParts.b) === parseInt(brokenParts.c)
                        : parseInt(brokenParts.a) - parseInt(brokenParts.b) === parseInt(brokenParts.c);

                    if (!isTrue) {
                        const fake1 = `${brokenParts.op === '+' ? parseInt(brokenParts.a) + 1 : Math.max(0, parseInt(brokenParts.a) - 1)} ${brokenParts.op} ${brokenParts.b} = ${brokenParts.c}`;
                        const fake2 = `${brokenParts.a} ${brokenParts.op} ${brokenParts.op === '+' ? parseInt(brokenParts.b) + 1 : Math.max(0, parseInt(brokenParts.b) - 1)} = ${brokenParts.c}`;
                        const fake3 = `${brokenParts.a} ${brokenParts.op} ${brokenParts.b} = ${parseInt(brokenParts.c) + 1}`;
                        const fake4 = `${brokenParts.a} ${brokenParts.op} ${brokenParts.b} = ${Math.max(0, parseInt(brokenParts.c) - 1)}`;

                        const allChoices = Array.from(new Set([fixEq, fake1, fake2, fake3, fake4])).filter(c => c !== brokenEq);
                        const finalChoices = [fixEq];
                        for (const c of allChoices) {
                            if (finalChoices.length < 4 && c !== fixEq) finalChoices.push(c);
                        }
                        finalChoices.sort(() => Math.random() - 0.5);

                        GENERATED_PUZZLES.push({ broken: brokenEq, choices: finalChoices, correct: finalChoices.indexOf(fixEq), hint, explanation });
                    }
                };

                for (const p of parts) {
                    for (const internal of TRANSFORMS[p.val].internal) {
                        processBroken({ ...eq, [p.key]: internal }, `Move a matchstick in the ${p.name}.`, `Turn ${internal} back into ${p.val} by moving one internal stick.`);
                    }
                }

                for (let x = 0; x < parts.length; x++) {
                    for (let y = 0; y < parts.length; y++) {
                        if (x === y) continue;
                        const p1 = parts[x];
                        const p2 = parts[y];
                        for (const r of TRANSFORMS[p1.val].remove) {
                            for (const a of TRANSFORMS[p2.val].add) {
                                processBroken({ ...eq, [p1.key]: r, [p2.key]: a }, `Move a stick from the ${p1.name} to the ${p2.name}.`, `Take a stick from ${r} to make ${p1.val}, and add it to ${a} to make ${p2.val}.`);
                            }
                        }
                    }
                }
            }
        }
    }
    // Seeded shuffle using date slightly ensures consistent ordering per session
    GENERATED_PUZZLES.sort(() => Math.random() - 0.5);
})();

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

    const puzzle = GENERATED_PUZZLES[pidx % GENERATED_PUZZLES.length];

    const startLevel = (lvl: number) => {
        setPidx((lvl - 1) % GENERATED_PUZZLES.length);
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
