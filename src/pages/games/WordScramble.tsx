import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, Type } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';

const WORD_LIST = [
    // Level 1-2 (3-4 letters)
    ['CAT', 'DOG', 'SUN', 'HAT', 'BOX', 'RED', 'SKY', 'JOY'],
    ['FISH', 'BIRD', 'JUMP', 'BLUE', 'STAR', 'KING', 'LION', 'MILK'],
    // Level 3-4 (5 letters)
    ['APPLE', 'GRAPE', 'SMILE', 'HOUSE', 'TRAIN', 'WATER', 'BREAD', 'HAPPY'],
    ['TIGER', 'ROBOT', 'CHAIR', 'TABLE', 'PLANT', 'CLOCK', 'CLOUD', 'MONEY'],
    // Level 5-6 (6 letters)
    ['BANANA', 'ORANGE', 'PURPLE', 'CIRCLE', 'FAMILY', 'FRIEND', 'SCHOOL', 'SUMMER'],
    ['WINTER', 'YELLOW', 'PLANET', 'ROCKET', 'DOCTOR', 'DRIVER', 'WINDOW', 'GARDEN'],
    // Level 7-8 (7 letters)
    ['MORNING', 'EVENING', 'KITCHEN', 'CHICKEN', 'HOLIDAY', 'LIBRARY', 'PICTURE', 'RAINBOW'],
    ['UNICORN', 'VAMPIRE', 'BALLOON', 'DESSERT', 'DIAMOND', 'FREEDOM', 'JOURNEY', 'MONSTER'],
    // Level 9-10 (8+ letters)
    ['DIFFRENT', 'ELEPHANT', 'DYNOSAUR', 'HOSPITAL', 'TELEFONE', 'MOUNTAIN', 'BIRTHDAY', 'SANDWICH'],
    ['VACATION', 'ADVENTUR', 'CHOCOLAT', 'SPAGHETI', 'STRAWBRY', 'UMBRELLA', 'UNIVERSE', 'WONDERFL']
];

export default function WordScramble() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'completed'>('intro');
    // const [scrambled, setScrambled] = useState<string[]>([]); // Removed unused
    const [selectedLetters, setSelectedLetters] = useState<string[]>([]);
    const [displayLetters, setDisplayLetters] = useState<{ char: string, id: number, used: boolean }[]>([]);
    const [currentWord, setCurrentWord] = useState('');
    const [wordsSolved, setWordsSolved] = useState(0);
    const [message, setMessage] = useState('');

    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    const WORDS_TO_WIN = 3;

    useEffect(() => {
        if (!profile) return;
        const fetchProgress = async () => {
            const { data } = await supabase
                .from('game_scores')
                .select('level')
                .eq('game_id', 'word-scramble')
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

    const scrambleWord = (word: string) => {
        const chars = word.split('');
        // Shuffle
        for (let i = chars.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        return chars;
    };

    const nextWord = (lvl: number) => {
        const poolIndex = Math.min(lvl - 1, 9);
        const pool = WORD_LIST[poolIndex];
        const word = pool[Math.floor(Math.random() * pool.length)];

        setCurrentWord(word);
        const shuffled = scrambleWord(word);

        setDisplayLetters(shuffled.map((c, i) => ({ char: c, id: i, used: false })));
        setSelectedLetters([]);
        setMessage('');
    };

    const startLevel = (lvl: number) => {
        setLevel(lvl);
        setWordsSolved(0);
        setGameState('playing');
        nextWord(lvl);
    };

    const startGame = () => {
        if (highestUnlockedLevel > 10) return;
        startLevel(highestUnlockedLevel);
    };

    const handleLetterClick = (item: { char: string, id: number, used: boolean }) => {
        if (item.used) return;

        setSelectedLetters(prev => [...prev, item.char]);
        setDisplayLetters(prev => prev.map(l => l.id === item.id ? { ...l, used: true } : l));
    };

    // Better Undo:
    const handleReset = () => {
        setSelectedLetters([]);
        setDisplayLetters(prev => prev.map(l => ({ ...l, used: false })));
        setMessage('');
    };

    const winLevel = async () => {
        setGameState('level-up');
        if (!profile) return;

        const pointsEarned = level * 2;
        await supabase.from('game_scores').insert({
            game_id: 'word-scramble',
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

    const checkAnswer = async () => {
        const guess = selectedLetters.join('');
        if (guess === currentWord) {
            setMessage('Correct! 🎉');
            await new Promise(r => setTimeout(r, 1000));

            if (wordsSolved + 1 >= WORDS_TO_WIN) {
                winLevel();
            } else {
                setWordsSolved(w => w + 1);
                nextWord(level);
            }
        } else {
            setMessage('Try Again ❌');
            setTimeout(() => {
                handleReset();
            }, 1000);
        }
    };

    // Auto check when length matches
    useEffect(() => {
        if (selectedLetters.length === currentWord.length && currentWord !== '') {
            checkAnswer();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLetters]);

    const nextLevel = () => {
        startLevel(level + 1);
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-yellow-100 text-yellow-600 flex items-center justify-center mx-auto mb-4">
                        <Type size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Word Scramble</h1>
                        <p className="text-slate-500 mt-2">Unscramble letters to find the hidden word.</p>
                    </div>
                    <Button onClick={startGame} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState === 'playing' && (
                <div className="w-full space-y-8">
                    <div className="flex justify-between items-center text-slate-500 font-medium">
                        <span>Level {level}</span>
                        <span>Solved: {wordsSolved}/{WORDS_TO_WIN}</span>
                    </div>

                    <div className="flex justify-center min-h-16">
                        {message ? (
                            <h2 className={`text-2xl font-bold ${message.includes('Correct') ? 'text-green-500' : 'text-slate-800'}`}>
                                {message}
                            </h2>
                        ) : (
                            <div className="flex gap-2">
                                {/* Placeholders for answer */}
                                {Array.from({ length: currentWord.length }).map((_, i) => (
                                    <div key={i} className="w-10 h-14 border-b-4 border-slate-300 flex items-center justify-center text-2xl font-bold text-slate-700">
                                        {selectedLetters[i] || ''}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-4 gap-4 p-4">
                        {displayLetters.map((item) => (
                            <motion.button
                                layoutId={`letter-${item.id}`}
                                key={item.id}
                                onClick={() => handleLetterClick(item)}
                                disabled={item.used}
                                className={`h-14 rounded-xl font-bold text-xl shadow-sm border-b-4 transition-all
                                    ${item.used
                                        ? 'bg-slate-100 text-slate-300 border-slate-100 scale-90'
                                        : 'bg-white text-indigo-600 border-indigo-100 hover:-translate-y-1 hover:border-indigo-300 active:scale-95'
                                    }
                                `}
                            >
                                {item.char}
                            </motion.button>
                        ))}
                    </div>

                    <div className="flex justify-center">
                        <Button variant="ghost" onClick={handleReset} className="text-slate-400 hover:text-red-500">
                            Reset Letters
                        </Button>
                    </div>
                </div>
            )}

            {gameState === 'level-up' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                        <Trophy size={40} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Excellent!</h2>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 2} Points</p>
                    </div>
                    <Button onClick={nextLevel} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">📖</div>
                    <h2 className="text-3xl font-bold text-slate-800">Vocabulary Master!</h2>
                    <p className="text-slate-500">You solved all the words!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
