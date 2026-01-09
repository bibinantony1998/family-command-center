import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Trophy, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

const COLORS = [
    { id: 0, color: 'bg-green-500', active: 'bg-green-300', sound: 261.63 }, // C4
    { id: 1, color: 'bg-red-500', active: 'bg-red-300', sound: 329.63 },   // E4
    { id: 2, color: 'bg-yellow-400', active: 'bg-yellow-200', sound: 392.00 }, // G4
    { id: 3, color: 'bg-blue-500', active: 'bg-blue-300', sound: 523.25 }  // C5
];

export default function SimonSays() {
    const navigate = useNavigate();
    const { profile } = useAuth();

    // Audio Context
    const audioCtxRef = useRef<AudioContext | null>(null);

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'demo' | 'playing' | 'level-up' | 'game-over' | 'completed'>('intro');
    const [sequence, setSequence] = useState<number[]>([]);
    const [userStep, setUserStep] = useState(0);
    const [activeColor, setActiveColor] = useState<number | null>(null);
    const [message, setMessage] = useState('');

    const [highestUnlockedLevel, setHighestUnlockedLevel] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        const fetchProgress = async () => {
            const { data } = await supabase
                .from('game_scores')
                .select('level')
                .eq('game_id', 'simon-says')
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

    const playTone = (freq: number) => {
        if (!audioCtxRef.current) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            audioCtxRef.current = new AudioContext();
        }
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtxRef.current.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtxRef.current.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        osc.start();
        osc.stop(audioCtxRef.current.currentTime + 0.5);
    };

    const activateColor = async (idx: number) => {
        setActiveColor(idx);
        playTone(COLORS[idx].sound);
        await new Promise(r => setTimeout(r, 300));
        setActiveColor(null);
    };

    const playSequence = async (seq: number[]) => {
        setGameState('demo');
        setMessage('Watch carefully...');
        await new Promise(r => setTimeout(r, 800));

        for (const idx of seq) {
            await activateColor(idx);
            await new Promise(r => setTimeout(r, 200 + Math.max(0, 500 - (level * 30)))); // Get faster
        }

        setGameState('playing');
        setMessage('Your turn!');
    };

    const startLevel = (lvl: number) => {
        // Sequence length = lvl + 2 (Level 1 = 3 steps)
        const length = lvl + 2;
        const newSeq = Array.from({ length }, () => Math.floor(Math.random() * 4));
        setSequence(newSeq);
        setUserStep(0);
        playSequence(newSeq);
    };

    const startGame = () => {
        if (highestUnlockedLevel > 10) return;
        setLevel(highestUnlockedLevel);
        startLevel(highestUnlockedLevel);
    };

    const handleColorClick = async (idx: number) => {
        if (gameState !== 'playing') return;

        activateColor(idx);

        if (idx === sequence[userStep]) {
            // Correct
            if (userStep + 1 === sequence.length) {
                // Completed Sequence
                setGameState('level-up');

                if (!profile) return;

                const pointsEarned = level * 2;
                await supabase.from('game_scores').insert({
                    game_id: 'simon-says',
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

            } else {
                setUserStep(s => s + 1);
            }
        } else {
            // Wrong
            setGameState('game-over');
        }
    };

    const nextLevel = () => {
        const next = level + 1;
        setLevel(next);
        startLevel(next);
    };

    const retryLevel = () => {
        startLevel(level);
    };

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 max-w-md mx-auto">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                        <Zap size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Simon Says</h1>
                        <p className="text-slate-500 mt-2">Memorize and repeat the sequence.</p>
                    </div>
                    <Button onClick={startGame} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${highestUnlockedLevel}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm font-medium">Back</button>
                </Card>
            )}

            {(gameState === 'playing' || gameState === 'demo' || gameState === 'game-over') && (
                <div className="flex flex-col items-center space-y-8">
                    <div className="flex justify-between w-full text-slate-500 font-medium">
                        <span>Level {level}</span>
                        <span>Lenght: {sequence.length}</span>
                    </div>

                    <h2 className={`text-xl font-bold h-8 transition-colors ${gameState === 'game-over' ? 'text-red-500' : 'text-slate-700'}`}>
                        {gameState === 'game-over' ? 'Wrong Pattern!' : message}
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                        {COLORS.map((btn, idx) => (
                            <button
                                key={idx}
                                className={`w-32 h-32 rounded-3xl shadow-lg transition-all duration-100 active:scale-95
                                    ${activeColor === idx ? btn.active + ' scale-105 ring-4 ring-offset-4 ring-white shadow-xl' : btn.color}
                                `}
                                onClick={() => handleColorClick(idx)}
                                disabled={gameState === 'demo'}
                            />
                        ))}
                    </div>

                    {gameState === 'game-over' && (
                        <div className="mt-8 flex gap-4 w-full">
                            <Button variant="outline" onClick={() => navigate('/games')} className="flex-1">Exit</Button>
                            <Button onClick={retryLevel} className="flex-1">Try Again</Button>
                        </div>
                    )}
                </div>
            )}

            {gameState === 'level-up' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                        <Trophy size={40} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Sequence Correct!</h2>
                        <p className="text-indigo-600 font-bold text-lg mt-2">+{level * 2} Points</p>
                    </div>
                    <Button onClick={nextLevel} className="w-full h-12">Next Level</Button>
                </Card>
            )}

            {gameState === 'completed' && (
                <Card className="text-center p-8 space-y-6">
                    <div className="text-6xl">🤖</div>
                    <h2 className="text-3xl font-bold text-slate-800">Super Memory!</h2>
                    <p className="text-slate-500">You completed the memory challenge!</p>
                    <Button onClick={() => navigate('/games')} className="w-full">Back to Games</Button>
                </Card>
            )}
        </div>
    );
}
