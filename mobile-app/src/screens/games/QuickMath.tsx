import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, Timer, Delete } from 'lucide-react-native';

const LEVELS_CONFIG: Record<number, { max: number, ops: string[] }> = {
    1: { max: 10, ops: ['+'] },
    2: { max: 20, ops: ['+'] },
    3: { max: 20, ops: ['-', '+'] },
    4: { max: 50, ops: ['+'] },
    5: { max: 50, ops: ['-', '+'] },
    6: { max: 100, ops: ['+'] },
    7: { max: 100, ops: ['-', '+'] },
    8: { max: 10, ops: ['*'] },
    9: { max: 20, ops: ['*', '+'] },
    10: { max: 50, ops: ['*', '-', '+'] },
};

export default function QuickMathScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over'>('intro');
    const [level, setLevel] = useState(1);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState(0);
    const [input, setInput] = useState('');
    const [count, setCount] = useState(0);
    const [timeLeft, setTimeLeft] = useState(60);

    useEffect(() => { getHighestLevel('quick-math').then(setLevel); }, []);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (gameState === 'playing') {
            timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 0) {
                        setGameState('game-over');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [gameState]);

    const generateQuestion = (lvl: number) => {
        const config = LEVELS_CONFIG[lvl] || LEVELS_CONFIG[10];
        const num1 = Math.floor(Math.random() * config.max) + 1;
        const num2 = Math.floor(Math.random() * config.max) + 1;
        const op = config.ops[Math.floor(Math.random() * config.ops.length)];

        if (op === '-') {
            const bigger = Math.max(num1, num2);
            const smaller = Math.min(num1, num2);
            setQuestion(`${bigger} - ${smaller}`);
            setAnswer(bigger - smaller);
        } else if (op === '*') {
            const n1 = Math.floor(Math.random() * 10) + 1;
            const n2 = Math.floor(Math.random() * 10) + 1;
            setQuestion(`${n1} x ${n2}`);
            setAnswer(n1 * n2);
        } else {
            setQuestion(`${num1} + ${num2}`);
            setAnswer(num1 + num2);
        }
        setInput('');
    };

    const startGame = () => {
        setCount(0);
        setTimeLeft(60);
        setGameState('playing');
        generateQuestion(level);
    };

    const handleInput = (val: string) => {
        const newInput = input + val;
        setInput(newInput);
        if (parseInt(newInput) === answer) {
            if (count + 1 >= 5) {
                saveScore('quick-math', level, level * 2);
                setGameState('level-up');
            } else {
                setCount(c => c + 1);
                generateQuestion(level);
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
                    <Text style={styles.title}>Quick Math</Text>
                    <Text style={styles.subtitle}>Solve 5 problems quickly!</Text>
                    <Button title={`Start Level ${level}`} onPress={startGame} style={styles.startBtn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={{ flex: 1 }}>
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={styles.timer}>{timeLeft}s</Text>
                        <Text style={styles.question}>{question}</Text>
                        <Text style={styles.input}>{input}</Text>
                    </View>
                    <View style={styles.keypad}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                            <TouchableOpacity key={n} style={styles.key} onPress={() => handleInput(String(n))}>
                                <Text style={styles.keyText}>{n}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={[styles.key, styles.keyAction]} onPress={() => setInput('')}><X size={24} color="#ef4444" /></TouchableOpacity>
                        <TouchableOpacity style={styles.key} onPress={() => handleInput('0')}><Text style={styles.keyText}>0</Text></TouchableOpacity>
                        <View style={styles.key} />
                    </View>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={styles.centerContent}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={styles.resultTitle}>Calculated!</Text>
                    <Text style={styles.points}>+{level * 2} Points</Text>
                    <Button title="Next Level" onPress={() => { setLevel(l => l + 1); startGame(); }} style={styles.startBtn} />
                </View>
            )}

            {gameState === 'game-over' && (
                <View style={styles.centerContent}>
                    <Text style={styles.emoji}>😢</Text>
                    <Text style={styles.resultTitle}>Time's Up!</Text>
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
    timer: { fontSize: 24, fontWeight: 'bold', color: '#64748b', marginBottom: 20 },
    question: { fontSize: 64, fontWeight: 'black', color: '#1e293b' },
    input: { fontSize: 40, fontWeight: 'bold', color: '#3b82f6', marginTop: 20, minHeight: 60 },
    keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 20 },
    key: { width: '30%', height: 70, backgroundColor: '#f1f5f9', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    keyText: { fontSize: 28, fontWeight: 'bold', color: '#1e293b' },
    keyAction: { backgroundColor: '#fee2e2' },
    resultTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: 'bold', color: '#6366f1', marginTop: 8 },
    emoji: { fontSize: 64 }
});
