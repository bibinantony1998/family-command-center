import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { X, Trophy, Timer } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

const TOTAL_LEVELS = 10;
const QUESTIONS_PER_LEVEL = 5;

// Difficulty config: [maxNumber, operators]
const LEVELS_CONFIG: Record<number, { max: number, ops: string[] }> = {
    1: { max: 10, ops: ['+'] },
    2: { max: 20, ops: ['+'] },
    3: { max: 20, ops: ['-', '+'] },
    4: { max: 50, ops: ['+'] },
    5: { max: 50, ops: ['-', '+'] },
    6: { max: 100, ops: ['+'] },
    7: { max: 100, ops: ['-', '+'] },
    8: { max: 10, ops: ['*'] },
    9: { max: 20, ops: ['*', '+'] },
    10: { max: 50, ops: ['*', '-', '+'] },
};

export default function QuickMath() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over' | 'completed'>('intro');
    const [level, setLevel] = useState(1);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState(0);
    const [userInput, setUserInput] = useState('');
    const [questionsAnswered, setQuestionsAnswered] = useState(0);
    const [timeLeft, setTimeLeft] = useState(30);

    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        const fetchProgress = async () => {
            const { data } = await supabase
                .from('game_scores')
                .select('level')
                .eq('game_id', 'quick-math')
                .eq('profile_id', profile.id)
                .order('level', { ascending: false })
                .limit(1);

            const maxLevel = data?.[0]?.level || 0;
            // Next level is max + 1
            const next = maxLevel + 1;
            setHighestUnlockedLevel(next);
            setIsLoading(false);

            // If already completed all
            if (next > TOTAL_LEVELS) {
                setGameState('completed');
            }
        };
        fetchProgress();
    }, [profile]);

    // Timer Effect
    useEffect(() => {
        let timer: ReturnType<typeof setInterval>;
        if (gameState === 'playing') {
            timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        setGameState('game-over');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [gameState]);

    const generateQuestion = (currentLevel: number) => {
        const config = LEVELS_CONFIG[currentLevel] || LEVELS_CONFIG[10];
        const num1 = Math.floor(Math.random() * config.max) + 1;
        const num2 = Math.floor(Math.random() * config.max) + 1;
        const op = config.ops[Math.floor(Math.random() * config.ops.length)];

        // Prevent negative results for simplicity
        let q = '';
        let a = 0;

        if (op === '-') {
            const bigger = Math.max(num1, num2);
            const smaller = Math.min(num1, num2);
            q = `${bigger} - ${smaller}`;
            a = bigger - smaller;
        } else if (op === '*') {
            // Keep multiplication simpler
            const n1 = Math.floor(Math.random() * 10) + 1;
            const n2 = Math.floor(Math.random() * 10) + 1;
            q = `${n1} x ${n2}`;
            a = n1 * n2;
        } else {
            q = `${num1} + ${num2}`;
            a = num1 + num2;
        }

        setQuestion(q);
        setAnswer(a);
        setUserInput('');
    };

    const startGame = () => {
        const startLvl = highestUnlockedLevel > TOTAL_LEVELS ? 1 : highestUnlockedLevel;
        // Note: If completed, the effect above sets gameState to 'completed'. 
        // But if they click 'Back to Games' then come back, it runs again.
        // If they actully want to REPLAY after finishing, we might need a reset?
        // User said "can't play same level again". 
        // For now, if beat game, maybe just stay on completed screen?
        // But let's allow playing level 1 if we ever adding a "Reset Progress" button.
        // For now, adhere to "next level".

        if (highestUnlockedLevel > TOTAL_LEVELS) return;

        setLevel(startLvl);
        setQuestionsAnswered(0);
        setTimeLeft(60); // 60s for level 1
        setGameState('playing');
        generateQuestion(startLvl);
    };

    const nextLevel = async () => {
        if (!profile) return;

        // Save score for completed level
        const pointsEarned = level * 2;
        await supabase.from('game_scores').insert({
            game_id: 'quick-math',
            level: level,
            points: pointsEarned,
            profile_id: profile.id,
            family_id: profile.family_id
        });

        // Update local unlocked tracker
        setHighestUnlockedLevel(level + 1);

        if (level >= TOTAL_LEVELS) {
            setGameState('completed');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        } else {
            setLevel(l => l + 1);
            setQuestionsAnswered(0);
            setTimeLeft(60 - ((level + 1) * 2)); // Update time for NEXT level
            setGameState('playing');
            generateQuestion(level + 1);
        }
    };

    const handleInput = (val: string) => {
        const newInput = userInput + val;
        setUserInput(newInput);

        if (parseInt(newInput) === answer) {
            // Correct
            if (questionsAnswered + 1 >= QUESTIONS_PER_LEVEL) {
                setGameState('level-up');
                confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
            } else {
                setQuestionsAnswered(prev => prev + 1);
                setUserInput('');
                generateQuestion(level);
            }
        } else if (newInput.length >= String(answer).length) {
            // Wrong and length match, reset
            // Could add penalty here
            setTimeout(() => setUserInput(''), 200);
        }
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">

            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4">
                        <Timer size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Quick Math</h1>
                        <p className="text-slate-500 mt-2">Solve 5 problems per level before time runs out!</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl text-left text-sm space-y-2">
                        <p className="font-semibold text-slate-700">Rewards:</p>
                        <p>• Level 1: <span className="text-indigo-600 font-bold">2 pts</span></p>
                        <p>• Level 5: <span className="text-indigo-600 font-bold">10 pts</span></p>
                        <p>• Level 10: <span className="text-indigo-600 font-bold">20 pts</span></p>
                    </div>
                    <Button onClick={startGame} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState === 'playing' && (
                <div className="w-full space-y-6">
                    <div className="flex justify-between items-center text-slate-500 font-medium">
                        <span>Level {level}</span>
                        <div className={`flex items-center gap-1 ${timeLeft < 10 ? 'text-red-500 animate-pulse' : ''}`}>
                            <Timer size={16} /> {timeLeft}s
                        </div>
                    </div>

                    <div className="text-center py-10">
                        <h2 className="text-6xl font-black text-slate-800 tracking-tighter mb-4">{question}</h2>
                        <div className="h-16 w-32 border-b-4 border-slate-200 mx-auto text-4xl font-bold text-blue-600 flex items-center justify-center">
                            {userInput}
                            <span className="w-0.5 h-8 bg-blue-400 animate-pulse ml-1 opacity-50"></span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button
                                key={num}
                                onClick={() => handleInput(String(num))}
                                className="h-16 rounded-2xl bg-white shadow-sm border-b-4 border-slate-100 text-2xl font-bold text-slate-700 active:border-b-0 active:translate-y-1 transition-all"
                            >
                                {num}
                            </button>
                        ))}
                        <button
                            onClick={() => setUserInput('')}
                            className="h-16 rounded-2xl bg-red-50 text-red-500 font-bold flex items-center justify-center active:bg-red-100 transition-colors"
                        >
                            <X />
                        </button>
                        <button
                            onClick={() => handleInput('0')}
                            className="h-16 rounded-2xl bg-white shadow-sm border-b-4 border-slate-100 text-2xl font-bold text-slate-700 active:border-b-0 active:translate-y-1 transition-all"
                        >
                            0
                        </button>
                        <div />
                    </div>
                </div>
            )}

            {gameState === 'level-up' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                        <Trophy size={40} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Level {level} Complete!</h2>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 2} Points</p>
                    </div>
                    <Button onClick={nextLevel} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'game-over' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-4xl">😢</div>
                    <h2 className="text-2xl font-bold text-slate-800">Time's Up!</h2>
                    <p className="text-slate-500">You reached Level {level}</p>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={() => navigate('/games')} className="flex-1">Exit</Button>
                        <Button onClick={startGame} className="flex-1">Try Again</Button>
                    </div>
                </Card>
            )}
            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">🏆</div>
                    <h2 className="text-3xl font-bold text-slate-800">Champion!</h2>
                    <p className="text-slate-500">You completed all 10 levels!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
