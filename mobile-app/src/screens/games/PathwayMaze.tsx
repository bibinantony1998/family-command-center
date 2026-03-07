import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, RefreshCw } from 'lucide-react-native';

type Cell = 0 | 1 | 2 | 3;
const { width: SW } = Dimensions.get('window');

function getLevelSize(level: number) { return 9 + Math.floor(level / 2) * 2; }
function getDemonCount(level: number) { return Math.min(1 + Math.floor((level - 1) / 2), 5); }
function getDemonSpeed(level: number) { return Math.max(250, 700 - level * 55); }

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

type Demon = { r: number; c: number; pr: number; pc: number };

function placeDemonsOnGrid(grid: Cell[][], count: number): Demon[] {
    const rows = grid.length, cols = grid[0].length;
    const candidates: { r: number; c: number }[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c] !== 1 && grid[r][c] !== 2 && (Math.abs(r - 1) + Math.abs(c - 1)) > 5) {
                candidates.push({ r, c });
            }
        }
    }
    candidates.sort(() => Math.random() - 0.5);
    return candidates.slice(0, count).map(p => ({ r: p.r, c: p.c, pr: -1, pc: -1 }));
}

const SAFE_RADIUS = 3; // Demon-free zone around start (1,1)

function pathReachable(from: { r: number; c: number }, to: { r: number; c: number }, grid: Cell[][], maxDist: number): boolean {
    if (Math.abs(from.r - to.r) + Math.abs(from.c - to.c) > maxDist * 2) return false;
    const queue: { r: number; c: number; d: number }[] = [{ ...from, d: 0 }];
    const visited = new Set<string>([`${from.r},${from.c}`]);
    while (queue.length > 0) {
        const { r, c, d } = queue.shift()!;
        if (r === to.r && c === to.c) return true;
        if (d >= maxDist) continue;
        for (const { dr, dc } of [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }]) {
            const nr = r + dr, nc = c + dc;
            const key = `${nr},${nc}`;
            if (!visited.has(key) && grid[nr] && grid[nr][nc] !== undefined && grid[nr][nc] !== 1) {
                visited.add(key); queue.push({ r: nr, c: nc, d: d + 1 });
            }
        }
    }
    return false;
}

function demonStep(demon: Demon, grid: Cell[][]): Demon {
    const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
    const valid = dirs
        .map(d => ({ r: demon.r + d.dr, c: demon.c + d.dc }))
        .filter(p =>
            grid[p.r] !== undefined &&
            grid[p.r][p.c] !== undefined &&
            grid[p.r][p.c] !== 1 &&
            // Never enter the safe zone around start
            (Math.abs(p.r - 1) + Math.abs(p.c - 1)) > SAFE_RADIUS
        );
    // Prefer not going back to previous position (anti-oscillation)
    const preferred = valid.filter(p => p.r !== demon.pr || p.c !== demon.pc);
    const choices = preferred.length > 0 ? preferred : valid;
    if (choices.length === 0) return demon;
    const next = choices[Math.floor(Math.random() * choices.length)];
    return { r: next.r, c: next.c, pr: demon.r, pc: demon.c };
}

export default function PathwayMazeScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up'>('intro');
    const [grid, setGrid] = useState<Cell[][]>([]);
    const [player, setPlayer] = useState({ r: 1, c: 1 });
    const [demons, setDemons] = useState<Demon[]>([]);
    const [moves, setMoves] = useState(0);
    const [caught, setCaught] = useState(false);
    const [loading, setLoading] = useState(true);
    const gridRef = useRef<Cell[][]>([]);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const shakeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => { getHighestLevel('pathway-maze').then(l => { setLevel(l); setLoading(false); }); }, []);
    useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

    const startLevel = (lvl: number) => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        const size = getLevelSize(lvl);
        const newGrid = generateMaze(size, size);
        gridRef.current = newGrid;
        const newDemons = placeDemonsOnGrid(newGrid, getDemonCount(lvl));
        setGrid(newGrid); setPlayer({ r: 1, c: 1 }); setDemons(newDemons);
        setMoves(0); setCaught(false); setLevel(lvl); setGameState('playing');
        intervalRef.current = setInterval(() => {
            setDemons(prev => prev.map(d => demonStep(d, gridRef.current)));
        }, getDemonSpeed(lvl));
    };

    // Demon collision check
    useEffect(() => {
        if (gameState !== 'playing') return;
        const isCaught = demons.some(d => d.r === player.r && d.c === player.c);
        if (isCaught) {
            setCaught(true);
            setMoves(m => m + 5); // penalty
            // Shake animation
            Animated.sequence([
                Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
            ]).start(() => {
                setPlayer({ r: 1, c: 1 });
                setCaught(false);
            });
        }
    }, [demons]);

    const move = (dr: number, dc: number) => {
        if (caught) return;
        setPlayer(prev => {
            const nr = prev.r + dr, nc = prev.c + dc;
            if (!gridRef.current[nr] || gridRef.current[nr][nc] === undefined || gridRef.current[nr][nc] === 1) return prev;
            setMoves(m => m + 1);
            if (gridRef.current[nr][nc] === 3) {
                if (intervalRef.current) clearInterval(intervalRef.current);
                saveScore('pathway-maze', level, level * 2);
                setGameState('level-up');
            }
            return { r: nr, c: nc };
        });
    };

    const cellSize = grid.length ? Math.min(28, Math.floor((SW - 40) / grid.length)) : 20;
    const demonNearby = !caught && demons.some(d => pathReachable(d, player, grid, 5));

    return (
        <View style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                <Text style={s.levelBadge}>Level {level} • {moves} moves</Text>
                <TouchableOpacity onPress={() => startLevel(level)} style={s.closeBtn}><RefreshCw size={18} color="#64748b" /></TouchableOpacity>
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.big}>🗺️</Text>
                    <Text style={s.title}>Pathway Maze</Text>
                    <Text style={s.subtitle}>Navigate 😊 to the ⭐ goal — avoid the 👺 demons! They'll send you back to start.</Text>
                    <Button title={loading ? 'Loading...' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && grid.length > 0 && (
                <View style={s.playArea}>
                    {/* Fixed-height banner — no layout shift */}
                    <View style={s.banner}>
                        {caught
                            ? <Text style={s.caughtText}>😱 Caught! Back to start (+5 moves)</Text>
                            : demonNearby
                                ? <Text style={s.warningText}>⚠️ Danger nearby — time your move!</Text>
                                : null}
                    </View>

                    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                        <View style={[s.mazeBox, { width: cellSize * grid[0].length, height: cellSize * grid.length }]}>
                            {grid.map((row, r) => (
                                <View key={r} style={{ flexDirection: 'row' }}>
                                    {row.map((cell, c) => {
                                        const isPlayer = player.r === r && player.c === c;
                                        const isDemon = demons.some(d => d.r === r && d.c === c);
                                        return (
                                            <View key={c} style={[
                                                { width: cellSize, height: cellSize, justifyContent: 'center', alignItems: 'center' },
                                                cell === 1 ? s.wall : cell === 3 ? s.goal : s.path,
                                            ]}>
                                                {isPlayer && <Text style={{ fontSize: cellSize * 0.65 }}>😊</Text>}
                                                {!isPlayer && isDemon && <Text style={{ fontSize: cellSize * 0.65 }}>👺</Text>}
                                                {!isPlayer && !isDemon && cell === 3 && <Text style={{ fontSize: cellSize * 0.65 }}>⭐</Text>}
                                            </View>
                                        );
                                    })}
                                </View>
                            ))}
                        </View>
                    </Animated.View>

                    <View style={s.dpad}>
                        <View style={s.dpadRow}><View style={s.dpadGap} /><TouchableOpacity onPress={() => move(-1, 0)} style={s.dkey}><Text style={s.dkeyText}>↑</Text></TouchableOpacity><View style={s.dpadGap} /></View>
                        <View style={s.dpadRow}>
                            <TouchableOpacity onPress={() => move(0, -1)} style={s.dkey}><Text style={s.dkeyText}>←</Text></TouchableOpacity>
                            <View style={[s.dkey, s.dkeyCenter]} />
                            <TouchableOpacity onPress={() => move(0, 1)} style={s.dkey}><Text style={s.dkeyText}>→</Text></TouchableOpacity>
                        </View>
                        <View style={s.dpadRow}><View style={s.dpadGap} /><TouchableOpacity onPress={() => move(1, 0)} style={s.dkey}><Text style={s.dkeyText}>↓</Text></TouchableOpacity><View style={s.dpadGap} /></View>
                    </View>

                    <Text style={s.demonInfo}>👹 {getDemonCount(level)} demon{getDemonCount(level) > 1 ? 's' : ''} active</Text>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={s.center}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={s.resultTitle}>Escaped! 🎉</Text>
                    <Text style={s.points}>+{level * 2} Points</Text>
                    <Text style={s.subtitle}>{moves} total moves</Text>
                    <Button title="Next Level" onPress={() => { const next = level + 1; setLevel(next); startLevel(next); }} style={s.btn} />
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingTop: 48, paddingHorizontal: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    levelBadge: { fontSize: 14, fontWeight: '700', color: '#64748b' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    big: { fontSize: 64 },
    title: { fontSize: 32, fontWeight: '800', color: '#1e293b', marginTop: 12, marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 },
    btn: { width: '100%', marginTop: 8 },
    playArea: { flex: 1, alignItems: 'center', paddingTop: 4 },
    banner: { height: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
    warningText: { fontSize: 13, color: '#f59e0b', fontWeight: '700', textAlign: 'center' },
    caughtText: { fontSize: 13, color: '#ef4444', fontWeight: '700', textAlign: 'center' },
    mazeBox: { borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: '#e2e8f0' },
    wall: { backgroundColor: '#334155' },
    path: { backgroundColor: '#f8fafc' },
    goal: { backgroundColor: '#fef9c3' },
    dpad: { marginTop: 16, gap: 4 },
    dpadRow: { flexDirection: 'row', gap: 4, justifyContent: 'center' },
    dpadGap: { width: 56 },
    dkey: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    dkeyCenter: { backgroundColor: '#e2e8f0' },
    dkeyText: { fontSize: 24, fontWeight: '700', color: '#475569' },
    demonInfo: { fontSize: 12, color: '#94a3b8', marginTop: 8 },
    resultTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 8 },
});
