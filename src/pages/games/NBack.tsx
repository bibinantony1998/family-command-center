import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, Brain } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const SEQUENCE_LENGTH = 20;
const DISPLAY_MS = 500;
const INTERVAL_MS = 2500;

function getNFromLevel(level: number): number {
    return level <= 2 ? 1 : level <= 5 ? 2 : level <= 8 ? 3 : 4;
}

function generateSequence(len: number, matchRate = 0.3): string[] {
    const seq: string[] = [];
    const n = 2;
    for (let i = 0; i < len; i++) {
        if (i >= n && Math.random() < matchRate) seq.push(seq[i - n]);
        else {
            let l = LETTERS[Math.floor(Math.random() * LETTERS.length)];
            if (i >= n && l === seq[i - n]) l = LETTERS[(LETTERS.indexOf(l) + 1) % LETTERS.length];
            seq.push(l);
        }
    }
    return seq;
}

export default function NBack() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over' | 'completed'>('intro');
    const [level, setLevel] = useState(1);
    const [n, setN] = useState(1);
    const [sequence, setSequence] = useState<string[]>([]);
    const [currentIdx, setCurrentIdx] = useState(-1);
    const [currentLetter, setCurrentLetter] = useState('');
    const [showLetter, setShowLetter] = useState(false);
    const [score, setScore] = useState({ correct: 0, incorrect: 0, missed: 0, total: 0 });
    const [userAnswered, setUserAnswered] = useState(false);
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const idxRef = useRef(-1);
    const seqRef = useRef<string[]>([]);
    const nRef = useRef(1);
    const answeredRef = useRef(false);
    const scoreRef = useRef({ correct: 0, incorrect: 0, missed: 0, total: 0 });

    useEffect(() => {
        if (!profile) return;
        (async () => {
            const { data } = await supabase.from('game_scores').select('level').eq('game_id', 'n-back').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1);
            const maxLevel = data?.[0]?.level || 0;
            const next = maxLevel + 1;
            setHighestUnlockedLevel(next);
            setIsLoading(false);
            if (next > 10) setGameState('completed');
        })();
    }, [profile]);

    const endGame = useCallback((passed: boolean) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setGameState(passed ? 'level-up' : 'game-over');
        if (passed) confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
    }, []);

    const startLevel = useCallback((lvl: number) => {
        const nVal = getNFromLevel(lvl);
        const seq = generateSequence(SEQUENCE_LENGTH);
        seqRef.current = seq;
        nRef.current = nVal;
        idxRef.current = -1;
        answeredRef.current = false;
        scoreRef.current = { correct: 0, incorrect: 0, missed: 0, total: 0 };

        setLevel(lvl);
        setN(nVal);
        setSequence(seq);
        setCurrentIdx(-1);
        setScore({ correct: 0, incorrect: 0, missed: 0, total: 0 });
        setGameState('playing');

        if (timerRef.current) clearInterval(timerRef.current);

        let i = 0;
        timerRef.current = setInterval(() => {
            // Check for missed answer before advancing
            if (i > nVal && !answeredRef.current) {
                const isMatch = seqRef.current[i - 1] === seqRef.current[i - 1 - nVal];
                if (isMatch) {
                    scoreRef.current = { ...scoreRef.current, missed: scoreRef.current.missed + 1, total: scoreRef.current.total + 1 };
                    setScore({ ...scoreRef.current });
                }
            }

            if (i >= SEQUENCE_LENGTH) {
                const s = scoreRef.current;
                const accuracy = s.total > 0 ? s.correct / s.total : 1;
                endGame(accuracy >= 0.7);
                return;
            }

            idxRef.current = i;
            setCurrentIdx(i);
            setCurrentLetter(seqRef.current[i]);
            setShowLetter(true);
            setFeedback(null);
            answeredRef.current = false;
            setUserAnswered(false);

            setTimeout(() => setShowLetter(false), DISPLAY_MS);
            i++;
        }, INTERVAL_MS);
    }, [endGame]);

    useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

    const handleMatch = () => {
        if (answeredRef.current || currentIdx < nRef.current) return;
        answeredRef.current = true;
        setUserAnswered(true);

        const isActualMatch = seqRef.current[currentIdx] === seqRef.current[currentIdx - nRef.current];
        const s = { ...scoreRef.current, total: scoreRef.current.total + 1 };
        if (isActualMatch) { s.correct++; setFeedback('correct'); }
        else { s.incorrect++; setFeedback('wrong'); }
        scoreRef.current = s;
        setScore(s);
    };

    const saveAndNext = async () => {
        if (profile) {
            await supabase.from('game_scores').insert({ game_id: 'n-back', level, points: level * 2, profile_id: profile.id, family_id: profile.family_id });
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
                    <div className="h-20 w-20 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center mx-auto">
                        <Brain size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">N-Back</h1>
                        <p className="text-slate-500 mt-2">Press the button when the letter matches what appeared N steps ago.</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl text-left text-sm text-slate-600 space-y-1">
                        <p>• Level 1-2: 1-Back (1 step ago)</p>
                        <p>• Level 3-5: 2-Back (2 steps ago)</p>
                        <p>• Level 6-8: 3-Back, Level 9-10: 4-Back</p>
                        <p>• Need 70%+ accuracy to pass</p>
                    </div>
                    <Button onClick={() => startLevel(highestUnlockedLevel)} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState === 'playing' && (
                <div className="w-full flex flex-col items-center space-y-8">
                    <div className="flex justify-between items-center w-full text-slate-500 font-medium">
                        <span>Level {level} ({n}-Back)</span>
                        <span className="text-sm">{currentIdx + 1}/{SEQUENCE_LENGTH}</span>
                    </div>

                    <div className={`w-40 h-40 rounded-3xl flex items-center justify-center text-7xl font-black transition-all duration-200
                        ${showLetter ? 'bg-indigo-500 text-white scale-110 shadow-2xl shadow-indigo-200' : 'bg-slate-100 text-slate-200'}`}>
                        {showLetter ? currentLetter : '?'}
                    </div>

                    {currentIdx >= n && (
                        <div className="text-slate-400 text-sm">
                            {n} step{n > 1 ? 's' : ''} ago: <span className="font-bold text-slate-600">{sequence[currentIdx - n]}</span>
                        </div>
                    )}

                    <button
                        onClick={handleMatch}
                        disabled={userAnswered || currentIdx < n}
                        className={`w-48 h-16 rounded-2xl text-white font-bold text-lg shadow-lg transition-all active:scale-95
                            ${feedback === 'correct' ? 'bg-green-500' : feedback === 'wrong' ? 'bg-red-500' : 'bg-indigo-500'}
                            ${(userAnswered || currentIdx < n) ? 'opacity-60' : ''}`}
                    >
                        {feedback === 'correct' ? '✓ Correct!' : feedback === 'wrong' ? '✗ Wrong' : 'MATCH!'}
                    </button>

                    <div className="flex gap-6 text-sm font-medium">
                        <span className="text-green-600">✓ {score.correct}</span>
                        <span className="text-red-500">✗ {score.incorrect}</span>
                        <span className="text-slate-400">— {score.missed}</span>
                    </div>
                </div>
            )}

            {gameState === 'level-up' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                        <Trophy size={40} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Level {level} Passed!</h2>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 2} Points</p>
                        <p className="text-slate-400 text-sm mt-1">{score.correct}/{score.total} correct</p>
                    </div>
                    <Button onClick={saveAndNext} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'game-over' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-4xl">🧠</div>
                    <h2 className="text-2xl font-bold text-slate-800">Keep Training!</h2>
                    <p className="text-slate-500">{score.correct}/{score.total} correct — need 70%</p>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={() => navigate('/games')} className="flex-1">Exit</Button>
                        <Button onClick={() => startLevel(level)} className="flex-1">Try Again</Button>
                    </div>
                </Card>
            )}

            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">🏆</div>
                    <h2 className="text-3xl font-bold text-slate-800">Memory Master!</h2>
                    <p className="text-slate-500">You completed all 10 N-Back levels!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
