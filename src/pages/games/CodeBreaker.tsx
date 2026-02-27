import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

const COLORS_4 = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
const COLORS_5 = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];
const COLORS_6 = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

function getColors(level: number) { return level <= 4 ? COLORS_4 : level <= 8 ? COLORS_5 : COLORS_6; }
function getCodeLen(level: number) { return level <= 6 ? 4 : 5; }
function makeCode(colors: string[], len: number) { return Array.from({ length: len }, () => colors[Math.floor(Math.random() * colors.length)]); }
function scoreGuess(secret: string[], guess: string[]): { exact: number; color: number } {
    let exact = 0, color = 0; const sR = [...secret], gR = [...guess];
    for (let i = 0; i < secret.length; i++) if (secret[i] === guess[i]) { exact++; sR[i] = ''; gR[i] = ''; }
    for (let i = 0; i < gR.length; i++) { if (!gR[i]) continue; const j = sR.indexOf(gR[i]); if (j >= 0) { color++; sR[j] = ''; } }
    return { exact, color };
}
const MAX_GUESSES = 8;

export default function CodeBreaker() {
    const navigate = useNavigate(); const { profile } = useAuth();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'won' | 'lost'>('intro');
    const [secret, setSecret] = useState<string[]>([]);
    const [colors, setColors] = useState<string[]>(COLORS_4);
    const [codeLen, setCodeLen] = useState(4);
    const [current, setCurrent] = useState<string[]>([]);
    const [history, setHistory] = useState<{ guess: string[]; exact: number; color: number }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        supabase.from('game_scores').select('level').eq('game_id', 'code-breaker').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1)
            .then(({ data }) => { setLevel((data?.[0]?.level || 0) + 1); setIsLoading(false); });
    }, [profile]);

    const startLevel = (lvl: number) => {
        const c = getColors(lvl), len = getCodeLen(lvl);
        setColors(c); setCodeLen(len); setSecret(makeCode(c, len)); setCurrent([]); setHistory([]); setGameState('playing');
    };

    const addColor = (col: string) => { if (current.length < codeLen) setCurrent(c => [...c, col]); };
    const removeLast = () => setCurrent(c => c.slice(0, -1));

    const submitGuess = () => {
        if (current.length !== codeLen) return;
        const result = scoreGuess(secret, current);
        const nh = [...history, { guess: [...current], ...result }];
        setHistory(nh); setCurrent([]);
        if (result.exact === codeLen) {
            const pts = (MAX_GUESSES - nh.length + 1) * level * 4;
            supabase.from('game_scores').insert({ game_id: 'code-breaker', level, points: pts, profile_id: profile?.id, family_id: profile?.family_id });
            confetti({ particleCount: 100, spread: 70 }); setGameState('won');
        } else if (nh.length >= MAX_GUESSES) setGameState('lost');
    };

    return (
        <div className="h-full flex flex-col items-center justify-start p-4 max-w-lg mx-auto pt-4">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <div className="text-6xl">🔐</div>
                    <h1 className="text-3xl font-bold text-slate-800">Code Breaker</h1>
                    <p className="text-slate-500">Crack the hidden color code using deduction!</p>
                    <div className="bg-slate-50 p-4 rounded-xl text-left text-sm space-y-2">
                        <p>• Guess the secret color sequence</p>
                        <p>• ⬛ = right color, right position</p>
                        <p>• ⬜ = right color, wrong position</p>
                        <p>• {MAX_GUESSES} guesses total</p>
                    </div>
                    <Button onClick={() => startLevel(level)} disabled={isLoading} className="w-full h-12 text-lg">{isLoading ? 'Loading...' : `Start Level ${level}`}</Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back</button>
                </Card>
            )}
            {gameState === 'playing' && (
                <div className="w-full space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Level {level}</span>
                        <span className="text-slate-500 font-medium">{MAX_GUESSES - history.length} guesses left</span>
                        <button onClick={() => startLevel(level)} className="p-2 rounded-xl bg-slate-100"><RefreshCw size={16} /></button>
                    </div>

                    {/* History */}
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                        {history.map((row, ri) => (
                            <div key={ri} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                                <div className="flex gap-2">
                                    {row.guess.map((c, ci) => <div key={ci} style={{ backgroundColor: c }} className="w-8 h-8 rounded-full border-2 border-black/10" />)}
                                </div>
                                <div className="ml-auto text-sm font-bold text-slate-600">
                                    ⬛×{row.exact} ⬜×{row.color}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Current row */}
                    <div className="flex gap-3 justify-center bg-indigo-50 rounded-xl p-4">
                        {Array.from({ length: codeLen }, (_, i) => (
                            <div key={i} style={{ backgroundColor: current[i] ?? '#e2e8f0' }} className="w-10 h-10 rounded-full border-2 border-black/10" />
                        ))}
                    </div>

                    {/* Color picker */}
                    <div className="flex gap-3 justify-center">
                        {colors.map((col, i) => (
                            <button key={i} onClick={() => addColor(col)} style={{ backgroundColor: col }} className="w-12 h-12 rounded-full border-4 border-white shadow-md hover:scale-110 transition-transform" />
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <Button onClick={removeLast} variant="outline" className="flex-1">⌫ Remove</Button>
                        <Button onClick={submitGuess} disabled={current.length !== codeLen} className="flex-1">Submit</Button>
                    </div>
                </div>
            )}
            {(gameState === 'won' || gameState === 'lost') && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <div className="text-6xl">{gameState === 'won' ? '🎉' : '💔'}</div>
                    <h2 className="text-3xl font-bold text-slate-800">{gameState === 'won' ? 'Code Cracked!' : 'Code Survived!'}</h2>
                    {gameState === 'lost' && <div className="flex gap-2 justify-center">{secret.map((c, i) => <div key={i} style={{ backgroundColor: c }} className="w-10 h-10 rounded-full" />)}</div>}
                    {gameState === 'won' && <p className="text-indigo-600 font-bold text-xl">+{(MAX_GUESSES - history.length + 1) * level * 4} Points</p>}
                    <Button onClick={() => { const n = level + (gameState === 'won' ? 1 : 0); setLevel(n); startLevel(n); }} className="w-full h-12">{gameState === 'won' ? 'Next Level' : 'Try Again'}</Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back to Games</button>
                </Card>
            )}
        </div>
    );
}
