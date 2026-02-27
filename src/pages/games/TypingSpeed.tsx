import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Trophy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const WORD_POOLS = [
    ['cat', 'dog', 'sun', 'hat', 'run', 'cup', 'map', 'sky', 'top', 'pen', 'big', 'red', 'hot', 'sit', 'joy', 'fly'],
    ['apple', 'light', 'brave', 'stone', 'cloud', 'tiger', 'greet', 'flame', 'crush', 'piano', 'river', 'smile', 'climb', 'speak', 'brush'],
    ['garden', 'planet', 'bridge', 'frozen', 'search', 'simple', 'travel', 'orange', 'spring', 'listen', 'mirror', 'flower', 'pocket', 'silver', 'castle'],
    ['keyboard', 'mountain', 'football', 'platinum', 'umbrella', 'thousand', 'alphabet', 'shoulder', 'treasure', 'skeleton', 'paradise', 'together', 'language', 'birthday'],
];

function shuffle<T>(arr: T[]): T[] { return [...arr].sort(() => Math.random() - 0.5); }
function getPool(level: number) { return level <= 3 ? 0 : level <= 6 ? 1 : level <= 10 ? 2 : 3; }

const DURATION = 60;

export default function TypingSpeed() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'result'>('intro');
    const [words, setWords] = useState<string[]>([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [input, setInput] = useState('');
    const [correct, setCorrect] = useState(0);
    const [timeLeft, setTimeLeft] = useState(DURATION);
    const [isLoading, setIsLoading] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!profile) return;
        supabase.from('game_scores').select('level').eq('game_id', 'typing-speed').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1)
            .then(({ data }) => { setLevel((data?.[0]?.level || 0) + 1); setIsLoading(false); });
    }, [profile]);
    useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

    const startLevel = (lvl: number) => {
        const pool = WORD_POOLS[getPool(lvl)];
        setWords(shuffle([...pool, ...pool, ...pool]).slice(0, 25));
        setCurrentIdx(0); setInput(''); setCorrect(0); setTimeLeft(DURATION); setGameState('playing');
        setTimeout(() => inputRef.current?.focus(), 100);
        timerRef.current = setInterval(() => {
            setTimeLeft(t => { if (t <= 1) { clearInterval(timerRef.current!); setGameState('result'); return 0; } return t - 1; });
        }, 1000);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const current = words[currentIdx] || '';
        if (val.endsWith(' ') || val === current) {
            if (val.trim() === current) setCorrect(c => c + 1);
            setCurrentIdx(i => i + 1); setInput('');
        } else { setInput(val); }
    };

    const wpm = Math.round((correct / DURATION) * 60);
    const pts = wpm;
    useEffect(() => {
        if (gameState === 'result' && profile) {
            supabase.from('game_scores').insert({ game_id: 'typing-speed', level, points: pts, profile_id: profile.id, family_id: profile.family_id });
        }
    }, [gameState]);

    const currentWord = words[currentIdx] || '';
    const isTypingCorrect = currentWord.startsWith(input);
    const timePct = timeLeft / DURATION;
    const timerCls = timePct > 0.5 ? 'bg-green-500' : timePct > 0.25 ? 'bg-amber-500' : 'bg-red-500';

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <div className="text-6xl">⌨️</div>
                    <h1 className="text-3xl font-bold text-slate-800">Typing Speed</h1>
                    <p className="text-slate-500">Type each word correctly. Speed and accuracy both count!</p>
                    <div className="bg-slate-50 p-4 rounded-xl text-left text-sm space-y-2">
                        <p>• 60-second timer</p>
                        <p>• Press Space or complete the word to advance</p>
                        <p>• Score = Words Per Minute</p>
                    </div>
                    <Button onClick={() => startLevel(level)} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${level}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back</button>
                </Card>
            )}

            {gameState === 'playing' && (
                <div className="w-full space-y-6">
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${timerCls}`} style={{ width: `${timePct * 100}%` }} />
                    </div>
                    <div className="flex justify-between text-slate-500 font-medium">
                        <span>⏱ {timeLeft}s</span><span>✅ {correct} words</span>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-8 text-center space-y-4">
                        <p className="text-4xl font-extrabold text-slate-800 tracking-widest">{currentWord}</p>
                        <div className="flex gap-3 justify-center opacity-50">
                            {words.slice(currentIdx + 1, currentIdx + 4).map((w, i) => <span key={i} className="text-sm text-slate-500">{w}</span>)}
                        </div>
                    </div>
                    <input ref={inputRef} value={input} onChange={handleChange}
                        className={`w-full h-14 border-2 rounded-xl px-4 text-xl font-semibold outline-none transition-colors
                            ${input && !isTypingCorrect ? 'border-red-300 bg-red-50' : 'border-slate-200 focus:border-indigo-400'}`}
                        placeholder="Type here..." autoComplete="off" spellCheck={false} />
                </div>
            )}

            {gameState === 'result' && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <Trophy className="mx-auto text-yellow-400" size={56} />
                    <h2 className="text-3xl font-bold text-slate-800">Time's Up!</h2>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between"><span className="text-slate-500">WPM</span><span className="font-bold text-slate-800">{wpm}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Words Typed</span><span className="font-bold text-slate-800">{correct}</span></div>
                    </div>
                    <p className="text-indigo-600 font-bold text-xl">+{pts} Points</p>
                    <Button onClick={() => startLevel(level)} className="w-full h-12">Play Again</Button>
                    <Button onClick={() => { const n = level + 1; setLevel(n); startLevel(n); }} variant="outline" className="w-full">Level {level + 1}</Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back to Games</button>
                </Card>
            )}
        </div>
    );
}
