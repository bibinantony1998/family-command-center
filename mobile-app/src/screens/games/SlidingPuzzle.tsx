import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { RefreshCw, X, Trophy } from 'lucide-react-native';

const SIZES: Record<number, number> = { 1: 3, 2: 3, 3: 3, 4: 4, 5: 4, 6: 4, 7: 4, 8: 4 };

function makeGrid(n: number): number[] {
    const total = n * n;
    const arr = Array.from({ length: total }, (_, i) => i);
    // Fisher-Yates shuffle that keeps solvable permutations
    for (let i = total - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return isSolvable(arr, n) ? arr : swapFirst(arr);
}

function swapFirst(arr: number[]): number[] {
    const a = [...arr];
    if (a[0] !== 0 && a[1] !== 0) { [a[0], a[1]] = [a[1], a[0]]; }
    else { [a[a.length - 1], a[a.length - 2]] = [a[a.length - 2], a[a.length - 1]]; }
    return a;
}

function isSolvable(arr: number[], n: number): boolean {
    let inv = 0;
    const flat = arr.filter(x => x !== 0);
    for (let i = 0; i < flat.length; i++)
        for (let j = i + 1; j < flat.length; j++)
            if (flat[i] > flat[j]) inv++;
    const blankRow = Math.floor(arr.indexOf(0) / n);
    if (n % 2 === 1) return inv % 2 === 0;
    return (inv + blankRow) % 2 === 0;
}

function isSolved(arr: number[]): boolean {
    return arr.every((v, i) => v === (i === arr.length - 1 ? 0 : i + 1));
}

const screenW = Dimensions.get('window').width;

export default function SlidingPuzzle() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'won'>('intro');
    const [grid, setGrid] = useState<number[]>([]);
    const [n, setN] = useState(3);
    const [moves, setMoves] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getHighestLevel('sliding-puzzle').then(l => { setLevel(l); setLoading(false); });
    }, []);

    const startLevel = (lvl: number) => {
        const size = SIZES[Math.min(lvl, 8)] ?? 4;
        setN(size);
        setGrid(makeGrid(size));
        setMoves(0);
        setGameState('playing');
    };

    const handleTap = (idx: number) => {
        const blank = grid.indexOf(0);
        const row = Math.floor(idx / n), col = idx % n;
        const bRow = Math.floor(blank / n), bCol = blank % n;
        if ((Math.abs(row - bRow) === 1 && col === bCol) || (Math.abs(col - bCol) === 1 && row === bRow)) {
            const ng = [...grid];
            [ng[idx], ng[blank]] = [ng[blank], ng[idx]];
            const nm = moves + 1;
            setGrid(ng);
            setMoves(nm);
            if (isSolved(ng)) {
                saveScore('sliding-puzzle', level, Math.max(1, 200 - nm) * level);
                setGameState('won');
            }
        }
    };

    const CELL = Math.floor((screenW - 48 - (n - 1) * 6) / n);
    const pts = Math.max(1, 200 - moves) * level;

    return (
        <View style={[s.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}><X size={22} color="#64748b" /></TouchableOpacity>
                {gameState === 'playing' && <Text style={s.badge}>Level {level} • {n}×{n} • Moves: {moves}</Text>}
                {gameState === 'playing' && <TouchableOpacity onPress={() => startLevel(level)} style={s.iconBtn}><RefreshCw size={18} color="#64748b" /></TouchableOpacity>}
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.emoji}>🔢</Text>
                    <Text style={s.title}>Sliding Puzzle</Text>
                    <Text style={s.sub}>Slide tiles into order — fewest moves wins!</Text>
                    <View style={s.rules}>
                        <Text style={s.rule}>• Tap a tile next to the blank space to slide it</Text>
                        <Text style={s.rule}>• Arrange 1→8 (3×3) or 1→15 (4×4) in order</Text>
                        <Text style={s.rule}>• Fewer moves = more points</Text>
                    </View>
                    <Button title={loading ? 'Loading…' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={s.boardArea}>
                    <View style={[s.board, { gap: 6 }]}>
                        {grid.map((val, idx) => (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => handleTap(idx)}
                                activeOpacity={val === 0 ? 1 : 0.7}
                                style={[
                                    s.tile,
                                    { width: CELL, height: CELL, borderRadius: 12 },
                                    val === 0 ? s.tileBlank : s.tileFilled,
                                    val !== 0 && val === (idx === grid.length - 1 ? 0 : idx + 1) && s.tileCorrect,
                                ]}
                            >
                                {val !== 0 && <Text style={[s.tileText, { fontSize: CELL > 70 ? 24 : 18 }]}>{val}</Text>}
                            </TouchableOpacity>
                        ))}
                    </View>
                    <Text style={s.hint}>Tap a tile adjacent to the blank space</Text>
                </View>
            )}

            {gameState === 'won' && (
                <View style={s.center}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={s.title}>Solved! 🎉</Text>
                    <Text style={s.movesText}>{moves} moves</Text>
                    <Text style={s.points}>+{pts} Points</Text>
                    <Button title="Next Level" onPress={() => { const nxt = level + 1; setLevel(nxt); startLevel(nxt); }} style={s.btn} />
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, marginBottom: 8 },
    iconBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    badge: { fontSize: 13, fontWeight: '700', color: '#64748b' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emoji: { fontSize: 64, marginBottom: 12 },
    title: { fontSize: 30, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
    sub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    rules: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 14, width: '100%', marginBottom: 28, gap: 6 },
    rule: { fontSize: 13, color: '#475569', lineHeight: 18 },
    btn: { width: '100%' },
    boardArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    board: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    tile: { justifyContent: 'center', alignItems: 'center', margin: 3 },
    tileFilled: { backgroundColor: '#4f46e5', shadowColor: '#4f46e5', shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
    tileCorrect: { backgroundColor: '#059669' },
    tileBlank: { backgroundColor: '#f1f5f9' },
    tileText: { color: '#fff', fontWeight: '800' },
    hint: { marginTop: 20, color: '#94a3b8', fontSize: 13, fontStyle: 'italic' },
    movesText: { fontSize: 16, color: '#64748b', marginTop: 4 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 28 },
});
