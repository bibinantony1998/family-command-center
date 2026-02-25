import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X } from 'lucide-react-native';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const SEQ_LEN = 20;
const SHOW_MS = 600;
const INTERVAL_MS = 2500;

const getNFromLevel = (l: number) => l <= 2 ? 1 : l <= 5 ? 2 : l <= 8 ? 3 : 4;

function makeSeq(n: number): string[] {
    const seq: string[] = [];
    for (let i = 0; i < SEQ_LEN; i++) {
        if (i >= n && Math.random() < 0.3) seq.push(seq[i - n]);
        else seq.push(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
    }
    return seq;
}

export default function NBackScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();
    const [level, setLevel] = useState(1);
    const [n, setN] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over'>('intro');
    const [seq, setSeq] = useState<string[]>([]);
    const [idx, setIdx] = useState(-1);
    const [letter, setLetter] = useState('');
    const [visible, setVisible] = useState(false);
    const [score, setScore] = useState({ correct: 0, wrong: 0, total: 0 });
    const [answered, setAnswered] = useState(false);
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
    const [loading, setLoading] = useState(true);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);
    const refs = useRef({ idx: -1, seq: [] as string[], n: 1, answered: false, score: { correct: 0, wrong: 0, total: 0 } });

    useEffect(() => { getHighestLevel('n-back').then(l => { setLevel(l); setLoading(false); }); }, []);
    useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

    const startLevel = (lvl: number) => {
        const nVal = getNFromLevel(lvl);
        const s = makeSeq(nVal);
        refs.current = { idx: -1, seq: s, n: nVal, answered: false, score: { correct: 0, wrong: 0, total: 0 } };
        setLevel(lvl); setN(nVal); setSeq(s); setIdx(-1); setScore({ correct: 0, wrong: 0, total: 0 }); setGameState('playing');
        if (timer.current) clearInterval(timer.current);
        let i = 0;
        timer.current = setInterval(() => {
            if (i >= SEQ_LEN) {
                clearInterval(timer.current!);
                const sc = refs.current.score;
                const acc = sc.total > 0 ? sc.correct / sc.total : 1;
                if (acc >= 0.7) { saveScore('n-back', lvl, lvl * 2); setGameState('level-up'); }
                else setGameState('game-over');
                return;
            }
            refs.current.idx = i; refs.current.answered = false;
            setIdx(i); setLetter(refs.current.seq[i]); setVisible(true); setAnswered(false); setFeedback(null);
            setTimeout(() => setVisible(false), SHOW_MS);
            i++;
        }, INTERVAL_MS);
    };

    const handleMatch = () => {
        if (refs.current.answered || refs.current.idx < refs.current.n) return;
        refs.current.answered = true; setAnswered(true);
        const isMatch = refs.current.seq[refs.current.idx] === refs.current.seq[refs.current.idx - refs.current.n];
        const sc = { ...refs.current.score, total: refs.current.score.total + 1 };
        if (isMatch) { sc.correct++; setFeedback('correct'); } else { sc.wrong++; setFeedback('wrong'); }
        refs.current.score = sc; setScore(sc);
    };

    return (
        <View style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => { if (timer.current) clearInterval(timer.current); navigation.goBack(); }} style={s.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                <Text style={s.levelBadge}>Level {level} • {n}-Back</Text>
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.big}>🧠</Text>
                    <Text style={s.title}>N-Back</Text>
                    <Text style={s.subtitle}>Press MATCH when the letter matches {n} step{n > 1 ? 's' : ''} ago</Text>
                    <View style={s.rules}>
                        <Text style={s.ruleText}>• Level 1-2: 1-Back</Text>
                        <Text style={s.ruleText}>• Level 3-5: 2-Back</Text>
                        <Text style={s.ruleText}>• Level 6-8: 3-Back, 9-10: 4-Back</Text>
                        <Text style={s.ruleText}>• Need 70%+ accuracy to advance</Text>
                    </View>
                    <Button title={loading ? 'Loading...' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={s.center}>
                    <View style={[s.letterBox, visible && s.letterActive]}>
                        <Text style={[s.letterText, visible && s.letterTextActive]}>{visible ? letter : '?'}</Text>
                    </View>
                    {idx >= n && <Text style={s.hint}>{n} step ago: <Text style={s.hintVal}>{seq[idx - n]}</Text></Text>}
                    <TouchableOpacity onPress={handleMatch} disabled={answered || idx < n}
                        style={[s.matchBtn, feedback === 'correct' && s.matchCorrect, feedback === 'wrong' && s.matchWrong, (answered || idx < n) && s.matchDisabled]}>
                        <Text style={s.matchText}>{feedback === 'correct' ? '✓ Correct!' : feedback === 'wrong' ? '✗ Wrong' : 'MATCH!'}</Text>
                    </TouchableOpacity>
                    <View style={s.scoreRow}>
                        <Text style={s.scoreGreen}>✓ {score.correct}</Text>
                        <Text style={s.scoreRed}>✗ {score.wrong}</Text>
                        <Text style={s.scoreGray}>{idx + 1}/{SEQ_LEN}</Text>
                    </View>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={s.center}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={s.resultTitle}>Level {level} Passed!</Text>
                    <Text style={s.points}>+{level * 2} Points</Text>
                    <Button title="Next Level" onPress={() => { const next = level + 1; setLevel(next); startLevel(next); }} style={s.btn} />
                </View>
            )}

            {gameState === 'game-over' && (
                <View style={s.center}>
                    <Text style={s.big}>🧠</Text>
                    <Text style={s.resultTitle}>Keep Training!</Text>
                    <Text style={s.subtitle}>{score.correct}/{score.total} correct — need 70%</Text>
                    <Button title="Try Again" onPress={() => startLevel(level)} style={s.btn} />
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingTop: 48, paddingHorizontal: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    levelBadge: { fontSize: 14, fontWeight: '700', color: '#64748b' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    big: { fontSize: 64 },
    title: { fontSize: 32, fontWeight: '800', color: '#1e293b', marginTop: 12, marginBottom: 8 },
    subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 24 },
    rules: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, width: '100%', marginBottom: 24 },
    ruleText: { fontSize: 14, color: '#475569', marginBottom: 6 },
    btn: { width: '100%', marginTop: 8 },
    letterBox: { width: 140, height: 140, borderRadius: 28, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    letterActive: { backgroundColor: '#6366f1', shadowColor: '#6366f1', shadowOpacity: 0.4, shadowRadius: 16, elevation: 8, shadowOffset: { width: 0, height: 4 } },
    letterText: { fontSize: 72, fontWeight: '900', color: '#cbd5e1' },
    letterTextActive: { color: 'white' },
    hint: { fontSize: 14, color: '#94a3b8', marginBottom: 24 },
    hintVal: { fontWeight: '700', color: '#475569' },
    matchBtn: { width: 180, height: 60, borderRadius: 20, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    matchCorrect: { backgroundColor: '#22c55e' },
    matchWrong: { backgroundColor: '#ef4444' },
    matchDisabled: { opacity: 0.5 },
    matchText: { color: 'white', fontSize: 18, fontWeight: '800' },
    scoreRow: { flexDirection: 'row', gap: 24 },
    scoreGreen: { color: '#22c55e', fontWeight: '700', fontSize: 16 },
    scoreRed: { color: '#ef4444', fontWeight: '700', fontSize: 16 },
    scoreGray: { color: '#94a3b8', fontWeight: '600', fontSize: 16 },
    resultTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 32 },
});
