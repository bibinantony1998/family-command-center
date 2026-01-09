import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, LayoutGrid } from 'lucide-react-native';

export default function SchulteTableScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over'>('intro');
    const [level, setLevel] = useState(1);
    const [grid, setGrid] = useState<number[]>([]);
    const [gridSize, setGridSize] = useState(3);
    const [nextNumber, setNextNumber] = useState(1);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => { getHighestLevel('schulte-table').then(setLevel); }, []);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (gameState === 'playing') {
            timer = setInterval(() => setElapsed(e => e + 0.1), 100);
        }
        return () => clearInterval(timer);
    }, [gameState]);

    const startGame = () => {
        let size = 3;
        if (level > 2) size = 4;
        if (level > 5) size = 5;

        setGridSize(size);
        const numbers = Array.from({ length: size * size }, (_, i) => i + 1)
            .sort(() => Math.random() - 0.5);

        setGrid(numbers);
        setNextNumber(1);
        setElapsed(0);
        setGameState('playing');
    };

    const handlePress = (num: number) => {
        if (num === nextNumber) {
            if (num === grid.length) {
                // Win
                saveScore('schulte-table', level, level * 2);
                setGameState('level-up');
            } else {
                setNextNumber(n => n + 1);
            }
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
                    <LayoutGrid size={64} color="#d97706" />
                    <Text style={styles.title}>Schulte Table</Text>
                    <Text style={styles.subtitle}>Find numbers in order (1, 2, 3...)</Text>
                    <Button title={`Start Level ${level}`} onPress={startGame} style={styles.startBtn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={styles.centerContent}>
                    <View style={{ marginBottom: 20, alignItems: 'center' }}>
                        <Text style={{ fontSize: 48, fontWeight: 'bold', color: '#4f46e5' }}>{nextNumber}</Text>
                        <Text style={{ color: '#64748b' }}>Time: {elapsed.toFixed(1)}s</Text>
                    </View>
                    <View style={[styles.grid, { width: gridSize * 70 }]}>
                        {grid.map((num, i) => (
                            <TouchableOpacity
                                key={i}
                                style={[styles.cell, num < nextNumber && styles.cellFound]}
                                onPress={() => handlePress(num)}
                                disabled={num < nextNumber}
                            >
                                <Text style={[styles.cellText, num < nextNumber && styles.textFound]}>{num}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={styles.centerContent}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={styles.resultTitle}>Good Focus!</Text>
                    <Text style={styles.points}>+{level * 2} Points</Text>
                    <Button title="Next Level" onPress={() => { setLevel(l => l + 1); startGame(); }} style={styles.startBtn} />
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
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
    cell: { width: 60, height: 60, backgroundColor: '#fff', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cellFound: { backgroundColor: '#f1f5f9', borderColor: '#f1f5f9' },
    cellText: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    textFound: { color: '#cbd5e1' }
});
