import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { X } from 'lucide-react-native';

const WORD_BANK = new Set([
    'ant', 'top', 'pen', 'net', 'tap', 'pan', 'nap', 'apt', 'tan', 'pot', 'not', 'ton', 'ten', 'pant',
    'apple', 'eagle', 'eel', 'lamp', 'piano', 'oak', 'king', 'game', 'echo', 'orange', 'elephant',
    'tiger', 'rat', 'table', 'eat', 'art', 'tree', 'egg', 'green', 'night', 'teacher', 'rabbit',
    'bat', 'tennis', 'sun', 'never', 'red', 'dog', 'garden', 'net', 'time', 'enter', 'ring', 'girl',
    'lion', 'nest', 'train', 'noodle', 'ear', 'arm', 'moon', 'name', 'eye', 'year', 'robot', 'text',
    'taxi', 'island', 'door', 'ring', 'gate', 'exit', 'trip', 'pink', 'kite', 'end',
    'dance', 'end', 'day', 'yes', 'star', 'river', 'rock', 'kangaroo', 'owl', 'wolf', 'fox', 'box',
    'x-ray', 'yellow', 'water', 'rain', 'inch', 'hat', 'turn', 'none', 'eel', 'last', 'town',
    'north', 'hand', 'drop', 'paper', 'race', 'cat', 'art', 'talk', 'know', 'word', 'duck',
]);

function lastLetter(word: string) { return word[word.length - 1].toUpperCase(); }
function firstLetter(word: string) { return word[0].toUpperCase(); }
function isValid(word: string, chain: string[]): { ok: boolean; reason: string } {
    const w = word.toLowerCase().trim();
    if (w.length < 3) return { ok: false, reason: 'Word must be 3+ letters' };
    if (!WORD_BANK.has(w)) return { ok: false, reason: `"${word}" not in word list` };
    if (chain.includes(w)) return { ok: false, reason: 'Word already used!' };
    if (chain.length > 0 && firstLetter(w) !== lastLetter(chain[chain.length - 1])) {
        return { ok: false, reason: `Must start with "${lastLetter(chain[chain.length - 1])}"` };
    }
    return { ok: true, reason: '' };
}

const STARTER_WORDS = ['apple', 'tiger', 'rabbit', 'ocean', 'umbrella', 'island', 'rain', 'elephant'];
const TIME_LIMITS = [60, 90, 120, 150, 180];

export default function WordChainScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'result'>('intro');
    const [chain, setChain] = useState<string[]>([]);
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const [timeLeft, setTimeLeft] = useState(60);
    const [loading, setLoading] = useState(true);
    const inputRef = useRef<TextInput>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const flatRef = useRef<FlatList>(null);

    useEffect(() => {
        getHighestLevel('word-chain').then(l => { setLevel(l); setLoading(false); });
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    const startLevel = (lvl: number) => {
        const starter = STARTER_WORDS[(lvl - 1) % STARTER_WORDS.length];
        const duration = TIME_LIMITS[Math.min(lvl - 1, TIME_LIMITS.length - 1)];
        setChain([starter]);
        setInput('');
        setError('');
        setTimeLeft(duration);
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

    const handleSubmit = () => {
        const w = input.trim().toLowerCase();
        const { ok, reason } = isValid(w, chain);
        if (!ok) {
            setError(reason);
            return;
        }
        setError('');
        const newChain = [...chain, w];
        setChain(newChain);
        setInput('');
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    };

    const pts = Math.max(chain.length - 1, 0) * level * 2;

    const handleFinish = () => {
        if (pts > 0) saveScore('word-chain', level, pts);
    };

    useEffect(() => {
        if (gameState === 'result') handleFinish();
    }, [gameState]);

    const timePct = timeLeft / TIME_LIMITS[Math.min(level - 1, TIME_LIMITS.length - 1)];
    const timerColor = timePct > 0.5 ? '#22c55e' : timePct > 0.25 ? '#f59e0b' : '#ef4444';
    const nextStart = chain.length > 0 ? lastLetter(chain[chain.length - 1]) : '?';

    return (
        <View style={[s.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => { if (timerRef.current) clearInterval(timerRef.current); navigation.goBack(); }} style={s.closeBtn}>
                    <X size={24} color="#64748b" />
                </TouchableOpacity>
                {gameState === 'playing' && <Text style={s.levelBadge}>Level {level} • Chain: {chain.length - 1}</Text>}
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.emoji}>🔗</Text>
                    <Text style={s.title}>Word Chain</Text>
                    <Text style={s.subtitle}>Each word must start with the last letter of the previous!</Text>
                    <View style={s.rulesBox}>
                        <Text style={s.ruleText}>• Example: apple → <Text style={{ color: '#4f46e5', fontWeight: '700' }}>E</Text>agle → <Text style={{ color: '#4f46e5', fontWeight: '700' }}>E</Text>el</Text>
                        <Text style={s.ruleText}>• Words must be 3+ letters</Text>
                        <Text style={s.ruleText}>• No repeating words</Text>
                        <Text style={s.ruleText}>• Build as long a chain as possible before time's up!</Text>
                    </View>
                    <Button title={loading ? 'Loading…' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={s.playArea}>
                    <View style={s.timerBar}>
                        <View style={[s.timerFill, { width: `${timePct * 100}%` as any, backgroundColor: timerColor }]} />
                    </View>
                    <Text style={s.timerText}>{timeLeft}s</Text>

                    <FlatList
                        ref={flatRef}
                        data={chain}
                        keyExtractor={(_, i) => i.toString()}
                        style={s.chainList}
                        renderItem={({ item, index }) => (
                            <View style={[s.chainItem, index === chain.length - 1 && s.chainItemLast]}>
                                <Text style={[s.chainWord, index === 0 && s.chainStarter]}>
                                    {index > 0 && <Text style={s.connector}>→ </Text>}
                                    <Text style={s.chainWordHighlight}>{item[0].toUpperCase()}</Text>
                                    {item.slice(1).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.chainContent}
                    />

                    <View style={s.promptBox}>
                        <Text style={s.promptText}>Next word must start with <Text style={s.nextLetter}>{nextStart}</Text></Text>
                    </View>

                    <View style={s.inputRow}>
                        <TextInput
                            ref={inputRef}
                            style={s.input}
                            value={input}
                            onChangeText={t => { setInput(t); setError(''); }}
                            onSubmitEditing={handleSubmit}
                            autoCapitalize="none"
                            autoCorrect={false}
                            placeholder={`${nextStart.toLowerCase()}...`}
                            placeholderTextColor="#94a3b8"
                            returnKeyType="done"
                        />
                        <TouchableOpacity style={s.goBtn} onPress={handleSubmit}>
                            <Text style={s.goBtnText}>GO</Text>
                        </TouchableOpacity>
                    </View>
                    {error ? <Text style={s.error}>{error}</Text> : null}
                </View>
            )}

            {gameState === 'result' && (
                <View style={s.center}>
                    <Text style={s.emoji}>⏰</Text>
                    <Text style={s.resultTitle}>Time's Up!</Text>
                    <Text style={s.chainLength}>{chain.length - 1} words chained</Text>
                    <Text style={s.points}>+{pts} Points</Text>
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
    ruleText: { fontSize: 13, color: '#475569', lineHeight: 20 },
    btn: { width: '100%' },
    playArea: { flex: 1 },
    timerBar: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
    timerFill: { height: '100%', borderRadius: 4 },
    timerText: { fontSize: 13, fontWeight: '700', color: '#64748b', textAlign: 'right', marginBottom: 12 },
    chainList: { maxHeight: 80, flexGrow: 0, marginBottom: 16 },
    chainContent: { alignItems: 'center', paddingHorizontal: 4 },
    chainItem: { marginRight: 4 },
    chainItemLast: {},
    chainStarter: { color: '#059669' },
    chainWord: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
    chainWordHighlight: { color: '#4f46e5', fontSize: 18 },
    connector: { color: '#94a3b8' },
    promptBox: { backgroundColor: '#eef2ff', padding: 12, borderRadius: 14, marginBottom: 16, alignItems: 'center' },
    promptText: { fontSize: 14, color: '#4338ca', fontWeight: '600' },
    nextLetter: { fontSize: 18, fontWeight: '900', color: '#4f46e5' },
    inputRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
    input: { flex: 1, height: 52, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 14, paddingHorizontal: 16, fontSize: 20, fontWeight: '600', color: '#1e293b' },
    goBtn: { width: 64, height: 52, backgroundColor: '#4f46e5', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    goBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    error: { color: '#ef4444', fontWeight: '600', fontSize: 13, textAlign: 'center' },
    resultTitle: { fontSize: 30, fontWeight: '800', color: '#1e293b', marginTop: 16 },
    chainLength: { fontSize: 18, color: '#64748b', marginTop: 8 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginVertical: 16 },
});
