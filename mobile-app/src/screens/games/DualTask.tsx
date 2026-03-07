import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X } from 'lucide-react-native';

const SHAPES = ['●', '■', '▲', '◆', '★'];
const ROUND_TIME = 60;

function getMath(level: number) {
    const m = 5 + level * 3, a = Math.floor(Math.random() * m) + 1, b = Math.floor(Math.random() * m) + 1;
    const useMulti = level >= 5 && Math.random() < 0.3;
    if (useMulti) { const n1 = Math.floor(Math.random() * 5) + 1, n2 = Math.floor(Math.random() * 5) + 1; return { q: `${n1} × ${n2}`, answer: n1 * n2 }; }
    if (Math.random() < 0.5) { const big = Math.max(a, b), sm = Math.min(a, b); return { q: `${big} - ${sm}`, answer: big - sm }; }
    return { q: `${a} + ${b}`, answer: a + b };
}

function makeShapeGrid(level: number) {
    const gridSize = 12 + level;
    const target = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const count = 2 + Math.floor(Math.random() * (level + 1));
    // Fill entirely with NON-target shapes first so random fill doesn't add surprise targets
    const nonTargets = SHAPES.filter(s => s !== target);
    const grid = Array.from({ length: gridSize }, () => nonTargets[Math.floor(Math.random() * nonTargets.length)]);
    // Now place exactly `count` targets at random unique positions
    const positions = Array.from({ length: gridSize }, (_, i) => i).sort(() => Math.random() - 0.5);
    for (let p = 0; p < count; p++) grid[positions[p]] = target;
    return { grid, target, count };
}

type Feedback = 'correct' | 'wrong' | null;

export default function DualTaskScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over'>('intro');
    const [math, setMath] = useState({ q: '', answer: 0 });
    const [mathInput, setMathInput] = useState('');
    const [shapes, setShapes] = useState<ReturnType<typeof makeShapeGrid> | null>(null);
    const [shapeInput, setShapeInput] = useState('');
    const [mathOk, setMathOk] = useState(0);
    const [shapeOk, setShapeOk] = useState(0);
    const [total, setTotal] = useState(0);
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
    const [loading, setLoading] = useState(true);
    const [mathFeedback, setMathFeedback] = useState<Feedback>(null);
    const [shapeFeedback, setShapeFeedback] = useState<Feedback>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const stateRef = useRef(gameState);
    stateRef.current = gameState;
    // Use ref to hold latest mathOk/shapeOk/total so the feedback closures don't capture stale values
    const mathOkRef = useRef(mathOk);
    const shapeOkRef = useRef(shapeOk);
    const totalRef = useRef(total);
    mathOkRef.current = mathOk;
    shapeOkRef.current = shapeOk;
    totalRef.current = total;

    useEffect(() => { getHighestLevel('dual-task').then(l => { setLevel(l); setLoading(false); }); }, []);
    useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

    useEffect(() => {
        if (timeLeft === 0 && stateRef.current === 'playing') {
            const passed = (mathOkRef.current + shapeOkRef.current) >= Math.floor(totalRef.current * 0.6);
            if (passed) { saveScore('dual-task', level, level * 2); setGameState('level-up'); }
            else setGameState('game-over');
        }
    }, [timeLeft]);

    const startLevel = (lvl: number) => {
        setLevel(lvl); setTimeLeft(ROUND_TIME); setMathOk(0); setShapeOk(0); setTotal(0);
        setMath(getMath(lvl)); setMathInput(''); setShapes(makeShapeGrid(lvl)); setShapeInput('');
        setMathFeedback(null); setShapeFeedback(null);
        setGameState('playing');
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(timerRef.current!); return 0; } return t - 1; }), 1000);
    };

    const showMathFeedback = (fb: Feedback) => {
        setMathFeedback(fb);
        setTimeout(() => setMathFeedback(null), 600);
    };

    const handleMathKey = (v: string) => {
        const ni = mathInput + v;
        setMathInput(ni);
        if (parseInt(ni) === math.answer) {
            setMathOk(p => p + 1); setTotal(p => p + 1);
            showMathFeedback('correct');
            setTimeout(() => { setMath(getMath(level)); setMathInput(''); }, 600);
        } else if (ni.length > String(math.answer).length) {
            showMathFeedback('wrong');
            setTimeout(() => setMathInput(''), 600);
        }
    };

    const handleShapeSubmit = () => {
        const isCorrect = parseInt(shapeInput) === shapes?.count;
        setShapeFeedback(isCorrect ? 'correct' : 'wrong');
        if (isCorrect) setShapeOk(p => p + 1);
        setTotal(p => p + 1);
        setTimeout(() => {
            setShapes(makeShapeGrid(level));
            setShapeInput('');
            setShapeFeedback(null);
        }, 700);
    };

    const mathBorderColor = mathFeedback === 'correct' ? '#22c55e' : mathFeedback === 'wrong' ? '#ef4444' : '#f8fafc';
    const shapeBorderColor = shapeFeedback === 'correct' ? '#22c55e' : shapeFeedback === 'wrong' ? '#ef4444' : '#f8fafc';

    return (
        <View style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => { if (timerRef.current) clearInterval(timerRef.current); navigation.goBack(); }} style={s.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                <Text style={[s.timer, timeLeft < 10 && s.timerRed]}>{timeLeft}s</Text>
                <Text style={s.levelBadge}>Lv {level} • {mathOk + shapeOk}/{total}</Text>
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.big}>🤯</Text>
                    <Text style={s.title}>Dual Task</Text>
                    <Text style={s.subtitle}>Solve math AND count shapes at the same time!</Text>
                    <View style={s.rules}>
                        <Text style={s.ruleText}>• <Text style={s.ruleHighlight}>MATH:</Text> tap the numpad to answer the equation. You'll see ✅ or ❌ after each answer.</Text>
                        <Text style={s.ruleText}>• <Text style={s.ruleHighlight}>COUNT:</Text> count the highlighted shape in the grid, enter the number, tap ✓. Green = correct, red = wrong.</Text>
                        <Text style={s.ruleText}>• Need 60% accuracy across both tasks to pass</Text>
                        <Text style={s.ruleText}>• Higher levels = bigger numbers + more shapes</Text>
                    </View>
                    <Button title={loading ? 'Loading...' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && shapes && (
                <View style={s.playArea}>
                    {/* Math section */}
                    <View style={[s.section, { borderColor: mathBorderColor, borderWidth: 2 }]}>
                        <View style={s.sectionHeader}>
                            <Text style={s.sectionLabel}>MATH</Text>
                            {mathFeedback && (
                                <Text style={[s.feedbackBadge, mathFeedback === 'correct' ? s.fbCorrect : s.fbWrong]}>
                                    {mathFeedback === 'correct' ? '✓ Correct!' : '✗ Wrong'}
                                </Text>
                            )}
                        </View>
                        <View style={s.mathRow}>
                            <Text style={s.mathQ}>{math.q} =</Text>
                            <View style={[s.mathInputBox, mathFeedback && { borderColor: mathFeedback === 'correct' ? '#22c55e' : '#ef4444' }]}>
                                <Text style={[s.mathInputText, mathFeedback === 'correct' && { color: '#22c55e' }, mathFeedback === 'wrong' && { color: '#ef4444' }]}>{mathInput || '?'}</Text>
                            </View>
                        </View>
                        <View style={s.numpad}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, null].map((n, i) => n !== null ? (
                                <TouchableOpacity key={i} onPress={() => handleMathKey(String(n))} style={s.nkey}><Text style={s.nkeyText}>{n}</Text></TouchableOpacity>
                            ) : <View key={i} style={s.nkey} />)}
                        </View>
                    </View>
                    {/* Shape section */}
                    <View style={[s.section, { borderColor: shapeBorderColor, borderWidth: 2 }]}>
                        <View style={s.sectionHeader}>
                            <Text style={s.sectionLabel}>COUNT: <Text style={s.targetShape}>{shapes.target}</Text></Text>
                            {shapeFeedback && (
                                <Text style={[s.feedbackBadge, shapeFeedback === 'correct' ? s.fbCorrect : s.fbWrong]}>
                                    {shapeFeedback === 'correct' ? `✓ ${shapes.count} is right!` : `✗ Was ${shapes.count}`}
                                </Text>
                            )}
                        </View>
                        <View style={s.shapesGrid}>
                            {shapes.grid.map((sh, i) => (
                                <Text key={i} style={[s.shapeCell, sh === shapes.target && s.shapeCellTarget]}>{sh}</Text>
                            ))}
                        </View>
                        <View style={s.shapeInputRow}>
                            <TextInput value={shapeInput} onChangeText={setShapeInput} keyboardType="number-pad"
                                style={s.shapeInput} placeholder="Count?" maxLength={2} />
                            <TouchableOpacity onPress={handleShapeSubmit} style={[s.submitBtn, shapeFeedback === 'correct' && { backgroundColor: '#22c55e' }, shapeFeedback === 'wrong' && { backgroundColor: '#ef4444' }]}>
                                <Text style={s.submitText}>✓</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={s.center}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={s.resultTitle}>Multitasker!</Text>
                    <Text style={s.points}>+{level * 2} Points</Text>
                    <Button title="Next Level" onPress={() => { const next = level + 1; setLevel(next); startLevel(next); }} style={s.btn} />
                </View>
            )}

            {gameState === 'game-over' && (
                <View style={s.center}>
                    <Text style={s.big}>🤯</Text>
                    <Text style={s.resultTitle}>Overloaded!</Text>
                    <Text style={s.subtitle}>Need 60% accuracy</Text>
                    <Button title="Try Again" onPress={() => startLevel(level)} style={s.btn} />
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingTop: 48, paddingHorizontal: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    levelBadge: { fontSize: 13, fontWeight: '700', color: '#64748b' },
    timer: { fontSize: 16, fontWeight: '800', color: '#6366f1' },
    timerRed: { color: '#ef4444' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    big: { fontSize: 64 },
    title: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 12, marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 16 },
    rules: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 14, width: '100%', marginBottom: 20, gap: 8 },
    ruleText: { fontSize: 13, color: '#475569', lineHeight: 18 },
    ruleHighlight: { fontWeight: '800', color: '#6366f1' },
    btn: { width: '100%', marginTop: 8 },
    playArea: { flex: 1, gap: 10 },
    section: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    sectionLabel: { fontSize: 11, fontWeight: '800', color: '#3b82f6', letterSpacing: 1 },
    feedbackBadge: { fontSize: 12, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    fbCorrect: { backgroundColor: '#dcfce7', color: '#166534' },
    fbWrong: { backgroundColor: '#fee2e2', color: '#991b1b' },
    mathRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    mathQ: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
    mathInputBox: { flex: 1, height: 36, borderBottomWidth: 2, borderColor: '#6366f1', justifyContent: 'center' },
    mathInputText: { fontSize: 20, fontWeight: '800', color: '#6366f1' },
    numpad: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
    nkey: { width: 52, height: 40, borderRadius: 10, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center' },
    nkeyText: { fontSize: 18, fontWeight: '700', color: '#4338ca' },
    targetShape: { fontSize: 20 },
    shapesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
    shapeCell: { width: 32, height: 32, textAlign: 'center', textAlignVertical: 'center', fontSize: 20, backgroundColor: '#f1f5f9', borderRadius: 6, color: '#334155' },
    shapeCellTarget: {},
    shapeInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    shapeInput: { flex: 1, height: 40, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, fontSize: 16, fontWeight: '700', color: '#1e293b' },
    submitBtn: { width: 48, height: 40, borderRadius: 10, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
    submitText: { color: 'white', fontSize: 20, fontWeight: '800' },
    resultTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 32 },
});
