import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, GlassWater, RefreshCw } from 'lucide-react-native';

const LEVELS_CONFIG = [
    { target: 4, jugs: [5, 3] },      // Level 1
    { target: 1, jugs: [3, 2] },      // Level 2
    { target: 4, jugs: [8, 5, 3] },   // Level 3
    { target: 5, jugs: [12, 7, 5] },  // Level 4
    { target: 6, jugs: [8, 5] },      // Level 5
    { target: 2, jugs: [9, 4] },      // Level 6
    { target: 7, jugs: [10, 6, 5] },  // Level 7
    { target: 9, jugs: [13, 8, 5] },  // Level 8
    { target: 1, jugs: [5, 2] },      // Level 9
    { target: 12, jugs: [24, 13, 11] }// Level 10
];

export default function WaterJugsScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up'>('intro');
    const [jugs, setJugs] = useState<{ id: number, capacity: number, current: number }[]>([]);
    const [selectedJug, setSelectedJug] = useState<number | null>(null);
    const [moves, setMoves] = useState(0);

    useEffect(() => { getHighestLevel('water-jugs').then(setLevel); }, []);

    const startLevel = (lvl: number) => {
        const config = LEVELS_CONFIG[lvl - 1] || LEVELS_CONFIG[0];
        setJugs(config.jugs.map((cap, i) => ({ id: i, capacity: cap, current: 0 })));
        setGameState('playing');
        setMoves(0);
        setSelectedJug(null);
    };

    const startGame = () => {
        // Cap level
        const lvl = level > 10 ? 1 : level;
        startLevel(lvl);
    };

    const handlePress = (idx: number) => {
        if (selectedJug === null) {
            setSelectedJug(idx);
        } else {
            if (selectedJug === idx) {
                setSelectedJug(null);
            } else {
                pour(selectedJug, idx);
            }
        }
    };

    const fillJug = () => {
        if (selectedJug === null) return;
        const newJugs = [...jugs];
        newJugs[selectedJug].current = newJugs[selectedJug].capacity;
        setJugs(newJugs);
        setMoves(m => m + 1);
        setSelectedJug(null);
        checkWin(newJugs);
    };

    const emptyJug = () => {
        if (selectedJug === null) return;
        const newJugs = [...jugs];
        newJugs[selectedJug].current = 0;
        setJugs(newJugs);
        setMoves(m => m + 1);
        setSelectedJug(null);
        checkWin(newJugs);
    };

    const pour = (from: number, to: number) => {
        const newJugs = [...jugs];
        const src = newJugs[from];
        const dst = newJugs[to];
        const amount = Math.min(src.current, dst.capacity - dst.current);

        if (amount > 0) {
            src.current -= amount;
            dst.current += amount;
            setJugs(newJugs);
            setMoves(m => m + 1);
        }
        setSelectedJug(null);
        checkWin(newJugs);
    };

    const checkWin = (currentJugs: typeof jugs) => {
        const target = LEVELS_CONFIG[level - 1].target;
        if (currentJugs.some(j => j.current === target)) {
            // Win
            saveScore('water-jugs', level, level * 2);
            setGameState('level-up');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                <Text style={styles.levelBadge}>Level {level}</Text>
            </View>

            {gameState === 'intro' && (
                <View style={styles.centerContent}>
                    <GlassWater size={64} color="#06b6d4" />
                    <Text style={styles.title}>Water Jugs</Text>
                    <Text style={styles.subtitle}>Measure exactly {LEVELS_CONFIG[Math.min(level - 1, 9)].target}L</Text>
                    <Button title={`Start Level ${level}`} onPress={startGame} style={styles.startBtn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={styles.gameContainer}>
                    <Text style={styles.target}>Target: {LEVELS_CONFIG[level - 1].target}L</Text>
                    <Text style={styles.moves}>Moves: {moves}</Text>

                    <View style={styles.jugsRow}>
                        {jugs.map((jug, i) => (
                            <TouchableOpacity
                                key={i}
                                style={[styles.jug, selectedJug === i && styles.jugSelected]}
                                onPress={() => handlePress(i)}
                            >
                                <View style={[styles.water, { height: `${(jug.current / jug.capacity) * 100}%` }]} />
                                <Text style={styles.jugText}>{jug.current}L / {jug.capacity}L</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.actions}>
                        <Button title="Fill" onPress={fillJug} disabled={selectedJug === null} variant={selectedJug !== null ? 'default' : 'outline'} />
                        <Button title="Empty" onPress={emptyJug} disabled={selectedJug === null} variant={selectedJug !== null ? 'destructive' : 'outline'} />
                    </View>

                    <TouchableOpacity onPress={() => startLevel(level)} style={styles.restartRow}>
                        <RefreshCw size={16} color="#94a3b8" />
                        <Text style={styles.restartText}>Restart</Text>
                    </TouchableOpacity>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={styles.centerContent}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={styles.resultTitle}>Measured!</Text>
                    <Text style={styles.points}>+{level * 2} Points</Text>
                    <Button title="Next Level" onPress={() => { setLevel(l => l + 1); startLevel(level + 1); }} style={styles.startBtn} />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 40 },
    closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    levelBadge: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 32, fontWeight: 'black', color: '#1e293b', marginBottom: 12, marginTop: 16 },
    subtitle: { fontSize: 16, color: '#64748b' },
    startBtn: { marginTop: 32, width: '100%' },
    resultTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: 'bold', color: '#6366f1', marginTop: 8 },
    gameContainer: { flex: 1, paddingTop: 40 },
    target: { fontSize: 32, fontWeight: 'black', textAlign: 'center', color: '#1e293b' },
    moves: { textAlign: 'center', color: '#64748b', marginBottom: 40 },
    jugsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, alignItems: 'flex-end', height: 200, marginBottom: 40 },
    jug: { width: 80, height: 150, borderWidth: 4, borderColor: '#94a3b8', borderTopWidth: 0, borderRadius: 12, justifyContent: 'flex-end', overflow: 'hidden' },
    jugSelected: { borderColor: '#3b82f6' },
    water: { backgroundColor: '#3b82f6', width: '100%' },
    jugText: { position: 'absolute', width: '100%', textAlign: 'center', bottom: -24, fontWeight: 'bold', color: '#64748b' },
    actions: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
    restartRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 40 },
    restartText: { color: '#94a3b8' }
});
