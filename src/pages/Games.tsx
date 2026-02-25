import { useNavigate } from 'react-router-dom';
import {
    Calculator, Play, Layers, Zap, Palette, Brain, Gamepad2, Type, Timer,
    Grid3X3, Binary, Hammer, LayoutGrid, FlaskConical, RotateCcw, MapPin,
    Hash, BrainCircuit, Eye, Shuffle, GitFork
} from 'lucide-react';

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

interface Category {
    label: string;
    emoji: string;
    games: Game[];
}

const CATEGORIES: Category[] = [
    {
        label: 'Memory',
        emoji: '🧠',
        games: [
            { id: 'memory-match', title: 'Memory Match', description: 'Find matching pairs of cards.', icon: Brain, color: 'from-violet-500 to-purple-500', textColor: 'text-purple-600', bgColor: 'bg-purple-100', path: '/games/memory-match' },
            { id: 'simon-says', title: 'Simon Says', description: 'Repeat the sequence of lights.', icon: Zap, color: 'from-indigo-500 to-blue-500', textColor: 'text-blue-600', bgColor: 'bg-indigo-100', path: '/games/simon-says' },
            { id: 'pattern-memory', title: 'Pattern Memory', description: 'Memorize and recreate the grid pattern.', icon: Grid3X3, color: 'from-violet-500 to-fuchsia-500', textColor: 'text-violet-600', bgColor: 'bg-violet-100', path: '/games/pattern-memory' },
            { id: 'number-memory', title: 'Number Memory', description: 'Memorize the number before it disappears.', icon: Binary, color: 'from-cyan-500 to-blue-500', textColor: 'text-cyan-600', bgColor: 'bg-cyan-100', path: '/games/number-memory' },
            { id: 'n-back', title: 'N-Back', description: 'Match the stimulus from N steps ago.', icon: BrainCircuit, color: 'from-violet-600 to-indigo-600', textColor: 'text-violet-600', bgColor: 'bg-violet-100', path: '/games/n-back' },
        ]
    },
    {
        label: 'Problem Solving',
        emoji: '🧩',
        games: [
            { id: 'quick-math', title: 'Quick Math', description: 'Race against time to solve arithmetic!', icon: Calculator, color: 'from-blue-500 to-cyan-500', textColor: 'text-blue-600', bgColor: 'bg-blue-100', path: '/games/quick-math' },
            { id: 'water-jugs', title: 'Water Jugs', description: 'Pour water to measure exact amounts.', icon: Gamepad2, color: 'from-emerald-500 to-teal-500', textColor: 'text-teal-600', bgColor: 'bg-teal-100', path: '/games/water-jugs' },
            { id: 'tower-hanoi', title: 'Tower of Hanoi', description: 'Move the stack of disks to the last rod.', icon: Layers, color: 'from-orange-500 to-amber-500', textColor: 'text-orange-600', bgColor: 'bg-orange-100', path: '/games/tower-hanoi' },
            { id: 'ball-sort', title: 'Ball Sort', description: 'Sort colored balls into matching tubes.', icon: FlaskConical, color: 'from-purple-500 to-pink-500', textColor: 'text-purple-600', bgColor: 'bg-purple-100', path: '/games/ball-sort' },
            { id: 'number-sequence', title: 'Number Sequence', description: 'Find the pattern — what comes next?', icon: Hash, color: 'from-emerald-500 to-green-500', textColor: 'text-emerald-600', bgColor: 'bg-emerald-100', path: '/games/number-sequence' },
            { id: 'pathway-maze', title: 'Pathway Maze', description: 'Navigate from start to the goal!', icon: MapPin, color: 'from-teal-500 to-cyan-500', textColor: 'text-teal-600', bgColor: 'bg-teal-100', path: '/games/pathway-maze' },
        ]
    },
    {
        label: 'Attention & Speed',
        emoji: '⚡',
        games: [
            { id: 'reflex-challenge', title: 'Reflex Challenge', description: 'Test your pure reaction speed.', icon: Timer, color: 'from-red-500 to-rose-500', textColor: 'text-red-600', bgColor: 'bg-red-100', path: '/games/reflex-challenge' },
            { id: 'schulte-table', title: 'Schulte Table', description: 'Find 1–25 in order as fast as possible.', icon: LayoutGrid, color: 'from-amber-500 to-orange-500', textColor: 'text-amber-600', bgColor: 'bg-amber-100', path: '/games/schulte-table' },
            { id: 'whack-a-mole', title: 'Whack-a-Mole', description: 'Tap the moles before they vanish!', icon: Hammer, color: 'from-orange-700 to-amber-700', textColor: 'text-amber-800', bgColor: 'bg-amber-100', path: '/games/whack-a-mole' },
            { id: 'visual-search', title: 'Visual Search', description: 'Find all target shapes in the grid.', icon: Eye, color: 'from-sky-500 to-blue-500', textColor: 'text-sky-600', bgColor: 'bg-sky-100', path: '/games/visual-search' },
            { id: 'trail-making', title: 'Trail Making', description: 'Connect numbered dots in order, fast!', icon: GitFork, color: 'from-fuchsia-500 to-purple-500', textColor: 'text-fuchsia-600', bgColor: 'bg-fuchsia-100', path: '/games/trail-making' },
            { id: 'dual-task', title: 'Dual Task', description: 'Solve math and count shapes at once!', icon: BrainCircuit, color: 'from-rose-500 to-pink-500', textColor: 'text-rose-600', bgColor: 'bg-rose-100', path: '/games/dual-task' },
        ]
    },
    {
        label: 'Verbal',
        emoji: '📝',
        games: [
            { id: 'word-scramble', title: 'Word Scramble', description: 'Unscramble letters to find the word.', icon: Type, color: 'from-orange-500 to-red-500', textColor: 'text-orange-600', bgColor: 'bg-orange-100', path: '/games/word-scramble' },
            { id: 'anagram-solver', title: 'Anagram Solver', description: 'Tap letters in order to form the word.', icon: Shuffle, color: 'from-amber-500 to-yellow-400', textColor: 'text-amber-600', bgColor: 'bg-amber-100', path: '/games/anagram-solver' },
        ]
    },
    {
        label: 'Spatial',
        emoji: '🔷',
        games: [
            { id: 'color-chaos', title: 'Color Chaos', description: 'Tap the color of the text, not the word!', icon: Palette, color: 'from-pink-500 to-rose-500', textColor: 'text-pink-600', bgColor: 'bg-pink-100', path: '/games/color-chaos' },
            { id: 'mental-rotation', title: 'Mental Rotation', description: 'Which shape is a rotated match?', icon: RotateCcw, color: 'from-cyan-500 to-teal-500', textColor: 'text-cyan-600', bgColor: 'bg-cyan-100', path: '/games/mental-rotation' },
        ]
    },
];

export default function Games() {
    const navigate = useNavigate();
    const totalGames = CATEGORIES.reduce((sum, c) => sum + c.games.length, 0);

    return (
        <div className="space-y-6 pb-24">
            <header>
                <h1 className="text-3xl font-bold text-slate-800">Brain Games</h1>
                <p className="text-slate-500">{totalGames} games to sharpen your mind & earn points!</p>
            </header>

            {CATEGORIES.map((cat) => (
                <section key={cat.label} className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{cat.emoji}</span>
                        <h2 className="text-base font-bold text-slate-700">{cat.label}</h2>
                        <span className="text-xs text-slate-400 font-medium">{cat.games.length} games</span>
                    </div>

                    <div className="grid gap-3">
                        {cat.games.map((game) => (
                            <div key={game.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex gap-4 items-center">
                                <div className={`h-14 w-14 rounded-2xl ${game.bgColor} ${game.textColor} flex items-center justify-center shrink-0`}>
                                    <game.icon size={26} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-bold text-slate-800 leading-tight">{game.title}</h3>
                                    <p className="text-xs text-slate-400 leading-snug mt-0.5 line-clamp-2">{game.description}</p>
                                </div>
                                {game.comingSoon ? (
                                    <span className="shrink-0 px-3 py-1 bg-slate-100 text-slate-400 text-xs font-bold rounded-full">Soon</span>
                                ) : (
                                    <button
                                        onClick={() => navigate(game.path)}
                                        className={`shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r ${game.color} text-white text-sm font-bold shadow active:scale-95 transition-all flex items-center gap-1.5`}
                                    >
                                        <Play size={13} fill="currentColor" /> Play
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
