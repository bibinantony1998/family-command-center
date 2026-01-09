import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, Timer, Dna } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';

const EMOJIS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', 'cow', '🐷', '🐸', '🐵'];

interface CardItem {
    id: number;
    emoji: string;
    isFlipped: boolean;
    isMatched: boolean;
}

export default function MemoryMatch() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over' | 'completed'>('intro');
    const [level, setLevel] = useState(1);
    const [gridSize, setGridSize] = useState(4); // Total cards
    const [cards, setCards] = useState<CardItem[]>([]);
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [timeLeft, setTimeLeft] = useState(60);
    const [isChecking, setIsChecking] = useState(false);

    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        const fetchProgress = async () => {
            const { data } = await supabase
                .from('game_scores')
                .select('level')
                .eq('game_id', 'memory-match')
                .eq('profile_id', profile.id)
                .order('level', { ascending: false })
                .limit(1);

            const maxLevel = data?.[0]?.level || 0;
            const next = maxLevel + 1;
            setHighestUnlockedLevel(next);
            setIsLoading(false);

            if (next > 10) {  // Assuming 10 levels max for now
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

    const generateCards = (currentLevel: number) => {
        // Pairs count based on level
        // Level 1: 2 pairs (4 cards)
        // Level 2: 3 pairs (6 cards)
        // Level 3: 4 pairs (8 cards)
        // Level 4: 6 pairs (12 cards)
        // Level 5: 8 pairs (16 cards)
        // Level 6: 10 pairs (20 cards)

        let pairs = 2;
        if (currentLevel === 2) pairs = 3;
        else if (currentLevel === 3) pairs = 4;
        else if (currentLevel === 4) pairs = 6;
        else if (currentLevel === 5) pairs = 8;
        else if (currentLevel === 6) pairs = 10;
        else if (currentLevel >= 7) pairs = 12;

        setGridSize(pairs * 2);

        const selectedEmojis = EMOJIS.slice(0, pairs);
        const cardValues = [...selectedEmojis, ...selectedEmojis];

        // Shuffle
        for (let i = cardValues.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cardValues[i], cardValues[j]] = [cardValues[j], cardValues[i]];
        }

        setCards(cardValues.map((emoji, index) => ({
            id: index,
            emoji,
            isFlipped: true, // Show initially for a moment? No, let's keep hidden.
            isMatched: false
        })));

        // Specifically set all to unflipped
        setTimeout(() => {
            setCards(prev => prev.map(c => ({ ...c, isFlipped: false })));
        }, 500);
    };

    const startGame = () => {
        if (highestUnlockedLevel > 10) return;
        setLevel(highestUnlockedLevel);
        startGameLevel(highestUnlockedLevel);
    };

    const startGameLevel = (lvl: number) => {
        setGameState('playing');
        setTimeLeft(30 + (lvl * 10)); // More time for higher levels
        setFlippedIndices([]);
        setIsChecking(false);
        generateCards(lvl);
    };

    const handleCardClick = (index: number) => {
        if (gameState !== 'playing' || isChecking || cards[index].isFlipped || cards[index].isMatched) return;

        // Flip card
        const newCards = [...cards];
        newCards[index].isFlipped = true;
        setCards(newCards);

        const newFlipped = [...flippedIndices, index];
        setFlippedIndices(newFlipped);

        if (newFlipped.length === 2) {
            setIsChecking(true);
            const [firstIndex, secondIndex] = newFlipped;

            if (cards[firstIndex].emoji === cards[index].emoji) {
                // Match!
                setTimeout(() => {
                    setCards(prev => prev.map((c, i) =>
                        i === firstIndex || i === secondIndex
                            ? { ...c, isMatched: true }
                            : c
                    ));
                    setFlippedIndices([]);
                    setIsChecking(false);
                    checkWin([...cards], firstIndex, secondIndex);
                }, 500);
            } else {
                // No Match
                setTimeout(() => {
                    setCards(prev => prev.map((c, i) =>
                        i === firstIndex || i === secondIndex
                            ? { ...c, isFlipped: false }
                            : c
                    ));
                    setFlippedIndices([]);
                    setIsChecking(false);
                }, 1000);
            }
        }
    };

    const checkWin = async (currentCards: CardItem[], idx1: number, idx2: number) => {
        // We need to check if all cards are matched. 
        // Note: state update hasn't propagated fully in this closure, so we manually check
        // Or we just check if matched count + 2 == total
        // The two we just matched aren't marked in currentCards yet passed to this function? 
        // Wait, I passed a copy of cards BEFORE setting isMatched in the timeout?
        // Actually, let's just count from currentCards but treat idx1 and idx2 as matched.

        // Simpler: Just check if every card is either matched OR is one of the two we just flipped
        const allMatched = currentCards.every((c, i) => c.isMatched || i === idx1 || i === idx2);

        if (allMatched) {
            // Level Complete
            if (!profile) return;

            const pointsEarned = level * 2;
            await supabase.from('game_scores').insert({
                game_id: 'memory-match',
                level: level,
                points: pointsEarned,
                profile_id: profile.id,
                family_id: profile.family_id
            });

            if (level >= 10) {
                setGameState('completed');
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            } else {
                setGameState('level-up');
                confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } });
            }
        }
    };

    const nextLevel = () => {
        const next = level + 1;
        setHighestUnlockedLevel(next);
        setLevel(next);
        startGameLevel(next);
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-4">
                        <Dna size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Memory Match</h1>
                        <p className="text-slate-500 mt-2">Find all matching pairs of cards.</p>
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
                <div className="w-full h-full flex flex-col">
                    <div className="flex justify-between items-center text-slate-500 font-medium mb-6">
                        <span>Level {level}</span>
                        <div className={`flex items-center gap-1 ${timeLeft < 10 ? 'text-red-500 animate-pulse' : ''}`}>
                            <Timer size={16} /> {timeLeft}s
                        </div>
                    </div>

                    <div className={`grid gap-3 flex-1 place-content-center w-full`}
                        style={{
                            gridTemplateColumns: `repeat(${gridSize <= 6 ? 2 : gridSize <= 12 ? 3 : 4}, minmax(0, 1fr))`
                        }}>
                        {cards.map((card, index) => (
                            <motion.button
                                key={index}
                                onClick={() => handleCardClick(index)}
                                className={`aspect-square rounded-xl text-3xl flex items-center justify-center shadow-sm transition-all
                                    ${card.isFlipped || card.isMatched ? 'bg-white border-2 border-indigo-100 rotate-0' : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-transparent'}
                                `}
                                animate={{ rotateY: card.isFlipped || card.isMatched ? 0 : 180 }}
                                transition={{ duration: 0.3 }}
                                disabled={card.isMatched}
                            >
                                {(card.isFlipped || card.isMatched) ? card.emoji : ''}
                            </motion.button>
                        ))}
                    </div>

                    <button onClick={() => setGameState('game-over')} className="mt-6 text-slate-400 text-sm">Give Up</button>
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
                    <div className="text-4xl">🕰️</div>
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
                    <div className="text-6xl">🧠</div>
                    <h2 className="text-3xl font-bold text-slate-800">Memory Master!</h2>
                    <p className="text-slate-500">You completed the memory challenge!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
