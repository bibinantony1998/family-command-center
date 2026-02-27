import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { Trophy, X, RefreshCw } from 'lucide-react-native';

const SIZE = 4;
const TILE_COLORS: Record<number, { bg: string; text: string }> = {
    0: { bg: '#cdc1b4', text: '#cdc1b4' },
    2: { bg: '#eee4da', text: '#776e65' },
    4: { bg: '#ede0c8', text: '#776e65' },
    8: { bg: '#f2b179', text: '#f9f6f2' },
    16: { bg: '#f59563', text: '#f9f6f2' },
    32: { bg: '#f67c5f', text: '#f9f6f2' },
    64: { bg: '#f65e3b', text: '#f9f6f2' },
    128: { bg: '#edcf72', text: '#f9f6f2' },
    256: { bg: '#edcc61', text: '#f9f6f2' },
    512: { bg: '#edc850', text: '#f9f6f2' },
    1024: { bg: '#edc53f', text: '#f9f6f2' },
    2048: { bg: '#edc22e', text: '#f9f6f2' },
};

type Grid = number[][];

function emptyGrid(): Grid { return Array.from({ length: SIZE }, () => Array(SIZE).fill(0)); }

function addRandom(g: Grid): Grid {
    const empty: [number, number][] = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (g[r][c] === 0) empty.push([r, c]);
    if (!empty.length) return g;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    const ng = g.map(row => [...row]);
    ng[r][c] = Math.random() < 0.9 ? 2 : 4;
    return ng;
}

function slideRow(row: number[]): { row: number[]; score: number } {
    const filtered = row.filter(x => x !== 0);
    let score = 0;
    for (let i = 0; i < filtered.length - 1; i++) {
        if (filtered[i] === filtered[i + 1]) {
            filtered[i] *= 2; score += filtered[i]; filtered.splice(i + 1, 1);
        }
    }
    while (filtered.length < SIZE) filtered.push(0);
    return { row: filtered, score };
}

function moveGrid(g: Grid, dir: 'left' | 'right' | 'up' | 'down'): { grid: Grid; score: number; moved: boolean } {
    let grid = g.map(r => [...r]);
    let totalScore = 0, moved = false;

    function process(rows: number[][]): number[][] {
        return rows.map(row => {
            const { row: newRow, score } = slideRow(row);
            totalScore += score;
            if (newRow.some((v, i) => v !== row[i])) moved = true;
            return newRow;
        });
    }

    if (dir === 'left') { grid = process(grid); }
    else if (dir === 'right') { grid = process(grid.map(r => [...r].reverse())).map(r => r.reverse()); }
    else if (dir === 'up') {
        let t = grid[0].map((_, c) => grid.map(r => r[c]));
        t = process(t);
        grid = t[0].map((_, c) => t.map(r => r[c]));
    } else {
        let t = grid[0].map((_, c) => grid.map(r => r[c]).reverse());
        t = process(t);
        grid = t[0].map((_, c) => t.map(r => r[c]).reverse());
    }
    return { grid, score: totalScore, moved };
}

function hasWon(g: Grid) { return g.some(r => r.some(v => v >= 2048)); }
function hasLost(g: Grid) {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if (g[r][c] === 0) return false;
        if (c < SIZE - 1 && g[r][c] === g[r][c + 1]) return false;
        if (r < SIZE - 1 && g[r][c] === g[r + 1][c]) return false;
    }
    return true;
}

const SWIPE_MIN = 30;
const screenW = Dimensions.get('window').width;
const CELL = Math.floor((screenW - 48 - 12) / SIZE);

export default function Game2048Screen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'won' | 'lost'>('intro');
    const [grid, setGrid] = useState<Grid>(emptyGrid());
    const [score, setScore] = useState(0);
    const [best, setBest] = useState(0);
    const [loading, setLoading] = useState(true);
    const touchStart = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        getHighestLevel('game-2048').then(l => { setLevel(l); setLoading(false); });
    }, []);

    const startGame = () => {
        const g = addRandom(addRandom(emptyGrid()));
        setGrid(g); setScore(0); setGameState('playing');
    };

    const handleMove = (dir: 'left' | 'right' | 'up' | 'down') => {
        setGrid(prev => {
            const { grid: ng, score: pts, moved } = moveGrid(prev, dir);
            if (!moved) return prev;
            setScore(s => { const ns = s + pts; if (ns > best) setBest(ns); return ns; });
            const final = addRandom(ng);
            if (hasWon(final)) { saveScore('game-2048', level, score); setGameState('won'); }
            else if (hasLost(final)) { setGameState('lost'); }
            return final;
        });
    };

    const panResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: (_, g) => { touchStart.current = { x: g.x0, y: g.y0 }; },
        onPanResponderRelease: (_, g) => {
            if (!touchStart.current) return;
            const dx = g.moveX - touchStart.current.x;
            const dy = g.moveY - touchStart.current.y;
            const adx = Math.abs(dx), ady = Math.abs(dy);
            if (Math.max(adx, ady) < SWIPE_MIN) return;
            if (adx > ady) handleMove(dx > 0 ? 'right' : 'left');
            else handleMove(dy > 0 ? 'down' : 'up');
            touchStart.current = null;
        },
    });

    const tileFontSize = CELL > 70 ? 22 : 16;

    return (
        <View style={[s.container, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}><X size={24} color="#64748b" /></TouchableOpacity>
                <View style={s.scores}>
                    <View style={s.scoreBox}><Text style={s.scoreLabel}>SCORE</Text><Text style={s.scoreVal}>{score}</Text></View>
                    <View style={s.scoreBox}><Text style={s.scoreLabel}>BEST</Text><Text style={s.scoreVal}>{best}</Text></View>
                </View>
                <TouchableOpacity onPress={startGame} style={s.closeBtn}><RefreshCw size={20} color="#64748b" /></TouchableOpacity>
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.emoji}>🔢</Text>
                    <Text style={s.title}>2048</Text>
                    <Text style={s.subtitle}>Swipe tiles to merge them and reach 2048!</Text>
                    <View style={s.rulesBox}>
                        <Text style={s.ruleText}>• Swipe in any direction to move all tiles</Text>
                        <Text style={s.ruleText}>• Same numbers merge and double</Text>
                        <Text style={s.ruleText}>• Reach the 2048 tile to win</Text>
                        <Text style={s.ruleText}>• Game ends when no moves are left</Text>
                    </View>
                    <Button title={loading ? 'Loading…' : 'Start Game'} onPress={startGame} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={s.boardArea} {...panResponder.panHandlers}>
                    <View style={s.board}>
                        {grid.map((row, ri) => row.map((val, ci) => {
                            const tileColor = TILE_COLORS[val] ?? TILE_COLORS[2048];
                            return (
                                <View key={`${ri}-${ci}`} style={[s.tile, { width: CELL, height: CELL, backgroundColor: tileColor.bg }]}>
                                    {val > 0 && <Text style={[s.tileText, { color: tileColor.text, fontSize: tileFontSize }]}>{val}</Text>}
                                </View>
                            );
                        }))}
                    </View>
                    <Text style={s.swipeHint}>Swipe to move tiles</Text>
                </View>
            )}

            {(gameState === 'won' || gameState === 'lost') && (
                <View style={s.center}>
                    <Text style={s.emoji}>{gameState === 'won' ? '🏆' : '😔'}</Text>
                    <Text style={s.resultTitle}>{gameState === 'won' ? 'You reached 2048!' : 'No more moves!'}</Text>
                    <Text style={s.points}>{gameState === 'won' ? `+${score} Points` : `Score: ${score}`}</Text>
                    <Button title="Play Again" onPress={startGame} style={s.btn} />
                </View>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#faf8ef', paddingHorizontal: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 52, marginBottom: 8 },
    closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    scores: { flexDirection: 'row', gap: 8 },
    scoreBox: { backgroundColor: '#bbada0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6, alignItems: 'center', minWidth: 64 },
    scoreLabel: { fontSize: 10, fontWeight: '700', color: '#eee4da', letterSpacing: 0.5 },
    scoreVal: { fontSize: 18, fontWeight: '800', color: '#fff' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emoji: { fontSize: 64, marginBottom: 12 },
    title: { fontSize: 30, fontWeight: '800', color: '#776e65', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#776e65', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    rulesBox: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 14, width: '100%', marginBottom: 28, gap: 6 },
    ruleText: { fontSize: 13, color: '#475569', lineHeight: 18 },
    btn: { width: '100%' },
    boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    board: { backgroundColor: '#bbada0', borderRadius: 8, padding: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tile: { borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
    tileText: { fontWeight: '800' },
    swipeHint: { marginTop: 20, color: '#b5a99e', fontStyle: 'italic', fontSize: 13 },
    resultTitle: { fontSize: 28, fontWeight: '800', color: '#776e65', marginTop: 16, marginBottom: 8 },
    points: { fontSize: 32, fontWeight: '800', color: '#6366f1', marginBottom: 28 },
});
