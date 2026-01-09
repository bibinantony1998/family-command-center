import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, Timer, Palette } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

const COLORS = [
    { name: 'RED', class: 'text-red-500' },
    { name: 'BLUE', class: 'text-blue-500' },
    { name: 'GREEN', class: 'text-green-500' },
    { name: 'YELLOW', class: 'text-yellow-500' },
    { name: 'PURPLE', class: 'text-purple-500' },
    { name: 'ORANGE', class: 'text-orange-500' }
];

export default function ColorChaos() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over' | 'completed'>('intro');
    const [timeLeft, setTimeLeft] = useState(30);
    const [word, setWord] = useState(COLORS[0]);
    const [inkColor, setInkColor] = useState(COLORS[1]);
    const [options, setOptions] = useState<string[]>([]);

    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    const questionsPerLevel = 10;
    const [questionsAnswered, setQuestionsAnswered] = useState(0);

    useEffect(() => {
        if (!profile) return;
        const fetchProgress = async () => {
            const { data } = await supabase
                .from('game_scores')
                .select('level')
                .eq('game_id', 'color-chaos')
                .eq('profile_id', profile.id)
                .order('level', { ascending: false })
                .limit(1);

            const maxLevel = data?.[0]?.level || 0;
            const next = maxLevel + 1;
            setHighestUnlockedLevel(next);
            setIsLoading(false);

            if (next > 10) setGameState('completed');
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
            }, 100); // 100ms for smoother bar, but Logic is seconds? No, let's do 0.1s steps.
        }
        return () => clearInterval(timer);
    }, [gameState]);

    const generateRound = useCallback(() => {
        // Difficulty scaling
        const poolSize = Math.min(COLORS.length, 2 + Math.floor(level / 2));
        const pool = COLORS.slice(0, poolSize);

        const randomWord = pool[Math.floor(Math.random() * pool.length)];
        const randomInk = pool[Math.floor(Math.random() * pool.length)];

        // Ensure somewhat random distribution of match vs mismatch if needed,
        // but true random is fine for Stroop.

        setWord(randomWord);
        setInkColor(randomInk);

        // Generate options (Ink Colors)
        const correct = randomInk.name;
        const distractors = pool.map(c => c.name).filter(n => n !== correct);

        const opts = [correct];
        // Add 2 distractors
        while (opts.length < 3 && distractors.length > 0) {
            const ridx = Math.floor(Math.random() * distractors.length);
            opts.push(distractors[ridx]);
            distractors.splice(ridx, 1);
        }

        // Shuffle options
        for (let i = opts.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [opts[i], opts[j]] = [opts[j], opts[i]];
        }

        setOptions(opts);
    }, [level, setWord, setInkColor, setOptions]);

    const startGame = () => {
        if (highestUnlockedLevel > 10) return;
        setLevel(highestUnlockedLevel);
        startLevel(highestUnlockedLevel);
    };

    const startLevel = (lvl: number) => {
        setQuestionsAnswered(0);
        // Time decreases with level
        // Level 1: 30s for 10 q (3s per q)
        // Level 10: 10s for 10 q (1s per q) -> Extreme!
        const time = 300 - (lvl * 20); // 30.0s -> 10.0s (in 0.1s units)
        setTimeLeft(time);
        setGameState('playing');
        generateRound();
    };


    const handleOption = (selectedColorName: string) => {
        if (selectedColorName === inkColor.name) {
            // Correct
            if (questionsAnswered + 1 >= questionsPerLevel) {
                winLevel();
            } else {
                setQuestionsAnswered(q => q + 1);
                generateRound();
            }
        } else {
            // Penalty? Or Game Over?
            // Let's do a 5 second (50 unit) penalty
            setTimeLeft(t => Math.max(0, t - 50));
        }
    };

    const winLevel = async () => {
        setGameState('level-up');
        if (!profile) return;

        const pointsEarned = level * 2;
        await supabase.from('game_scores').insert({
            game_id: 'color-chaos',
            level: level,
            points: pointsEarned,
            profile_id: profile.id,
            family_id: profile.family_id
        });

        const next = level + 1;
        setHighestUnlockedLevel(next);

        if (next > 10) {
            setGameState('completed');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        } else {
            confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
        }
    };

    const nextLevel = () => {
        const next = level + 1;
        setLevel(next);
        startLevel(next);
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center mx-auto mb-4">
                        <Palette size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Color Chaos</h1>
                        <p className="text-slate-500 mt-2">Tap the <span className="font-bold underline">COLOR</span> of the text, not the word!</p>
                    </div>
                    <Button onClick={startGame} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel} `}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState === 'playing' && (
                <div className="w-full space-y-12">
                    <div className="flex justify-between items-center text-slate-500 font-medium">
                        <span>Level {level}</span>
                        <div className={`flex items - center gap - 1 ${timeLeft < 50 ? 'text-red-500 animate-pulse' : ''} `}>
                            <Timer size={16} /> {(timeLeft / 10).toFixed(1)}s
                        </div>
                    </div>

                    <div className="text-center py-8">
                        <h2 className={`text - 6xl font - black tracking - wider ${inkColor.class} `}>
                            {word.name}
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {options.map((opt) => (
                            <button
                                key={opt}
                                onClick={() => handleOption(opt)}
                                className="h-16 rounded-2xl bg-white shadow-sm border-2 border-slate-100 text-xl font-bold text-slate-700 active:scale-95 transition-all"
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {gameState === 'level-up' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                        <Trophy size={40} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Focused!</h2>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 2} Points</p>
                    </div>
                    <Button onClick={nextLevel} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'game-over' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-4xl">😵‍💫</div>
                    <h2 className="text-2xl font-bold text-slate-800">Brain Twist!</h2>
                    <p className="text-slate-500">You reached Level {level}</p>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={() => navigate('/games')} className="flex-1">Exit</Button>
                        <Button onClick={() => startLevel(level)} className="flex-1">Try Again</Button>
                    </div>
                </Card>
            )}

            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">🦅</div>
                    <h2 className="text-3xl font-bold text-slate-800">Eagle Eye!</h2>
                    <p className="text-slate-500">You mastered the chaos!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
