import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const WORD_BANK = new Set([
    'ant', 'top', 'pen', 'net', 'tap', 'pan', 'nap', 'tan', 'pot', 'not', 'ton', 'ten', 'pant', 'apt',
    'apple', 'eagle', 'eel', 'lamp', 'piano', 'oak', 'king', 'game', 'echo', 'orange', 'elephant',
    'tiger', 'rat', 'table', 'eat', 'art', 'tree', 'egg', 'green', 'night', 'teacher', 'rabbit',
    'bat', 'tennis', 'sun', 'never', 'red', 'dog', 'garden', 'time', 'enter', 'ring', 'girl',
    'lion', 'nest', 'train', 'noodle', 'ear', 'arm', 'moon', 'name', 'eye', 'year', 'robot', 'text',
    'taxi', 'island', 'door', 'gate', 'exit', 'trip', 'pink', 'kite', 'end', 'dance', 'day', 'yes',
    'star', 'river', 'rock', 'kangaroo', 'owl', 'wolf', 'fox', 'box', 'yellow', 'water', 'rain',
    'north', 'hand', 'drop', 'paper', 'race', 'cat', 'talk', 'know', 'word', 'duck', 'kick',
    'kick', 'kettle', 'last', 'town', 'inch', 'hat', 'turn', 'none', 'left', 'fish', 'hat',
]);
const STARTERS = ['apple', 'tiger', 'rabbit', 'ocean', 'umbrella', 'island', 'rain', 'elephant', 'night', 'dog'];
const DURATIONS = [60, 75, 90, 105, 120];

function lastLetter(w: string) { return w[w.length - 1].toUpperCase(); }
function validate(w: string, chain: string[]): { ok: boolean; reason: string } {
    const wl = w.toLowerCase().trim();
    if (wl.length < 2) return { ok: false, reason: 'Word too short (3+ letters)' };
    if (!WORD_BANK.has(wl)) return { ok: false, reason: `"${w}" not in word list` };
    if (chain.includes(wl)) return { ok: false, reason: 'Already used!' };
    if (chain.length > 0 && wl[0].toUpperCase() !== lastLetter(chain[chain.length - 1]))
        return { ok: false, reason: `Must start with "${lastLetter(chain[chain.length - 1])}"` };
    return { ok: true, reason: '' };
}

export default function WordChain() {
    const navigate = useNavigate(); const { profile } = useAuth();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'result'>('intro');
    const [chain, setChain] = useState<string[]>([]);
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const [timeLeft, setTimeLeft] = useState(60);
    const [isLoading, setIsLoading] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const chainRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!profile) return;
        supabase.from('game_scores').select('level').eq('game_id', 'word-chain').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1)
            .then(({ data }) => { setLevel((data?.[0]?.level || 0) + 1); setIsLoading(false); });
    }, [profile]);
    useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

    const startLevel = (lvl: number) => {
        const starter = STARTERS[(lvl - 1) % STARTERS.length];
        const dur = DURATIONS[Math.min(lvl - 1, DURATIONS.length - 1)];
        setChain([starter]); setInput(''); setError(''); setTimeLeft(dur); setGameState('playing');
        setTimeout(() => inputRef.current?.focus(), 100);
        timerRef.current = setInterval(() => {
            setTimeLeft(t => { if (t <= 1) { clearInterval(timerRef.current!); setGameState('result'); return 0; } return t - 1; });
        }, 1000);
    };

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        const w = input.trim().toLowerCase();
        const { ok, reason } = validate(w, chain);
        if (!ok) { setError(reason); return; }
        setError('');
        const nc = [...chain, w];
        setChain(nc); setInput('');
        setTimeout(() => { if (chainRef.current) chainRef.current.scrollLeft = 99999; }, 50);
    };

    const pts = Math.max(chain.length - 1, 0) * level * 2;
    useEffect(() => {
        if (gameState === 'result' && pts > 0 && profile)
            supabase.from('game_scores').insert({ game_id: 'word-chain', level, points: pts, profile_id: profile.id, family_id: profile.family_id });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState]);

    const dur = DURATIONS[Math.min(level - 1, DURATIONS.length - 1)];
    const timePct = timeLeft / dur;
    const timerCls = timePct > 0.5 ? 'bg-green-500' : timePct > 0.25 ? 'bg-amber-500' : 'bg-red-500';
    const nextStart = chain.length > 0 ? lastLetter(chain[chain.length - 1]) : '?';

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <div className="text-6xl">🔗</div>
                    <h1 className="text-3xl font-bold text-slate-800">Word Chain</h1>
                    <p className="text-slate-500">Each word must start with the last letter of the previous!</p>
                    <div className="bg-slate-50 p-4 rounded-xl text-left text-sm space-y-2">
                        <p>• Example: apple → <strong className="text-indigo-600">e</strong>agle → <strong className="text-indigo-600">e</strong>el</p>
                        <p>• Words must be 3+ letters</p>
                        <p>• No repeating words</p>
                        <p>• Build the longest chain before time runs out!</p>
                    </div>
                    <Button onClick={() => startLevel(level)} disabled={isLoading} className="w-full h-12 text-lg">{isLoading ? 'Loading...' : `Start Level ${level}`}</Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back</button>
                </Card>
            )}
            {gameState === 'playing' && (
                <div className="w-full space-y-5">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${timerCls}`} style={{ width: `${timePct * 100}%` }} />
                    </div>
                    <div className="flex justify-between text-slate-500 font-medium">
                        <span>⏱ {timeLeft}s</span><span>🔗 {chain.length - 1} chained</span>
                    </div>

                    {/* Chain display */}
                    <div ref={chainRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {chain.map((word, i) => (
                            <span key={i} className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-bold ${i === chain.length - 1 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                {i > 0 && <span className="text-slate-400 mr-1">→</span>}
                                <span className="text-indigo-300 font-black">{word[0].toUpperCase()}</span>{word.slice(1).toUpperCase()}
                            </span>
                        ))}
                    </div>

                    <div className="bg-indigo-50 rounded-xl p-3 text-center border border-indigo-100">
                        <p className="text-indigo-700 font-semibold">
                            Next word must start with <span className="text-2xl font-black text-indigo-600">{nextStart}</span>
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="flex gap-3">
                        <input ref={inputRef} value={input} onChange={e => { setInput(e.target.value); setError(''); }}
                            className="flex-1 h-12 border-2 border-slate-200 rounded-xl px-4 text-lg font-semibold focus:border-indigo-400 outline-none"
                            placeholder={`${nextStart.toLowerCase()}...`} autoComplete="off" spellCheck={false} />
                        <button type="submit" className="w-16 h-12 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">GO</button>
                    </form>
                    {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
                </div>
            )}
            {gameState === 'result' && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <div className="text-6xl">⏰</div>
                    <h2 className="text-3xl font-bold text-slate-800">Time's Up!</h2>
                    <p className="text-slate-500">{chain.length - 1} words chained</p>
                    <p className="text-indigo-600 font-bold text-xl">+{pts} Points</p>
                    <Button onClick={() => startLevel(level)} className="w-full h-12">Play Again</Button>
                    <Button onClick={() => { const n = level + 1; setLevel(n); startLevel(n); }} variant="outline" className="w-full">Level {level + 1}</Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back to Games</button>
                </Card>
            )}
        </div>
    );
}
