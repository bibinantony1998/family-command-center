import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, Hammer } from 'lucide-react-native';

export default function WhackAMoleScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over'>('intro');
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(30);
    const [moleIdx, setMoleIdx] = useState<number | null>(null);

    useEffect(() => { getHighestLevel('whack-a-mole').then(setLevel); }, []);

    // Game loop
    useEffect(() => {
        let timer: NodeJS.Timeout;
        let moleTimer: NodeJS.Timeout;

        if (gameState === 'playing') {
            timer = setInterval(() => {
                setTimeLeft(t => {
                    if (t <= 1) {
                        setGameState('game-over');
                        return 0;
                    }
                    return t - 1;
                });
            }, 1000);

            const spawnMole = () => {
                const idx = Math.floor(Math.random() * 9);
                setMoleIdx(idx);
                const duration = Math.max(400, 1000 - (level * 50));
                moleTimer = setTimeout(spawnMole, duration);
            };
            spawnMole();
        }

        return () => {
            clearInterval(timer);
            clearTimeout(moleTimer);
        };
    }, [gameState, level]);

    const handlePress = (idx: number) => {
        if (gameState !== 'playing') return;
        if (idx === moleIdx) {
            setScore(s => s + 1);
            setMoleIdx(null); // Hide immediately

            if (score + 1 >= (10 + level * 2)) {
                saveScore('whack-a-mole', level, level * 2);
                setGameState('level-up');
            }
        }
    };

    const startGame = () => {
        setScore(0);
        setTimeLeft(30);
        setGameState('playing');
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                <Text style={styles.levelBadge}>Level {level}</Text>
            </View>

            {gameState === 'intro' && (
                <View style={styles.centerContent}>
                    <Hammer size={64} color="#f59e0b" />
                    <Text style={styles.title}>Whack-a-Mole</Text>
                    <Text style={styles.subtitle}>Hit {10 + (level * 2)} moles!</Text>
                    <Button title={`Start Level ${level}`} onPress={startGame} style={styles.startBtn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={styles.centerContent}>
                    <View style={styles.stats}>
                        <View><Text style={styles.label}>Score</Text><Text style={styles.value}>{score}</Text></View>
                        <View><Text style={[styles.label, { textAlign: 'right' }]}>Time</Text><Text style={styles.value}>{timeLeft}s</Text></View>
                    </View>

                    <View style={styles.grid}>
                        {Array.from({ length: 9 }).map((_, i) => (
                            <TouchableOpacity
                                key={i}
                                style={styles.hole}
                                onPress={() => handlePress(i)}
                                activeOpacity={0.8}
                            >
                                {moleIdx === i && <View style={styles.mole} />}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {(gameState === 'level-up' || gameState === 'game-over') && (
                <View style={styles.centerContent}>
                    <Text style={styles.emoji}>{gameState === 'level-up' ? '🏆' : '⏰'}</Text>
                    <Text style={styles.resultTitle}>{gameState === 'level-up' ? 'Smashed it!' : 'Time Up!'}</Text>
                    {gameState === 'level-up' && <Text style={styles.points}>+{level * 2} Points</Text>}
                    <Button
                        title={gameState === 'level-up' ? "Next Level" : "Try Again"}
                        onPress={() => {
                            if (gameState === 'level-up') setLevel(l => l + 1);
                            startGame();
                        }}
                        style={styles.startBtn}
                    />
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
    emoji: { fontSize: 64 },
    stats: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 32, paddingHorizontal: 20 },
    label: { fontSize: 12, fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' },
    value: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', width: 300, gap: 10, justifyContent: 'center' },
    hole: { width: 90, height: 90, backgroundColor: '#f1f5f9', borderRadius: 45, borderWidth: 4, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    mole: { width: 70, height: 70, backgroundColor: '#d97706', borderRadius: 35, borderWidth: 4, borderColor: '#b45309' }
});
