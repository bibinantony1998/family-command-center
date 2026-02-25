import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X } from 'lucide-react-native';

// Simple tetromino-like shapes as SVG-free arrays of [row,col] offsets
const SHAPES = [
    [[0, 0], [1, 0], [2, 0], [2, 1]],           // L
    [[0, 0], [0, 1], [1, 1], [2, 1]],           // J
    [[0, 0], [0, 1], [1, 0], [1, 1]],           // O
    [[0, 1], [1, 0], [1, 1], [2, 0]],           // S
    [[0, 0], [1, 0], [1, 1], [2, 1]],           // Z
];

const GRID = 3;
const CELL = 28;

function renderShape(cells: number[][], color: string, bg: string) {
    const grid: boolean[][] = Array.from({ length: GRID }, () => Array(GRID).fill(false));
    cells.forEach(([r, c]) => { if (r < GRID && c < GRID) grid[r][c] = true; });
    return (
        <View style={{ gap: 2 }}>
            {grid.map((row, ri) => (
                <View key={ri} style={{ flexDirection: 'row', gap: 2 }}>
                    {row.map((filled, ci) => (
                        <View key={ci} style={{ width: CELL, height: CELL, borderRadius: 4, backgroundColor: filled ? color : bg }} />
                    ))}
                </View>
            ))}
        </View>
    );
}

function mirrorCells(cells: number[][]): number[][] {
    return cells.map(([r, c]) => [r, GRID - 1 - c]);
}
function rotateCells(cells: number[][], times: number): number[][] {
    let result = cells;
    for (let i = 0; i < times; i++) result = result.map(([r, c]) => [c, GRID - 1 - r]);
    return result;
}

function makeQuestion(level: number) {
    const shapeIdx = Math.floor(Math.random() * SHAPES.length);
    const baseRot = Math.floor(Math.random() * 4);
    const target = rotateCells(SHAPES[shapeIdx], baseRot);
    const matchRot = (baseRot + 1 + Math.floor(Math.random() * 3)) % 4;
    const matchPos = Math.floor(Math.random() * 4);
    const options = [];
    let distIdx = 0;
    for (let i = 0; i < 4; i++) {
        if (i === matchPos) {
            options.push({ cells: rotateCells(SHAPES[shapeIdx], matchRot), isMatch: true });
        } else {
            if (distIdx % 2 === 0) {
                options.push({ cells: mirrorCells(rotateCells(SHAPES[shapeIdx], (matchRot + distIdx + 1) % 4)), isMatch: false });
            } else {
                const altShape = SHAPES[(shapeIdx + distIdx + 1) % SHAPES.length];
                options.push({ cells: rotateCells(altShape, distIdx % 4), isMatch: false });
            }
            distIdx++;
        }
    }
    return { target, options };
}

const Q_PER_LEVEL = 5;

export default function MentalRotationScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up' | 'game-over'>('intro');
    const [question, setQuestion] = useState<ReturnType<typeof makeQuestion> | null>(null);
    const [answered, setAnswered] = useState<number | null>(null);
    const [qNum, setQNum] = useState(0);
    const [correct, setCorrect] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => { getHighestLevel('mental-rotation').then(l => { setLevel(l); setLoading(false); }); }, []);

    const nextQ = (lvl: number, num: number, c: number) => {
        if (num >= Q_PER_LEVEL) {
            if (c >= Math.ceil(Q_PER_LEVEL * 0.8)) { saveScore('mental-rotation', lvl, lvl * 2); setGameState('level-up'); }
            else setGameState('game-over');
            return;
        }
        setQuestion(makeQuestion(lvl)); setAnswered(null); setQNum(num);
    };

    const startLevel = (lvl: number) => {
        setLevel(lvl); setCorrect(0); setQNum(0); setQuestion(makeQuestion(lvl)); setAnswered(null); setGameState('playing');
    };

    const handlePick = (idx: number) => {
        if (answered !== null || !question) return;
        setAnswered(idx);
        const isMatch = question.options[idx].isMatch;
        const newCorrect = correct + (isMatch ? 1 : 0);
        setCorrect(newCorrect);
        setTimeout(() => nextQ(level, qNum + 1, newCorrect), 700);
    };

    return (
        <View style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                <Text style={s.levelBadge}>Level {level} • {qNum + 1}/{Q_PER_LEVEL}</Text>
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.big}>🔄</Text>
                    <Text style={s.title}>Mental Rotation</Text>
                    <Text style={s.subtitle}>Which shape is a ROTATION of the target? (Not mirrored!)</Text>
                    <Button title={loading ? 'Loading...' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && question && (
                <View style={s.playArea}>
                    <View style={s.targetBox}>
                        <Text style={s.label}>Target</Text>
                        {renderShape(question.target, '#6366f1', '#e0e7ff')}
                    </View>
                    <Text style={s.question}>Which one below is the same shape?</Text>
                    <View style={s.optionsGrid}>
                        {question.options.map((opt, i) => {
                            const bg = answered === null ? '#f8fafc' :
                                answered === i ? (opt.isMatch ? '#dcfce7' : '#fee2e2') :
                                    (opt.isMatch && answered !== null ? '#dcfce7' : '#f8fafc');
                            const border = answered === null ? '#e2e8f0' :
                                answered === i ? (opt.isMatch ? '#22c55e' : '#ef4444') :
                                    (opt.isMatch && answered !== null ? '#22c55e' : '#e2e8f0');
                            const shapeColor = answered !== null && opt.isMatch ? '#22c55e' : answered === i && !opt.isMatch ? '#ef4444' : '#94a3b8';
                            return (
                                <TouchableOpacity key={i} onPress={() => handlePick(i)}
                                    style={[s.option, { backgroundColor: bg, borderColor: border }]}>
                                    {renderShape(opt.cells, shapeColor, answered !== null ? (opt.isMatch ? '#dcfce7' : bg) : '#f1f5f9')}
                                </TouchableOpacity>
                            );
                        })}
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
                    <Text style={s.big}>🔄</Text>
                    <Text style={s.resultTitle}>Not quite!</Text>
                    <Text style={s.subtitle}>{correct}/{Q_PER_LEVEL} correct — need 80%</Text>
                    <Button title="Try Again" onPress={() => startLevel(level)} style={s.btn} />
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingTop: 48, paddingHorizontal: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    levelBadge: { fontSize: 14, fontWeight: '700', color: '#64748b' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    big: { fontSize: 64 },
    title: { fontSize: 32, fontWeight: '800', color: '#1e293b', marginTop: 12, marginBottom: 8 },
    subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', marginBottom: 24 },
    btn: { width: '100%', marginTop: 8 },
    playArea: { flex: 1, alignItems: 'center', paddingTop: 8 },
    targetBox: { backgroundColor: '#eef2ff', padding: 20, borderRadius: 20, alignItems: 'center', marginBottom: 16 },
    label: { fontSize: 12, fontWeight: '700', color: '#6366f1', letterSpacing: 1, marginBottom: 12 },
    question: { fontSize: 14, color: '#64748b', marginBottom: 16, textAlign: 'center' },
    optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
    option: { padding: 16, borderRadius: 16, borderWidth: 2, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    resultTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 32 },
});
