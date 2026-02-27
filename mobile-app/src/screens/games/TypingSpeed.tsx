import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X } from 'lucide-react-native';

const WORD_POOLS: string[][] = [
    // Level 1-3 — short simple
    ['cat', 'dog', 'sun', 'hat', 'run', 'big', 'red', 'cup', 'map', 'day', 'sky', 'top', 'hot', 'sit', 'pen'],
    // Level 4-6 — medium
    ['apple', 'light', 'brave', 'stone', 'cloud', 'tiger', 'greet', 'flame', 'crush', 'piano', 'river', 'smile', 'climb', 'speak', 'brush'],
    // Level 7-10 — longer
    ['garden', 'planet', 'bridge', 'frozen', 'search', 'simple', 'travel', 'orange', 'spring', 'listen', 'mirror', 'flower', 'pocket', 'silver', 'castle'],
    // Level 11+ — challenge
    ['keyboard', 'mountain', 'football', 'platinum', 'umbrella', 'thousand', 'alphabet', 'shoulder', 'treasure', 'skeleton', 'paradise', 'together', 'language', 'birthday', 'owledge'],
];

const GAME_DURATION = 60;
const WORDS_COUNT = 20;

function getPoolIndex(level: number) {
    if (level <= 3) return 0;
    if (level <= 6) return 1;
    if (level <= 10) return 2;
    return 3;
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export default function TypingSpeedScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'result'>('intro');
    const [words, setWords] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [input, setInput] = useState('');
    const [correct, setCorrect] = useState(0);
    const [incorrect, setIncorrect] = useState(0);
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
    const [loading, setLoading] = useState(true);
    const inputRef = useRef<TextInput>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        getHighestLevel('typing-speed').then(l => { setLevel(l); setLoading(false); });
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    const startLevel = (lvl: number) => {
        const pool = WORD_POOLS[getPoolIndex(lvl)];
        const wordList = shuffle(pool).concat(shuffle(pool)).concat(shuffle(pool)).slice(0, WORDS_COUNT);
        setWords(wordList);
        setCurrentIndex(0);
        setInput('');
        setCorrect(0);
        setIncorrect(0);
        setTimeLeft(GAME_DURATION);
        setGameState('playing');
        setTimeout(() => inputRef.current?.focus(), 200);

        timerRef.current = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) {
                    clearInterval(timerRef.current!);
                    setGameState('result');
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
    };

    const handleChange = (text: string) => {
        setInput(text);
        const current = words[currentIndex] || '';
        const typed = text.trim();
        if (typed === current) {
            setCorrect(c => c + 1);
            setCurrentIndex(i => {
                const next = i + 1;
                if (next >= words.length) {
                    clearInterval(timerRef.current!);
                    setGameState('result');
                }
                return next;
            });
            setInput('');
        }
    };

    const wpm = Math.round((correct / GAME_DURATION) * 60);
    const accuracy = correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 100) : 100;
    const points = Math.round(wpm * (accuracy / 100));

    const handleFinish = () => {
        saveScore('typing-speed', level, points);
    };

    useEffect(() => {
        if (gameState === 'result') handleFinish();
    }, [gameState]);

    const currentWord = words[currentIndex] || '';
    const inputCorrect = currentWord.startsWith(input) || input === '';
    const timerPct = timeLeft / GAME_DURATION;
    const timerColor = timerPct > 0.5 ? '#22c55e' : timerPct > 0.25 ? '#f59e0b' : '#ef4444';

    return (
        <View style={[s.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => { if (timerRef.current) clearInterval(timerRef.current); navigation.goBack(); }} style={s.closeBtn}>
                    <X size={24} color="#64748b" />
                </TouchableOpacity>
                {gameState === 'playing' && <Text style={s.levelBadge}>Level {level} • ⚡ Typing Speed</Text>}
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.emoji}>⌨️</Text>
                    <Text style={s.title}>Typing Speed</Text>
                    <Text style={s.subtitle}>Type each word correctly before time runs out. Accuracy matters!</Text>
                    <View style={s.rulesBox}>
                        <Text style={s.ruleText}>• {GAME_DURATION}-second timer</Text>
                        <Text style={s.ruleText}>• Type the highlighted word exactly</Text>
                        <Text style={s.ruleText}>• Word auto-advances when correct</Text>
                        <Text style={s.ruleText}>• Score = WPM × Accuracy %</Text>
                    </View>
                    <Button title={loading ? 'Loading…' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={s.playArea}>
                    {/* Timer bar */}
                    <View style={s.timerBar}>
                        <View style={[s.timerFill, { width: `${timerPct * 100}%` as any, backgroundColor: timerColor }]} />
                    </View>
                    <View style={s.statsRow}>
                        <Text style={s.stat}>⏱ {timeLeft}s</Text>
                        <Text style={s.stat}>✅ {correct}</Text>
                        <Text style={s.stat}>{currentIndex + 1}/{words.length}</Text>
                    </View>

                    {/* Word display */}
                    <View style={s.wordCard}>
                        <Text style={s.currentWord}>{currentWord}</Text>
                        <View style={s.upcomingRow}>
                            {words.slice(currentIndex + 1, currentIndex + 4).map((w, i) => (
                                <Text key={i} style={[s.upcomingWord, { opacity: 1 - i * 0.25 }]}>{w}</Text>
                            ))}
                        </View>
                    </View>

                    {/* Input */}
                    <TextInput
                        ref={inputRef}
                        style={[s.input, !inputCorrect && s.inputError]}
                        value={input}
                        onChangeText={handleChange}
                        autoCapitalize="none"
                        autoCorrect={false}
                        spellCheck={false}
                        placeholder="Type here…"
                        placeholderTextColor="#94a3b8"
                    />
                </View>
            )}

            {gameState === 'result' && (
                <View style={s.center}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={s.resultTitle}>Time's Up!</Text>
                    <View style={s.statsCard}>
                        <View style={s.statRow}>
                            <Text style={s.statLabel}>WPM</Text>
                            <Text style={s.statValue}>{wpm}</Text>
                        </View>
                        <View style={s.statRow}>
                            <Text style={s.statLabel}>Accuracy</Text>
                            <Text style={s.statValue}>{accuracy}%</Text>
                        </View>
                        <View style={s.statRow}>
                            <Text style={s.statLabel}>Words Typed</Text>
                            <Text style={s.statValue}>{correct}</Text>
                        </View>
                    </View>
                    <Text style={s.points}>+{points} Points</Text>
                    <Button title="Play Again" onPress={() => startLevel(level)} style={s.btn} />
                    <Button title={`Level ${level + 1}`} onPress={() => { const n = level + 1; setLevel(n); startLevel(n); }} style={[s.btn, { marginTop: 10 }]} variant="outline" />
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
    playArea: { flex: 1 },
    timerBar: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
    timerFill: { height: '100%', borderRadius: 4 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    stat: { fontSize: 14, fontWeight: '700', color: '#64748b' },
    wordCard: { backgroundColor: '#f8fafc', borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 24 },
    currentWord: { fontSize: 36, fontWeight: '800', color: '#1e293b', letterSpacing: 2, marginBottom: 16 },
    upcomingRow: { flexDirection: 'row', gap: 12 },
    upcomingWord: { fontSize: 15, color: '#94a3b8' },
    input: { height: 56, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 16, paddingHorizontal: 20, fontSize: 22, fontWeight: '600', color: '#1e293b', backgroundColor: '#fafafa' },
    inputError: { borderColor: '#fca5a5', backgroundColor: '#fff5f5' },
    resultTitle: { fontSize: 30, fontWeight: '800', color: '#1e293b', marginTop: 16 },
    statsCard: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, width: '100%', marginVertical: 16, gap: 4 },
    statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    statLabel: { fontSize: 15, color: '#64748b' },
    statValue: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginBottom: 24 },
});
