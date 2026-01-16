import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, GlassWater, RefreshCw } from 'lucide-react-native';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const { width, height } = Dimensions.get('window');

const LEVELS_CONFIG = [
    { target: 4, jugs: [5, 3] },      // Level 1
    { target: 1, jugs: [3, 2] },      // Level 2
    { target: 4, jugs: [8, 5, 3] },   // Level 3
    { target: 5, jugs: [12, 7, 5] },  // Level 4
    { target: 6, jugs: [8, 5] },      // Level 5
    { target: 2, jugs: [9, 4] },      // Level 6
    { target: 7, jugs: [10, 6, 5] },  // Level 7
    { target: 9, jugs: [13, 8, 5] },  // Level 8
    { target: 1, jugs: [5, 2] },      // Level 9
    { target: 12, jugs: [24, 13, 11] }// Level 10
];

export default function WaterJugsScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up'>('intro');
    const [jugs, setJugs] = useState<{ id: number, capacity: number, current: number }[]>([]);
    const [selectedJug, setSelectedJug] = useState<number | null>(null);
    const [moves, setMoves] = useState(0);

    useEffect(() => { getHighestLevel('water-jugs').then(setLevel); }, []);

    const startLevel = (lvl: number) => {
        const config = LEVELS_CONFIG[lvl - 1] || LEVELS_CONFIG[0];
        setJugs(config.jugs.map((cap, i) => ({ id: i, capacity: cap, current: 0 })));
        setGameState('playing');
        setMoves(0);
        setSelectedJug(null);
    };

    const startGame = () => {
        const lvl = level > 10 ? 1 : level;
        startLevel(lvl);
    };

    const handlePress = (idx: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        if (selectedJug === null) {
            setSelectedJug(idx);
        } else {
            if (selectedJug === idx) {
                setSelectedJug(null);
            } else {
                pour(selectedJug, idx);
            }
        }
    };

    const fillJug = () => {
        if (selectedJug === null) return;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const newJugs = [...jugs];
        newJugs[selectedJug].current = newJugs[selectedJug].capacity;
        setJugs(newJugs);
        setMoves(m => m + 1);
        setSelectedJug(null);
        checkWin(newJugs);
    };

    const emptyJug = () => {
        if (selectedJug === null) return;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const newJugs = [...jugs];
        newJugs[selectedJug].current = 0;
        setJugs(newJugs);
        setMoves(m => m + 1);
        setSelectedJug(null);
        checkWin(newJugs);
    };

    const pour = (from: number, to: number) => {
        const newJugs = [...jugs];
        const src = newJugs[from];
        const dst = newJugs[to];
        const amount = Math.min(src.current, dst.capacity - dst.current);

        if (amount > 0) {
            src.current -= amount;
            dst.current += amount;
            setJugs(newJugs);
            setMoves(m => m + 1);
        }
        setSelectedJug(null);
        checkWin(newJugs);
    };

    const checkWin = (currentJugs: typeof jugs) => {
        const target = LEVELS_CONFIG[level - 1].target;
        if (currentJugs.some(j => j.current === target)) {
            saveScore('water-jugs', level, level * 2);
            setGameState('level-up');
        }
    };

    // Style adjustments for safe area
    const containerStyle = [
        styles.container,
        { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) + 20 }
    ];

    return (
        <View style={containerStyle}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                    <X size={24} color="#64748b" />
                </TouchableOpacity>
                {gameState === 'playing' && (
                    <View style={styles.levelBadgeContainer}>
                        <Text style={styles.levelBadgeText}>Level {level}</Text>
                    </View>
                )}
            </View>

            {gameState === 'intro' && (
                <View style={styles.centerContent}>
                    <View style={styles.iconBg}>
                        <GlassWater size={48} color="#0d9488" />
                    </View>
                    <Text style={styles.title}>Water Jugs</Text>
                    <Text style={styles.subtitle}>Measure exactly {LEVELS_CONFIG[Math.min(level - 1, 9)].target}L</Text>

                    <View style={styles.rulesContainer}>
                        <Text style={styles.rulesTitle}>Rules:</Text>
                        <Text style={styles.ruleText}>• Fill: Fill a jug to top.</Text>
                        <Text style={styles.ruleText}>• Empty: Pour out a jug completely.</Text>
                        <Text style={styles.ruleText}>• Pour: Transfer water between jugs.</Text>
                    </View>

                    <Button title={`Start Level ${level}`} onPress={startGame} style={styles.startBtn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={styles.gameContainer}>
                    <View style={styles.gameContent}>
                        <View style={styles.goalContainer}>
                            <Text style={styles.goalLabel}>GOAL</Text>
                            <Text style={styles.targetBig}>{LEVELS_CONFIG[level - 1].target}L</Text>
                            <Text style={styles.moves}>Moves: {moves}</Text>
                        </View>

                        <View style={styles.jugsArea}>
                            <View style={styles.jugsRow}>
                                {jugs.map((jug, i) => (
                                    <View key={i} style={styles.jugWrapper}>
                                        <TouchableOpacity
                                            activeOpacity={0.9}
                                            style={[
                                                styles.jug,
                                                selectedJug === i && styles.jugSelected,
                                                selectedJug !== null && selectedJug !== i && styles.jugPourTarget
                                            ]}
                                            onPress={() => handlePress(i)}
                                        >
                                            <View style={[styles.water, { height: `${(jug.current / jug.capacity) * 100}%` }]} />

                                            {/* Measurement Lines */}
                                            <View style={styles.measurementLines}>
                                                {[...Array(3)].map((_, k) => (
                                                    <View key={k} style={styles.measureLine} />
                                                ))}
                                            </View>

                                            <View style={styles.jugInfoOverlay}>
                                                <Text style={styles.jugCurrentText}>{jug.current}L</Text>
                                                <View style={styles.divider} />
                                                <Text style={styles.jugMaxText}>Max {jug.capacity}L</Text>
                                            </View>

                                            {selectedJug === i && (
                                                <View style={styles.selectedBadge}>
                                                    <Text style={styles.selectedText}>SELECTED</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                        <Text style={styles.jugLabel}>Jug {i + 1}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Controls Section - now pushed to bottom but above restart */}
                        <View style={styles.controlsAndRestart}>
                            {selectedJug !== null ? (
                                <View style={styles.controlsArea}>
                                    <View style={styles.instructionBox}>
                                        <Text style={styles.instructionText}>
                                            Tap another jug to pour
                                        </Text>
                                    </View>
                                    <View style={styles.actionButtons}>
                                        <Button
                                            title="Fill Full"
                                            onPress={fillJug}
                                            variant="outline"
                                            style={styles.actionBtn}
                                            textStyle={{ color: '#2563eb' }}
                                        />
                                        <Button
                                            title="Empty It"
                                            onPress={emptyJug}
                                            variant="outline"
                                            style={[styles.actionBtn, { borderColor: '#fecaca' }]}
                                            textStyle={{ color: '#dc2626' }}
                                        />
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.controlsArea}>
                                    <View style={styles.placeholderBox}>
                                        <Text style={styles.placeholderText}>Select a jug to Fill, Empty, or Pour</Text>
                                    </View>
                                </View>
                            )}

                            <TouchableOpacity onPress={() => startLevel(level)} style={styles.restartRow}>
                                <RefreshCw size={16} color="#94a3b8" />
                                <Text style={styles.restartText}>Restart Level</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={styles.centerContent}>
                    <View style={[styles.iconBg, { backgroundColor: '#dcfce7' }]}>
                        <Trophy size={48} color="#16a34a" />
                    </View>
                    <Text style={styles.resultTitle}>Target Reached!</Text>
                    <Text style={styles.points}>+{level * 2} Points</Text>
                    <Button title="Next Level" onPress={() => { setLevel(l => l + 1); startLevel(level + 1); }} style={styles.startBtn} />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff', paddingHorizontal: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, alignItems: 'center', height: 44 },
    closeBtn: { padding: 10, backgroundColor: '#f1f5f9', borderRadius: 20 },
    levelBadgeContainer: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    levelBadgeText: { fontSize: 14, fontWeight: '700', color: '#64748b' },

    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    iconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#ccfbf1', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 32, fontWeight: '800', color: '#1e293b', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#64748b', marginBottom: 32 },

    rulesContainer: { width: '100%', backgroundColor: '#f8fafc', padding: 20, borderRadius: 16, marginBottom: 32 },
    rulesTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginBottom: 12 },
    ruleText: { fontSize: 14, color: '#475569', marginBottom: 8, lineHeight: 20 },

    startBtn: { width: '100%', height: 56 },

    gameContainer: { flex: 1, display: 'flex', flexDirection: 'column' },
    gameContent: { flex: 1, justifyContent: 'space-between' }, // Maximize space distribution

    goalContainer: { alignItems: 'center', marginTop: 20 },
    goalLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', letterSpacing: 1, marginBottom: 4 },
    targetBig: { fontSize: 40, fontWeight: '800', color: '#1e293b' },
    moves: { fontSize: 14, color: '#64748b', marginTop: 8, fontWeight: '500' },

    jugsArea: { flex: 1, justifyContent: 'center', alignItems: 'center' }, // Center jugs vertically and horizontally
    jugsRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, alignItems: 'flex-end', height: 220 },
    jugWrapper: { alignItems: 'center', gap: 8 },

    jug: {
        width: 80,
        height: 160,
        borderWidth: 3,
        borderColor: '#cbd5e1',
        borderTopWidth: 0,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        backgroundColor: 'rgba(239, 246, 255, 0.5)',
        justifyContent: 'flex-end',
        overflow: 'hidden',
        position: 'relative' // Explicitly relative
    },
    jugSelected: {
        borderColor: '#6366f1',
        borderWidth: 3,
        shadowColor: "#6366f1",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
        transform: [{ scale: 1.05 }]
    },
    jugPourTarget: {
        borderColor: '#60a5fa',
        borderStyle: 'dashed'
    },

    water: { backgroundColor: '#60a5fa', width: '100%', opacity: 0.8 },

    measurementLines: { position: 'absolute', right: 0, top: 20, bottom: 20, justifyContent: 'space-evenly', width: 10, opacity: 0.5 },
    measureLine: { height: 1, backgroundColor: '#94a3b8', width: 8 },

    jugInfoOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    jugCurrentText: { fontSize: 20, fontWeight: '800', color: '#334155', textShadowColor: 'rgba(255,255,255,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
    divider: { width: 20, height: 1, backgroundColor: '#94a3b8', marginVertical: 4, opacity: 0.5 },
    jugMaxText: { fontSize: 10, fontWeight: '600', color: '#64748b' },

    selectedBadge: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#6366f1', paddingVertical: 2, alignItems: 'center' },
    selectedText: { color: '#fff', fontSize: 10, fontWeight: '700' },

    jugLabel: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },

    controlsAndRestart: { paddingBottom: 10 },
    controlsArea: { marginBottom: 20 },
    instructionBox: { backgroundColor: '#eef2ff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#c7d2fe', marginBottom: 16, alignItems: 'center' },
    instructionText: { color: '#4338ca', fontWeight: '600' },

    placeholderBox: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, alignItems: 'center', height: 80, justifyContent: 'center' },
    placeholderText: { color: '#94a3b8', fontStyle: 'italic' },

    actionButtons: { flexDirection: 'row', gap: 12 },
    actionBtn: { flex: 1, backgroundColor: '#ffffff' },

    restartRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 10 },
    restartText: { color: '#94a3b8', fontWeight: '500' },

    resultTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 32 }
});
