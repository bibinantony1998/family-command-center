import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, Zap, Timer } from 'lucide-react-native';

export default function ReflexChallengeScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();

    const [gameState, setGameState] = useState<'intro' | 'waiting' | 'ready' | 'go' | 'too-early' | 'result' | 'level-up'>('intro');
    const [level, setLevel] = useState(1);
    const [message, setMessage] = useState('');
    const [reactionTime, setReactionTime] = useState(0);

    const startTimeRef = useRef<number>(0);
    const timeoutRef = useRef<NodeJS.Timeout>();

    useEffect(() => { getHighestLevel('reflex-challenge').then(setLevel); }, []);

    const targetTime = 500 - (level * 30);

    const startRound = () => {
        setGameState('waiting');
        setMessage('Wait for Green...');
        const delay = 2000 + Math.random() * 3000;
        timeoutRef.current = setTimeout(() => {
            setGameState('go');
            setMessage('TAP NOW!');
            startTimeRef.current = Date.now();
        }, delay);
    };

    const handlePress = () => {
        if (gameState === 'waiting') {
            clearTimeout(timeoutRef.current);
            setGameState('too-early');
        } else if (gameState === 'go') {
            const time = Date.now() - startTimeRef.current;
            setReactionTime(time);
            if (time <= targetTime) {
                // Pass
                saveScore('reflex-challenge', level, level * 2);
                setGameState('level-up');
            } else {
                setGameState('result'); // Failed
            }
        }
    };

    return (
        <View style={styles.container}>
            {(gameState === 'intro' || gameState === 'result' || gameState === 'level-up' || gameState === 'too-early') && (
                <>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                        <Text style={styles.levelBadge}>Level {level}</Text>
                    </View>
                    <View style={styles.centerContent}>
                        {gameState === 'intro' && (
                            <>
                                <Zap size={64} color="#eab308" />
                                <Text style={styles.title}>Reflex Challenge</Text>
                                <Text style={styles.subtitle}>Tap when screen turns GREEN!</Text>
                                <Button title={`Start Level ${level}`} onPress={startRound} style={styles.startBtn} />
                            </>
                        )}
                        {gameState === 'result' && (
                            <>
                                <Text style={styles.emoji}>🐌</Text>
                                <Text style={styles.resultTitle}>Too Slow!</Text>
                                <Text style={styles.subtitle}>{reactionTime}ms (Target: {targetTime}ms)</Text>
                                <Button title="Try Again" onPress={startRound} style={styles.startBtn} />
                            </>
                        )}
                        {gameState === 'too-early' && (
                            <>
                                <Text style={styles.emoji}>⚠️</Text>
                                <Text style={styles.resultTitle}>Too Early!</Text>
                                <Button title="Try Again" onPress={startRound} style={styles.startBtn} />
                            </>
                        )}
                        {gameState === 'level-up' && (
                            <>
                                <Trophy size={64} color="#fbbf24" />
                                <Text style={styles.resultTitle}>Fast!</Text>
                                <Text style={styles.subtitle}>{reactionTime}ms</Text>
                                <Text style={styles.points}>+{level * 2} Points</Text>
                                <Button title="Next Level" onPress={() => { setLevel(l => l + 1); startRound(); }} style={styles.startBtn} />
                            </>
                        )}
                    </View>
                </>
            )}

            {(gameState === 'waiting' || gameState === 'go') && (
                <TouchableWithoutFeedback onPress={handlePress}>
                    <View style={[styles.fullScreen, gameState === 'waiting' ? styles.bgRed : styles.bgGreen]}>
                        <Text style={styles.gameText}>{message}</Text>
                        {gameState === 'waiting' && <Zap size={100} color="white" style={{ opacity: 0.5 }} />}
                    </View>
                </TouchableWithoutFeedback>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 40, padding: 20 },
    closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    levelBadge: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    title: { fontSize: 32, fontWeight: 'black', color: '#1e293b', marginBottom: 12, marginTop: 16 },
    subtitle: { fontSize: 16, color: '#64748b', marginTop: 8 },
    startBtn: { marginTop: 32, width: '100%' },
    resultTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: 'bold', color: '#6366f1', marginTop: 8 },
    emoji: { fontSize: 64 },
    // Game Area
    fullScreen: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    bgRed: { backgroundColor: '#ef4444' },
    bgGreen: { backgroundColor: '#22c55e' },
    gameText: { fontSize: 48, fontWeight: 'black', color: 'white', marginBottom: 40 }
});
