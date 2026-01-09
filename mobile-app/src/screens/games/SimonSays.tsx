import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, Zap } from 'lucide-react-native';

const COLORS = [
    { id: 0, color: '#22c55e', active: '#86efac' }, // Green
    { id: 1, color: '#ef4444', active: '#fca5a5' }, // Red
    { id: 2, color: '#eab308', active: '#fde047' }, // Yellow
    { id: 3, color: '#3b82f6', active: '#93c5fd' }, // Blue
];

export default function SimonSaysScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();

    const [gameState, setGameState] = useState<'intro' | 'demo' | 'playing' | 'level-up' | 'game-over'>('intro');
    const [level, setLevel] = useState(1);
    const [sequence, setSequence] = useState<number[]>([]);
    const [userStep, setUserStep] = useState(0);
    const [activeIdx, setActiveIdx] = useState<number | null>(null);
    const [message, setMessage] = useState('');

    useEffect(() => { getHighestLevel('simon-says').then(setLevel); }, []);

    const playSequence = async (seq: number[]) => {
        setGameState('demo');
        setMessage('Watch...');
        await new Promise(r => setTimeout(r, 1000));

        for (const idx of seq) {
            setActiveIdx(idx);
            await new Promise(r => setTimeout(r, 400));
            setActiveIdx(null);
            await new Promise(r => setTimeout(r, 200));
        }

        setGameState('playing');
        setMessage('Your turn!');
    };

    const startGame = () => {
        const length = level + 2;
        const newSeq = Array.from({ length }, () => Math.floor(Math.random() * 4));
        setSequence(newSeq);
        setUserStep(0);
        playSequence(newSeq);
    };

    const handlePress = (idx: number) => {
        if (gameState !== 'playing') return;

        // Flash visual
        setActiveIdx(idx);
        setTimeout(() => setActiveIdx(null), 200);

        if (idx === sequence[userStep]) {
            if (userStep + 1 === sequence.length) {
                saveScore('simon-says', level, level * 2);
                setGameState('level-up');
            } else {
                setUserStep(s => s + 1);
            }
        } else {
            setGameState('game-over');
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
                    <Zap size={64} color="#6366f1" />
                    <Text style={styles.title}>Simon Says</Text>
                    <Text style={styles.subtitle}>Memorize the sequence!</Text>
                    <Button title={`Start Level ${level}`} onPress={startGame} style={styles.startBtn} />
                </View>
            )}

            {(gameState === 'playing' || gameState === 'demo' || gameState === 'game-over') && (
                <View style={styles.centerContent}>
                    <Text style={styles.message}>{gameState === 'game-over' ? 'Wrong!' : message}</Text>
                    <View style={styles.grid}>
                        {COLORS.map((c, i) => (
                            <TouchableOpacity
                                key={i}
                                style={[styles.btn, { backgroundColor: activeIdx === i ? c.active : c.color }]}
                                onPress={() => handlePress(i)}
                                disabled={gameState !== 'playing'}
                                activeOpacity={1}
                            />
                        ))}
                    </View>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={styles.centerContent}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={styles.resultTitle}>Correct!</Text>
                    <Text style={styles.points}>+{level * 2} Points</Text>
                    <Button title="Next Level" onPress={() => { setLevel(l => l + 1); startGame(); }} style={styles.startBtn} />
                </View>
            )}

            {gameState === 'game-over' && (
                <View style={styles.centerContent}>
                    <Text style={styles.emoji}>😢</Text>
                    <Text style={styles.resultTitle}>Game Over</Text>
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
    title: { fontSize: 32, fontWeight: 'black', color: '#1e293b', marginBottom: 12, marginTop: 16 },
    subtitle: { fontSize: 16, color: '#64748b' },
    startBtn: { marginTop: 32, width: '100%' },
    resultTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: 'bold', color: '#6366f1', marginTop: 8 },
    emoji: { fontSize: 64 },
    message: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginBottom: 32 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', width: 280, gap: 16, justifyContent: 'center' },
    btn: { width: 130, height: 130, borderRadius: 24 }
});
