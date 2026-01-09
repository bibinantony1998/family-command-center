import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Timer, Trophy, X } from 'lucide-react-native';

const COLORS = [
    { name: 'RED', color: '#ef4444', label: 'Red' },
    { name: 'BLUE', color: '#3b82f6', label: 'Blue' },
    { name: 'GREEN', color: '#22c55e', label: 'Green' },
    { name: 'YELLOW', color: '#eab308', label: 'Yellow' },
    { name: 'PURPLE', color: '#a855f7', label: 'Purple' },
    { name: 'ORANGE', color: '#f97316', label: 'Orange' },
];

export default function ColorChaosScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over'>('intro');
    const [level, setLevel] = useState(1);
    const [startedLevel, setStartedLevel] = useState(1);
    const [timeLeft, setTimeLeft] = useState(30);
    const [word, setWord] = useState(COLORS[0]);
    const [ink, setInk] = useState(COLORS[1]);
    const [options, setOptions] = useState<string[]>([]);
    const [questionsAnswered, setQuestionsAnswered] = useState(0);

    const init = async () => {
        const lvl = await getHighestLevel('color-chaos');
        setStartedLevel(lvl);
        setLevel(lvl);
    };

    useEffect(() => { init(); }, []);

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
            }, 1000); // simplify to 1s ticks for mobile perf
        }
        return () => clearInterval(timer);
    }, [gameState]);

    const generateRound = useCallback(() => {
        // Limited pool based on level not really needed for colors, just use all
        const randomWord = COLORS[Math.floor(Math.random() * COLORS.length)];
        const randomInk = COLORS[Math.floor(Math.random() * COLORS.length)];

        setWord(randomWord);
        setInk(randomInk);

        const correct = randomInk.name;
        // Distractors
        const others = COLORS.filter(c => c.name !== correct).map(c => c.name);
        // Shuffle others
        others.sort(() => Math.random() - 0.5);

        const opts = [correct, others[0], others[1]];
        opts.sort(() => Math.random() - 0.5);
        setOptions(opts);
    }, []);

    const startGame = () => {
        setGameState('playing');
        setTimeLeft(30);
        setQuestionsAnswered(0);
        generateRound();
    };

    const handleOption = (selected: string) => {
        if (selected === ink.name) {
            if (questionsAnswered + 1 >= 10) {
                // Level Win
                saveScore('color-chaos', level, level * 2);
                setGameState('level-up');
            } else {
                setQuestionsAnswered(q => q + 1);
                generateRound();
            }
        } else {
            // Penalize
            setTimeLeft(t => Math.max(0, t - 5));
        }
    };

    const nextLevel = () => {
        setLevel(l => l + 1);
        startGame(); // Reset timers etc
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
                    <Text style={styles.title}>Color Chaos</Text>
                    <Text style={styles.subtitle}>Tap the COLOR of the text, not the word!</Text>
                    <Button title={`Start Level ${level}`} onPress={startGame} style={{ marginTop: 32, width: '100%' }} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={styles.gameContent}>
                    <Text style={styles.timer}>{timeLeft}s</Text>

                    <View style={styles.wordContainer}>
                        <Text style={[styles.wordText, { color: ink.color }]}>{word.name}</Text>
                    </View>

                    <View style={styles.options}>
                        {options.map(opt => (
                            <TouchableOpacity key={opt} style={styles.optionBtn} onPress={() => handleOption(opt)}>
                                <Text style={styles.optionText}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={styles.centerContent}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={styles.resultTitle}>Level Complete!</Text>
                    <Text style={styles.points}>+{level * 2} Points</Text>
                    <Button title="Next Level" onPress={nextLevel} style={{ marginTop: 32, width: '100%' }} />
                </View>
            )}

            {gameState === 'game-over' && (
                <View style={styles.centerContent}>
                    <Text style={styles.emoji}>😵‍💫</Text>
                    <Text style={styles.resultTitle}>Game Over</Text>
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
    gameContent: { flex: 1, paddingTop: 40 },
    timer: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#64748b', marginBottom: 40 },
    wordContainer: { alignItems: 'center', marginBottom: 60 },
    wordText: { fontSize: 64, fontWeight: 'black', letterSpacing: 2 },
    options: { gap: 16 },
    optionBtn: { backgroundColor: 'white', padding: 20, borderRadius: 16, borderWidth: 2, borderColor: '#e2e8f0', alignItems: 'center' },
    optionText: { fontSize: 20, fontWeight: 'bold', color: '#334155' },
    resultTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: 'bold', color: '#6366f1', marginTop: 8 },
    emoji: { fontSize: 64 }
});
