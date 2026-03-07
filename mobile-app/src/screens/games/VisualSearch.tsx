import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X } from 'lucide-react-native';

const SHAPES = ['●', '■', '▲', '◆', '★', '⬟'];
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];
const { width: SW } = Dimensions.get('window');

function generateGrid(level: number) {
    const gridSize = 16 + (level - 1) * 3, numColors = Math.min(2 + level, 5);
    const tIdx = Math.floor(Math.random() * SHAPES.length), tcIdx = Math.floor(Math.random() * numColors);
    const targetShape = SHAPES[tIdx], targetColor = COLORS[tcIdx];
    const count = 2 + Math.floor(Math.random() * (level + 1));
    // Pick unique positions for targets
    const positions = Array.from({ length: gridSize }, (_, i) => i).sort(() => Math.random() - 0.5);
    const targetIndices = new Set(positions.slice(0, count));
    // Build non-target pool: all (shape, color) combos except the target combo
    const pool: { shape: string; color: string }[] = [];
    for (let s = 0; s < SHAPES.length; s++) {
        for (let c = 0; c < numColors; c++) {
            if (!(SHAPES[s] === targetShape && COLORS[c] === targetColor)) {
                pool.push({ shape: SHAPES[s], color: COLORS[c] });
            }
        }
    }
    const items = Array.from({ length: gridSize }, (_, i) => {
        if (targetIndices.has(i)) return { shape: targetShape, color: targetColor };
        return { ...pool[Math.floor(Math.random() * pool.length)] };
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
    const [wrongTaps, setWrongTaps] = useState<Set<number>>(new Set());
    const [qNum, setQNum] = useState(0);
    const [correct, setCorrect] = useState(0);
    const [loading, setLoading] = useState(true);
    const wrongTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

    useEffect(() => { getHighestLevel('visual-search').then(l => { setLevel(l); setLoading(false); }); }, []);

    // Cleanup timers on unmount
    useEffect(() => () => { wrongTimers.current.forEach(t => clearTimeout(t)); }, []);

    const nextQ = (lvl: number, num: number, c: number) => {
        if (num >= Q_PER_LEVEL) {
            if (c >= Math.ceil(Q_PER_LEVEL * 0.8)) { saveScore('visual-search', lvl, lvl * 2); setGameState('level-up'); }
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
        // Always compute match dynamically — never rely on a pre-computed flag
        const item = puzzle.items[idx];
        const isMatch = item.shape === puzzle.targetShape && item.color === puzzle.targetColor;
        if (isMatch) {
            const nf = new Set(found); nf.add(idx); setFound(nf);
            if (nf.size === puzzle.count) {
                const nc = correct + 1; setCorrect(nc);
                setTimeout(() => nextQ(level, qNum + 1, nc), 600);
            }
        } else {
            // Flash red on wrong tap
            const nw = new Set(wrongTaps); nw.add(idx); setWrongTaps(nw);
            const t = setTimeout(() => {
                setWrongTaps(prev => { const s = new Set(prev); s.delete(idx); return s; });
                wrongTimers.current.delete(idx);
            }, 600);
            wrongTimers.current.set(idx, t);
        }
    };

    const cols = puzzle ? Math.ceil(Math.sqrt(puzzle.items.length)) : 5;
    const gap = 4;
    const cellW = Math.floor((SW - 40 - gap * cols) / cols);

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
                    <Text style={s.subtitle}>Find and tap ALL items that match the target shape AND color in the grid!</Text>
                    <Button title={loading ? 'Loading...' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && puzzle && (
                <View style={s.playArea}>
                    <View style={s.targetCard}>
                        <Text style={s.findLabel}>Find all:</Text>
                        <Text style={[s.targetShape, { color: puzzle.targetColor }]}>{puzzle.targetShape}</Text>
                        <Text style={s.targetColorLabel}>in {puzzle.targetColor === '#ef4444' ? 'red' : puzzle.targetColor === '#3b82f6' ? 'blue' : puzzle.targetColor === '#22c55e' ? 'green' : puzzle.targetColor === '#eab308' ? 'yellow' : puzzle.targetColor === '#a855f7' ? 'purple' : 'orange'}</Text>
                        <Text style={s.foundCount}>{found.size}/{puzzle.count} found</Text>
                    </View>
                    <View style={s.grid}>
                        {puzzle.items.map((item, i) => (
                            <TouchableOpacity
                                key={i}
                                onPress={() => handleTap(i)}
                                activeOpacity={0.75}
                                style={[
                                    s.cell,
                                    { width: cellW, height: cellW, margin: gap / 2 },
                                    found.has(i) && s.cellFound,
                                    wrongTaps.has(i) && s.cellWrong,
                                ]}
                            >
                                <Text style={[s.cellText, { color: item.color, fontSize: cellW * 0.58 }]}>{item.shape}</Text>
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
    targetCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, marginBottom: 12 },
    findLabel: { fontSize: 14, color: '#64748b' },
    targetShape: { fontSize: 28, fontWeight: '800' },
    targetColorLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },
    foundCount: { fontSize: 13, color: '#94a3b8', marginLeft: 'auto' as any },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { borderRadius: 8, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center' },
    cellFound: { backgroundColor: '#dcfce7', borderWidth: 2, borderColor: '#22c55e' },
    cellWrong: { backgroundColor: '#fee2e2', borderWidth: 2, borderColor: '#ef4444' },
    cellText: { fontWeight: '700' },
    resultTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 32 },
});
