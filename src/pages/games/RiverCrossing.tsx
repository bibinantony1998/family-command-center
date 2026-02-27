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

const PUZZLES: Puzzle[] = [
    {
        title: 'Farmer, Fox, Chicken & Grain',
        items: [
            { id: 'fox', emoji: '🦊', label: 'Fox' },
            { id: 'chicken', emoji: '🐔', label: 'Chicken' },
            { id: 'grain', emoji: '🌾', label: 'Grain' },
        ],
        isIllegal: (side) =>
            (side.includes('fox') && side.includes('chicken')) ||
            (side.includes('chicken') && side.includes('grain')),
        hint: 'Fox eats chicken; chicken eats grain — never leave a dangerous pair alone!',
        minMoves: 7,
        boatCapacity: 1, // classic rule: farmer + 1 only
    },
    {
        title: 'Missionaries & Cannibals',
        items: [
            { id: 'm1', emoji: '🙏', label: 'Miss 1' },
            { id: 'm2', emoji: '🙏', label: 'Miss 2' },
            { id: 'm3', emoji: '🙏', label: 'Miss 3' },
            { id: 'c1', emoji: '😈', label: 'Cann 1' },
            { id: 'c2', emoji: '😈', label: 'Cann 2' },
            { id: 'c3', emoji: '😈', label: 'Cann 3' },
        ],
        isIllegal: (side) => {
            const m = side.filter(x => x.startsWith('m')).length;
            const c = side.filter(x => x.startsWith('c')).length;
            return m > 0 && c > m;
        },
        hint: 'Cannibals must never outnumber missionaries on either side of the river.',
        minMoves: 11,
        boatCapacity: 2,
    },
    {
        title: 'Jealous Husbands',
        items: [
            { id: 'h1', emoji: '👨', label: 'Husband A' },
            { id: 'w1', emoji: '👩', label: 'Wife A' },
            { id: 'h2', emoji: '🧔', label: 'Husband B' },
            { id: 'w2', emoji: '💁', label: 'Wife B' },
        ],
        isIllegal: (side) =>
            (side.includes('w1') && side.includes('h2') && !side.includes('h1')) ||
            (side.includes('w2') && side.includes('h1') && !side.includes('h2')),
        hint: 'No wife can be alone with another husband without her own husband present.',
        minMoves: 5,
        boatCapacity: 2,
    },
];

type Side = 'left' | 'right';

export default function RiverCrossing() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'won' | 'lost'>('intro');
    const [puzzle, setPuzzle] = useState<Puzzle>(PUZZLES[0]);
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
        const p = PUZZLES[(lvl - 1) % PUZZLES.length];
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
                            <p>• Click items on a bank to load them onto the boat (max 2)</p>
                            <p>• Click <strong>Row →</strong> to cross (you can row empty too)</p>
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
