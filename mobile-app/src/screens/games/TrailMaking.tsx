import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X } from 'lucide-react-native';

const { width: SW } = Dimensions.get('window');
const SVG_SIZE = SW - 40;
const MARGIN = 28;

function getLevelCount(level: number) { return 8 + (level - 1) * 2; }

function generateDots(count: number): { x: number; y: number }[] {
    const dots: { x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
        let x: number, y: number, tries = 0;
        do {
            x = MARGIN + Math.random() * (SVG_SIZE - 2 * MARGIN);
            y = MARGIN + Math.random() * (SVG_SIZE - 2 * MARGIN);
            tries++;
        } while (tries < 50 && dots.some(d => Math.hypot(d.x - x, d.y - y) < 38));
        dots.push({ x, y });
    }
    return dots;
}

export default function TrailMakingScreen() {
    const navigation = useNavigation();
    const { saveScore, getHighestLevel } = useGameScore();
    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'level-up'>('intro');
    const [dots, setDots] = useState<{ x: number; y: number }[]>([]);
    const [nextDot, setNextDot] = useState(0);
    const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number }[]>([]);
    const [elapsed, setElapsed] = useState(0);
    const [loading, setLoading] = useState(true);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => { getHighestLevel('trail-making').then(l => { setLevel(l); setLoading(false); }); }, []);
    useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

    const startLevel = (lvl: number) => {
        const count = getLevelCount(lvl);
        setDots(generateDots(count)); setNextDot(0); setLines([]); setElapsed(0); setLevel(lvl); setGameState('playing');
        if (timerRef.current) clearInterval(timerRef.current);
        const t = Date.now();
        timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - t) / 1000)), 500);
    };

    const handleDot = (idx: number) => {
        if (idx !== nextDot) return;
        if (nextDot > 0) setLines(prev => [...prev, { x1: dots[nextDot - 1].x, y1: dots[nextDot - 1].y, x2: dots[nextDot].x, y2: dots[nextDot].y }]);
        const newNext = nextDot + 1;
        setNextDot(newNext);
        if (newNext === dots.length) {
            if (timerRef.current) clearInterval(timerRef.current);
            setGameState('level-up');
            saveScore('trail-making', level, level * 2);
        }
    };

    return (
        <View style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => { if (timerRef.current) clearInterval(timerRef.current); navigation.goBack(); }} style={s.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                <Text style={s.levelBadge}>Level {level} • {elapsed}s</Text>
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.big}>📍</Text>
                    <Text style={s.title}>Trail Making</Text>
                    <Text style={s.subtitle}>Tap the numbered dots in order (1→2→3…) as fast as you can!</Text>
                    <Button title={loading ? 'Loading...' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && dots.length > 0 && (
                <View style={s.playArea}>
                    <Text style={s.nextHint}>Next: <Text style={s.nextNum}>{nextDot + 1}</Text></Text>
                    <View style={[s.svgWrap, { width: SVG_SIZE, height: SVG_SIZE }]}>
                        {/* Lines */}
                        {lines.map((l, i) => {
                            const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
                            const len = Math.hypot(dx, dy);
                            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                            return (
                                <View key={i} style={{
                                    position: 'absolute', left: l.x1, top: l.y1, width: len, height: 2,
                                    backgroundColor: '#6366f1', transformOrigin: '0 0',
                                    transform: [{ rotate: `${angle}deg` }]
                                }} />
                            );
                        })}
                        {/* Dots */}
                        {dots.map((d, i) => {
                            const done = i < nextDot, isNext = i === nextDot;
                            return (
                                <TouchableOpacity key={i} onPress={() => handleDot(i)}
                                    style={[s.dot, { left: d.x - 18, top: d.y - 18 }, done && s.dotDone, isNext && s.dotNext]}>
                                    <Text style={[s.dotText, (done || isNext) && s.dotTextLight]}>{i + 1}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            )}

            {gameState === 'level-up' && (
                <View style={s.center}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={s.resultTitle}>Trail Blazer! 🔥</Text>
                    <Text style={s.points}>+{level * 2} Points</Text>
                    <Text style={s.timeText}>Finished in {elapsed}s</Text>
                    <Button title="Next Level" onPress={() => { const next = level + 1; setLevel(next); startLevel(next); }} style={s.btn} />
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingTop: 48, paddingHorizontal: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    levelBadge: { fontSize: 14, fontWeight: '700', color: '#6366f1' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    big: { fontSize: 64 },
    title: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 12, marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 },
    btn: { width: '100%', marginTop: 8 },
    playArea: { flex: 1, alignItems: 'center' },
    nextHint: { fontSize: 14, color: '#94a3b8', marginBottom: 8 },
    nextNum: { fontWeight: '800', color: '#6366f1', fontSize: 16 },
    svgWrap: { backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 2, borderColor: '#e2e8f0', position: 'relative', overflow: 'hidden' },
    dot: { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: 'white', borderWidth: 2, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
    dotDone: { backgroundColor: '#a5b4fc', borderColor: '#6366f1' },
    dotNext: { backgroundColor: '#6366f1', borderColor: '#4338ca', shadowColor: '#6366f1', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4, shadowOffset: { width: 0, height: 2 } },
    dotText: { fontSize: 11, fontWeight: '800', color: '#64748b' },
    dotTextLight: { color: 'white' },
    resultTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginTop: 16 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 8 },
    timeText: { fontSize: 14, color: '#94a3b8', marginBottom: 24 },
});
