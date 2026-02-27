import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X } from 'lucide-react-native';

interface Puzzle {
    groups: { theme: string; words: string[]; color: string }[];
}

const PUZZLES: Puzzle[] = [
    {
        groups: [
            { theme: '🐾 Animals', words: ['LION', 'TIGER', 'BEAR', 'WOLF'], color: '#fbbf24' },
            { theme: '🌈 Colors', words: ['RED', 'BLUE', 'GREEN', 'PINK'], color: '#60a5fa' },
            { theme: '🍎 Fruits', words: ['MANGO', 'GRAPE', 'PEACH', 'PLUM'], color: '#34d399' },
            { theme: '🏠 Rooms', words: ['HALL', 'ATTIC', 'PORCH', 'DEN'], color: '#f87171' },
        ],
    },
    {
        groups: [
            { theme: '🌍 Countries', words: ['PERU', 'IRAN', 'FIJI', 'MALI'], color: '#fbbf24' },
            { theme: '🎵 Instruments', words: ['HARP', 'LUTE', 'TUBA', 'OBOE'], color: '#60a5fa' },
            { theme: '⛅ Weather', words: ['HAIL', 'SMOG', 'MIST', 'SLEET'], color: '#34d399' },
            { theme: '🔢 Shapes', words: ['CUBE', 'CONE', 'OVAL', 'RHOMBUS'], color: '#f87171' },
        ],
    },
    {
        groups: [
            { theme: '⚽ Sports', words: ['POLO', 'GOLF', 'JUDO', 'SUMO'], color: '#fbbf24' },
            { theme: '🌊 Ocean', words: ['REEF', 'WAVE', 'TIDE', 'KELP'], color: '#60a5fa' },
            { theme: '🍕 Foods', words: ['PITA', 'TOFU', 'BRIE', 'FETA'], color: '#34d399' },
            { theme: '🎭 Emotions', words: ['RAGE', 'GLEE', 'FEAR', 'ENVY'], color: '#f87171' },
        ],
    },
    {
        groups: [
            { theme: '🌳 Trees', words: ['OAK', 'ELM', 'ASH', 'YEW'], color: '#fbbf24' },
            { theme: '💼 Jobs', words: ['CHEF', 'PILOT', 'NURSE', 'JUDGE'], color: '#60a5fa' },
            { theme: '🎮 Games', words: ['CHESS', 'DARTS', 'BINGO', 'POKER'], color: '#34d399' },
            { theme: '🌸 Flowers', words: ['ROSE', 'LILY', 'IRIS', 'DAHLIA'], color: '#f87171' },
        ],
    },
    {
        groups: [
            { theme: '🦋 Insects', words: ['MOTH', 'FLEA', 'WASP', 'GNAT'], color: '#fbbf24' },
            { theme: '🏔 Landforms', words: ['MESA', 'FJORD', 'DELTA', 'ATOLL'], color: '#60a5fa' },
            { theme: '🎨 Art Styles', words: ['CUBISM', 'GOTHIC', 'BAROQUE', 'REALISM'], color: '#34d399' },
            { theme: '🧪 Elements', words: ['IRON', 'GOLD', 'NEON', 'ZINC'], color: '#f87171' },
        ],
    },
];

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export default function WordConnectionsScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over'>('intro');
    const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
    const [tiles, setTiles] = useState<string[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [solved, setSolved] = useState<number[]>([]);
    const [mistakes, setMistakes] = useState(0);
    const [loading, setLoading] = useState(true);
    const MAX_MISTAKES = 3;

    useEffect(() => {
        getHighestLevel('word-connections').then(l => { setLevel(l); setLoading(false); });
    }, []);

    const startLevel = (lvl: number) => {
        const puz = PUZZLES[(lvl - 1) % PUZZLES.length];
        setPuzzle(puz);
        const allWords = puz.groups.flatMap(g => g.words);
        setTiles(shuffle(allWords));
        setSelected([]);
        setSolved([]);
        setMistakes(0);
        setGameState('playing');
    };

    const toggleSelect = (word: string) => {
        if (selected.includes(word)) {
            setSelected(s => s.filter(w => w !== word));
        } else if (selected.length < 4) {
            setSelected(s => [...s, word]);
        }
    };

    const handleSubmit = () => {
        if (!puzzle || selected.length !== 4) return;
        const groupIdx = puzzle.groups.findIndex(g => g.words.every(w => selected.includes(w)) && selected.every(w => g.words.includes(w)));
        if (groupIdx >= 0 && !solved.includes(groupIdx)) {
            const newSolved = [...solved, groupIdx];
            setSolved(newSolved);
            setSelected([]);
            if (newSolved.length === puzzle.groups.length) {
                saveScore('word-connections', level, (MAX_MISTAKES - mistakes + 1) * level * 3);
                setGameState('level-up');
            }
        } else {
            const newMistakes = mistakes + 1;
            setMistakes(newMistakes);
            setSelected([]);
            if (newMistakes >= MAX_MISTAKES) {
                setGameState('game-over');
            }
        }
    };

    const isTileSolved = (word: string) => puzzle?.groups.some((g, i) => solved.includes(i) && g.words.includes(word));
    const getSolvedColor = (word: string) => puzzle?.groups.find((g, i) => solved.includes(i) && g.words.includes(word))?.color;

    return (
        <View style={[s.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}>
                    <X size={24} color="#64748b" />
                </TouchableOpacity>
                {gameState === 'playing' && <Text style={s.levelBadge}>Level {level} • Mistakes: {mistakes}/{MAX_MISTAKES}</Text>}
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.emoji}>🔗</Text>
                    <Text style={s.title}>Word Connections</Text>
                    <Text style={s.subtitle}>Group 16 words into 4 themed categories of 4.</Text>
                    <View style={s.rulesBox}>
                        <Text style={s.ruleText}>• Select 4 words that share a theme</Text>
                        <Text style={s.ruleText}>• Tap Submit to check your group</Text>
                        <Text style={s.ruleText}>• Only {MAX_MISTAKES} mistakes allowed</Text>
                        <Text style={s.ruleText}>• Color reveals solved groups</Text>
                    </View>
                    <Button title={loading ? 'Loading…' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && puzzle && (
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Solved groups */}
                    {solved.map(idx => (
                        <View key={idx} style={[s.solvedGroup, { backgroundColor: puzzle.groups[idx].color }]}>
                            <Text style={s.solvedTheme}>{puzzle.groups[idx].theme}</Text>
                            <Text style={s.solvedWords}>{puzzle.groups[idx].words.join(', ')}</Text>
                        </View>
                    ))}

                    {/* Tiles */}
                    <View style={s.grid}>
                        {tiles.filter(w => !isTileSolved(w)).map(word => {
                            const isSelected = selected.includes(word);
                            return (
                                <TouchableOpacity
                                    key={word}
                                    style={[s.tile, isSelected && s.tileSelected]}
                                    onPress={() => toggleSelect(word)}
                                >
                                    <Text style={[s.tileText, isSelected && s.tileTextSelected]}>{word}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Mistake dots */}
                    <View style={s.mistakesRow}>
                        <Text style={s.mistakesLabel}>Mistakes: </Text>
                        {Array.from({ length: MAX_MISTAKES }, (_, i) => (
                            <Text key={i} style={s.dot}>{i < mistakes ? '🔴' : '⚪'}</Text>
                        ))}
                    </View>

                    <Button
                        title={`Submit (${selected.length}/4)`}
                        onPress={handleSubmit}
                        disabled={selected.length !== 4}
                        style={s.btn}
                    />
                    <TouchableOpacity onPress={() => setSelected([])} style={s.clearBtn}>
                        <Text style={s.clearText}>Clear Selection</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

            {gameState === 'level-up' && (
                <View style={s.center}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={s.resultTitle}>Connected! 🎉</Text>
                    <Text style={s.points}>+{(MAX_MISTAKES - mistakes + 1) * level * 3} Points</Text>
                    <Button title="Next Puzzle" onPress={() => { const n = level + 1; setLevel(n); startLevel(n); }} style={s.btn} />
                </View>
            )}

            {gameState === 'game-over' && (
                <View style={s.center}>
                    <Text style={s.emoji}>😓</Text>
                    <Text style={s.resultTitle}>Too many mistakes!</Text>
                    <Button title="Try Again" onPress={() => startLevel(level)} style={s.btn} />
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 44, marginBottom: 8 },
    closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    levelBadge: { fontSize: 13, fontWeight: '700', color: '#64748b' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
    emoji: { fontSize: 64, marginBottom: 12 },
    title: { fontSize: 30, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    rulesBox: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 14, width: '100%', marginBottom: 28, gap: 6 },
    ruleText: { fontSize: 13, color: '#475569', lineHeight: 18 },
    btn: { width: '100%', marginTop: 12 },
    solvedGroup: { borderRadius: 14, padding: 14, marginBottom: 8 },
    solvedTheme: { fontSize: 14, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
    solvedWords: { fontSize: 13, color: '#374151' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    tile: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 2, borderColor: '#e2e8f0' },
    tileSelected: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
    tileText: { fontSize: 13, fontWeight: '700', color: '#334155' },
    tileTextSelected: { color: '#fff' },
    mistakesRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    mistakesLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },
    dot: { fontSize: 16, marginLeft: 4 },
    clearBtn: { alignItems: 'center', paddingVertical: 12 },
    clearText: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
    resultTitle: { fontSize: 30, fontWeight: '800', color: '#1e293b', marginTop: 16, marginBottom: 8 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 4, marginBottom: 28 },
});
