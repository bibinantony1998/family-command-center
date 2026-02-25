import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X } from 'lucide-react-native';

const SHAPES = ['●', '■', '▲', '◆', '★', '♥'];
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];

function generateGrid(level: number) {
    const gridSize = 16 + (level - 1) * 3, numColors = Math.min(2 + level, 5);
    const tIdx = Math.floor(Math.random() * SHAPES.length), tcIdx = Math.floor(Math.random() * numColors);
    const targetShape = SHAPES[tIdx], targetColor = COLORS[tcIdx];
    const count = 2 + Math.floor(Math.random() * (level + 1));
    const targetIndices = new Set<number>();
    while (targetIndices.size < count) targetIndices.add(Math.floor(Math.random() * gridSize));
    const items = Array.from({ length: gridSize }, (_, i) => {
        if (targetIndices.has(i)) return { shape: targetShape, color: targetColor, isTarget: true };
        const si = Math.floor(Math.random() * SHAPES.length), ci = Math.floor(Math.random() * numColors);
        return { shape: SHAPES[si % SHAPES.length], color: COLORS[ci], isTarget: false };
    });
    return { items, targetShape, targetColor, count };
}

const Q_PER_LEVEL = 5;

export default function VisualSearchScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over'>('intro');
    const [puzzle, setPuzzle] = useState<ReturnType<typeof generateGrid> | null>(null);
    const [found, setFound] = useState<Set<number>>(new Set());
    const [qNum, setQNum] = useState(0);
    const [correct, setCorrect] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => { getHighestLevel('visual-search').then(l => { setLevel(l); setLoading(false); }); }, []);

    const nextQ = (lvl: number, num: number, c: number) => {
        if (num >= Q_PER_LEVEL) {
            if (c >= Math.ceil(Q_PER_LEVEL * 0.8)) { saveScore('visual-search', lvl, lvl * 2); setGameState('level-up'); }
            else setGameState('game-over');
            return;
        }
        setPuzzle(generateGrid(lvl)); setFound(new Set()); setQNum(num);
    };

    const startLevel = (lvl: number) => {
        setLevel(lvl); setCorrect(0); setQNum(0); setPuzzle(generateGrid(lvl)); setFound(new Set()); setGameState('playing');
    };

    const handleTap = (idx: number) => {
        if (!puzzle || found.has(idx)) return;
        if (puzzle.items[idx].isTarget) {
            const nf = new Set(found); nf.add(idx); setFound(nf);
            if (nf.size === puzzle.count) {
                const nc = correct + 1; setCorrect(nc);
                setTimeout(() => nextQ(level, qNum + 1, nc), 500);
            }
        }
    };

    const cols = puzzle ? Math.ceil(Math.sqrt(puzzle.items.length)) : 5;
    const cellW = Math.floor((380 - 40) / cols);

    return (
        <View style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                <Text style={s.levelBadge}>Level {level} • {qNum + 1}/{Q_PER_LEVEL}</Text>
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.big}>👁️</Text>
                    <Text style={s.title}>Visual Search</Text>
                    <Text style={s.subtitle}>Tap all instances of the target shape in the grid!</Text>
                    <Button title={loading ? 'Loading...' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && puzzle && (
                <View style={s.playArea}>
                    <View style={s.targetCard}>
                        <Text style={s.findLabel}>Find all:</Text>
                        <Text style={[s.targetShape, { color: puzzle.targetColor }]}>{puzzle.targetShape}</Text>
                        <Text style={s.foundCount}>{found.size}/{puzzle.count} found</Text>
                    </View>
                    <View style={[s.grid, { flexDirection: 'row', flexWrap: 'wrap' }]}>
                        {puzzle.items.map((item, i) => (
                            <TouchableOpacity key={i} onPress={() => handleTap(i)}
                                style={[s.cell, { width: cellW, height: cellW }, found.has(i) && s.cellFound]}>
                                <Text style={[s.cellText, { color: item.color, fontSize: cellW * 0.5 }]}>{item.shape}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={s.center}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={s.resultTitle}>Eagle Eyes! 👁️</Text>
                    <Text style={s.points}>+{level * 2} Points</Text>
                    <Button title="Next Level" onPress={() => { const next = level + 1; setLevel(next); startLevel(next); }} style={s.btn} />
                </View>
            )}

            {gameState === 'game-over' && (
                <View style={s.center}>
                    <Text style={s.big}>👁️</Text>
                    <Text style={s.resultTitle}>Keep Looking!</Text>
                    <Text style={s.subtitle}>{correct}/{Q_PER_LEVEL} — need 80%</Text>
                    <Button title="Try Again" onPress={() => startLevel(level)} style={s.btn} />
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingTop: 48, paddingHorizontal: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    levelBadge: { fontSize: 14, fontWeight: '700', color: '#64748b' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    big: { fontSize: 64 },
    title: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 12, marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 },
    btn: { width: '100%', marginTop: 8 },
    playArea: { flex: 1 },
    targetCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, marginBottom: 12 },
    findLabel: { fontSize: 14, color: '#64748b' },
    targetShape: { fontSize: 28, fontWeight: '800' },
    foundCount: { fontSize: 13, color: '#94a3b8', marginLeft: 'auto' as any },
    grid: { gap: 3 },
    cell: { borderRadius: 8, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
    cellFound: { backgroundColor: '#dcfce7', borderWidth: 2, borderColor: '#22c55e' },
    cellText: { fontWeight: '700' },
    resultTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 32 },
});
