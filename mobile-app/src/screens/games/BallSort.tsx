import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, FlaskConical, RefreshCw } from 'lucide-react-native';

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];
const COLOR_LABELS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
const TUBE_CAP = 4;

function getLevelConfig(level: number) {
    const numColors = Math.min(2 + Math.floor((level - 1) / 2), 5);
    return { numColors, numTubes: numColors + 2 };
}

function generatePuzzle(numColors: number, numTubes: number): string[][] {
    const all: string[] = [];
    for (let c = 0; c < numColors; c++)
        for (let i = 0; i < TUBE_CAP; i++) all.push(COLOR_LABELS[c]);
    for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
    }
    const tubes: string[][] = Array.from({ length: numTubes }, () => []);
    let idx = 0;
    for (let t = 0; t < numColors; t++)
        for (let i = 0; i < TUBE_CAP; i++) tubes[t].push(all[idx++]);
    return tubes;
}

function isSolved(tubes: string[][]): boolean {
    return tubes.every(t => t.length === 0 || (t.length === TUBE_CAP && t.every(b => b === t[0])));
}

export default function BallSortScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up'>('intro');
    const [tubes, setTubes] = useState<string[][]>([]);
    const [selected, setSelected] = useState<number | null>(null);
    const [moves, setMoves] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => { getHighestLevel('ball-sort').then(l => { setLevel(l); setLoading(false); }); }, []);

    const startLevel = (lvl: number) => {
        const { numColors, numTubes } = getLevelConfig(lvl);
        setTubes(generatePuzzle(numColors, numTubes));
        setSelected(null); setMoves(0); setGameState('playing');
    };

    const handleTube = async (idx: number) => {
        if (selected === null) { if (tubes[idx].length > 0) setSelected(idx); return; }
        if (selected === idx) { setSelected(null); return; }
        const top = tubes[selected][tubes[selected].length - 1];
        const dst = tubes[idx];
        if (dst.length >= TUBE_CAP || (dst.length > 0 && dst[dst.length - 1] !== top)) { setSelected(idx); return; }
        const next = tubes.map(t => [...t]);
        next[selected].pop(); next[idx].push(top);
        setTubes(next); setSelected(null); setMoves(m => m + 1);
        if (isSolved(next)) { saveScore('ball-sort', level, level * 2); setGameState('level-up'); }
    };

    return (
        <View style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                <Text style={s.levelBadge}>Level {level} • {moves} moves</Text>
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <FlaskConical size={64} color="#a855f7" />
                    <Text style={s.title}>Ball Sort</Text>
                    <Text style={s.subtitle}>Sort colored balls into matching tubes</Text>
                    <View style={s.rules}>
                        <Text style={s.ruleText}>• Tap a tube to pick up the top ball</Text>
                        <Text style={s.ruleText}>• Tap another tube to place it</Text>
                        <Text style={s.ruleText}>• Only same-colored balls can stack</Text>
                    </View>
                    <Button title={loading ? 'Loading...' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && (
                <ScrollView contentContainerStyle={s.gameArea}>
                    <View style={s.tubesRow}>
                        {tubes.map((tube, ti) => (
                            <TouchableOpacity key={ti} onPress={() => handleTube(ti)}
                                style={[s.tube, selected === ti && s.tubeSelected]}>
                                {[...Array(TUBE_CAP)].map((_, bi) => {
                                    const ball = tube[TUBE_CAP - 1 - bi];
                                    const colorIdx = ball ? COLOR_LABELS.indexOf(ball) : -1;
                                    return (
                                        <View key={bi} style={[s.ball, ball ? { backgroundColor: COLORS[colorIdx] } : s.emptySlot]} />
                                    );
                                })}
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TouchableOpacity onPress={() => startLevel(level)} style={s.resetRow}>
                        <RefreshCw size={16} color="#94a3b8" />
                        <Text style={s.resetText}>Reset</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

            {gameState === 'level-up' && (
                <View style={s.center}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={s.resultTitle}>Sorted! 🎉</Text>
                    <Text style={s.points}>+{level * 2} Points</Text>
                    <Button title="Next Level" onPress={() => { const next = level + 1; setLevel(next); startLevel(next); }} style={s.btn} />
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingTop: 48, paddingHorizontal: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    levelBadge: { fontSize: 14, fontWeight: '700', color: '#64748b' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    title: { fontSize: 32, fontWeight: '800', color: '#1e293b', marginTop: 16, marginBottom: 8 },
    subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 24 },
    rules: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, width: '100%', marginBottom: 24 },
    ruleText: { fontSize: 14, color: '#475569', marginBottom: 6 },
    btn: { width: '100%', marginTop: 8 },
    gameArea: { alignItems: 'center', paddingTop: 16 },
    tubesRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
    tube: { width: 50, padding: 4, gap: 3, alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, backgroundColor: '#f8fafc', minHeight: 160 },
    tubeSelected: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
    ball: { width: 38, height: 38, borderRadius: 19 },
    emptySlot: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed' },
    resetRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 24 },
    resetText: { color: '#94a3b8', fontWeight: '500' },
    resultTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 32 },
});
