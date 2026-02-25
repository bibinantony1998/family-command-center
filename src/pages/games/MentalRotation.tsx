import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

// Shapes defined as SVG paths (relative commands) — each is a polygon shape
const SHAPES = [
    // L-shape
    'M0,0 L20,0 L20,20 L40,20 L40,40 L0,40 Z',
    // T-shape
    'M0,0 L60,0 L60,20 L40,20 L40,50 L20,50 L20,20 L0,20 Z',
    // Z-shape
    'M0,0 L40,0 L40,20 L60,20 L60,40 L20,40 L20,20 L0,20 Z',
    // Plus-ish
    'M20,0 L40,0 L40,20 L60,20 L60,40 L40,40 L40,60 L20,60 L20,40 L0,40 L0,20 L20,20 Z',
    // Arrow
    'M0,20 L30,0 L30,15 L60,15 L60,25 L30,25 L30,40 Z',
];

function rotatePoint(x: number, y: number, cx: number, cy: number, deg: number) {
    const rad = (deg * Math.PI) / 180;
    return {
        x: Math.cos(rad) * (x - cx) - Math.sin(rad) * (y - cy) + cx,
        y: Math.sin(rad) * (x - cx) + Math.cos(rad) * (y - cy) + cy,
    };
}

function mirrorPath(path: string): string {
    return path.replace(/([ML])(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_m, cmd, x, y) => `${cmd}${60 - parseFloat(x)},${y}`);
}

function rotateSvg(path: string, deg: number): string {
    const cx = 30, cy = 30;
    return path.replace(/([ML])(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_m, cmd, x, y) => {
        const { x: rx, y: ry } = rotatePoint(parseFloat(x), parseFloat(y), cx, cy, deg);
        return `${cmd}${rx.toFixed(1)},${ry.toFixed(1)}`;
    });
}

interface Option { path: string; isMatch: boolean; rotation: number; }

function generateQuestion(level: number): { target: string; options: Option[] } {
    const shapeIdx = Math.floor(Math.random() * SHAPES.length);
    const base = SHAPES[shapeIdx];
    const targetRot = Math.floor(Math.random() * 4) * 90;
    const target = rotateSvg(base, targetRot);

    const rotations = [90, 180, 270].sort(() => Math.random() - 0.5).slice(0, 3);
    const matchIdx = Math.floor(Math.random() * 4);

    const options: Option[] = [];
    let rotIdx = 0;
    for (let i = 0; i < 4; i++) {
        if (i === matchIdx) {
            const r = (targetRot + (level * 37 + 45)) % 360;
            options.push({ path: rotateSvg(base, r), isMatch: true, rotation: r });
        } else {
            if (Math.random() < 0.5) {
                options.push({ path: mirrorPath(rotateSvg(base, rotations[rotIdx % 3])), isMatch: false, rotation: 0 });
            } else {
                const altShape = SHAPES[(shapeIdx + rotIdx + 1) % SHAPES.length];
                options.push({ path: rotateSvg(altShape, rotations[rotIdx % 3]), isMatch: false, rotation: 0 });
            }
            rotIdx++;
        }
    }
    return { target, options };
}

const QUESTIONS_PER_LEVEL = 5;

export default function MentalRotation() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over' | 'completed'>('intro');
    const [level, setLevel] = useState(1);
    const [question, setQuestion] = useState<{ target: string; options: Option[] } | null>(null);
    const [answered, setAnswered] = useState<number | null>(null);
    const [correct, setCorrect] = useState(0);
    const [qNum, setQNum] = useState(0);
    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        (async () => {
            const { data } = await supabase.from('game_scores').select('level').eq('game_id', 'mental-rotation').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1);
            const maxLevel = data?.[0]?.level || 0;
            const next = maxLevel + 1;
            setHighestUnlockedLevel(next);
            setIsLoading(false);
            if (next > 10) setGameState('completed');
        })();
    }, [profile]);

    const nextQuestion = (lvl: number, num: number, c: number) => {
        if (num >= QUESTIONS_PER_LEVEL) {
            if (c >= Math.ceil(QUESTIONS_PER_LEVEL * 0.8)) setGameState('level-up');
            else setGameState('game-over');
            return;
        }
        setQuestion(generateQuestion(lvl));
        setAnswered(null);
        setQNum(num);
    };

    const startLevel = (lvl: number) => {
        setLevel(lvl);
        setCorrect(0);
        setQNum(0);
        setGameState('playing');
        setQuestion(generateQuestion(lvl));
        setAnswered(null);
    };

    const handleAnswer = (idx: number) => {
        if (answered !== null) return;
        setAnswered(idx);
        const isMatch = question!.options[idx].isMatch;
        const newCorrect = correct + (isMatch ? 1 : 0);
        setCorrect(newCorrect);
        setTimeout(() => nextQuestion(level, qNum + 1, newCorrect), 800);
    };

    const saveAndNext = async () => {
        if (profile) {
            await supabase.from('game_scores').insert({ game_id: 'mental-rotation', level, points: level * 2, profile_id: profile.id, family_id: profile.family_id });
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
                    <div className="h-20 w-20 rounded-2xl bg-cyan-100 text-cyan-600 flex items-center justify-center mx-auto">
                        <RotateCcw size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Mental Rotation</h1>
                        <p className="text-slate-500 mt-2">Which shape is a rotation of the target? (Not mirrored!)</p>
                    </div>
                    <Button onClick={() => startLevel(highestUnlockedLevel)} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {gameState === 'playing' && question && (
                <div className="w-full space-y-6">
                    <div className="flex justify-between items-center text-slate-500 font-medium">
                        <span>Level {level}</span>
                        <span>{qNum + 1}/{QUESTIONS_PER_LEVEL}</span>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-4 flex flex-col items-center gap-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Target Shape</p>
                        <svg viewBox="-5 -5 70 70" width="100" height="100">
                            <path d={question.target} fill="#6366f1" />
                        </svg>
                    </div>

                    <p className="text-center text-sm text-slate-500">Which one below is the same shape (rotated)?</p>

                    <div className="grid grid-cols-2 gap-3">
                        {question.options.map((opt, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(idx)}
                                disabled={answered !== null}
                                className={`rounded-2xl p-4 flex items-center justify-center border-2 transition-all
                                    ${answered === null ? 'border-slate-200 bg-white hover:border-indigo-300 active:scale-95' :
                                        answered === idx ? (opt.isMatch ? 'border-green-500 bg-green-50' : 'border-red-400 bg-red-50')
                                            : (opt.isMatch && answered !== null ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-slate-50')
                                    }`}
                            >
                                <svg viewBox="-5 -5 70 70" width="80" height="80">
                                    <path d={opt.path} fill={
                                        answered !== null && opt.isMatch ? '#22c55e' :
                                            answered === idx && !opt.isMatch ? '#ef4444' : '#94a3b8'
                                    } />
                                </svg>
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
                        <h2 className="text-2xl font-bold text-slate-800">Level {level} Complete!</h2>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 2} Points</p>
                        <p className="text-slate-400 text-sm">{correct}/{QUESTIONS_PER_LEVEL} correct</p>
                    </div>
                    <Button onClick={saveAndNext} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'game-over' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-4xl">🔄</div>
                    <h2 className="text-2xl font-bold text-slate-800">Not quite!</h2>
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
                    <h2 className="text-3xl font-bold text-slate-800">Spatial Master!</h2>
                    <p className="text-slate-500">You completed all 10 levels!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
