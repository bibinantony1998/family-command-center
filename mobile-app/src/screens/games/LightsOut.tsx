import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, RefreshCw } from 'lucide-react-native';

// Predefined solvable puzzles per level (1 = lit, 0 = off) for 5x5 grid
const PUZZLES_5X5 = [
    [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1], // L1 checkerboard corners
    [1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1], // L2 border
    [0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0], // L3
    [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1], // L4 X
    [1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1, 1], // L5
    [0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0], // L6 diamond
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1], // L7 full chessboard
    [0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0], // L8 ring
];

const SIZE = 5;

function toggle(grid: number[], idx: number): number[] {
    const row = Math.floor(idx / SIZE);
    const col = idx % SIZE;
    const ng = [...grid];
    const neighbors = [idx, idx - SIZE, idx + SIZE];
    if (col > 0) neighbors.push(idx - 1);
    if (col < SIZE - 1) neighbors.push(idx + 1);
    for (const n of neighbors) {
        if (n >= 0 && n < SIZE * SIZE && Math.abs(Math.floor(n / SIZE) - row) <= 1) {
            ng[n] = ng[n] === 1 ? 0 : 1;
        }
    }
    // fix: only toggle valid neighbors (same row +-1, or col +-1)
    return ng;
}

function applyToggle(grid: number[], idx: number): number[] {
    const row = Math.floor(idx / SIZE);
    const col = idx % SIZE;
    const ng = [...grid];
    const candidates = [idx];
    if (row > 0) candidates.push(idx - SIZE);
    if (row < SIZE - 1) candidates.push(idx + SIZE);
    if (col > 0) candidates.push(idx - 1);
    if (col < SIZE - 1) candidates.push(idx + 1);
    for (const n of candidates) ng[n] = ng[n] === 1 ? 0 : 1;
    return ng;
}

export default function LightsOutScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up'>('intro');
    const [grid, setGrid] = useState<number[]>([]);
    const [moves, setMoves] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getHighestLevel('lights-out').then(l => { setLevel(l); setLoading(false); });
    }, []);

    const startLevel = (lvl: number) => {
        const puzzle = PUZZLES_5X5[(lvl - 1) % PUZZLES_5X5.length];
        setGrid([...puzzle]);
        setMoves(0);
        setGameState('playing');
    };

    const handlePress = (idx: number) => {
        const newGrid = applyToggle(grid, idx);
        const newMoves = moves + 1;
        setGrid(newGrid);
        setMoves(newMoves);
        if (newGrid.every(v => v === 0)) {
            saveScore('lights-out', level, Math.max(1, 50 - newMoves) * level);
            setGameState('level-up');
        }
    };

    const CELL_SIZE = 56;

    return (
        <View style={[s.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                {gameState === 'playing' && (
                    <>
                        <Text style={s.levelBadge}>Level {level} • Moves: {moves}</Text>
                        <TouchableOpacity onPress={() => startLevel(level)} style={s.closeBtn}><RefreshCw size={20} color="#64748b" /></TouchableOpacity>
                    </>
                )}
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.emoji}>💡</Text>
                    <Text style={s.title}>Lights Out</Text>
                    <Text style={s.subtitle}>Turn off all the lights by tapping them!</Text>
                    <View style={s.rulesBox}>
                        <Text style={s.ruleText}>• Tap a cell to toggle it and its neighbors</Text>
                        <Text style={s.ruleText}>• Goal: make all lights go dark</Text>
                        <Text style={s.ruleText}>• Fewer moves = more points</Text>
                        <Text style={s.ruleText}>• Puzzles get trickier each level</Text>
                    </View>
                    <Button title={loading ? 'Loading…' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={s.playArea}>
                    <Text style={s.instruction}>Turn off all lights</Text>
                    <View style={s.grid}>
                        {grid.map((val, idx) => (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => handlePress(idx)}
                                style={[s.cell, { width: CELL_SIZE, height: CELL_SIZE }, val === 1 ? s.cellOn : s.cellOff]}
                                activeOpacity={0.7}
                            >
                                {val === 1 && <Text style={s.bulb}>💡</Text>}
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={s.hint}>Lit: {grid.filter(v => v === 1).length} remaining</Text>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={s.center}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={s.resultTitle}>All Dark! 🌚</Text>
                    <Text style={s.points}>+{Math.max(1, 50 - moves) * level} Points</Text>
                    <Text style={s.movesText}>Solved in {moves} moves</Text>
                    <Button title="Next Level" onPress={() => { const n = level + 1; setLevel(n); startLevel(n); }} style={s.btn} />
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', paddingHorizontal: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 44, marginBottom: 8 },
    closeBtn: { padding: 8, backgroundColor: '#1e293b', borderRadius: 20 },
    levelBadge: { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emoji: { fontSize: 64, marginBottom: 12 },
    title: { fontSize: 30, fontWeight: '800', color: '#f1f5f9', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    rulesBox: { backgroundColor: '#1e293b', padding: 16, borderRadius: 14, width: '100%', marginBottom: 28, gap: 6 },
    ruleText: { fontSize: 13, color: '#94a3b8', lineHeight: 18 },
    btn: { width: '100%' },
    playArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    instruction: { fontSize: 16, fontWeight: '700', color: '#cbd5e1', marginBottom: 24 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: 5 * 56 + 4 * 8 },
    cell: { borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cellOn: { backgroundColor: '#fbbf24', shadowColor: '#fbbf24', shadowOpacity: 0.8, shadowRadius: 12, elevation: 8 },
    cellOff: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
    bulb: { fontSize: 24 },
    hint: { marginTop: 20, color: '#475569', fontSize: 14 },
    resultTitle: { fontSize: 30, fontWeight: '800', color: '#f1f5f9', marginTop: 16, marginBottom: 4 },
    points: { fontSize: 36, fontWeight: '800', color: '#fbbf24', marginTop: 4, marginBottom: 8 },
    movesText: { color: '#94a3b8', fontSize: 14, marginBottom: 24 },
});
