import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, RefreshCw } from 'lucide-react-native';

const COLORS_4 = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];
const COLORS_5 = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];
const COLORS_6 = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
const COLOR_LABELS = ['🔴', '🔵', '🟢', '🟡', '🟣', '🩷'];

function getColors(level: number) {
    if (level <= 4) return COLORS_4;
    if (level <= 8) return COLORS_5;
    return COLORS_6;
}
function getCodeLength(level: number) {
    return level <= 6 ? 4 : 5;
}

function makeCode(colors: string[], length: number): string[] {
    return Array.from({ length }, () => colors[Math.floor(Math.random() * colors.length)]);
}

function scoreGuess(secret: string[], guess: string[]): { exact: number; color: number } {
    let exact = 0, color = 0;
    const sRem = [...secret], gRem = [...guess];
    for (let i = 0; i < secret.length; i++) {
        if (secret[i] === guess[i]) { exact++; sRem[i] = ''; gRem[i] = ''; }
    }
    for (let i = 0; i < gRem.length; i++) {
        if (!gRem[i]) continue;
        const j = sRem.indexOf(gRem[i]);
        if (j >= 0) { color++; sRem[j] = ''; }
    }
    return { exact, color };
}

interface GuessRow { guess: string[]; exact: number; color: number; }

const MAX_GUESSES = 8;

export default function CodeBreakerScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'won' | 'lost'>('intro');
    const [secret, setSecret] = useState<string[]>([]);
    const [colors, setColors] = useState<string[]>(COLORS_4);
    const [codeLen, setCodeLen] = useState(4);
    const [current, setCurrent] = useState<string[]>([]);
    const [history, setHistory] = useState<GuessRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getHighestLevel('code-breaker').then(l => { setLevel(l); setLoading(false); });
    }, []);

    const startLevel = (lvl: number) => {
        const c = getColors(lvl);
        const len = getCodeLength(lvl);
        setColors(c);
        setCodeLen(len);
        setSecret(makeCode(c, len));
        setCurrent([]);
        setHistory([]);
        setGameState('playing');
    };

    const addColor = (col: string) => {
        if (current.length < codeLen) setCurrent(c => [...c, col]);
    };

    const removeLast = () => setCurrent(c => c.slice(0, -1));

    const submitGuess = () => {
        if (current.length !== codeLen) return;
        const result = scoreGuess(secret, current);
        const newHistory = [...history, { guess: [...current], ...result }];
        setHistory(newHistory);
        setCurrent([]);
        if (result.exact === codeLen) {
            saveScore('code-breaker', level, (MAX_GUESSES - newHistory.length + 1) * level * 4);
            setGameState('won');
        } else if (newHistory.length >= MAX_GUESSES) {
            setGameState('lost');
        }
    };

    const colorLabel = (col: string) => COLOR_LABELS[COLORS_6.indexOf(col)] ?? '⬜';

    return (
        <View style={[s.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                {gameState === 'playing' && (
                    <>
                        <Text style={s.levelBadge}>Level {level} • {MAX_GUESSES - history.length} guesses left</Text>
                        <TouchableOpacity onPress={() => startLevel(level)} style={s.closeBtn}><RefreshCw size={20} color="#64748b" /></TouchableOpacity>
                    </>
                )}
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.emoji}>🔐</Text>
                    <Text style={s.title}>Code Breaker</Text>
                    <Text style={s.subtitle}>Crack the hidden color code using deduction!</Text>
                    <View style={s.rulesBox}>
                        <Text style={s.ruleText}>• Guess the secret color sequence</Text>
                        <Text style={s.ruleText}>• ⬛ = right color, right position</Text>
                        <Text style={s.ruleText}>• ⬜ = right color, wrong position</Text>
                        <Text style={s.ruleText}>• You have {MAX_GUESSES} guesses total</Text>
                    </View>
                    <Button title={loading ? 'Loading…' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                    {/* History */}
                    {history.map((row, ri) => (
                        <View key={ri} style={s.histRow}>
                            <View style={s.pegsRow}>
                                {row.guess.map((c, ci) => (
                                    <View key={ci} style={[s.peg, { backgroundColor: c }]} />
                                ))}
                            </View>
                            <View style={s.feedbackBox}>
                                <Text style={s.feedbackText}>⬛×{row.exact}  ⬜×{row.color}</Text>
                            </View>
                        </View>
                    ))}

                    {/* Current input row */}
                    <View style={s.currentRow}>
                        {Array.from({ length: codeLen }, (_, i) => (
                            <View key={i} style={[s.peg, s.pegLarge, { backgroundColor: current[i] ?? '#e2e8f0' }]} />
                        ))}
                    </View>

                    {/* Color palette */}
                    <View style={s.palette}>
                        {colors.map((col, i) => (
                            <TouchableOpacity key={i} onPress={() => addColor(col)} style={[s.colorBtn, { backgroundColor: col }]} />
                        ))}
                    </View>

                    {/* Actions */}
                    <View style={s.actions}>
                        <Button title="⌫ Remove" onPress={removeLast} variant="outline" style={s.halfBtn} />
                        <Button title="Submit" onPress={submitGuess} disabled={current.length !== codeLen} style={s.halfBtn} />
                    </View>
                </ScrollView>
            )}

            {(gameState === 'won' || gameState === 'lost') && (
                <View style={s.center}>
                    <Text style={s.emoji}>{gameState === 'won' ? '🎉' : '💔'}</Text>
                    <Text style={s.resultTitle}>{gameState === 'won' ? 'Code Cracked!' : 'Code Survived'}</Text>
                    {gameState === 'lost' && (
                        <View style={s.revealRow}>
                            <Text style={s.revealLabel}>The code was: </Text>
                            {secret.map((c, i) => <View key={i} style={[s.peg, s.pegLarge, { backgroundColor: c }]} />)}
                        </View>
                    )}
                    {gameState === 'won' && (
                        <Text style={s.points}>+{(MAX_GUESSES - history.length + 1) * level * 4} Points</Text>
                    )}
                    <Button title={gameState === 'won' ? 'Next Level' : 'Try Again'} onPress={() => { const n = gameState === 'won' ? level + 1 : level; setLevel(n); startLevel(n); }} style={s.btn} />
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 44, marginBottom: 8 },
    closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    levelBadge: { fontSize: 13, fontWeight: '700', color: '#64748b' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emoji: { fontSize: 64, marginBottom: 12 },
    title: { fontSize: 30, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    rulesBox: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 14, width: '100%', marginBottom: 28, gap: 6 },
    ruleText: { fontSize: 13, color: '#475569', lineHeight: 18 },
    btn: { width: '100%' },
    histRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#f8fafc', borderRadius: 14, padding: 10 },
    pegsRow: { flexDirection: 'row', gap: 8, flex: 1 },
    peg: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(0,0,0,0.1)' },
    pegLarge: { width: 44, height: 44, borderRadius: 22 },
    feedbackBox: { paddingLeft: 12 },
    feedbackText: { fontSize: 13, fontWeight: '700', color: '#475569' },
    currentRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginVertical: 16 },
    palette: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 20 },
    colorBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, borderColor: 'rgba(0,0,0,0.15)' },
    actions: { flexDirection: 'row', gap: 12 },
    halfBtn: { flex: 1 },
    revealRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    revealLabel: { fontSize: 14, color: '#64748b' },
    resultTitle: { fontSize: 30, fontWeight: '800', color: '#1e293b', marginTop: 16, marginBottom: 8 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 4, marginBottom: 28 },
});
