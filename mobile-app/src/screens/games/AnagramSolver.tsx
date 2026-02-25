import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, Shuffle, Check } from 'lucide-react-native';

const WORD_POOL: string[][] = [
    ['cat', 'dog', 'sun', 'hat', 'map'], ['bird', 'fish', 'tree', 'jump', 'frog'],
    ['apple', 'brain', 'cloud', 'dance', 'earth'], ['bright', 'castle', 'dragon', 'flight', 'garden'],
    ['captain', 'dolphin', 'feather', 'journey', 'lantern'], ['absolute', 'calendar', 'daughter', 'elephant', 'fragment'],
    ['adventure', 'beautiful', 'celebrate', 'dimension', 'excellent'], ['basketball', 'chocolate', 'completely', 'democratic', 'earthworm'],
    ['imagination', 'development', 'environment', 'neighboring', 'persistence'],
    ['accomplishment', 'communication', 'extraordinary', 'manufacturing', 'transformation'],
];

function scramble(word: string): string {
    const arr = word.split('');
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]]; }
    const r = arr.join(''); return r === word ? scramble(word) : r;
}

const Q_PER_LEVEL = 5;

export default function AnagramSolverScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over'>('intro');
    const [word, setWord] = useState('');
    const [scrambled, setScrambled] = useState('');
    const [letters, setLetters] = useState<{ char: string; used: boolean }[]>([]);
    const [answer, setAnswer] = useState<string[]>([]);
    const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
    const [qNum, setQNum] = useState(0);
    const [correct, setCorrect] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => { getHighestLevel('anagram-solver').then(l => { setLevel(l); setLoading(false); }); }, []);

    const loadQ = (lvl: number, num: number) => {
        const pool = WORD_POOL[Math.min(lvl - 1, WORD_POOL.length - 1)];
        const w = pool[num % pool.length], s = scramble(w);
        setWord(w); setScrambled(s); setLetters(s.split('').map(c => ({ char: c, used: false }))); setAnswer([]); setFeedback(null); setQNum(num);
    };

    const startLevel = (lvl: number) => { setLevel(lvl); setCorrect(0); setQNum(0); loadQ(lvl, 0); setGameState('playing'); };

    const handleLetter = (idx: number) => {
        if (letters[idx].used || feedback) return;
        const nl = [...letters]; nl[idx] = { ...nl[idx], used: true };
        const na = [...answer, letters[idx].char];
        setLetters(nl); setAnswer(na);
        if (na.length === word.length) {
            const guess = na.join('');
            if (guess === word) {
                setFeedback('correct'); const nc = correct + 1; setCorrect(nc);
                setTimeout(() => {
                    const nxt = qNum + 1;
                    if (nxt >= Q_PER_LEVEL) { if (nc >= Math.ceil(Q_PER_LEVEL * 0.8)) { saveScore('anagram-solver', level, level * 2); setGameState('level-up'); } else setGameState('game-over'); }
                    else loadQ(level, nxt);
                }, 700);
            } else {
                setFeedback('wrong');
                setTimeout(() => { setLetters(scrambled.split('').map(c => ({ char: c, used: false }))); setAnswer([]); setFeedback(null); }, 700);
            }
        }
    };

    const removeLast = () => {
        if (!answer.length || feedback) return;
        const last = answer[answer.length - 1];
        const na = answer.slice(0, -1);
        const nl = [...letters];
        for (let i = nl.length - 1; i >= 0; i--) { if (nl[i].used && nl[i].char === last) { nl[i] = { ...nl[i], used: false }; break; } }
        setLetters(nl); setAnswer(na);
    };

    return (
        <View style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                <Text style={s.levelBadge}>Level {level} • {qNum + 1}/{Q_PER_LEVEL}</Text>
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.big}>🔤</Text>
                    <Text style={s.title}>Anagram Solver</Text>
                    <Text style={s.subtitle}>Tap letters in the right order to form the word!</Text>
                    <Button title={loading ? 'Loading...' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={s.playArea}>
                    <View style={[s.answerBox, feedback === 'correct' && s.correct, feedback === 'wrong' && s.wrong]}>
                        {answer.length === 0 ? <Text style={s.placeholder}>Tap letters below...</Text> :
                            <View style={s.answerRow}>
                                {answer.map((c, i) => (
                                    <View key={i} style={[s.answerTile, feedback === 'correct' && s.tileOk, feedback === 'wrong' && s.tileBad]}>
                                        <Text style={s.tileLetter}>{c.toUpperCase()}</Text>
                                    </View>
                                ))}
                            </View>
                        }
                        {feedback === 'correct' && <Check size={20} color="#22c55e" style={{ marginTop: 8 }} />}
                    </View>

                    <View style={s.letterBank}>
                        {letters.map((l, i) => (
                            <TouchableOpacity key={i} onPress={() => handleLetter(i)} disabled={l.used}
                                style={[s.letterTile, l.used && s.letterUsed]}>
                                <Text style={[s.letterChar, l.used && s.letterCharUsed]}>{l.char.toUpperCase()}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={s.controls}>
                        <TouchableOpacity onPress={removeLast} style={s.controlBtn}>
                            <Text style={s.controlText}>⌫ Remove</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setLetters(scrambled.split('').map(c => ({ char: c, used: false }))); setAnswer([]); setFeedback(null); }} style={s.controlBtn}>
                            <Shuffle size={14} color="#64748b" />
                            <Text style={s.controlText}> Reset</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={s.center}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={s.resultTitle}>Word Wizard!</Text>
                    <Text style={s.points}>+{level * 2} Points</Text>
                    <Button title="Next Level" onPress={() => { const next = level + 1; setLevel(next); startLevel(next); }} style={s.btn} />
                </View>
            )}

            {gameState === 'game-over' && (
                <View style={s.center}>
                    <Text style={s.big}>🔤</Text>
                    <Text style={s.resultTitle}>Keep Unscrambling!</Text>
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
    title: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 12, marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 },
    btn: { width: '100%', marginTop: 8 },
    playArea: { flex: 1 },
    answerBox: { minHeight: 70, borderRadius: 16, backgroundColor: '#f8fafc', borderWidth: 2, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginBottom: 20, padding: 12 },
    correct: { backgroundColor: '#f0fdf4', borderColor: '#22c55e' },
    wrong: { backgroundColor: '#fef2f2', borderColor: '#ef4444' },
    placeholder: { color: '#cbd5e1', fontStyle: 'italic' },
    answerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
    answerTile: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
    tileOk: { backgroundColor: '#22c55e' }, tileBad: { backgroundColor: '#ef4444' },
    tileLetter: { color: 'white', fontWeight: '800', fontSize: 16 },
    letterBank: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 16 },
    letterTile: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'white', borderWidth: 2, borderColor: '#fde68a', borderBottomWidth: 4, justifyContent: 'center', alignItems: 'center' },
    letterUsed: { backgroundColor: '#f1f5f9', borderColor: '#e2e8f0', borderBottomWidth: 2 },
    letterChar: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
    letterCharUsed: { color: '#cbd5e1' },
    controls: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
    controlBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f1f5f9' },
    controlText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
    resultTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 32 },
});
