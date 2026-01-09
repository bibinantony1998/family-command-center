import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Timer, Trophy, X } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, interpolate, withSequence, withTiming } from 'react-native-reanimated';

const EMOJIS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯'];

interface Card {
    id: number;
    emoji: string;
    isFlipped: boolean;
    isMatched: boolean;
}

const CardItem = ({ card, onPress }: { card: Card, onPress: () => void }) => {
    // Basic Flip Animation could go here, but for now simple conditional render or opacity transition
    // React Native Reanimated is great but complex for one-shot.
    // Let's do simple style changes for V1.
    return (
        <TouchableOpacity
            style={[styles.card, (card.isFlipped || card.isMatched) ? styles.cardFlipped : styles.cardBack]}
            onPress={onPress}
            activeOpacity={0.8}
            disabled={card.isFlipped || card.isMatched}
        >
            {(card.isFlipped || card.isMatched) && <Text style={styles.cardEmoji}>{card.emoji}</Text>}
        </TouchableOpacity>
    );
};

export default function MemoryMatchScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();

    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over'>('intro');
    const [level, setLevel] = useState(1);
    const [cards, setCards] = useState<Card[]>([]);
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [timeLeft, setTimeLeft] = useState(60);

    const init = async () => {
        const lvl = await getHighestLevel('memory-match');
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
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [gameState]);

    const startGame = () => {
        setGameState('playing');
        setTimeLeft(30 + (level * 10));

        let pairs = Math.min(EMOJIS.length, 2 + Math.floor(level / 2));
        if (pairs > 8) pairs = 8; // Max 16 cards (4x4) to fit screen easily

        const selected = EMOJIS.slice(0, pairs);
        const deck = [...selected, ...selected]
            .sort(() => Math.random() - 0.5)
            .map((emoji, i) => ({ id: i, emoji, isFlipped: false, isMatched: false }));

        setCards(deck);
        setFlippedIndices([]);
    };

    const handleCardPress = (index: number) => {
        if (flippedIndices.length >= 2) return;

        const newCards = [...cards];
        newCards[index].isFlipped = true;
        setCards(newCards);

        const newFlipped = [...flippedIndices, index];
        setFlippedIndices(newFlipped);

        if (newFlipped.length === 2) {
            const [idx1, idx2] = newFlipped;
            if (newCards[idx1].emoji === newCards[idx2].emoji) {
                // Match
                newCards[idx1].isMatched = true;
                newCards[idx2].isMatched = true;
                setCards(newCards);
                setFlippedIndices([]);

                if (newCards.every(c => c.isMatched)) {
                    // Win
                    saveScore('memory-match', level, level * 2);
                    setGameState('level-up');
                }
            } else {
                // No Match
                setTimeout(() => {
                    setCards(prev => prev.map((c, i) =>
                        (i === idx1 || i === idx2) ? { ...c, isFlipped: false } : c
                    ));
                    setFlippedIndices([]);
                }, 1000);
            }
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
                    <Text style={styles.title}>Memory Match</Text>
                    <Text style={styles.subtitle}>Find all the pairs before time runs out!</Text>
                    <Button title={`Start Level ${level}`} onPress={startGame} style={{ marginTop: 32, width: '100%' }} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={styles.gameContent}>
                    <Text style={styles.timer}>{timeLeft}s</Text>
                    <View style={styles.grid}>
                        {cards.map((card, idx) => (
                            <CardItem key={idx} card={card} onPress={() => handleCardPress(idx)} />
                        ))}
                    </View>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={styles.centerContent}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={styles.resultTitle}>Level Complete!</Text>
                    <Text style={styles.points}>+{level * 2} Points</Text>
                    <Button title="Next Level" onPress={() => { setLevel(l => l + 1); startGame(); }} style={{ marginTop: 32, width: '100%' }} />
                </View>
            )}

            {gameState === 'game-over' && (
                <View style={styles.centerContent}>
                    <Text style={styles.emoji}>🕰️</Text>
                    <Text style={styles.resultTitle}>Time's Up!</Text>
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
    gameContent: { flex: 1, paddingTop: 20 },
    timer: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#64748b', marginBottom: 20 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
    card: { width: 70, height: 70, borderRadius: 12, justifyContent: 'center', alignItems: 'center', margin: 4 },
    cardBack: { backgroundColor: '#6366f1' },
    cardFlipped: { backgroundColor: 'white', borderWidth: 2, borderColor: '#e2e8f0' },
    cardEmoji: { fontSize: 32 },
    resultTitle: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: 'bold', color: '#6366f1', marginTop: 8 },
    emoji: { fontSize: 64 }
});
