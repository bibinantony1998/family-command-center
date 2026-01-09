import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Timer, Trophy, X, EyeOff } from 'lucide-react-native';

export default function NumberMemoryScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();

    const [gameState, setGameState] = useState<'intro' | 'memorize' | 'recall' | 'level-up' | 'game-over'>('intro');
    const [level, setLevel] = useState(1);
    const [number, setNumber] = useState('');
    const [input, setInput] = useState('');
    const [timeLeft, setTimeLeft] = useState(0); // Time to memorize

    const init = async () => {
        const lvl = await getHighestLevel('number-memory');
        setLevel(lvl);
    };

    useEffect(() => { init(); }, []);

    const startGame = () => {
        let num = '';
        for (let i = 0; i < level; i++) num += Math.floor(Math.random() * 10);
        setNumber(num);
        setInput('');

        setGameState('memorize');
        const duration = 2000 + (level * 1000); // ms
        setTimeLeft(duration / 1000);

        setTimeout(() => {
            setGameState('recall');
        }, duration);
    };

    const submit = () => {
        if (input === number) {
            saveScore('number-memory', level, level * 2);
            setGameState('level-up');
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
                    <Text style={styles.title}>Number Memory</Text>
                    <Text style={styles.subtitle}>Memorize the number before it disappears!</Text>
                    <Button title={`Start Level ${level}`} onPress={startGame} style={{ marginTop: 32, width: '100%' }} />
                </View>
            )}

            {gameState === 'memorize' && (
                <View style={styles.centerContent}>
                    <Text style={styles.memorizeLabel}>Memorize This</Text>
                    <Text style={styles.numberDisplay}>{number}</Text>
                    {/* Progress Bar placeholder */}
                </View>
            )}

            {gameState === 'recall' && (
                <View style={styles.centerContent}>
                    <EyeOff size={48} color="#94a3b8" />
                    <Text style={[styles.subtitle, { marginTop: 16 }]}>What was the number?</Text>
                    <TextInput
                        style={styles.input}
                        value={input}
                        onChangeText={setInput}
                        keyboardType="number-pad"
                        autoFocus
                        maxLength={level + 2}
                    />
                    <Button title="Submit" onPress={submit} style={{ marginTop: 32, width: '100%' }} />
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={styles.centerContent}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={styles.resultTitle}>Correct!</Text>
                    <Text style={styles.points}>+{level * 2} Points</Text>
                    <Button title="Next Level" onPress={() => { setLevel(l => l + 1); startGame(); }} style={{ marginTop: 32, width: '100%' }} />
                </View>
            )}

            {gameState === 'game-over' && (
                <View style={styles.centerContent}>
                    <Text style={styles.emoji}>❌</Text>
                    <Text style={styles.resultTitle}>Incorrect</Text>
                    <Text style={styles.subtitle}>It was {number}</Text>
                    <Button title="Try Again" onPress={startGame} style={{ marginTop: 32, width: '100%' }} />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 40 },
    closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    levelBadge: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 32, fontWeight: 'black', color: '#1e293b', marginBottom: 12 },
    subtitle: { fontSize: 16, color: '#64748b', textAlign: 'center' },
    memorizeLabel: { color: '#94a3b8', fontWeight: 'bold', letterSpacing: 2, marginBottom: 20 },
    numberDisplay: { fontSize: 64, fontWeight: 'black', color: '#1e293b' },
    input: { fontSize: 40, fontWeight: 'bold', textAlign: 'center', borderBottomWidth: 2, borderBottomColor: '#cbd5e1', width: '80%', padding: 10, letterSpacing: 4 },
    resultTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: 'bold', color: '#6366f1', marginTop: 8 },
    emoji: { fontSize: 64 }
});
