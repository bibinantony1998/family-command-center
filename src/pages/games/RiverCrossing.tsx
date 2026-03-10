import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import confetti from 'canvas-confetti';

interface Item { id: string; emoji: string; label: string; }
interface Puzzle {
    title: string;
    items: Item[];
    isIllegal: (side: string[]) => boolean;
    hint: string;
    minMoves: number;
    boatCapacity: number; // max items the farmer can take (not counting farmer)
}

const getPuzzleForLevel = (level: number): Puzzle => {
    const cycle = (level - 1) % 3; // 0 = Food Chain, 1 = Outnumber, 2 = Protect
    const difficultyGroup = Math.floor((level - 1) / 3);

    if (cycle === 0) {
        // Food Chain
        const N = Math.min(7, 3 + difficultyGroup);
        const CHAINS = [
            [], [], [], // N=0,1,2 n/a
            [{ e: '🦊', n: 'Fox' }, { e: '🐔', n: 'Chicken' }, { e: '🌾', n: 'Grain' }], // N=3
            [{ e: '🦅', n: 'Hawk' }, { e: '🐍', n: 'Snake' }, { e: '🐭', n: 'Mouse' }, { e: '🧀', n: 'Cheese' }], // N=4
            [{ e: '🐻', n: 'Bear' }, { e: '🐺', n: 'Wolf' }, { e: '🐶', n: 'Dog' }, { e: '🐱', n: 'Cat' }, { e: '🐭', n: 'Mouse' }], // N=5
            [{ e: '🦖', n: 'T-Rex' }, { e: '🐊', n: 'Croc' }, { e: '🦅', n: 'Eagle' }, { e: '🐍', n: 'Snake' }, { e: '🐸', n: 'Frog' }, { e: '🪰', n: 'Fly' }], // N=6
            [{ e: '🐉', n: 'Dragon' }, { e: '🦖', n: 'Rex' }, { e: '🦍', n: 'Kong' }, { e: '🐻', n: 'Bear' }, { e: '🐺', n: 'Wolf' }, { e: '🐑', n: 'Sheep' }, { e: '🌾', n: 'Grain' }] // N=7
        ];
        const chain = CHAINS[N];

        const items = chain.map((it, i) => ({ id: `i${i}`, emoji: it.e, label: it.n }));
        const cap = Math.floor(N / 2);

        return {
            title: `Food Chain (${N} items)`,
            items,
            isIllegal: (side) => {
                const indices = side.map(id => parseInt(id.substring(1))).sort((a, b) => a - b);
                for (let i = 0; i < indices.length - 1; i++) {
                    if (indices[i + 1] === indices[i] + 1) return true; // Adjacent found!
                }
                return false;
            },
            hint: `Each item will eat the one directly below it in the chain. Separating them is key!`,
            minMoves: N * 3,
            boatCapacity: cap,
        }
    } else if (cycle === 1) {
        // Outnumber Factions
        const N = 3 + difficultyGroup;
        const THEMES = [
            { a: { e: '😇', n: 'Human' }, b: { e: '🧛', n: 'Vamp' } },
            { a: { e: '🧑‍🚀', n: 'Astro' }, b: { e: '👽', n: 'Alien' } },
            { a: { e: '🧙', n: 'Wiz' }, b: { e: '👹', n: 'Orc' } },
            { a: { e: '🐶', n: 'Dog' }, b: { e: '🐱', n: 'Cat' } },
            { a: { e: '🦸', n: 'Hero' }, b: { e: '🦹', n: 'Vill' } },
            { a: { e: '🧝', n: 'Elf' }, b: { e: '👺', n: 'Gob' } },
        ];
        const theme = THEMES[difficultyGroup % THEMES.length];

        const items = [];
        for (let i = 1; i <= N; i++) {
            items.push({ id: `a${i}`, emoji: theme.a.e, label: `${theme.a.n} ${i}` });
            items.push({ id: `b${i}`, emoji: theme.b.e, label: `${theme.b.n} ${i}` });
        }
        return {
            title: `${N} ${theme.a.n}s & ${theme.b.n}s`,
            items,
            isIllegal: (side) => {
                const aCount = side.filter(x => x.startsWith('a')).length;
                const bCount = side.filter(x => x.startsWith('b')).length;
                return aCount > 0 && bCount > aCount; // B cannot outnumber A if A is present
            },
            hint: `The ${theme.b.n}s (${theme.b.e}) must never outnumber the ${theme.a.n}s (${theme.a.e}) on either side!`,
            minMoves: N * 4 - 1,
            boatCapacity: Math.max(2, N - 1),
        };
    } else {
        // Protect
        const N = 3 + difficultyGroup;
        const THEMES = [
            { p: { e: '👨', n: 'Hus' }, c: { e: '👩', n: 'Wife' } },
            { p: { e: '🛡️', n: 'Kni' }, c: { e: '👑', n: 'Reg' } },
            { p: { e: '🐕', n: 'Dog' }, c: { e: '🐑', n: 'Shp' } },
            { p: { e: '🐧', n: 'Pen' }, c: { e: '🥚', n: 'Egg' } },
            { p: { e: '🦖', n: 'Rex' }, c: { e: '👶', n: 'Bby' } },
            { p: { e: '🦅', n: 'Eag' }, c: { e: '🐥', n: 'Chk' } },
        ];
        const theme = THEMES[difficultyGroup % THEMES.length];

        const items = [];
        for (let i = 1; i <= N; i++) {
            items.push({ id: `p${i}`, emoji: theme.p.e, label: `${theme.p.n} ${i}` });
            items.push({ id: `c${i}`, emoji: theme.c.e, label: `${theme.c.n} ${i}` });
        }
        return {
            title: `${N} Protectors & Wards`,
            items,
            isIllegal: (side) => {
                const protectors = side.filter(x => x.startsWith('p')).map(x => x.substring(1));
                const wards = side.filter(x => x.startsWith('c')).map(x => x.substring(1));
                return wards.some(w => !protectors.includes(w)) && protectors.length > 0;
            },
            hint: `A ${theme.c.n} (${theme.c.e}) cannot be with another ${theme.p.n} (${theme.p.e}) unless their own ${theme.p.n} is present.`,
            minMoves: N * 4 - 3,
            boatCapacity: Math.max(2, N - 1),
        };
    }
};

type Side = 'left' | 'right';

export default function RiverCrossing() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'won' | 'lost'>('intro');
    const [puzzle, setPuzzle] = useState<Puzzle>(getPuzzleForLevel(1));
    const [left, setLeft] = useState<string[]>([]);
    const [right, setRight] = useState<string[]>([]);
    const [boatSide, setBoatSide] = useState<Side>('left');
    const [boatLoad, setBoatLoad] = useState<string[]>([]);
    const [moves, setMoves] = useState(0);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;
        supabase.from('game_scores').select('level').eq('game_id', 'river-crossing').eq('profile_id', profile.id).order('level', { ascending: false }).limit(1)
            .then(({ data }) => { setLevel((data?.[0]?.level || 0) + 1); setIsLoading(false); });
    }, [profile]);

    const startLevel = (lvl: number) => {
        const p = getPuzzleForLevel(lvl);
        setPuzzle(p);
        setLeft(p.items.map(i => i.id));
        setRight([]);
        setBoatSide('left');
        setBoatLoad([]);
        setMoves(0);
        setError('');
        setGameState('playing');
    };

    const toggleBoat = (id: string) => {
        const currentBank = boatSide === 'left' ? left : right;
        if (!currentBank.includes(id) && !boatLoad.includes(id)) return;
        if (boatLoad.includes(id)) { setBoatLoad(bl => bl.filter(x => x !== id)); return; }
        if (boatLoad.length < puzzle.boatCapacity) setBoatLoad(bl => [...bl, id]);
    };

    const row = () => {
        const fromSide = boatSide === 'left' ? left : right;
        const toSide = boatSide === 'left' ? right : left;
        const setFrom = boatSide === 'left' ? setLeft : setRight;
        const setTo = boatSide === 'left' ? setRight : setLeft;

        const newFrom = fromSide.filter(x => !boatLoad.includes(x));
        const newTo = [...toSide, ...boatLoad];

        // Only the FROM side is left without the farmer — check that for danger.
        // The TO side is safe because the farmer arrives there.
        if (puzzle.isIllegal(newFrom)) {
            const bankName = boatSide === 'left' ? 'left' : 'right';
            setError(`💥 You left a dangerous pair alone on the ${bankName} bank without the farmer!`);
            setGameState('lost');
            return;
        }

        setFrom(newFrom);
        setTo(newTo);
        setBoatSide(s => s === 'left' ? 'right' : 'left');
        setBoatLoad([]);
        setError('');
        const newMoves = moves + 1;
        setMoves(newMoves);

        if (newTo.length === puzzle.items.length) {
            const pts = Math.max(1, puzzle.minMoves * 2 - newMoves) * level * 3;
            supabase.from('game_scores').insert({ game_id: 'river-crossing', level, points: pts, profile_id: profile?.id, family_id: profile?.family_id });
            confetti({ particleCount: 120, spread: 70 });
            setGameState('won');
        }
    };

    const bankItem = (id: string) => puzzle.items.find(it => it.id === id)!;
    const pts = Math.max(1, puzzle.minMoves * 2 - moves) * level * 3;

    return (
        <div className="h-full flex flex-col p-4 max-w-xl mx-auto">
            {gameState === 'intro' && (
                <div className="flex-1 flex items-center justify-center">
                    <Card className="text-center p-8 space-y-6 w-full">
                        <div className="text-6xl">⛵</div>
                        <h1 className="text-3xl font-bold text-slate-800">River Crossing</h1>
                        <p className="text-slate-500">Transport everyone safely across the river — without leaving dangerous pairs alone!</p>
                        <div className="bg-slate-50 p-4 rounded-xl text-left text-sm space-y-2">
                            <p>• Click items on a bank to load them onto the boat — capacity varies per puzzle (1 or 2)</p>
                            <p>• The farmer always rides the boat — you can cross with an empty boat too</p>
                            <p>• Click <strong>Row →</strong> to cross</p>
                            <p>• Certain combinations left unsupervised cause trouble!</p>
                        </div>
                        <Button onClick={() => startLevel(level)} disabled={isLoading} className="w-full h-12 text-lg">
                            {isLoading ? 'Loading...' : `Start Level ${level}`}
                        </Button>
                        <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back</button>
                    </Card>
                </div>
            )}

            {gameState === 'playing' && (
                <div className="flex-1 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-600 text-sm">{puzzle.title}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-sm">Moves: {moves}</span>
                            <button onClick={() => startLevel(level)} className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"><RefreshCw size={15} /></button>
                        </div>
                    </div>

                    {/* Scene */}
                    <div className="flex-1 flex gap-3 min-h-0">
                        {/* LEFT BANK */}
                        <div className="flex-1 bg-green-50 rounded-2xl p-3 flex flex-col gap-2 border-2 border-green-100">
                            <p className="text-xs font-bold text-green-700 text-center">🏞 Left Bank</p>
                            <div className="flex flex-col gap-2 flex-1">
                                {left.map(id => {
                                    const it = bankItem(id);
                                    const inBoat = boatLoad.includes(id);
                                    return (
                                        <button key={id} onClick={() => boatSide === 'left' && toggleBoat(id)}
                                            className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all text-left ${inBoat ? 'bg-indigo-100 border-indigo-400' : 'bg-white border-slate-200 hover:border-indigo-300'} ${boatSide !== 'left' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                            <span className="text-2xl">{it.emoji}</span>
                                            <span className="text-xs font-bold text-slate-600">{it.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* RIVER / BOAT */}
                        <div className="w-24 flex flex-col items-center justify-center gap-3">
                            <div className="text-3xl">🌊</div>
                            <div className="bg-blue-100 border-2 border-blue-300 rounded-xl p-2 w-full text-center transition-all">
                                <div className="text-xl">⛵ 👨‍🌾</div>
                                <div className="text-lg leading-none min-h-[1.5rem]">
                                    {boatLoad.map(id => puzzle.items.find(x => x.id === id)?.emoji).join(' ')}
                                </div>
                                <div className="text-xs text-blue-600 font-semibold mt-1">
                                    {boatLoad.length}/{puzzle.boatCapacity} cargo
                                </div>
                            </div>
                            <button onClick={row} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors w-full">
                                {boatSide === 'left' ? 'Row →' : '← Row'}
                            </button>
                        </div>

                        {/* RIGHT BANK */}
                        <div className="flex-1 bg-amber-50 rounded-2xl p-3 flex flex-col gap-2 border-2 border-amber-100">
                            <p className="text-xs font-bold text-amber-700 text-center">🏝 Right Bank</p>
                            <div className="flex flex-col gap-2 flex-1">
                                {right.map(id => {
                                    const it = bankItem(id);
                                    const inBoat = boatLoad.includes(id);
                                    return (
                                        <button key={id} onClick={() => boatSide === 'right' && toggleBoat(id)}
                                            className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all text-left ${inBoat ? 'bg-indigo-100 border-indigo-400' : 'bg-white border-slate-200 hover:border-indigo-300'} ${boatSide !== 'right' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                                            <span className="text-2xl">{it.emoji}</span>
                                            <span className="text-xs font-bold text-slate-600">{it.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm font-medium text-center">{error}</div>}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <p className="text-amber-800 text-xs">💡 {puzzle.hint}</p>
                    </div>
                </div>
            )}

            {gameState === 'won' && (
                <div className="flex-1 flex items-center justify-center">
                    <Card className="text-center p-8 space-y-6 w-full">
                        <div className="text-6xl">⛵🎉</div>
                        <h2 className="text-3xl font-bold text-slate-800">Everyone's Safe!</h2>
                        <p className="text-slate-500">{moves} crossings</p>
                        <p className="text-indigo-600 font-bold text-2xl">+{pts} Points</p>
                        <Button onClick={() => { const nxt = level + 1; setLevel(nxt); startLevel(nxt); }} className="w-full h-12">Next Puzzle</Button>
                        <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back to Games</button>
                    </Card>
                </div>
            )}

            {gameState === 'lost' && (
                <div className="flex-1 flex items-center justify-center">
                    <Card className="text-center p-8 space-y-6 w-full">
                        <div className="text-6xl">💀</div>
                        <h2 className="text-3xl font-bold text-slate-800">Chaos Ensued!</h2>
                        <p className="text-red-500 font-medium">{error}</p>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-amber-800 text-sm">💡 {puzzle.hint}</p>
                        </div>
                        <Button onClick={() => startLevel(level)} className="w-full h-12">Try Again</Button>
                        <button onClick={() => navigate('/games')} className="text-slate-400 text-sm">Back to Games</button>
                    </Card>
                </div>
            )}
        </div>
    );
}
