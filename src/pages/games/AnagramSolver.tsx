import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, Shuffle, X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

const WORD_POOL: string[][] = [
    ['cat', 'dog', 'sun', 'hat', 'map'],
    ['bird', 'fish', 'tree', 'jump', 'frog'],
    ['apple', 'brain', 'cloud', 'dance', 'earth'],
    ['bright', 'castle', 'dragon', 'flight', 'garden'],
    ['captain', 'dolphin', 'feather', 'journey', 'lantern'],
    ['absolute', 'calendar', 'daughter', 'elephant', 'fragment'],
    ['adventure', 'beautiful', 'celebrate', 'dimension', 'excellent'],
    ['basketball', 'chocolate', 'completely', 'democratic', 'earthworm'],
    ['imagination', 'development', 'environment', 'neighboring', 'persistence'],
    ['accomplishment', 'communication', 'extraordinary', 'manufacturing', 'transformation'],
];

function scramble(word: string): string {
    const arr = word.split('');
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    // Ensure scrambled != original
    const result = arr.join('');
    return result === word ? scramble(word) : result;
}

const QUESTIONS_PER_LEVEL = 5;

export default function AnagramSolver() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over' | 'completed'>('intro');
    const [level, setLevel] = useState(1);
    const [word, setWord] = useState('');
    const [scrambled, setScrambled] = useState('');
    const [letters, setLetters] = useState<{ char: string; used: boolean }[]>([]);
    const [userAnswer, setUserAnswer] = useState<string[]>([]);
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
    const [qNum, setQNum] = useState(0);
    const [correct, setCorrect] = useState(0);
    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        (async () => {
            const { data } = await supabase.from('game_scores').select('level').eq('game_id', 'anagram-solver').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1);
            const maxLevel = data?.[0]?.level || 0;
            const next = maxLevel + 1;
            setHighestUnlockedLevel(next); setIsLoading(false);
            if (next > 10) setGameState('completed');
        })();
    }, [profile]);

    const loadQuestion = (lvl: number, num: number) => {
        const pool = WORD_POOL[Math.min(lvl - 1, WORD_POOL.length - 1)];
        const w = pool[num % pool.length];
        const s = scramble(w);
        setWord(w);
        setScrambled(s);
        setLetters(s.split('').map(c => ({ char: c, used: false })));
        setUserAnswer([]);
        setFeedback(null);
        setQNum(num);
    };

    const startLevel = (lvl: number) => {
        setLevel(lvl); setCorrect(0); setGameState('playing');
        loadQuestion(lvl, 0);
    };

    const handleLetterClick = (idx: number) => {
        if (letters[idx].used || feedback) return;
        const newLetters = [...letters];
        newLetters[idx] = { ...newLetters[idx], used: true };
        const newAnswer = [...userAnswer, letters[idx].char];
        setLetters(newLetters);
        setUserAnswer(newAnswer);

        if (newAnswer.length === word.length) {
            const guess = newAnswer.join('');
            if (guess === word) {
                setFeedback('correct');
                const newCorrect = correct + 1;
                setCorrect(newCorrect);
                confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
                setTimeout(() => {
                    const nextQ = qNum + 1;
                    if (nextQ >= QUESTIONS_PER_LEVEL) {
                        if (newCorrect >= Math.ceil(QUESTIONS_PER_LEVEL * 0.8)) setGameState('level-up');
                        else setGameState('game-over');
                    } else loadQuestion(level, nextQ);
                }, 700);
            } else {
                setFeedback('wrong');
                setTimeout(() => {
                    setLetters(scrambled.split('').map(c => ({ char: c, used: false })));
                    setUserAnswer([]); setFeedback(null);
                }, 700);
            }
        }
    };

    const handleRemoveLast = () => {
        if (!userAnswer.length || feedback) return;
        const lastChar = userAnswer[userAnswer.length - 1];
        const newAnswer = userAnswer.slice(0, -1);
        const newLetters = [...letters];
        // Find last used instance of this char
        for (let i = newLetters.length - 1; i >= 0; i--) {
            if (newLetters[i].used && newLetters[i].char === lastChar) {
                newLetters[i] = { ...newLetters[i], used: false }; break;
            }
        }
        setLetters(newLetters); setUserAnswer(newAnswer);
    };

    const saveAndNext = async () => {
        if (profile) {
            await supabase.from('game_scores').insert({ game_id: 'anagram-solver', level, points: level * 2, profile_id: profile.id, family_id: profile.family_id });
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
                    <div className="h-20 w-20 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto"><Shuffle size={40} /></div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Anagram Solver</h1>
                        <p className="text-slate-500 mt-2">Rearrange the scrambled letters to form the correct word!</p>
                    </div>
                    <Button onClick={() => startLevel(highestUnlockedLevel)} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState === 'playing' && (
                <div className="w-full space-y-6">
                    <div className="flex justify-between text-slate-500 font-medium">
                        <span>Level {level}</span><span>{qNum + 1}/{QUESTIONS_PER_LEVEL}</span>
                    </div>

                    {/* Answer Area */}
                    <div className={`min-h-16 rounded-2xl p-3 flex items-center justify-center gap-2 flex-wrap transition-colors
                        ${feedback === 'correct' ? 'bg-green-50 border-2 border-green-300' : feedback === 'wrong' ? 'bg-red-50 border-2 border-red-300' : 'bg-slate-50 border-2 border-slate-200'}`}>
                        {userAnswer.length === 0 ? <span className="text-slate-300 text-sm">Tap letters below...</span> :
                            userAnswer.map((c, i) => (
                                <div key={i} className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold
                                    ${feedback === 'correct' ? 'bg-green-500 text-white' : feedback === 'wrong' ? 'bg-red-400 text-white' : 'bg-indigo-500 text-white'}`}>
                                    {c.toUpperCase()}
                                </div>
                            ))
                        }
                    </div>

                    {feedback === 'correct' && <div className="flex items-center justify-center gap-2 text-green-600 font-bold"><Check size={18} /> Correct!</div>}
                    {feedback === 'wrong' && <div className="text-center text-red-500 font-bold">Not quite — try again!</div>}

                    {/* Letter Bank */}
                    <div className="flex flex-wrap gap-2 justify-center">
                        {letters.map((l, idx) => (
                            <button key={idx} onClick={() => handleLetterClick(idx)} disabled={l.used}
                                className={`w-12 h-12 rounded-xl text-lg font-bold shadow-sm transition-all
                                    ${l.used ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-white border-b-4 border-amber-200 text-slate-700 active:border-b-0 active:translate-y-1'}`}>
                                {l.char.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-3 justify-center">
                        <button onClick={handleRemoveLast} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-100 text-slate-500 font-medium text-sm active:bg-slate-200">
                            <X size={14} /> Remove
                        </button>
                        <button onClick={() => {
                            setLetters(scrambled.split('').map(c => ({ char: c, used: false })));
                            setUserAnswer([]); setFeedback(null);
                        }} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-100 text-slate-500 font-medium text-sm active:bg-slate-200">
                            <Shuffle size={14} /> Reset
                        </button>
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
                    <div className="text-4xl">🔤</div>
                    <h2 className="text-2xl font-bold text-slate-800">Keep Unscrambling!</h2>
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
                    <h2 className="text-3xl font-bold text-slate-800">Word Wizard!</h2>
                    <p className="text-slate-500">You completed all 10 anagram levels!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
