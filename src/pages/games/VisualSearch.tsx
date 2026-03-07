import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

const ALL_SHAPES = ['●', '■', '▲', '◆', '★', '♥', '⬟', '⬡'];
const COLORS = ['text-red-500', 'text-blue-500', 'text-green-500', 'text-yellow-500', 'text-purple-500', 'text-orange-500', 'text-pink-500', 'text-teal-500'];

function getLevelConfig(level: number) {
    const gridSize = 16 + (level - 1) * 4;
    const numDistractors = Math.min(2 + level, 6);
    const targetCount = 2 + Math.floor(level / 2);
    return { gridSize, numDistractors, targetCount };
}

interface GridItem { shape: string; color: string; }

function generateGrid(level: number): { items: GridItem[], target: string, targetColor: string, targetCount: number } {
    const { gridSize, numDistractors, targetCount } = getLevelConfig(level);
    const targetShape = ALL_SHAPES[Math.floor(Math.random() * ALL_SHAPES.length)];
    const targetColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const distractorShapes = ALL_SHAPES.filter(s => s !== targetShape).slice(0, numDistractors);
    const distractorColors = COLORS.filter(c => c !== targetColor).slice(0, numDistractors);
    // Place targets at unique shuffled positions
    const positions = Array.from({ length: gridSize }, (_, i) => i).sort(() => Math.random() - 0.5);
    const targetIndices = new Set(positions.slice(0, targetCount));
    const items: GridItem[] = [];
    for (let i = 0; i < gridSize; i++) {
        if (targetIndices.has(i)) {
            items.push({ shape: targetShape, color: targetColor });
        } else {
            const s = distractorShapes[Math.floor(Math.random() * distractorShapes.length)];
            const c = distractorColors[Math.floor(Math.random() * distractorColors.length)];
            items.push({ shape: s, color: c });
        }
    }
    return { items, target: targetShape, targetColor, targetCount };
}

const QUESTIONS_PER_LEVEL = 5;

export default function VisualSearch() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over' | 'completed'>('intro');
    const [level, setLevel] = useState(1);
    const [puzzle, setPuzzle] = useState<ReturnType<typeof generateGrid> | null>(null);
    const [found, setFound] = useState<Set<number>>(new Set());
    const [wrongTaps, setWrongTaps] = useState<Set<number>>(new Set());
    const [qNum, setQNum] = useState(0);
    const [correct, setCorrect] = useState(0);
    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        (async () => {
            const { data } = await supabase.from('game_scores').select('level').eq('game_id', 'visual-search').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1);
            const maxLevel = data?.[0]?.level || 0;
            const next = maxLevel + 1;
            setHighestUnlockedLevel(next); setIsLoading(false);
            if (next > 10) setGameState('completed');
        })();
    }, [profile]);

    const nextQuestion = (lvl: number, num: number, c: number) => {
        if (num >= QUESTIONS_PER_LEVEL) {
            if (c >= Math.ceil(QUESTIONS_PER_LEVEL * 0.8)) setGameState('level-up');
            else setGameState('game-over');
            return;
        }
        setPuzzle(generateGrid(lvl)); setFound(new Set()); setWrongTaps(new Set()); setQNum(num);
    };

    const startLevel = (lvl: number) => {
        setLevel(lvl); setCorrect(0); setQNum(0);
        setPuzzle(generateGrid(lvl)); setFound(new Set()); setWrongTaps(new Set()); setGameState('playing');
    };

    const handleTap = (idx: number) => {
        if (!puzzle || found.has(idx) || wrongTaps.has(idx)) return;
        const item = puzzle.items[idx];
        const isMatch = item.shape === puzzle.target && item.color === puzzle.targetColor;
        if (isMatch) {
            const newFound = new Set(found);
            newFound.add(idx);
            setFound(newFound);
            if (newFound.size === puzzle.targetCount) {
                const newCorrect = correct + 1;
                setCorrect(newCorrect);
                confetti({ particleCount: 30, spread: 40, origin: { y: 0.6 } });
                setTimeout(() => nextQuestion(level, qNum + 1, newCorrect), 500);
            }
        } else {
            // Flash red for 600ms on wrong tap
            const nw = new Set(wrongTaps); nw.add(idx); setWrongTaps(nw);
            setTimeout(() => setWrongTaps(prev => { const s = new Set(prev); s.delete(idx); return s; }), 600);
        }
    };

    const saveAndNext = async () => {
        if (profile) {
            await supabase.from('game_scores').insert({ game_id: 'visual-search', level, points: level * 2, profile_id: profile.id, family_id: profile.family_id });
            setHighestUnlockedLevel(level + 1);
        }
        const next = level + 1;
        if (next > 10) { setGameState('completed'); confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); }
        else startLevel(next);
    };

    const cols = puzzle ? Math.ceil(Math.sqrt(puzzle.items.length)) : 5;

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-lg mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mx-auto"><Eye size={40} /></div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Visual Search</h1>
                        <p className="text-slate-500 mt-2">Find all target shapes hidden in the grid!</p>
                    </div>
                    <Button onClick={() => startLevel(highestUnlockedLevel)} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState === 'playing' && puzzle && (
                <div className="w-full space-y-4">
                    <div className="flex justify-between text-slate-500 font-medium">
                        <span>Level {level}</span><span>{qNum + 1}/{QUESTIONS_PER_LEVEL}</span>
                    </div>

                    <Card className="p-3 flex items-center gap-3">
                        <p className="text-sm text-slate-500">Find all:</p>
                        <span className={`text-3xl ${puzzle.targetColor}`}>{puzzle.target}</span>
                        <span className="text-sm text-slate-400">({found.size}/{puzzle.targetCount} found)</span>
                    </Card>

                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4 }}>
                        {puzzle.items.map((item, idx) => (
                            <button key={idx} onClick={() => handleTap(idx)}
                                className={`h-10 rounded-lg flex items-center justify-center text-xl transition-all
                                    ${found.has(idx) ? 'bg-green-100 scale-90 ring-2 ring-green-400' : wrongTaps.has(idx) ? 'bg-red-100 ring-2 ring-red-400' : 'bg-slate-100 active:scale-90'}`}>
                                <span className={item.color}>{item.shape}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {gameState === 'level-up' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto"><Trophy size={40} /></div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Sharp Eyes! 👀</h2>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 2} Points</p>
                    </div>
                    <Button onClick={saveAndNext} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'game-over' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-4xl">👁️</div>
                    <h2 className="text-2xl font-bold text-slate-800">Keep Looking!</h2>
                    <p className="text-slate-500">{correct}/{QUESTIONS_PER_LEVEL} rounds — need 80%</p>
                    <div className="flex gap-4">
                        <Button variant="outline" onClick={() => navigate('/games')} className="flex-1">Exit</Button>
                        <Button onClick={() => startLevel(level)} className="flex-1">Try Again</Button>
                    </div>
                </Card>
            )}

            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">🏆</div>
                    <h2 className="text-3xl font-bold text-slate-800">Eagle-Eyed!</h2>
                    <p className="text-slate-500">You completed all 10 levels!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
