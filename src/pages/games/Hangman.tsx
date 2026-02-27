import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

const WORDS_POOL = [
    'cat', 'dog', 'sun', 'hat', 'run', 'joy', 'fly', 'ant', 'owl', 'fox', 'pen', 'map',
    'apple', 'tiger', 'chair', 'cloud', 'flame', 'river', 'piano', 'brave', 'stone', 'smile', 'climb', 'brush',
    'castle', 'bridge', 'flower', 'silver', 'garden', 'travel', 'orange', 'mirror', 'frozen', 'listen', 'search',
    'dolphin', 'unicorn', 'diamond', 'rainbow', 'captain', 'kitchen', 'morning', 'thunder', 'blanket', 'chicken',
    'keyboard', 'mountain', 'football', 'platinum', 'umbrella', 'thousand', 'alphabet', 'shoulder', 'treasure',
];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const MAX_WRONG = 6;

function pickWord(level: number) {
    let pool: string[];
    if (level <= 3) pool = WORDS_POOL.slice(0, 12);
    else if (level <= 6) pool = WORDS_POOL.slice(12, 27);
    else if (level <= 10) pool = WORDS_POOL.slice(27, 40);
    else pool = WORDS_POOL.slice(40);
    return pool[Math.floor(Math.random() * pool.length)].toUpperCase();
}

export default function Hangman() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'won' | 'lost'>('intro');
    const [word, setWord] = useState('');
    const [guessed, setGuessed] = useState<Set<string>>(new Set());
    const [wrongCount, setWrongCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        supabase.from('game_scores').select('level').eq('game_id', 'hangman').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1)
            .then(({ data }) => { setLevel((data?.[0]?.level || 0) + 1); setIsLoading(false); });
    }, [profile]);

    const startLevel = (lvl: number) => {
        setWord(pickWord(lvl)); setGuessed(new Set()); setWrongCount(0); setGameState('playing');
    };

    const handleGuess = (letter: string) => {
        if (guessed.has(letter)) return;
        const ng = new Set(guessed); ng.add(letter); setGuessed(ng);
        if (!word.includes(letter)) {
            const nw = wrongCount + 1; setWrongCount(nw);
            if (nw >= MAX_WRONG) setGameState('lost');
        } else {
            if (word.split('').every(c => ng.has(c))) {
                const pts = (MAX_WRONG - wrongCount) * level * 2;
                supabase.from('game_scores').insert({ game_id: 'hangman', level, points: pts, profile_id: profile?.id, family_id: profile?.family_id });
                confetti({ particleCount: 80, spread: 60 });
                setGameState('won');
            }
        }
    };

    // Keyboard support
    useEffect(() => {
        if (gameState !== 'playing') return;
        const onKey = (e: KeyboardEvent) => {
            const l = e.key.toUpperCase();
            if (l.length === 1 && l >= 'A' && l <= 'Z') handleGuess(l);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState, guessed, word, wrongCount, level]);

    const displayWord = word.split('').map(c => guessed.has(c) ? c : '_').join(' ');
    const gallowLines = ['  ╔═══╗', '  ║', '  ║   ' + (wrongCount >= 1 ? '😬' : ' '), '  ║   ' + (wrongCount >= 2 ? '|' : ' '), '  ║  ' + (wrongCount >= 3 ? '/' : ' ') + (wrongCount >= 2 ? '|' : ' ') + (wrongCount >= 4 ? '\\' : ' '), '  ║  ' + (wrongCount >= 5 ? '/' : ' ') + ' ' + (wrongCount >= 6 ? '\\' : ' '), '══╩══'];
    const pts = (MAX_WRONG - wrongCount) * level * 2;

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <div className="text-6xl">🪢</div>
                    <h1 className="text-3xl font-bold text-slate-800">Hangman</h1>
                    <p className="text-slate-500">Guess the hidden word one letter at a time.</p>
                    <div className="bg-slate-50 p-4 rounded-xl text-left text-sm space-y-2">
                        <p>• Click letters A–Z to guess</p>
                        <p>• {MAX_WRONG} wrong guesses = game over</p>
                        <p>• Fewer mistakes = more points</p>
                    </div>
                    <Button onClick={() => startLevel(level)} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${level}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back</button>
                </Card>
            )}

            {gameState === 'playing' && (
                <div className="w-full space-y-6">
                    <div className="flex justify-between text-slate-500 font-medium">
                        <span>Level {level}</span>
                        <span className="flex gap-1">{Array.from({ length: MAX_WRONG }, (_, i) => <span key={i}>{i < wrongCount ? '🖤' : '❤️'}</span>)}</span>
                    </div>
                    <div className="bg-slate-800 rounded-2xl p-6 font-mono text-slate-200 text-lg space-y-0.5">
                        {gallowLines.map((line, i) => <div key={i}>{line || '\u00A0'}</div>)}
                    </div>
                    <p className="text-center text-4xl font-extrabold tracking-[0.4em] text-slate-800">{displayWord}</p>
                    <div className="flex flex-wrap gap-1.5 justify-center">
                        {ALPHABET.map(letter => {
                            const isG = guessed.has(letter);
                            const isC = isG && word.includes(letter);
                            const isW = isG && !word.includes(letter);
                            return (
                                <button key={letter} onClick={() => handleGuess(letter)} disabled={isG}
                                    className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors
                                        ${isC ? 'bg-green-100 text-green-700 border border-green-300' : ''}
                                        ${isW ? 'bg-red-100 text-red-400 border border-red-200' : ''}
                                        ${!isG ? 'bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 border border-slate-200' : ''}
                                    `}>{letter}</button>
                            );
                        })}
                    </div>
                </div>
            )}

            {(gameState === 'won' || gameState === 'lost') && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <div className="text-6xl">{gameState === 'won' ? '🎉' : '💀'}</div>
                    <h2 className="text-3xl font-bold text-slate-800">{gameState === 'won' ? 'You Got It!' : 'Game Over'}</h2>
                    {gameState === 'lost' && <p className="text-slate-500">The word was: <strong className="text-slate-800">{word}</strong></p>}
                    {gameState === 'won' && <p className="text-indigo-600 font-bold text-xl">+{pts} Points</p>}
                    <Button onClick={() => { const n = level + (gameState === 'won' ? 1 : 0); setLevel(n); startLevel(n); }} className="w-full h-12">
                        {gameState === 'won' ? 'Next Level' : 'Try Again'}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back to Games</button>
                </Card>
            )}
        </div>
    );
}
