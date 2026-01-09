import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, Type } from 'lucide-react-native';

const WORD_LIST = [
    ['CAT', 'DOG', 'SUN'],
    ['FISH', 'BIRD', 'JUMP'],
    ['APPLE', 'GRAPE', 'SMILE'],
    ['TIGER', 'ROBOT', 'CHAIR'],
    ['BANANA', 'ORANGE', 'PURPLE'],
    ['WINTER', 'YELLOW', 'PLANET'],
    ['MORNING', 'EVENING', 'KITCHEN'],
    ['UNICORN', 'VAMPIRE', 'BALLOON'],
    ['DIFFRENT', 'ELEPHANT', 'DYNOSAUR'],
    ['VACATION', 'ADVENTUR', 'CHOCOLAT']
];

export default function WordScrambleScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up'>('intro');
    const [currentWord, setCurrentWord] = useState('');
    const [letters, setLetters] = useState<{ char: string, id: number }[]>([]);
    const [input, setInput] = useState<{ char: string, id: number }[]>([]);
    const [wordsSolved, setWordsSolved] = useState(0);

    useEffect(() => { getHighestLevel('word-scramble').then(setLevel); }, []);

    const nextWord = () => {
        const pool = WORD_LIST[Math.min(level - 1, 9)];
        const word = pool[Math.floor(Math.random() * pool.length)];
        setCurrentWord(word);

        const shuffled = word.split('').map((c, i) => ({ char: c, id: i }))
            .sort(() => Math.random() - 0.5);
        setLetters(shuffled);
        setInput([]);
    };

    const startGame = () => {
        setWordsSolved(0);
        setGameState('playing');
        nextWord();
    };

    const handleLetterPress = (l: { char: string, id: number }) => {
        setInput(prev => [...prev, l]);
        setLetters(prev => prev.filter(item => item.id !== l.id));
    };

    const handleInputPress = (l: { char: string, id: number }) => {
        setLetters(prev => [...prev, l]);
        setInput(prev => prev.filter(item => item.id !== l.id));
    };

    useEffect(() => {
        if (input.length === currentWord.length && currentWord) {
            const guess = input.map(i => i.char).join('');
            if (guess === currentWord) {
                if (wordsSolved + 1 >= 3) {
                    saveScore('word-scramble', level, level * 2);
                    setGameState('level-up');
                } else {
                    setWordsSolved(w => w + 1);
                    setTimeout(nextWord, 500); // delay to show full word
                }
            }
        }
    }, [input]);

    const handleReset = () => {
        // Return all to bottom
        const all = [...input, ...letters];
        setInput([]);
        setLetters(all.sort(() => Math.random() - 0.5));
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                <Text style={styles.levelBadge}>Level {level}</Text>
            </View>

            {gameState === 'intro' && (
                <View style={styles.centerContent}>
                    <Type size={64} color="#8b5cf6" />
                    <Text style={styles.title}>Word Scramble</Text>
                    <Text style={styles.subtitle}>Unscramble 3 words to win!</Text>
                    <Button title={`Start Level ${level}`} onPress={startGame} style={styles.startBtn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={styles.centerContent}>
                    <Text style={styles.solved}>Solved: {wordsSolved}/3</Text>

                    {/* Input Slots */}
                    <View style={styles.inputRow}>
                        {Array.from({ length: currentWord.length }).map((_, i) => (
                            <TouchableOpacity
                                key={i}
                                style={styles.slot}
                                onPress={() => input[i] && handleInputPress(input[i])}
                            >
                                <Text style={styles.slotText}>{input[i]?.char || ''}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Letter Bank */}
                    <View style={styles.lettersRow}>
                        {letters.map((l) => (
                            <TouchableOpacity key={l.id} style={styles.letterBtn} onPress={() => handleLetterPress(l)}>
                                <Text style={styles.letterText}>{l.char}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Button title="Scramble" onPress={handleReset} variant="ghost" style={{ marginTop: 40 }} />
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={styles.centerContent}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={styles.resultTitle}>Vocabulary Pro!</Text>
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
    solved: { fontSize: 18, color: '#64748b', marginBottom: 40 },
    inputRow: { flexDirection: 'row', gap: 8, marginBottom: 40, minHeight: 60 },
    slot: { width: 40, height: 60, borderBottomWidth: 4, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
    slotText: { fontSize: 32, fontWeight: 'black', color: '#1e293b' },
    lettersRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
    letterBtn: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: '#e2e8f0' },
    letterText: { fontSize: 24, fontWeight: 'bold', color: '#4f46e5' }
});
