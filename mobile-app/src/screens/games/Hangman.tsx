import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X } from 'lucide-react-native';

const WORDS_BY_LEVEL: string[][] = [
    // 1-3: 3-4 letter words
    ['cat', 'dog', 'sun', 'hat', 'run', 'cup', 'map', 'sky', 'top', 'pen', 'big', 'red', 'hot', 'sit', 'joy', 'fly', 'sea', 'ant', 'owl', 'fox'],
    // 4-6: 5-letter
    ['apple', 'tiger', 'chair', 'cloud', 'flame', 'river', 'piano', 'brave', 'stone', 'greet', 'smile', 'climb', 'brush', 'ocean', 'light'],
    // 7-10: 6-letter
    ['castle', 'bridge', 'flower', 'silver', 'pocket', 'garden', 'travel', 'orange', 'mirror', 'frozen', 'planet', 'search', 'simple', 'listen', 'choose'],
    // 11+: 7-8 letter
    ['dolphin', 'unicorn', 'diamond', 'rainbow', 'captain', 'kitchen', 'morning', 'thunder', 'blanket', 'chicken', 'journey', 'science', 'freedom', 'mystery', 'balloon'],
];

const MAX_WRONG = 6;
const BODY_PARTS = ['😶', '🤜', '🤛', '🦵', '🦵', '😵'];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function getPoolIndex(level: number) {
    if (level <= 3) return 0;
    if (level <= 6) return 1;
    if (level <= 10) return 2;
    return 3;
}

function pickWord(level: number) {
    const pool = WORDS_BY_LEVEL[getPoolIndex(level)];
    return pool[Math.floor(Math.random() * pool.length)].toUpperCase();
}

export default function HangmanScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'won' | 'lost'>('intro');
    const [word, setWord] = useState('');
    const [guessed, setGuessed] = useState<Set<string>>(new Set());
    const [wrongCount, setWrongCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [score, setScore] = useState(0);
    const [wordsWon, setWordsWon] = useState(0);

    useEffect(() => {
        getHighestLevel('hangman').then(l => { setLevel(l); setLoading(false); });
    }, []);

    const startLevel = (lvl: number) => {
        setWord(pickWord(lvl));
        setGuessed(new Set());
        setWrongCount(0);
        setWordsWon(0);
        setScore(0);
        setGameState('playing');
    };

    const handleGuess = (letter: string) => {
        if (guessed.has(letter) || gameState !== 'playing') return;
        const newGuessed = new Set(guessed);
        newGuessed.add(letter);
        setGuessed(newGuessed);

        if (!word.includes(letter)) {
            const newWrong = wrongCount + 1;
            setWrongCount(newWrong);
            if (newWrong >= MAX_WRONG) {
                setGameState('lost');
            }
        } else {
            // check if won
            const allRevealed = word.split('').every(c => newGuessed.has(c));
            if (allRevealed) {
                const pts = (MAX_WRONG - wrongCount) * level * 2;
                setScore(s => s + pts);
                setWordsWon(w => w + 1);
                saveScore('hangman', level, pts);
                setGameState('won');
            }
        }
    };

    const hangBodyParts: string[] = [];
    // Head
    if (wrongCount >= 1) hangBodyParts.push('○');
    // Body
    if (wrongCount >= 2) hangBodyParts.push('|');
    // Arms
    if (wrongCount >= 3) hangBodyParts.push('/');
    if (wrongCount >= 4) hangBodyParts.push('\\');
    // Legs
    if (wrongCount >= 5) hangBodyParts.push('/');
    if (wrongCount >= 6) hangBodyParts.push('\\');

    // ASCII gallows
    const gallows = [
        '  ╔═══╗',
        `  ║   ${wrongCount >= 1 ? '😬' : ' '}`,
        `  ║   ${wrongCount >= 2 ? '|' : ' '}`,
        `  ║  ${wrongCount >= 3 ? '/' : ' '}${wrongCount >= 2 ? '|' : ' '}${wrongCount >= 4 ? '\\' : ' '}`,
        `  ║  ${wrongCount >= 5 ? '/' : ' '} ${wrongCount >= 6 ? '\\' : ' '}`,
        '══╩══',
    ];

    const displayWord = word.split('').map(c => (guessed.has(c) ? c : '_')).join(' ');

    return (
        <View style={[s.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}>
                    <X size={24} color="#64748b" />
                </TouchableOpacity>
                {gameState === 'playing' && (
                    <Text style={s.levelBadge}>Level {level} • {MAX_WRONG - wrongCount} left</Text>
                )}
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.emoji}>🪢</Text>
                    <Text style={s.title}>Hangman</Text>
                    <Text style={s.subtitle}>Guess the hidden word one letter at a time!</Text>
                    <View style={s.rulesBox}>
                        <Text style={s.ruleText}>• Tap letters to guess</Text>
                        <Text style={s.ruleText}>• {MAX_WRONG} wrong guesses = game over</Text>
                        <Text style={s.ruleText}>• Fewer mistakes = more points</Text>
                        <Text style={s.ruleText}>• Words get longer as levels increase</Text>
                    </View>
                    <Button title={loading ? 'Loading…' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={s.playArea}>
                    {/* Gallows */}
                    <View style={s.gallowsBox}>
                        {gallows.map((line, i) => (
                            <Text key={i} style={s.gallowsText}>{line}</Text>
                        ))}
                    </View>

                    {/* Hearts / lives */}
                    <View style={s.livesRow}>
                        {Array.from({ length: MAX_WRONG }, (_, i) => (
                            <Text key={i} style={s.heart}>{i < wrongCount ? '🖤' : '❤️'}</Text>
                        ))}
                    </View>

                    {/* Word blanks */}
                    <Text style={s.wordDisplay}>{displayWord}</Text>

                    {/* Alphabet */}
                    <View style={s.keyboard}>
                        {ALPHABET.map(letter => {
                            const isGuessed = guessed.has(letter);
                            const isCorrect = isGuessed && word.includes(letter);
                            const isWrong = isGuessed && !word.includes(letter);
                            return (
                                <TouchableOpacity
                                    key={letter}
                                    style={[s.key, isCorrect && s.keyCorrect, isWrong && s.keyWrong]}
                                    onPress={() => handleGuess(letter)}
                                    disabled={isGuessed}
                                >
                                    <Text style={[s.keyText, isGuessed && s.keyTextUsed]}>{letter}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            )}

            {(gameState === 'won' || gameState === 'lost') && (
                <View style={s.center}>
                    <Text style={s.emoji}>{gameState === 'won' ? '🎉' : '💀'}</Text>
                    <Text style={s.resultTitle}>{gameState === 'won' ? 'You got it!' : 'Game Over'}</Text>
                    {gameState === 'lost' && <Text style={s.subtitle}>The word was: <Text style={{ fontWeight: '800', color: '#1e293b' }}>{word}</Text></Text>}
                    {gameState === 'won' && <Text style={s.points}>+{score} Points</Text>}
                    <Button title="Next Word" onPress={() => { if (gameState === 'lost') { startLevel(level); } else { const n = level + 1; setLevel(n); startLevel(n); } }} style={s.btn} />
                    <Button title="Menu" onPress={() => navigation.goBack()} style={[s.btn, { marginTop: 10 }]} variant="outline" />
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 44, marginBottom: 8 },
    closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    levelBadge: { fontSize: 14, fontWeight: '700', color: '#64748b' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emoji: { fontSize: 64, marginBottom: 12 },
    title: { fontSize: 30, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    rulesBox: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 14, width: '100%', marginBottom: 28, gap: 6 },
    ruleText: { fontSize: 13, color: '#475569', lineHeight: 18 },
    btn: { width: '100%' },
    playArea: { flex: 1, alignItems: 'center' },
    gallowsBox: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, marginBottom: 12, alignSelf: 'stretch', alignItems: 'center' },
    gallowsText: { fontFamily: 'monospace', fontSize: 20, color: '#334155', lineHeight: 26 },
    livesRow: { flexDirection: 'row', gap: 4, marginBottom: 16 },
    heart: { fontSize: 20 },
    wordDisplay: { fontSize: 30, fontWeight: '800', letterSpacing: 6, color: '#1e293b', marginBottom: 20 },
    keyboard: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
    key: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    keyCorrect: { backgroundColor: '#dcfce7', borderColor: '#86efac' },
    keyWrong: { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
    keyText: { fontSize: 14, fontWeight: '700', color: '#334155' },
    keyTextUsed: { color: '#cbd5e1' },
    resultTitle: { fontSize: 30, fontWeight: '800', color: '#1e293b', marginTop: 16, marginBottom: 8 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 4, marginBottom: 28 },
});
