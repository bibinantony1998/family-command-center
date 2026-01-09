import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Calculator, Play, Layers, Zap, Palette, Brain, Gamepad2, Type, Timer, Grid3X3, Binary, Hammer, LayoutGrid } from 'lucide-react';

interface Game {
    id: string;
    title: string;
    description: string;
    icon: typeof Calculator;
    color: string;
    textColor: string;
    bgColor: string;
    path: string;
    comingSoon?: boolean;
}

const GAMES: Game[] = [
    {
        id: 'quick-math',
        title: 'Quick Math',
        description: 'Race against time to solve arithmetic problems!',
        icon: Calculator,
        color: 'from-blue-500 to-cyan-500',
        textColor: 'text-blue-600',
        bgColor: 'bg-blue-100',
        path: '/games/quick-math'
    },
    {
        id: 'memory-match',
        title: 'Memory Match',
        description: 'Find matching pairs of cards before time runs out.',
        icon: Brain,
        color: 'from-violet-500 to-purple-500',
        textColor: 'text-purple-600',
        bgColor: 'bg-purple-100',
        path: '/games/memory-match'
    },
    {
        id: 'water-jugs',
        title: 'Water Jugs',
        description: 'Pour water between jugs to measure exact amounts.',
        icon: Gamepad2,
        color: 'from-emerald-500 to-teal-500',
        textColor: 'text-teal-600',
        bgColor: 'bg-teal-100',
        path: '/games/water-jugs'
    },
    {
        id: 'tower-hanoi',
        title: 'Tower of Hanoi',
        description: 'Move the stack of disks to the last rod.',
        icon: Layers,
        color: 'from-orange-500 to-amber-500',
        textColor: 'text-orange-600',
        bgColor: 'bg-orange-100',
        path: '/games/tower-hanoi'
    },
    {
        id: 'simon-says',
        title: 'Simon Says',
        description: 'Repeat the sequence of lights and sounds.',
        icon: Zap,
        color: 'from-indigo-500 to-blue-500',
        textColor: 'text-blue-600',
        bgColor: 'bg-indigo-100',
        path: '/games/simon-says'
    },
    {
        id: 'color-chaos',
        title: 'Color Chaos',
        description: 'Tap the color of the text, not the word!',
        icon: Palette,
        color: 'from-pink-500 to-rose-500',
        textColor: 'text-pink-600',
        bgColor: 'bg-pink-100',
        path: '/games/color-chaos'
    },
    {
        id: 'word-scramble',
        title: 'Word Scramble',
        description: 'Unscramble letters to find the word.',
        icon: Type,
        color: 'from-orange-500 to-red-500',
        textColor: 'text-orange-600',
        bgColor: 'bg-orange-100',
        path: '/games/word-scramble'
    },
    {
        id: 'reflex-challenge',
        title: 'Reflex Challenge',
        description: 'Test your pure reaction speed.',
        icon: Timer,
        color: 'from-red-500 to-rose-500',
        textColor: 'text-red-600',
        bgColor: 'bg-red-100',
        path: '/games/reflex-challenge'
    },
    {
        id: 'pattern-memory',
        title: 'Pattern Memory',
        description: 'Memorize and recreate the grid pattern.',
        icon: Grid3X3,
        color: 'from-violet-500 to-fuchsia-500',
        textColor: 'text-violet-600',
        bgColor: 'bg-violet-100',
        path: '/games/pattern-memory'
    },
    {
        id: 'schulte-table',
        title: 'Schulte Table',
        description: 'Find numbers 1-25 in order as fast as possible.',
        icon: LayoutGrid,
        color: 'from-amber-500 to-orange-500',
        textColor: 'text-amber-600',
        bgColor: 'bg-amber-100',
        path: '/games/schulte-table'
    },
    {
        id: 'number-memory',
        title: 'Number Memory',
        description: 'Memorize the number before it disappears.',
        icon: Binary,
        color: 'from-cyan-500 to-blue-500',
        textColor: 'text-cyan-600',
        bgColor: 'bg-cyan-100',
        path: '/games/number-memory'
    },
    {
        id: 'whack-a-mole',
        title: 'Whack-a-Mole',
        description: 'Tap the moles before they vanish!',
        icon: Hammer,
        color: 'from-orange-700 to-amber-700',
        textColor: 'text-amber-800',
        bgColor: 'bg-amber-100',
        path: '/games/whack-a-mole'
    }
];

export default function Games() {
    const navigate = useNavigate();

    return (
        <div className="space-y-6 pb-24">
            <header>
                <h1 className="text-3xl font-bold text-slate-800">Brain Games</h1>
                <p className="text-slate-500">Sharpen your mind and earn points!</p>
            </header>

            <div className="grid gap-4">
                {GAMES.map((game) => (
                    <Card key={game.id} className="relative overflow-hidden group">
                        <div className="flex gap-4">
                            <div className={`h-16 w-16 rounded-2xl ${game.bgColor} ${game.textColor} flex items-center justify-center shrink-0`}>
                                <game.icon size={32} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-800">{game.title}</h3>
                                <p className="text-sm text-slate-500 leading-snug mb-3">{game.description}</p>

                                {game.comingSoon ? (
                                    <span className="inline-block px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full">
                                        Coming Soon
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => navigate(`/games/${game.id}`)}
                                        className={`px-4 py-2 rounded-lg bg-gradient-to-r ${game.color} text-white text-sm font-bold shadow-md active:scale-95 transition-all flex items-center gap-2`}
                                    >
                                        <Play size={16} fill="currentColor" /> Play Now
                                    </button>
                                )}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
