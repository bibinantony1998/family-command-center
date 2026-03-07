import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { X, RefreshCw, Trophy } from 'lucide-react-native';

// 7-segment bitmask: segments [top, topL, topR, mid, botL, botR, bot]
// Index:                          0     1     2    3    4     5    6
const SEGMENTS: Record<string, number[]> = {
    '0': [1, 1, 1, 0, 1, 1, 1],
    '1': [0, 0, 1, 0, 0, 1, 0],
    '2': [1, 0, 1, 1, 1, 0, 1],
    '3': [1, 0, 1, 1, 0, 1, 1],
    '4': [0, 1, 1, 1, 0, 1, 0],
    '5': [1, 1, 0, 1, 0, 1, 1],
    '6': [1, 1, 0, 1, 1, 1, 1],
    '7': [1, 0, 1, 0, 0, 1, 0],
    '8': [1, 1, 1, 1, 1, 1, 1],
    '9': [1, 1, 1, 1, 0, 1, 1],
};

// Map bitmask back to digit (if possible)
function segmentsToDigit(segs: number[]): string | null {
    for (const [digit, mask] of Object.entries(SEGMENTS)) {
        if (mask.every((v, i) => v === segs[i])) return digit;
    }
    return null;
}

interface Puzzle {
    // equation like "6+4=4" as digit/operator tokens
    tokens: string[]; // e.g. ['6', '+', '4', '=', '4']
    // indices of which tokens are editable digit positions (not operators/= sign)
    editableIndices: number[];
    movesAllowed: number;
    hint: string;
}

const PUZZLES: Puzzle[] = [
    { tokens: ['6', '+', '4', '=', '4'], editableIndices: [0, 2, 4], movesAllowed: 1, hint: 'Change one segment to make 6+4=10 or 6-4=2' },
    { tokens: ['5', '+', '3', '=', '6'], editableIndices: [0, 2, 4], movesAllowed: 1, hint: 'The result should be 8' },
    { tokens: ['8', '-', '4', '=', '5'], editableIndices: [0, 2, 4], movesAllowed: 1, hint: 'Change 8 into 9' },
    { tokens: ['2', '+', '3', '=', '4'], editableIndices: [0, 2, 4], movesAllowed: 1, hint: 'The result should be 5' },
    { tokens: ['1', '+', '0', '=', '9'], editableIndices: [0, 2, 4], movesAllowed: 1, hint: 'Change 0 on the right to 9' },
    { tokens: ['9', '-', '5', '=', '5'], editableIndices: [0, 2, 4], movesAllowed: 1, hint: 'Change 5 on the left to 4' },
    { tokens: ['3', '+', '3', '=', '9'], editableIndices: [0, 2, 4], movesAllowed: 1, hint: 'Turn the 9 into a 6' },
    { tokens: ['7', '-', '2', '=', '4'], editableIndices: [0, 2, 4], movesAllowed: 1, hint: 'Change 4 to 5' },
    { tokens: ['6', '÷', '2', '=', '4'], editableIndices: [0, 2, 4], movesAllowed: 1, hint: 'Change the 4 to 3' },
    { tokens: ['4', '+', '5', '=', '8'], editableIndices: [0, 2, 4], movesAllowed: 1, hint: 'Change 8 into 9' },
];

const W = Dimensions.get('window').width;
const DIGIT_W = Math.min(52, (W - 80) / 5);
const SEG_THICK = 5;
const SEG_LEN = DIGIT_W - SEG_THICK * 2;

// Segment geometry: each segment is a positioned rectangle
// [isHorizontal, left, top, width, height]
function segStyle(idx: number, W: number): object {
    const L = SEG_LEN, T = SEG_THICK, H = W;
    const positions: [boolean, number, number, number, number][] = [
        [true, T, 0, L, T],   // 0: top
        [false, 0, T, T, L],   // 1: topL
        [false, H - T, T, T, L],   // 2: topR
        [true, T, H / 2 - T / 2, L, T], // 3: mid
        [false, 0, H / 2 + T / 2, T, L],  // 4: botL
        [false, H - T, H / 2 + T / 2, T, L],  // 5: botR
        [true, T, H - T, L, T],   // 6: bot
    ];
    const [, left, top, width, height] = positions[idx];
    return { position: 'absolute', left, top, width, height, borderRadius: 2 };
}

function DigitDisplay({ segs, onToggle, baseColor }: {
    segs: number[];
    onToggle?: (i: number) => void;
    baseColor?: string;
}) {
    const H = DIGIT_W;
    return (
        <View style={{ width: DIGIT_W, height: H, position: 'relative', margin: 4 }}>
            {segs.map((on, i) => (
                <TouchableOpacity
                    key={i}
                    onPress={() => onToggle?.(i)}
                    activeOpacity={onToggle ? 0.6 : 1}
                    disabled={!onToggle}
                    style={[
                        segStyle(i, H) as any,
                        { backgroundColor: on ? (baseColor || '#ef4444') : '#e2e8f0' },
                        !onToggle && { opacity: 1 },
                    ]}
                />
            ))}
        </View>
    );
}

function OperatorDisplay({ op }: { op: string }) {
    return (
        <View style={{ justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, height: DIGIT_W }}>
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#475569' }}>{op}</Text>
        </View>
    );
}

function evalEquation(tokens: string[], digitStates: Record<number, number[]>): boolean {
    try {
        // Replace editable digit positions; skip if unknown
        const resolved = tokens.map((t, i) => {
            if (digitStates[i] !== undefined) {
                const d = segmentsToDigit(digitStates[i]);
                return d; // null if not a valid digit
            }
            return t;
        });
        if (resolved.some(r => r === null)) return false;
        const expr = resolved.join('').replace('÷', '/');
        const [lhs, rhs] = expr.split('=');
        // Safe eval using Function
        // eslint-disable-next-line no-new-func
        const lhsVal = Function(`"use strict"; return (${lhs})`)();
        const rhsVal = Function(`"use strict"; return (${rhs})`)();
        return lhsVal === rhsVal && !isNaN(lhsVal);
    } catch {
        return false;
    }
}

export default function MatchstickMath() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'won' | 'wrong'>('intro');
    const [puzzleIdx, setPuzzleIdx] = useState(0);
    const [digitStates, setDigitStates] = useState<Record<number, number[]>>({});
    const [removed, setRemoved] = useState<{ tokenIdx: number; segIdx: number } | null>(null);
    const [hintVisible, setHintVisible] = useState(false);
    const [score, setScore] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getHighestLevel('matchstick-math').then(l => { setLevel(l); setLoading(false); });
    }, []);

    const puzzle = PUZZLES[puzzleIdx % PUZZLES.length];

    const initDigitStates = (p: Puzzle) => {
        const ds: Record<number, number[]> = {};
        p.editableIndices.forEach(i => {
            ds[i] = [...SEGMENTS[p.tokens[i]]];
        });
        return ds;
    };

    const startLevel = (lvl: number) => {
        setPuzzleIdx((lvl - 1) % PUZZLES.length);
        setDigitStates(initDigitStates(PUZZLES[(lvl - 1) % PUZZLES.length]));
        setRemoved(null);
        setHintVisible(false);
        setGameState('playing');
    };

    const handleSegTap = (tokenIdx: number, segIdx: number) => {
        const current = digitStates[tokenIdx];
        if (!current) return;
        const isOn = current[segIdx] === 1;

        if (isOn) {
            // Remove: only allowed if we haven't removed one yet
            if (removed !== null) return; // already have a removed segment
            const next = [...current];
            next[segIdx] = 0;
            setDigitStates(prev => ({ ...prev, [tokenIdx]: next }));
            setRemoved({ tokenIdx, segIdx });
        } else {
            // Add: only allowed if we have a removed segment (to place it)
            if (removed === null) return;
            const next = [...current];
            next[segIdx] = 1;
            setDigitStates(prev => ({ ...prev, [tokenIdx]: next }));
            // One move used (removed + added)
            setRemoved(null);
        }
    };

    const checkSolution = () => {
        const valid = evalEquation(puzzle.tokens, digitStates);
        // Also ensure exactly 1 move has been completed (removed is null = we placed our removed segment)
        const movesDone = removed === null && JSON.stringify(digitStates) !== JSON.stringify(initDigitStates(puzzle));
        if (valid && movesDone) {
            const pts = hintVisible ? level : level * 2;
            setScore(s => s + pts);
            saveScore('matchstick-math', level, pts);
            setGameState('won');
        } else {
            setGameState('wrong');
        }
    };

    const resetPuzzle = () => {
        setDigitStates(initDigitStates(puzzle));
        setRemoved(null);
        setGameState('playing');
    };

    const next = () => {
        const nextIdx = puzzleIdx + 1;
        setPuzzleIdx(nextIdx);
        const nextPuzzle = PUZZLES[nextIdx % PUZZLES.length];
        setDigitStates(initDigitStates(nextPuzzle));
        setRemoved(null);
        setHintVisible(false);
        setGameState('playing');
    };

    const moveStatus = removed
        ? `1 matchstick lifted — tap a dark segment to place it`
        : `Tap a lit segment (red) to pick it up`;

    return (
        <ScrollView style={[s.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24), flexGrow: 1 }}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}><X size={22} color="#64748b" /></TouchableOpacity>
                {gameState === 'playing' && (
                    <>
                        <Text style={s.badge}>Level {level} • Score: {score} • Puzzle {(puzzleIdx % PUZZLES.length) + 1}/{PUZZLES.length}</Text>
                        <TouchableOpacity onPress={resetPuzzle} style={s.iconBtn}><RefreshCw size={18} color="#64748b" /></TouchableOpacity>
                    </>
                )}
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.bigEmoji}>🔥</Text>
                    <Text style={s.title}>Matchstick Math</Text>
                    <Text style={s.sub}>Move exactly ONE matchstick to fix the broken equation!</Text>
                    <View style={s.rules}>
                        <Text style={s.rule}>🔴 <Text style={s.ruleBold}>Tap a red segment</Text> to pick it up (remove it)</Text>
                        <Text style={s.rule}>⬜ <Text style={s.ruleBold}>Tap a grey segment</Text> to place your picked-up matchstick there</Text>
                        <Text style={s.rule}>✅ You must move exactly 1 matchstick — remove one, add one</Text>
                        <Text style={s.rule}>💡 Solve without the hint for 2× points!</Text>
                    </View>
                    <Button title={loading ? 'Loading…' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={s.playArea}>
                    <Text style={s.instruction}>Move 1 matchstick to fix the equation:</Text>

                    {/* Equation display */}
                    <View style={s.equationRow}>
                        {puzzle.tokens.map((token, i) => {
                            const isOperator = !puzzle.editableIndices.includes(i);
                            if (isOperator) return <OperatorDisplay key={i} op={token} />;
                            return (
                                <DigitDisplay
                                    key={i}
                                    segs={digitStates[i] || SEGMENTS[token]}
                                    onToggle={(segIdx) => handleSegTap(i, segIdx)}
                                    baseColor={removed?.tokenIdx === i ? '#f97316' : '#ef4444'}
                                />
                            );
                        })}
                    </View>

                    {/* Move status */}
                    <View style={[s.statusBox, removed && s.statusBoxActive]}>
                        <Text style={[s.statusText, removed && s.statusTextActive]}>
                            {removed ? '🔴 ' : '👆 '}{moveStatus}
                        </Text>
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
                        <Button title="Check ✓" onPress={checkSolution} disabled={removed !== null} style={s.halfBtn} />
                    </View>
                </View>
            )}

            {gameState === 'won' && (
                <View style={s.center}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={s.title}>Correct! 🔥</Text>
                    <Text style={s.points}>+{hintVisible ? level : level * 2} pts • Score: {score}</Text>
                    <Button title="Next Puzzle →" onPress={next} style={s.btn} />
                </View>
            )}

            {gameState === 'wrong' && (
                <View style={s.center}>
                    <Text style={s.bigEmoji}>❌</Text>
                    <Text style={s.title}>Not quite...</Text>
                    <Text style={s.sub}>The equation isn't valid yet. Try a different segment!</Text>
                    <View style={s.hintBox}>
                        <Text style={s.hintText}>💡 {puzzle.hint}</Text>
                    </View>
                    <Button title="Try Again" onPress={resetPuzzle} style={[s.btn, { marginTop: 16 }]} />
                    <Button title="Skip" onPress={next} variant="outline" style={[s.btn, { marginTop: 8 }]} />
                </View>
            )}
        </ScrollView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, marginBottom: 8 },
    iconBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    badge: { fontSize: 11, fontWeight: '700', color: '#64748b', flex: 1, textAlign: 'center' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 },
    bigEmoji: { fontSize: 64, marginBottom: 12 },
    title: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
    sub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    rules: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 14, width: '100%', marginBottom: 28, gap: 10 },
    rule: { fontSize: 13, color: '#475569', lineHeight: 20 },
    ruleBold: { fontWeight: '800', color: '#1e293b' },
    btn: { width: '100%' },
    playArea: { flex: 1, gap: 20 },
    instruction: { fontSize: 15, fontWeight: '700', color: '#475569', textAlign: 'center' },
    equationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fef3c7',
        borderRadius: 20,
        padding: 24,
        borderWidth: 2,
        borderColor: '#f59e0b',
    },
    statusBox: {
        backgroundColor: '#f1f5f9',
        borderRadius: 12,
        padding: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    statusBoxActive: { backgroundColor: '#fff7ed', borderColor: '#f97316' },
    statusText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
    statusTextActive: { color: '#c2410c' },
    hintBox: { backgroundColor: '#fefce8', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#fde68a' },
    hintText: { fontSize: 13, color: '#92400e', lineHeight: 18 },
    actions: { flexDirection: 'row', gap: 12 },
    halfBtn: { flex: 1 },
    points: { fontSize: 24, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 24 },
});
