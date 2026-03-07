import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { X, RefreshCw, Trophy } from 'lucide-react-native';

// Each puzzle: items to cross the river; rule = fn(left[], right[]) -> isIllegal
interface Puzzle {
    title: string;
    items: { id: string; emoji: string; label: string }[];
    isIllegal: (side: string[]) => boolean;
    hint: string;
    boatCapacity: number;
}

const PUZZLES: Puzzle[] = [
    {
        title: 'Farmer, Fox, Chicken & Grain',
        items: [
            { id: 'fox', emoji: '🦊', label: 'Fox' },
            { id: 'chicken', emoji: '🐔', label: 'Chicken' },
            { id: 'grain', emoji: '🌾', label: 'Grain' },
        ],
        isIllegal: (side) =>
            (side.includes('fox') && side.includes('chicken')) ||
            (side.includes('chicken') && side.includes('grain')),
        hint: 'Fox eats chicken; chicken eats grain. Farmer must supervise dangerous pairs.',
        boatCapacity: 1,
    },
    {
        title: 'Three Missionaries & Cannibals',
        items: [
            { id: 'm1', emoji: '🙏', label: 'Miss 1' },
            { id: 'm2', emoji: '🙏', label: 'Miss 2' },
            { id: 'm3', emoji: '🙏', label: 'Miss 3' },
            { id: 'c1', emoji: '😈', label: 'Cann 1' },
            { id: 'c2', emoji: '😈', label: 'Cann 2' },
            { id: 'c3', emoji: '😈', label: 'Cann 3' },
        ],
        isIllegal: (side) => {
            const m = side.filter(x => x.startsWith('m')).length;
            const c = side.filter(x => x.startsWith('c')).length;
            return m > 0 && c > m;
        },
        hint: 'Cannibals must never outnumber missionaries on either side.',
        boatCapacity: 2,
    },
    {
        title: 'Jealous Husbands',
        items: [
            { id: 'h1', emoji: '👨', label: 'Hus A' },
            { id: 'w1', emoji: '👩', label: 'Wife A' },
            { id: 'h2', emoji: '🧔', label: 'Hus B' },
            { id: 'w2', emoji: '💁', label: 'Wife B' },
        ],
        isIllegal: (side) =>
            (side.includes('w1') && side.includes('h2') && !side.includes('h1')) ||
            (side.includes('w2') && side.includes('h1') && !side.includes('h2')),
        hint: 'No wife can be with another husband unless her own husband is present.',
        boatCapacity: 2,
    },
];

type Side = 'left' | 'right';

export default function RiverCrossing() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'won' | 'lost'>('intro');
    const [puzzle, setPuzzle] = useState<Puzzle>(PUZZLES[0]);
    const [left, setLeft] = useState<string[]>([]);
    const [right, setRight] = useState<string[]>([]);
    const [boatSide, setBoatSide] = useState<Side>('left');
    const [boatLoad, setBoatLoad] = useState<string[]>([]);
    const [moves, setMoves] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getHighestLevel('river-crossing').then(l => { setLevel(l); setLoading(false); });
    }, []);

    const startLevel = (lvl: number) => {
        const p = PUZZLES[(lvl - 1) % PUZZLES.length];
        setPuzzle(p);
        setLeft(p.items.map(i => i.id));
        setRight([]);
        setBoatSide('left');
        setBoatLoad([]);
        setMoves(0);
        setErrorMsg('');
        setGameState('playing');
    };

    const toggleBoat = (id: string) => {
        if (boatLoad.includes(id)) {
            setBoatLoad(bl => bl.filter(x => x !== id));
        } else if (boatLoad.length < puzzle.boatCapacity) {
            setBoatLoad(bl => [...bl, id]);
        }
    };

    const row = () => {
        const fromSide = boatSide === 'left' ? left : right;
        const toSide = boatSide === 'left' ? right : left;
        const setFrom = boatSide === 'left' ? setLeft : setRight;
        const setTo = boatSide === 'left' ? setRight : setLeft;

        const newFrom = fromSide.filter(x => !boatLoad.includes(x));
        const newTo = [...toSide, ...boatLoad];

        // Only check the side the farmer is LEAVING — those items are now unsupervised.
        // The destination side is safe because the farmer arrives there.
        if (puzzle.isIllegal(newFrom)) {
            setErrorMsg(`You left a dangerous pair alone on the ${boatSide === 'left' ? 'left' : 'right'} bank!`);
            setGameState('lost');
            return;
        }

        setFrom(newFrom);
        setTo(newTo);
        setBoatSide(s => s === 'left' ? 'right' : 'left');
        setBoatLoad([]);
        setMoves(m => m + 1);
        setErrorMsg('');

        if (newTo.length === puzzle.items.length) {
            saveScore('river-crossing', level, Math.max(1, 30 - moves) * level * 3);
            setGameState('won');
        }
    };

    const bankItems = (ids: string[]) =>
        puzzle.items.filter(it => ids.includes(it.id));

    return (
        <ScrollView style={[s.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}><X size={22} color="#64748b" /></TouchableOpacity>
                {gameState === 'playing' && <Text style={s.badge}>{puzzle.title}</Text>}
                {gameState === 'playing' && <TouchableOpacity onPress={() => startLevel(level)} style={s.iconBtn}><RefreshCw size={18} color="#64748b" /></TouchableOpacity>}
            </View>

            {gameState === 'intro' && (
                <View style={s.center}>
                    <Text style={s.emoji}>⛵</Text>
                    <Text style={s.title}>River Crossing</Text>
                    <Text style={s.sub}>Transport everyone safely — but follow the rules!</Text>
                    <View style={s.rules}>
                        <Text style={s.rule}>• Tap items on the bank to load onto the boat</Text>
                        <Text style={s.rule}>• Each puzzle shows the boat capacity (1 or 2 items max)</Text>
                        <Text style={s.rule}>• Press Row → to cross — the farmer always travels with the boat</Text>
                        <Text style={s.rule}>• You can cross with an empty boat to drop someone off alone</Text>
                        <Text style={s.rule}>• Certain combinations left alone on a bank are dangerous!</Text>
                    </View>
                    <Button title={loading ? 'Loading…' : `Start Level ${level}`} onPress={() => startLevel(level)} disabled={loading} style={s.btn} />
                </View>
            )}

            {gameState === 'playing' && (
                <View style={s.playArea}>
                    <Text style={s.moves}>Moves: {moves}</Text>

                    {/* Scene */}
                    <View style={s.scene}>
                        {/* LEFT BANK */}
                        <View style={s.bank}>
                            <Text style={s.bankLabel}>🏞 Left</Text>
                            {bankItems(left).map(it => (
                                <TouchableOpacity
                                    key={it.id}
                                    onPress={() => boatSide === 'left' && toggleBoat(it.id)}
                                    style={[s.item, boatLoad.includes(it.id) && s.itemSelected]}
                                >
                                    <Text style={s.itemEmoji}>{it.emoji}</Text>
                                    <Text style={s.itemLabel}>{it.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* RIVER + BOAT */}
                        <View style={s.river}>
                            <Text style={s.riverLabel}>🌊</Text>
                            <View style={[s.boat, { alignSelf: 'center' }]}>
                                <Text style={s.boatText}>⛵ 👨‍🌾</Text>
                                {boatLoad.map(id => {
                                    const it = puzzle.items.find(x => x.id === id);
                                    return it ? <Text key={id} style={s.boatItem}>{it.emoji}</Text> : null;
                                })}
                                <Text style={s.boatCapacity}>{boatLoad.length}/{puzzle.boatCapacity}</Text>
                            </View>
                            <TouchableOpacity style={s.rowBtn} onPress={row}>
                                <Text style={s.rowBtnText}>{boatSide === 'left' ? 'Row →' : '← Row'}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* RIGHT BANK */}
                        <View style={s.bank}>
                            <Text style={s.bankLabel}>🏝 Right</Text>
                            {bankItems(right).map(it => (
                                <TouchableOpacity
                                    key={it.id}
                                    onPress={() => boatSide === 'right' && toggleBoat(it.id)}
                                    style={[s.item, boatLoad.includes(it.id) && s.itemSelected]}
                                >
                                    <Text style={s.itemEmoji}>{it.emoji}</Text>
                                    <Text style={s.itemLabel}>{it.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {!!errorMsg && <Text style={s.error}>{errorMsg}</Text>}
                    <View style={s.hintBox}>
                        <Text style={s.hintText}>💡 {puzzle.hint}</Text>
                    </View>
                </View>
            )}

            {gameState === 'won' && (
                <View style={s.center}>
                    <Trophy size={64} color="#fbbf24" />
                    <Text style={s.title}>Everyone's safe! ⛵</Text>
                    <Text style={s.movesText}>{moves} crossings</Text>
                    <Text style={s.points}>+{Math.max(1, 30 - moves) * level * 3} Points</Text>
                    <Button title="Next Puzzle" onPress={() => { const nxt = level + 1; setLevel(nxt); startLevel(nxt); }} style={s.btn} />
                </View>
            )}

            {gameState === 'lost' && (
                <View style={s.center}>
                    <Text style={s.bigEmoji}>💀</Text>
                    <Text style={s.title}>Chaos Ensued!</Text>
                    <Text style={s.errorBig}>{errorMsg}</Text>
                    <View style={s.hintBox}>
                        <Text style={s.hintText}>💡 {puzzle.hint}</Text>
                    </View>
                    <Button title="Try Again" onPress={() => startLevel(level)} style={s.btn} />
                </View>
            )}
        </ScrollView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44, marginBottom: 8 },
    iconBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 20 },
    badge: { fontSize: 12, fontWeight: '700', color: '#64748b', flex: 1, textAlign: 'center' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
    emoji: { fontSize: 64, marginBottom: 12 },
    title: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginBottom: 8, textAlign: 'center' },
    sub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    rules: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 14, width: '100%', marginBottom: 28, gap: 6 },
    rule: { fontSize: 13, color: '#475569', lineHeight: 18 },
    btn: { width: '100%' },
    playArea: { flex: 1 },
    moves: { textAlign: 'center', fontWeight: '700', color: '#64748b', marginBottom: 12 },
    scene: { flexDirection: 'row', gap: 8 },
    bank: { flex: 1, backgroundColor: '#f0fdf4', borderRadius: 16, padding: 10, gap: 8, minHeight: 200 },
    bankLabel: { fontWeight: '800', fontSize: 13, color: '#15803d', textAlign: 'center', marginBottom: 4 },
    item: { backgroundColor: '#fff', borderRadius: 12, padding: 8, alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0' },
    itemSelected: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
    itemEmoji: { fontSize: 24 },
    itemLabel: { fontSize: 10, fontWeight: '700', color: '#475569', marginTop: 2 },
    river: { width: 80, alignItems: 'center', gap: 8, justifyContent: 'center' },
    riverLabel: { fontSize: 28 },
    boat: { backgroundColor: '#bfdbfe', borderRadius: 10, padding: 8, alignItems: 'center', width: 70, minHeight: 60 },
    boatCapacity: { fontSize: 9, fontWeight: '700', color: '#3b82f6', marginTop: 2 },
    boatText: { fontSize: 24 },
    boatItem: { fontSize: 18 },
    rowBtn: { backgroundColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 },
    rowBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    error: { marginTop: 12, color: '#ef4444', fontWeight: '600', textAlign: 'center', fontSize: 13 },
    hintBox: { backgroundColor: '#fefce8', padding: 12, borderRadius: 14, marginTop: 16 },
    hintText: { fontSize: 12, color: '#854d0e', lineHeight: 18 },
    movesText: { fontSize: 16, color: '#64748b', marginTop: 4 },
    points: { fontSize: 36, fontWeight: '800', color: '#6366f1', marginTop: 8, marginBottom: 28 },
    bigEmoji: { fontSize: 64, marginBottom: 12, textAlign: 'center' },
    errorBig: { fontSize: 15, color: '#ef4444', fontWeight: '600', textAlign: 'center', marginBottom: 12 },
});
