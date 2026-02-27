import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { X, RefreshCw, Trophy, Lightbulb } from 'lucide-react-native';

interface Puzzle {
    equation: string;   // e.g. "6+4=4"  (broken)
    solution: string;   // e.g. "6-4=4" -> what the equation becomes
    hint: string;
    display: string;    // show to user
    answer: string;     // correct answer display
}

// Each puzzle is multiple choice — pick the correct fixed equation
interface MCPuzzle {
    broken: string;
    choices: string[];
    correct: number; // index
    hint: string;
}

const PUZZLES: MCPuzzle[] = [
    { broken: '6 + 4 = 4', choices: ['6 - 4 = 2', '6 + 4 = 10', '6 ÷ 4 = 4', '6 + 4 = 14'], correct: 1, hint: 'Move one matchstick from the = sign.' },
    { broken: '5 + 3 = 6', choices: ['5 + 3 = 8', '5 - 3 = 6', '5 + 3 = 9', '5 × 3 = 6'], correct: 0, hint: 'Move one matchstick from the 6.' },
    { broken: '8 - 4 = 5', choices: ['8 - 3 = 5', '8 - 4 = 4', '8 - 4 = 9', '9 - 4 = 5'], correct: 3, hint: 'Move one matchstick to change 8 to 9.' },
    { broken: '2 + 3 = 4', choices: ['2 + 3 = 5', '2 + 2 = 4', '2 - 3 = 4', '2 + 3 = 14'], correct: 0, hint: 'Move one matchstick from the 4.' },
    { broken: '1 × 0 = 9', choices: ['1 × 0 = 0', '1 + 0 = 9', '1 × 9 = 9', '7 × 0 = 9'], correct: 2, hint: 'Move a matchstick to change the 0 after ×.' },
    { broken: '9 - 5 = 5', choices: ['9 - 4 = 5', '9 - 5 = 4', '9 + 5 = 5', '9 - 5 = 9'], correct: 0, hint: 'Change the 5 on the left using one matchstick.' },
    { broken: '3 + 3 = 9', choices: ['3 + 3 = 6', '3 - 3 = 9', '3 + 9 = 9', '3 + 3 = 3'], correct: 0, hint: 'One matchstick turns 9 into 6.' },
    { broken: '7 - 2 = 4', choices: ['7 - 2 = 5', '1 - 2 = 4', '7 - 2 = 9', '7 + 2 = 4'], correct: 0, hint: 'Move one matchstick from the 4.' },
    { broken: '6 ÷ 2 = 4', choices: ['6 ÷ 2 = 3', '0 ÷ 2 = 4', '6 + 2 = 4', '6 ÷ 2 = 1'], correct: 0, hint: 'One matchstick changes the 4 to 3.' },
    { broken: '4 + 5 = 8', choices: ['4 + 5 = 9', '4 - 5 = 8', '4 + 5 = 0', '4 × 5 = 8'], correct: 0, hint: 'One matchstick turns 8 into 9.' },
];

export default function MatchstickMath() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'correct' | 'wrong'>('intro');
    const [puzzleIdx, setPuzzleIdx] = useState(0);
    const [selected, setSelected] = useState<number | null>(null);
    const [hintVisible, setHintVisible] = useState(false);
    const [score, setScore] = useState(0);
    const [streak, setStreak] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getHighestLevel('matchstick-math').then(l => { setLevel(l); setLoading(false); });
    }, []);

    const puzzle = PUZZLES[puzzleIdx % PUZZLES.length];

    const startLevel = (lvl: number) => {
        setPuzzleIdx((lvl - 1) % PUZZLES.length);
        setSelected(null);
        setHintVisible(false);
        setScore(0);
        setStreak(0);
        setGameState('playing');
    };

    const submit = () => {
        if (selected === null) return;
        if (selected === puzzle.correct) {
            const pts = hintVisible ? level : level * 2;
            setScore(s => s + pts);
            setStreak(s => s + 1);
            saveScore('matchstick-math', level, pts);
            setGameState('correct');
        } else {
            setStreak(0);
            setGameState('wrong');
        }
    };

    const next = () => {
        setPuzzleIdx(i => i + 1);
        setSelected(null);
        setHintVisible(false);
        setGameState('playing');
    };

    return (
        <ScrollView style={[s.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24), flexGrow: 1 }}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}><X size={22} color="#64748b" /></TouchableOpacity>
                {gameState === 'playing' && (
                    <>
                        <Text style={s.badge}>Level {level} • Score: {score} {streak > 1 ? `🔥×${streak}` : ''}</Text>
                        <TouchableOpacity onPress={() => startLevel(level)} style={s.iconBtn}><RefreshCw size={18} color="#64748b" /></TouchableOpacity>
                    </>
                )}
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.bigEmoji}>🔥</Text>
                    <Text style={s.title}>Matchstick Math</Text>
                    <Text style={s.sub}>Move exactly ONE matchstick to fix the equation!</Text>
                    <View style={s.rules}>
                        <Text style={s.rule}>• You will see a broken equation</Text>
                        <Text style={s.rule}>• Choose which fixed version is correct</Text>
                        <Text style={s.rule}>• Solve without the hint for 2× points!</Text>
                    </View>
                    <Button title={loading ? 'Loading…' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={s.playArea}>
                    <View style={s.equationBox}>
                        <Text style={s.equationLabel}>BROKEN EQUATION (move 1 matchstick)</Text>
                        <Text style={s.equation}>{puzzle.broken}</Text>
                        <Text style={s.equationSub}>This is WRONG — pick the correct fixed version below</Text>
                    </View>

                    <Text style={s.choicesLabel}>Which fix is correct?</Text>
                    <View style={s.choices}>
                        {puzzle.choices.map((ch, i) => (
                            <TouchableOpacity
                                key={i}
                                onPress={() => setSelected(i)}
                                style={[s.choice, selected === i && s.choiceSelected]}
                            >
                                <Text style={[s.choiceText, selected === i && s.choiceTextSelected]}>{ch}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {hintVisible && (
                        <View style={s.hintBox}>
                            <Text style={s.hintText}>💡 {puzzle.hint}</Text>
                        </View>
                    )}

                    <View style={s.actions}>
                        {!hintVisible && (
                            <Button title="Hint (½ pts)" onPress={() => setHintVisible(true)} variant="outline" style={s.halfBtn} />
                        )}
                        <Button title="Submit" onPress={submit} disabled={selected === null} style={s.halfBtn} />
                    </View>
                </View>
            )}

            {(gameState === 'correct' || gameState === 'wrong') && (
                <View style={s.center}>
                    <Text style={s.bigEmoji}>{gameState === 'correct' ? '✅' : '❌'}</Text>
                    <Text style={s.title}>{gameState === 'correct' ? 'Correct!' : 'Not quite...'}</Text>
                    {gameState === 'wrong' && (
                        <View style={s.revealBox}>
                            <Text style={s.revealLabel}>The correct fix was:</Text>
                            <Text style={s.revealAnswer}>{puzzle.choices[puzzle.correct]}</Text>
                            <Text style={s.revealHint}>{puzzle.hint}</Text>
                        </View>
                    )}
                    {gameState === 'correct' && <Text style={s.points}>+{hintVisible ? level : level * 2} Points • Score: {score}</Text>}
                    <Button title="Next Puzzle →" onPress={next} style={s.btn} />
                </View>
            )}
        </ScrollView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, marginBottom: 8 },
    iconBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    badge: { fontSize: 13, fontWeight: '700', color: '#64748b' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 },
    bigEmoji: { fontSize: 64, marginBottom: 12 },
    title: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
    sub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    rules: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 14, width: '100%', marginBottom: 28, gap: 6 },
    rule: { fontSize: 13, color: '#475569', lineHeight: 18 },
    btn: { width: '100%' },
    playArea: { flex: 1, gap: 16 },
    equationBox: { backgroundColor: '#fef3c7', borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 2, borderColor: '#f59e0b' },
    equationLabel: { fontSize: 10, fontWeight: '800', color: '#b45309', letterSpacing: 1, marginBottom: 8 },
    equation: { fontSize: 40, fontWeight: '900', color: '#1e293b', letterSpacing: 4 },
    equationSub: { fontSize: 11, color: '#b45309', marginTop: 6 },
    choicesLabel: { fontSize: 14, fontWeight: '700', color: '#475569' },
    choices: { gap: 10 },
    choice: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 14, borderWidth: 2, borderColor: '#e2e8f0', alignItems: 'center' },
    choiceSelected: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
    choiceText: { fontSize: 22, fontWeight: '800', color: '#334155', letterSpacing: 3 },
    choiceTextSelected: { color: '#4f46e5' },
    hintBox: { backgroundColor: '#fefce8', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#fde68a' },
    hintText: { fontSize: 13, color: '#92400e', lineHeight: 18 },
    actions: { flexDirection: 'row', gap: 12 },
    halfBtn: { flex: 1 },
    points: { fontSize: 24, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 24 },
    revealBox: { backgroundColor: '#f0fdf4', padding: 16, borderRadius: 14, width: '100%', marginBottom: 20, alignItems: 'center', gap: 6 },
    revealLabel: { fontSize: 13, color: '#15803d' },
    revealAnswer: { fontSize: 28, fontWeight: '900', color: '#166534', letterSpacing: 3 },
    revealHint: { fontSize: 12, color: '#166534', textAlign: 'center' },
});
