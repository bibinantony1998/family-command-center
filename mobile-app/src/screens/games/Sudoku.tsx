import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, RefreshCw } from 'lucide-react-native';

// 4x4 Sudoku puzzles: 0 = blank
const PUZZLES_4x4 = [
    { puzzle: [1, 0, 0, 4, 0, 4, 1, 0, 0, 1, 4, 0, 4, 0, 0, 1], solution: [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1] },
    { puzzle: [0, 2, 0, 4, 4, 0, 2, 0, 0, 3, 0, 2, 2, 0, 3, 0], solution: [1, 2, 3, 4, 4, 1, 2, 3, 3, 4, 1, 2, 2, 3, 4, 1] },
    { puzzle: [0, 0, 3, 0, 3, 0, 0, 1, 0, 4, 0, 0, 1, 0, 0, 4], solution: [1, 2, 3, 4, 3, 4, 2, 1, 4, 1, 2, 3, 1, 3, 4, 2] },
    { puzzle: [2, 0, 0, 3, 0, 3, 2, 0, 0, 2, 3, 0, 3, 0, 0, 2], solution: [2, 1, 4, 3, 4, 3, 2, 1, 1, 2, 3, 4, 3, 4, 1, 2] },
    { puzzle: [0, 1, 0, 0, 0, 0, 4, 3, 3, 4, 0, 0, 0, 0, 1, 0], solution: [4, 1, 3, 2, 2, 6, 4, 3, 3, 4, 2, 1, 1, 2, 1, 4] },
];

const PUZZLES_9x9: Array<{ puzzle: number[], solution: number[] }> = [
    {
        puzzle: [
            5, 3, 0, 0, 7, 0, 0, 0, 0,
            6, 0, 0, 1, 9, 5, 0, 0, 0,
            0, 9, 8, 0, 0, 0, 0, 6, 0,
            8, 0, 0, 0, 6, 0, 0, 0, 3,
            4, 0, 0, 8, 0, 3, 0, 0, 1,
            7, 0, 0, 0, 2, 0, 0, 0, 6,
            0, 6, 0, 0, 0, 0, 2, 8, 0,
            0, 0, 0, 4, 1, 9, 0, 0, 5,
            0, 0, 0, 0, 8, 0, 0, 7, 9,
        ],
        solution: [
            5, 3, 4, 6, 7, 8, 9, 1, 2,
            6, 7, 2, 1, 9, 5, 3, 4, 8,
            1, 9, 8, 3, 4, 2, 5, 6, 7,
            8, 5, 9, 7, 6, 1, 4, 2, 3,
            4, 2, 6, 8, 5, 3, 7, 9, 1,
            7, 1, 3, 9, 2, 4, 8, 5, 6,
            9, 6, 1, 5, 3, 7, 2, 8, 4,
            2, 8, 7, 4, 1, 9, 6, 3, 5,
            3, 4, 5, 2, 8, 6, 1, 7, 9,
        ],
    },
];

export default function SudokuScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up'>('intro');
    const [gridSize, setGridSize] = useState(4);
    const [puzzle, setPuzzle] = useState<number[]>([]);
    const [solution, setSolution] = useState<number[]>([]);
    const [board, setBoard] = useState<number[]>([]);
    const [selected, setSelected] = useState<number | null>(null);
    const [errors, setErrors] = useState<Set<number>>(new Set());
    const [fixed, setFixed] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getHighestLevel('sudoku').then(l => { setLevel(l); setLoading(false); });
    }, []);

    const startLevel = (lvl: number) => {
        const is9x9 = lvl > 5;
        const size = is9x9 ? 9 : 4;
        setGridSize(size);

        let puz, sol;
        if (is9x9) {
            const p = PUZZLES_9x9[(lvl - 6) % PUZZLES_9x9.length];
            puz = p.puzzle; sol = p.solution;
        } else {
            const p = PUZZLES_4x4[(lvl - 1) % PUZZLES_4x4.length];
            puz = p.puzzle; sol = p.solution;
        }

        setPuzzle([...puz]);
        setSolution([...sol]);
        setBoard([...puz]);
        setFixed(new Set(puz.map((v, i) => v !== 0 ? i : -1).filter(i => i >= 0)));
        setErrors(new Set());
        setSelected(null);
        setGameState('playing');
    };

    const handleCellPress = (idx: number) => {
        if (fixed.has(idx)) { setSelected(null); return; }
        setSelected(idx);
    };

    const handleNumber = (num: number) => {
        if (selected === null) return;
        const newBoard = [...board];
        newBoard[selected] = num;
        setBoard(newBoard);

        const newErrors = new Set(errors);
        if (solution[selected] !== num) {
            newErrors.add(selected);
        } else {
            newErrors.delete(selected);
        }
        setErrors(newErrors);
        setSelected(null);

        // check win
        const complete = newBoard.every((v, i) => v !== 0 && v === solution[i]);
        if (complete) {
            saveScore('sudoku', level, level * 3);
            setGameState('level-up');
        }
    };

    const maxNum = gridSize;
    const cellSize = gridSize === 4 ? 72 : 38;
    const fontSize = gridSize === 4 ? 24 : 16;

    const getBoxBorder = (idx: number) => {
        const row = Math.floor(idx / gridSize);
        const col = idx % gridSize;
        const boxSize = gridSize === 4 ? 2 : 3;
        const borderRight = (col + 1) % boxSize === 0 && col < gridSize - 1;
        const borderBottom = (row + 1) % boxSize === 0 && row < gridSize - 1;
        return { borderRight, borderBottom };
    };

    return (
        <View style={[s.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}>
                    <X size={24} color="#64748b" />
                </TouchableOpacity>
                {gameState === 'playing' && (
                    <Text style={s.levelBadge}>Level {level} • {gridSize}×{gridSize}</Text>
                )}
                {gameState === 'playing' && (
                    <TouchableOpacity onPress={() => startLevel(level)} style={s.closeBtn}>
                        <RefreshCw size={20} color="#64748b" />
                    </TouchableOpacity>
                )}
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.emoji}>🧩</Text>
                    <Text style={s.title}>Sudoku</Text>
                    <Text style={s.subtitle}>Fill the grid so every row, column & box has each number once.</Text>
                    <View style={s.rulesBox}>
                        <Text style={s.ruleText}>• Levels 1–5: 4×4 grid (numbers 1–4)</Text>
                        <Text style={s.ruleText}>• Level 6+: 9×9 classic Sudoku</Text>
                        <Text style={s.ruleText}>• Red cells indicate incorrect numbers</Text>
                    </View>
                    <Button title={loading ? 'Loading…' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && (
                <ScrollView contentContainerStyle={s.playContainer} showsVerticalScrollIndicator={false}>
                    <View style={s.gridWrapper}>
                        <View style={[s.grid, { width: cellSize * gridSize + 4, borderWidth: 2, borderColor: '#334155' }]}>
                            {board.map((val, idx) => {
                                const { borderRight, borderBottom } = getBoxBorder(idx);
                                const isSelected = selected === idx;
                                const isError = errors.has(idx);
                                const isFixed = fixed.has(idx);
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        onPress={() => handleCellPress(idx)}
                                        style={[
                                            s.cell,
                                            { width: cellSize, height: cellSize },
                                            isSelected && s.cellSelected,
                                            isError && s.cellError,
                                            borderRight && { borderRightWidth: 2, borderRightColor: '#334155' },
                                            borderBottom && { borderBottomWidth: 2, borderBottomColor: '#334155' },
                                        ]}
                                    >
                                        <Text style={[
                                            s.cellText,
                                            { fontSize },
                                            isFixed && s.cellFixed,
                                            isError && s.cellErrorText,
                                            isSelected && s.cellSelectedText,
                                        ]}>
                                            {val !== 0 ? val : ''}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <View style={s.numPad}>
                        {Array.from({ length: maxNum }, (_, i) => i + 1).map(n => (
                            <TouchableOpacity key={n} style={s.numBtn} onPress={() => handleNumber(n)}>
                                <Text style={s.numText}>{n}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={[s.numBtn, { backgroundColor: '#fee2e2' }]} onPress={() => handleNumber(0)}>
                            <Text style={[s.numText, { color: '#dc2626' }]}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={s.hint}>Tap a cell then tap a number</Text>
                </ScrollView>
            )}

            {gameState === 'level-up' && (
                <View style={s.center}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={s.resultTitle}>Solved! 🎉</Text>
                    <Text style={s.points}>+{level * 3} Points</Text>
                    <Button title="Next Level" onPress={() => { const n = level + 1; setLevel(n); startLevel(n); }} style={s.btn} />
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 44, marginBottom: 8 },
    closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    levelBadge: { fontSize: 14, fontWeight: '700', color: '#64748b' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    emoji: { fontSize: 64, marginBottom: 12 },
    title: { fontSize: 30, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    rulesBox: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 14, width: '100%', marginBottom: 28, gap: 6 },
    ruleText: { fontSize: 13, color: '#475569', lineHeight: 18 },
    btn: { width: '100%' },
    playContainer: { alignItems: 'center', paddingBottom: 24, paddingTop: 8 },
    gridWrapper: { marginBottom: 20 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', borderColor: '#334155', borderRadius: 4, overflow: 'hidden' },
    cell: { borderWidth: 0.5, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    cellSelected: { backgroundColor: '#eef2ff' },
    cellError: { backgroundColor: '#fee2e2' },
    cellText: { fontWeight: '600', color: '#334155' },
    cellFixed: { fontWeight: '800', color: '#1e293b' },
    cellErrorText: { color: '#dc2626' },
    cellSelectedText: { color: '#4f46e5' },
    numPad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 12 },
    numBtn: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    numText: { fontSize: 20, fontWeight: '700', color: '#334155' },
    hint: { fontSize: 13, color: '#94a3b8', fontStyle: 'italic' },
    resultTitle: { fontSize: 30, fontWeight: '800', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 32 },
});
