import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, Layers, RefreshCw } from 'lucide-react-native';

const DISK_COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4'];

export default function TowerOfHanoiScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up'>('intro');
    const [level, setLevel] = useState(1);
    const [rods, setRods] = useState<number[][]>([[], [], []]);
    const [selectedRod, setSelectedRod] = useState<number | null>(null);
    const [moves, setMoves] = useState(0);

    useEffect(() => { getHighestLevel('tower-hanoi').then(setLevel); }, []);

    const numDisks = level + 2;

    const startGame = () => {
        const disks = Array.from({ length: numDisks }, (_, i) => i).reverse();
        setRods([disks, [], []]);
        setMoves(0);
        setSelectedRod(null);
        setGameState('playing');
    };

    const handleRodPress = (idx: number) => {
        if (gameState !== 'playing') return;

        if (selectedRod === null) {
            if (rods[idx].length > 0) setSelectedRod(idx);
        } else {
            if (selectedRod === idx) {
                setSelectedRod(null);
            } else {
                // Move logic
                const source = rods[selectedRod];
                const target = rods[idx];
                const disk = source[source.length - 1];
                const targetTop = target.length > 0 ? target[target.length - 1] : Infinity;

                if (disk < targetTop) {
                    const newRods = [...rods.map(r => [...r])];
                    newRods[selectedRod].pop();
                    newRods[idx].push(disk);
                    setRods(newRods);
                    setMoves(m => m + 1);
                    setSelectedRod(null);

                    if (newRods[2].length === numDisks) {
                        saveScore('tower-hanoi', level, level * 2);
                        setGameState('level-up');
                    }
                } else {
                    setSelectedRod(null); // Invalid move deselect
                }
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
                    <Layers size={64} color="#f97316" />
                    <Text style={styles.title}>Tower of Hanoi</Text>
                    <Text style={styles.subtitle}>Move stack to the last rod.</Text>
                    <Button title={`Start Level ${level}`} onPress={startGame} style={styles.startBtn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={styles.gameContainer}>
                    <Text style={styles.moves}>Moves: {moves}</Text>
                    <View style={styles.rodsContainer}>
                        {[0, 1, 2].map(rIdx => (
                            <TouchableOpacity
                                key={rIdx}
                                style={[styles.rod, selectedRod === rIdx && styles.rodActive]}
                                onPress={() => handleRodPress(rIdx)}
                                activeOpacity={0.9}
                            >
                                <View style={styles.pole} />
                                <View style={styles.disksBox}>
                                    {rods[rIdx].map((disk, i) => (
                                        <View
                                            key={disk}
                                            style={[
                                                styles.disk,
                                                { width: 40 + (disk * 15), backgroundColor: DISK_COLORS[disk % DISK_COLORS.length] }
                                            ]}
                                        />
                                    ))}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TouchableOpacity onPress={startGame} style={styles.restartRow}>
                        <RefreshCw size={16} color="#94a3b8" />
                        <Text style={styles.restartText}>Restart</Text>
                    </TouchableOpacity>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={styles.centerContent}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={styles.resultTitle}>Solved!</Text>
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
    gameContainer: { flex: 1, justifyContent: 'center' },
    moves: { textAlign: 'center', fontSize: 18, color: '#64748b', marginBottom: 40 },
    rodsContainer: { flexDirection: 'row', justifyContent: 'space-between', height: 250, borderBottomWidth: 4, borderColor: '#cbd5e1' },
    rod: { width: '30%', alignItems: 'center', justifyContent: 'flex-end', paddingTop: 20, borderRadius: 8 },
    rodActive: { backgroundColor: '#f0f9ff' },
    pole: { position: 'absolute', bottom: 0, width: 6, height: '100%', backgroundColor: '#cbd5e1', borderRadius: 3, zIndex: -1 },
    disksBox: { alignItems: 'center', width: '100%', paddingBottom: 0 },
    disk: { height: 18, borderRadius: 9, marginBottom: 2, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
    restartRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 40 },
    restartText: { color: '#94a3b8' }
});
