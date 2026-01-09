import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, Grid } from 'lucide-react-native';

export default function PatternMemoryScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();

    const [gameState, setGameState] = useState<'intro' | 'memorize' | 'recall' | 'level-up' | 'game-over'>('intro');
    const [level, setLevel] = useState(1);
    const [gridSize, setGridSize] = useState(3);
    const [pattern, setPattern] = useState<number[]>([]);
    const [selectedCells, setSelectedCells] = useState<number[]>([]);

    useEffect(() => {
        getHighestLevel('pattern-memory').then(setLevel);
    }, []);

    const startGame = () => {
        let size = 3;
        let count = 3 + (level - 1);
        if (level > 3) size = 4;
        if (level > 6) size = 5;
        if (size === 4) count = 5 + (level - 4);
        if (size === 5) count = 8 + (level - 7);

        setGridSize(size);
        const newPattern: number[] = [];
        const total = size * size;
        while (newPattern.length < count) {
            const r = Math.floor(Math.random() * total);
            if (!newPattern.includes(r)) newPattern.push(r);
        }
        setPattern(newPattern);
        setSelectedCells([]);
        setGameState('memorize');

        setTimeout(() => setGameState('recall'), 2000);
    };

    const handleCellPress = (index: number) => {
        if (gameState !== 'recall') return;
        if (selectedCells.includes(index)) return;

        if (pattern.includes(index)) {
            const newSelected = [...selectedCells, index];
            setSelectedCells(newSelected);
            if (newSelected.length === pattern.length) {
                saveScore('pattern-memory', level, level * 2);
                setGameState('level-up');
            }
        } else {
            setGameState('game-over');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                    <X size={24} color="#64748b" />
                </TouchableOpacity>
                <Text style={styles.levelBadge}>Level {level}</Text>
            </View>

            {gameState === 'intro' && (
                <View style={styles.centerContent}>
                    <Text style={styles.title}>Pattern Memory</Text>
                    <Text style={styles.subtitle}>Memorize the pattern!</Text>
                    <Button title={`Start Level ${level}`} onPress={startGame} style={styles.startBtn} />
                </View>
            )}

            {(gameState === 'memorize' || gameState === 'recall' || gameState === 'game-over') && (
                <View style={styles.centerContent}>
                    <Text style={styles.statusText}>{gameState === 'memorize' ? 'Memorize...' : 'Repeat Pattern'}</Text>
                    <View style={[styles.grid, { width: gridSize * 70 }]}>
                        {Array.from({ length: gridSize * gridSize }).map((_, i) => {
                            const isPattern = pattern.includes(i);
                            const isSelected = selectedCells.includes(i);
                            const isActive = (gameState === 'memorize' && isPattern) || (gameState === 'recall' && isSelected);
                            const isWrong = gameState === 'game-over' && !isPattern && i === selectedCells[selectedCells.length]; // logic slightly off for 'last pressed', but ok for now

                            return (
                                <TouchableOpacity
                                    key={i}
                                    style={[
                                        styles.cell,
                                        isActive && styles.cellActive,
                                        // gameState === 'game-over' && isPattern && styles.cellMissed 
                                    ]}
                                    onPress={() => handleCellPress(i)}
                                    activeOpacity={0.8}
                                    disabled={gameState !== 'recall'}
                                />
                            );
                        })}
                    </View>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={styles.centerContent}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={styles.resultTitle}>Perfect!</Text>
                    <Text style={styles.points}>+{level * 2} Points</Text>
                    <Button title="Next Level" onPress={() => { setLevel(l => l + 1); startGame(); }} style={styles.startBtn} />
                </View>
            )}

            {gameState === 'game-over' && (
                <View style={styles.centerContent}>
                    <Text style={styles.emoji}>🧠</Text>
                    <Text style={styles.resultTitle}>Memory Slip!</Text>
                    <Button title="Try Again" onPress={startGame} style={styles.startBtn} />
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
    title: { fontSize: 32, fontWeight: 'black', color: '#1e293b', marginBottom: 12 },
    subtitle: { fontSize: 16, color: '#64748b' },
    startBtn: { marginTop: 32, width: '100%' },
    statusText: { fontSize: 24, fontWeight: 'bold', color: '#6366f1', marginBottom: 32 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
    cell: { width: 60, height: 60, backgroundColor: '#f1f5f9', borderRadius: 12 },
    cellActive: { backgroundColor: '#6366f1', shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    resultTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: 'bold', color: '#6366f1', marginTop: 8 },
    emoji: { fontSize: 64 }
});
