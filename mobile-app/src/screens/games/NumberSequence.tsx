import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X } from 'lucide-react-native';

function makeSeq(level: number) {
    const type = Math.floor(Math.random() * Math.min(level, 5));
    const start = Math.floor(Math.random() * 5) + 1;
    if (type === 0) { const d = Math.floor(Math.random() * (level + 2)) + 1; return { terms: [start, start + d, start + 2 * d, start + 3 * d], answer: start + 4 * d, hint: `+${d} each step` }; }
    if (type === 1) { const r = Math.floor(Math.random() * 2) + 2; return { terms: [start, start * r, start * r * r, start * r * r * r], answer: start * r * r * r * r, hint: `×${r} each step` }; }
    if (type === 2) { const a = Math.floor(Math.random() * 3) + 1, b = Math.floor(Math.random() * 3) + 2; return { terms: [a, b, a + b, a + 2 * b], answer: 2 * a + 3 * b, hint: 'Sum of previous two' }; }
    if (type === 3) { return { terms: [1, 4, 9, 16], answer: 25, hint: 'Perfect squares' }; }
    return { terms: [2, 4, 8, 16], answer: 32, hint: 'Powers of 2' };
}

const Q_PER_LEVEL = 5;

export default function NumberSequenceScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over'>('intro');
    const [seq, setSeq] = useState<ReturnType<typeof makeSeq> | null>(null);
    const [input, setInput] = useState('');
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
    const [qNum, setQNum] = useState(0);
    const [correct, setCorrect] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => { getHighestLevel('number-sequence').then(l => { setLevel(l); setLoading(false); }); }, []);

    const nextQ = (lvl: number, num: number, c: number) => {
        if (num >= Q_PER_LEVEL) {
            if (c >= Math.ceil(Q_PER_LEVEL * 0.8)) { saveScore('number-sequence', lvl, lvl * 2); setGameState('level-up'); }
            else setGameState('game-over');
            return;
        }
        setSeq(makeSeq(lvl)); setInput(''); setFeedback(null); setShowHint(false); setQNum(num);
    };

    const startLevel = (lvl: number) => {
        setLevel(lvl); setCorrect(0); setQNum(0); setSeq(makeSeq(lvl)); setInput(''); setFeedback(null); setShowHint(false); setGameState('playing');
    };

    const handleKey = (val: string) => {
        if (feedback) return;
        const next = input + val;
        setInput(next);
        if (parseInt(next) === seq!.answer) {
            setFeedback('correct'); const nc = correct + 1; setCorrect(nc);
            setTimeout(() => nextQ(level, qNum + 1, nc), 600);
        } else if (next.length >= String(seq!.answer).length) {
            setFeedback('wrong'); setTimeout(() => { setInput(''); setFeedback(null); }, 500);
        }
    };

    return (
        <View style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                <Text style={s.levelBadge}>Level {level} • {qNum + 1}/{Q_PER_LEVEL}</Text>
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.big}>🔢</Text>
                    <Text style={s.title}>Number Sequence</Text>
                    <Text style={s.subtitle}>Find the pattern and enter the next number!</Text>
                    <Button title={loading ? 'Loading...' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && seq && (
                <View style={s.playArea}>
                    <View style={[s.seqBox, feedback === 'correct' && s.correctBox, feedback === 'wrong' && s.wrongBox]}>
                        <View style={s.termsRow}>
                            {seq.terms.map((t, i) => <Text key={i} style={s.term}>{t} ,</Text>)}
                            <View style={[s.answerSlot, feedback === 'correct' && s.answerCorrect, feedback === 'wrong' && s.answerWrong]}>
                                <Text style={s.answerText}>{input || '?'}</Text>
                            </View>
                        </View>
                        {showHint && <Text style={s.hint}>💡 {seq.hint}</Text>}
                    </View>

                    <View style={s.numpad}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                            <TouchableOpacity key={n} onPress={() => handleKey(String(n))} style={s.key}>
                                <Text style={s.keyText}>{n}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity onPress={() => setInput('')} style={[s.key, s.keyGray]}><Text style={s.keyTextGray}>✕</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => handleKey('0')} style={s.key}><Text style={s.keyText}>0</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowHint(true)} style={[s.key, s.keyHint]}><Text style={s.keyTextHint}>Hint</Text></TouchableOpacity>
                    </View>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={s.center}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={s.resultTitle}>Level {level} Done!</Text>
                    <Text style={s.points}>+{level * 2} Points</Text>
                    <Button title="Next Level" onPress={() => { const next = level + 1; setLevel(next); startLevel(next); }} style={s.btn} />
                </View>
            )}

            {gameState === 'game-over' && (
                <View style={s.center}>
                    <Text style={s.big}>🔢</Text>
                    <Text style={s.resultTitle}>Keep Practicing!</Text>
                    <Text style={s.subtitle}>{correct}/{Q_PER_LEVEL} — need 80%</Text>
                    <Button title="Try Again" onPress={() => startLevel(level)} style={s.btn} />
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingTop: 48, paddingHorizontal: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    levelBadge: { fontSize: 14, fontWeight: '700', color: '#64748b' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    big: { fontSize: 64 },
    title: { fontSize: 32, fontWeight: '800', color: '#1e293b', marginTop: 12, marginBottom: 8 },
    subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 24 },
    btn: { width: '100%', marginTop: 8 },
    playArea: { flex: 1 },
    seqBox: { backgroundColor: '#f8fafc', borderRadius: 20, padding: 20, marginBottom: 24, borderWidth: 2, borderColor: '#e2e8f0', alignItems: 'center' },
    correctBox: { backgroundColor: '#f0fdf4', borderColor: '#22c55e' },
    wrongBox: { backgroundColor: '#fef2f2', borderColor: '#ef4444' },
    termsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 4 },
    term: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
    answerSlot: { width: 64, height: 44, borderRadius: 10, borderBottomWidth: 3, borderColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
    answerCorrect: { borderColor: '#22c55e' }, answerWrong: { borderColor: '#ef4444' },
    answerText: { fontSize: 22, fontWeight: '800', color: '#6366f1' },
    hint: { marginTop: 10, fontSize: 13, color: '#94a3b8' },
    numpad: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
    key: { width: 90, height: 56, borderRadius: 16, backgroundColor: 'white', borderWidth: 2, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
    keyText: { fontSize: 22, fontWeight: '700', color: '#1e293b' },
    keyGray: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
    keyTextGray: { fontSize: 18, color: '#ef4444', fontWeight: '700' },
    keyHint: { backgroundColor: '#fefce8', borderColor: '#fde68a' },
    keyTextHint: { fontSize: 14, color: '#d97706', fontWeight: '700' },
    resultTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 32 },
});
