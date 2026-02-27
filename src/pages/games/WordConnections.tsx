import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

const PUZZLES = [
    {
        groups: [
            { theme: '🐾 Animals', words: ['LION', 'TIGER', 'BEAR', 'WOLF'], color: 'bg-amber-200 border-amber-400' },
            { theme: '🌈 Colors', words: ['RED', 'BLUE', 'GREEN', 'PINK'], color: 'bg-blue-200 border-blue-400' },
            { theme: '🍎 Fruits', words: ['MANGO', 'GRAPE', 'PEACH', 'PLUM'], color: 'bg-green-200 border-green-400' },
            { theme: '🏠 Rooms', words: ['HALL', 'ATTIC', 'PORCH', 'DEN'], color: 'bg-rose-200 border-rose-400' },
        ]
    },
    {
        groups: [
            { theme: '🌍 Countries', words: ['PERU', 'IRAN', 'FIJI', 'MALI'], color: 'bg-amber-200 border-amber-400' },
            { theme: '🎵 Instruments', words: ['HARP', 'LUTE', 'TUBA', 'OBOE'], color: 'bg-blue-200 border-blue-400' },
            { theme: '⛅ Weather', words: ['HAIL', 'SMOG', 'MIST', 'SLEET'], color: 'bg-green-200 border-green-400' },
            { theme: '🔢 Shapes', words: ['CUBE', 'CONE', 'OVAL', 'RHOMBUS'], color: 'bg-rose-200 border-rose-400' },
        ]
    },
    {
        groups: [
            { theme: '⚽ Sports', words: ['POLO', 'GOLF', 'JUDO', 'SUMO'], color: 'bg-amber-200 border-amber-400' },
            { theme: '🌊 Ocean', words: ['REEF', 'WAVE', 'TIDE', 'KELP'], color: 'bg-blue-200 border-blue-400' },
            { theme: '🍕 Foods', words: ['PITA', 'TOFU', 'BRIE', 'FETA'], color: 'bg-green-200 border-green-400' },
            { theme: '🎭 Emotions', words: ['RAGE', 'GLEE', 'FEAR', 'ENVY'], color: 'bg-rose-200 border-rose-400' },
        ]
    },
    {
        groups: [
            { theme: '🌳 Trees', words: ['OAK', 'ELM', 'ASH', 'YEW'], color: 'bg-amber-200 border-amber-400' },
            { theme: '💼 Jobs', words: ['CHEF', 'PILOT', 'NURSE', 'JUDGE'], color: 'bg-blue-200 border-blue-400' },
            { theme: '🎮 Games', words: ['CHESS', 'DARTS', 'BINGO', 'POKER'], color: 'bg-green-200 border-green-400' },
            { theme: '🌸 Flowers', words: ['ROSE', 'LILY', 'IRIS', 'DAHLIA'], color: 'bg-rose-200 border-rose-400' },
        ]
    },
    {
        groups: [
            { theme: '🦋 Insects', words: ['MOTH', 'FLEA', 'WASP', 'GNAT'], color: 'bg-amber-200 border-amber-400' },
            { theme: '🏔 Landforms', words: ['MESA', 'FJORD', 'DELTA', 'ATOLL'], color: 'bg-blue-200 border-blue-400' },
            { theme: '🎨 Art Styles', words: ['CUBISM', 'GOTHIC', 'BAROQUE', 'REALISM'], color: 'bg-green-200 border-green-400' },
            { theme: '🧪 Elements', words: ['IRON', 'GOLD', 'NEON', 'ZINC'], color: 'bg-rose-200 border-rose-400' },
        ]
    },
];

function shuffle<T>(arr: T[]): T[] { return [...arr].sort(() => Math.random() - 0.5); }

export default function WordConnections() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'won' | 'lost'>('intro');
    const [puzzle, setPuzzle] = useState(PUZZLES[0]);
    const [tiles, setTiles] = useState<string[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [solved, setSolved] = useState<number[]>([]);
    const [mistakes, setMistakes] = useState(0);
    const [shake, setShake] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const MAX_MISTAKES = 4;

    useEffect(() => {
        if (!profile) return;
        supabase.from('game_scores').select('level').eq('game_id', 'word-connections').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1)
            .then(({ data }) => { setLevel((data?.[0]?.level || 0) + 1); setIsLoading(false); });
    }, [profile]);

    const startLevel = (lvl: number) => {
        const puz = PUZZLES[(lvl - 1) % PUZZLES.length];
        setPuzzle(puz); setTiles(shuffle(puz.groups.flatMap(g => g.words)));
        setSelected([]); setSolved([]); setMistakes(0); setGameState('playing');
    };

    const toggle = (word: string) => {
        if (selected.includes(word)) setSelected(s => s.filter(w => w !== word));
        else if (selected.length < 4) setSelected(s => [...s, word]);
    };

    const submit = () => {
        const gi = puzzle.groups.findIndex(g => g.words.every(w => selected.includes(w)) && selected.every(w => g.words.includes(w)));
        if (gi >= 0 && !solved.includes(gi)) {
            const ns = [...solved, gi]; setSolved(ns); setSelected([]);
            if (ns.length === puzzle.groups.length) {
                const pts = (MAX_MISTAKES - mistakes + 1) * level * 3;
                supabase.from('game_scores').insert({ game_id: 'word-connections', level, points: pts, profile_id: profile?.id, family_id: profile?.family_id });
                confetti({ particleCount: 120, spread: 70 }); setGameState('won');
            }
        } else {
            setMistakes(m => m + 1); setSelected([]); setShake(true);
            setTimeout(() => setShake(false), 600);
            if (mistakes + 1 >= MAX_MISTAKES) setGameState('lost');
        }
    };

    const isSolved = (w: string) => puzzle.groups.some((g, i) => solved.includes(i) && g.words.includes(w));

    return (
        <div className="h-full flex flex-col items-center justify-start p-4 max-w-lg mx-auto pt-6">
            {gameState === 'intro' && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <div className="text-6xl">🔗</div>
                    <h1 className="text-3xl font-bold text-slate-800">Word Connections</h1>
                    <p className="text-slate-500">Group 16 words into 4 themed categories of 4.</p>
                    <div className="bg-slate-50 p-4 rounded-xl text-left text-sm space-y-2">
                        <p>• Select 4 words that share a theme</p>
                        <p>• Click Submit to check your group</p>
                        <p>• {MAX_MISTAKES} mistakes allowed</p>
                    </div>
                    <Button onClick={() => startLevel(level)} disabled={isLoading} className="w-full h-12 text-lg">
                        {isLoading ? 'Loading...' : `Start Level ${level}`}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back</button>
                </Card>
            )}

            {gameState === 'playing' && (
                <div className="w-full space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-600 font-semibold">Level {level}</span>
                        <div className="flex gap-1">{Array.from({ length: MAX_MISTAKES }, (_, i) => <span key={i} className="text-lg">{i < mistakes ? '🔴' : '⚪'}</span>)}</div>
                    </div>

                    {solved.map(idx => (
                        <div key={idx} className={`rounded-xl p-3 border-2 ${puzzle.groups[idx].color}`}>
                            <p className="font-bold text-slate-800 text-sm">{puzzle.groups[idx].theme}</p>
                            <p className="text-slate-600 text-sm">{puzzle.groups[idx].words.join(', ')}</p>
                        </div>
                    ))}

                    <div className={`grid grid-cols-4 gap-2 ${shake ? 'animate-[wiggle_0.3s_ease-in-out]' : ''}`}>
                        {tiles.filter(w => !isSolved(w)).map(word => (
                            <button key={word} onClick={() => toggle(word)}
                                className={`py-3 px-1 rounded-xl text-xs font-bold text-center transition-all border-2
                                    ${selected.includes(word) ? 'bg-indigo-600 text-white border-indigo-700 scale-95' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'}`}>
                                {word}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setSelected([])} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-medium text-sm hover:bg-slate-50">Clear</button>
                        <Button onClick={submit} disabled={selected.length !== 4} className="flex-2 py-2.5 px-6">Submit ({selected.length}/4)</Button>
                    </div>
                </div>
            )}

            {(gameState === 'won' || gameState === 'lost') && (
                <Card className="text-center p-8 space-y-6 w-full">
                    <div className="text-6xl">{gameState === 'won' ? '🏆' : '😓'}</div>
                    <h2 className="text-3xl font-bold text-slate-800">{gameState === 'won' ? 'Connected!' : 'Too Many Mistakes!'}</h2>
                    {gameState === 'won' && <p className="text-indigo-600 font-bold text-xl">+{(MAX_MISTAKES - mistakes + 1) * level * 3} Points</p>}
                    <Button onClick={() => { const n = level + (gameState === 'won' ? 1 : 0); setLevel(n); startLevel(n); }} className="w-full h-12">
                        {gameState === 'won' ? 'Next Puzzle' : 'Try Again'}
                    </Button>
                    <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back to Games</button>
                </Card>
            )}
        </div>
    );
}
