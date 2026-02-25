import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, RefreshCw } from 'lucide-react-native';

type Cell = 0 | 1 | 2 | 3;
const { width: SW } = Dimensions.get('window');

function getLevelSize(level: number) { return 5 + Math.floor(level / 2) * 2; }

function generateMaze(rows: number, cols: number): Cell[][] {
    const grid: Cell[][] = Array.from({ length: rows }, () => Array(cols).fill(1) as Cell[]);
    function carve(r: number, c: number) {
        const dirs = [[0, 2], [0, -2], [2, 0], [-2, 0]].sort(() => Math.random() - 0.5);
        for (const [dr, dc] of dirs) {
            const nr = r + dr, nc = c + dc;
            if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && grid[nr][nc] === 1) {
                grid[r + dr / 2][c + dc / 2] = 0; grid[nr][nc] = 0; carve(nr, nc);
            }
        }
    }
    grid[1][1] = 0; carve(1, 1);
    grid[1][1] = 2; grid[rows - 2][cols - 2] = 3;
    return grid;
}

export default function PathwayMazeScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up'>('intro');
    const [grid, setGrid] = useState<Cell[][]>([]);
    const [player, setPlayer] = useState({ r: 1, c: 1 });
    const [moves, setMoves] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => { getHighestLevel('pathway-maze').then(l => { setLevel(l); setLoading(false); }); }, []);

    const startLevel = (lvl: number) => {
        const size = getLevelSize(lvl);
        setGrid(generateMaze(size, size)); setPlayer({ r: 1, c: 1 }); setMoves(0); setLevel(lvl); setGameState('playing');
    };

    const move = (dr: number, dc: number) => {
        setPlayer(prev => {
            const nr = prev.r + dr, nc = prev.c + dc;
            if (!grid[nr] || !grid[nr][nc] || grid[nr][nc] === 1) return prev;
            setMoves(m => m + 1);
            if (grid[nr][nc] === 3) { saveScore('pathway-maze', level, level * 2); setGameState('level-up'); }
            return { r: nr, c: nc };
        });
    };

    const cellSize = grid.length ? Math.min(32, Math.floor((SW - 40) / grid.length)) : 24;

    return (
        <View style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                <Text style={s.levelBadge}>Level {level} • {moves} moves</Text>
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.big}>🗺️</Text>
                    <Text style={s.title}>Pathway Maze</Text>
                    <Text style={s.subtitle}>Navigate from start to the ⭐ goal!</Text>
                    <Button title={loading ? 'Loading...' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && grid.length > 0 && (
                <View style={s.playArea}>
                    <View style={[s.mazeBox, { width: cellSize * grid[0].length, height: cellSize * grid.length }]}>
                        {grid.map((row, r) => (
                            <View key={r} style={{ flexDirection: 'row' }}>
                                {row.map((cell, c) => {
                                    const isPlayer = player.r === r && player.c === c;
                                    return (
                                        <View key={c} style={[{ width: cellSize, height: cellSize, justifyContent: 'center', alignItems: 'center' },
                                        cell === 1 ? s.wall : cell === 3 ? s.goal : s.path]}>
                                            {isPlayer && <Text style={{ fontSize: cellSize * 0.6 }}>😊</Text>}
                                            {!isPlayer && cell === 3 && <Text style={{ fontSize: cellSize * 0.6 }}>⭐</Text>}
                                        </View>
                                    );
                                })}
                            </View>
                        ))}
                    </View>

                    <View style={s.dpad}>
                        <View style={s.dpadRow}><View style={s.dpadGap} /><TouchableOpacity onPress={() => move(-1, 0)} style={s.dkey}><Text style={s.dkeyText}>↑</Text></TouchableOpacity><View style={s.dpadGap} /></View>
                        <View style={s.dpadRow}>
                            <TouchableOpacity onPress={() => move(0, -1)} style={s.dkey}><Text style={s.dkeyText}>←</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => startLevel(level)} style={[s.dkey, s.dkeyCenter]}><RefreshCw size={16} color="#94a3b8" /></TouchableOpacity>
                            <TouchableOpacity onPress={() => move(0, 1)} style={s.dkey}><Text style={s.dkeyText}>→</Text></TouchableOpacity>
                        </View>
                        <View style={s.dpadRow}><View style={s.dpadGap} /><TouchableOpacity onPress={() => move(1, 0)} style={s.dkey}><Text style={s.dkeyText}>↓</Text></TouchableOpacity><View style={s.dpadGap} /></View>
                    </View>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={s.center}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={s.resultTitle}>Escaped! 🎉</Text>
                    <Text style={s.points}>+{level * 2} Points</Text>
                    <Button title="Next Level" onPress={() => { const next = level + 1; setLevel(next); startLevel(next); }} style={s.btn} />
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
    title: { fontSize: 32, fontWeight: '800', color: '#1e293b', marginTop: 12, marginBottom: 8 },
    subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 24 },
    btn: { width: '100%', marginTop: 8 },
    playArea: { flex: 1, alignItems: 'center', paddingTop: 8 },
    mazeBox: { borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#e2e8f0' },
    wall: { backgroundColor: '#334155' },
    path: { backgroundColor: '#f8fafc' },
    goal: { backgroundColor: '#fef9c3' },
    dpad: { marginTop: 24, gap: 4 },
    dpadRow: { flexDirection: 'row', gap: 4, justifyContent: 'center' },
    dpadGap: { width: 52 },
    dkey: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    dkeyCenter: { backgroundColor: '#e2e8f0' },
    dkeyText: { fontSize: 22, fontWeight: '700', color: '#475569' },
    resultTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 32 },
});
