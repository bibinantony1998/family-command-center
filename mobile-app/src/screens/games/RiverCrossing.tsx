import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { useGameScore } from '../../hooks/useGameScore';
import { X, RefreshCw, Trophy } from 'lucide-react-native';

// Each puzzle: items to cross the river; rule = fn(left[], right[]) -> isIllegal
interface Item { id: string; emoji: string; label: string; canRow?: boolean; }
interface Puzzle {
    title: string;
    items: Item[];
    isIllegal: (side: string[]) => boolean;
    hint: string;
    minMoves: number;
    boatCapacity: number;
}

const isSolvable = (puzzle: Puzzle): number => {
    const M = puzzle.items.length;
    const allMask = (1 << M) - 1;

    const queue: [number, boolean, number][] = [[allMask, true, 0]];
    const visited = new Set<string>();
    visited.add(`${allMask}-true`);

    while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        const [leftMask, isBoatLeft, moves] = item;
        if (leftMask === 0 && !isBoatLeft) return moves;

        if (moves > 100) return -1; // safeguard

        const currentBankMask = isBoatLeft ? leftMask : (allMask ^ leftMask);

        const combos: number[] = [];
        let sub = currentBankMask;
        while (sub > 0) {
            let count = 0;
            let hasRower = false;
            for (let i = 0; i < M; i++) {
                if ((sub & (1 << i)) !== 0) {
                    count++;
                    if (puzzle.items[i].canRow) hasRower = true;
                }
            }
            if (count >= 1 && count <= puzzle.boatCapacity && hasRower) {
                combos.push(sub);
            }
            sub = (sub - 1) & currentBankMask;
        }

        for (const boatMask of combos) {
            const nextLeftMask = isBoatLeft ? (leftMask ^ boatMask) : (leftMask | boatMask);
            const nextRightMask = allMask ^ nextLeftMask;

            const getIds = (mask: number) => puzzle.items.filter((_, i) => (mask & (1 << i)) !== 0).map(x => x.id);

            if (puzzle.isIllegal(getIds(nextLeftMask))) continue;
            if (puzzle.isIllegal(getIds(nextRightMask))) continue;

            const stateKey = `${nextLeftMask}-${!isBoatLeft}`;
            if (!visited.has(stateKey)) {
                visited.add(stateKey);
                queue.push([nextLeftMask, !isBoatLeft, moves + 1]);
            }
        }
    }
    return -1;
};

const getPuzzleForLevel = (level: number): Puzzle => {
    let easing = 0;
    while (true) {
        const p = generateBasePuzzle(level, easing);
        if (level === 1) return p; // Bypass check for tutorial
        const moves = isSolvable(p);
        if (moves !== -1) {
            p.minMoves = moves;
            return p;
        }
        easing++;
        if (easing > 5) return p; // Fallback
    }
};

const generateBasePuzzle = (level: number, easing: number): Puzzle => {
    const cycle = (level - 1) % 3; // 0 = Food Chain, 1 = Outnumber, 2 = Protect
    const difficultyGroup = Math.floor((level - 1) / 3);

    if (cycle === 0) {
        if (level === 1) {
            return {
                title: 'Farmer, Fox, Chicken & Grain',
                items: [
                    { id: 'farmer', emoji: '🧑‍🌾', label: 'Farmer', canRow: true },
                    { id: 'fox', emoji: '🦊', label: 'Fox', canRow: false },
                    { id: 'chicken', emoji: '🐔', label: 'Chicken', canRow: false },
                    { id: 'grain', emoji: '🌾', label: 'Grain', canRow: false },
                ],
                isIllegal: (side) =>
                    !side.includes('farmer') && (
                        (side.includes('fox') && side.includes('chicken')) ||
                        (side.includes('chicken') && side.includes('grain'))
                    ),
                hint: 'Fox eats chicken; chicken eats grain. Only the Farmer can row the boat!',
                minMoves: 7,
                boatCapacity: 2,
            };
        }

        // Food Chain
        const N = Math.min(7, 3 + difficultyGroup);
        const CHAINS = [
            [], [], [], // N=0,1,2 n/a
            [{ e: '🦊', n: 'Fox' }, { e: '🐔', n: 'Chicken' }, { e: '🌾', n: 'Grain' }], // N=3
            [{ e: '🦅', n: 'Hawk' }, { e: '🐍', n: 'Snake' }, { e: '🐭', n: 'Mouse' }, { e: '🧀', n: 'Cheese' }], // N=4
            [{ e: '🐻', n: 'Bear' }, { e: '🐺', n: 'Wolf' }, { e: '🐶', n: 'Dog' }, { e: '🐱', n: 'Cat' }, { e: '🐭', n: 'Mouse' }], // N=5
            [{ e: '🦖', n: 'T-Rex' }, { e: '🐊', n: 'Croc' }, { e: '🦅', n: 'Eagle' }, { e: '🐍', n: 'Snake' }, { e: '🐸', n: 'Frog' }, { e: '🪰', n: 'Fly' }], // N=6
            [{ e: '🐉', n: 'Dragon' }, { e: '🦖', n: 'Rex' }, { e: '🦍', n: 'Kong' }, { e: '🐻', n: 'Bear' }, { e: '🐺', n: 'Wolf' }, { e: '🐑', n: 'Sheep' }, { e: '🌾', n: 'Grain' }] // N=7
        ];
        const chain = CHAINS[N];

        const items = chain.map((it, i) => ({ id: `i${i}`, emoji: it.e, label: it.n, canRow: i < Math.max(1, N - 2) }));
        const cap = Math.floor(N / 2) + easing;

        return {
            title: `Food Chain (${N} items)`,
            items,
            isIllegal: (side) => {
                const indices = side.map(id => parseInt(id.substring(1))).sort((a, b) => a - b);
                for (let i = 0; i < indices.length - 1; i++) {
                    if (indices[i + 1] === indices[i] + 1) return true; // Adjacent found!
                }
                return false;
            },
            hint: `Each item will eat the one directly below it in the chain. Separating them is key!`,
            minMoves: N * 3,
            boatCapacity: cap,
        }
    } else if (cycle === 1) {
        // Outnumber Factions
        const N = 3 + difficultyGroup;
        const THEMES = [
            { a: { e: '😇', n: 'Human' }, b: { e: '🧛', n: 'Vamp' } },
            { a: { e: '🧑‍🚀', n: 'Astro' }, b: { e: '👽', n: 'Alien' } },
            { a: { e: '🧙', n: 'Wiz' }, b: { e: '👹', n: 'Orc' } },
            { a: { e: '🐶', n: 'Dog' }, b: { e: '🐱', n: 'Cat' } },
            { a: { e: '🦸', n: 'Hero' }, b: { e: '🦹', n: 'Vill' } },
            { a: { e: '🧝', n: 'Elf' }, b: { e: '👺', n: 'Gob' } },
        ];
        const theme = THEMES[difficultyGroup % THEMES.length];

        const items = [];
        for (let i = 1; i <= N; i++) {
            items.push({ id: `a${i}`, emoji: theme.a.e, label: `${theme.a.n} ${i}`, canRow: true });
            items.push({ id: `b${i}`, emoji: theme.b.e, label: `${theme.b.n} ${i}`, canRow: i < N || easing > 0 });
        }
        return {
            title: `${N} ${theme.a.n}s & ${theme.b.n}s`,
            items,
            isIllegal: (side) => {
                const aCount = side.filter(x => x.startsWith('a')).length;
                const bCount = side.filter(x => x.startsWith('b')).length;
                return aCount > 0 && bCount > aCount; // B cannot outnumber A if A is present
            },
            hint: `The ${theme.b.n}s (${theme.b.e}) must never outnumber the ${theme.a.n}s (${theme.a.e}) on either side!`,
            minMoves: N * 4 - 1,
            boatCapacity: Math.max(2, N - 1) + Math.floor(easing / 2),
        };
    } else {
        // Protect
        const N = 3 + difficultyGroup;
        const THEMES = [
            { p: { e: '👨', n: 'Hus' }, c: { e: '👩', n: 'Wife' } },
            { p: { e: '🛡️', n: 'Kni' }, c: { e: '👑', n: 'Reg' } },
            { p: { e: '🐕', n: 'Dog' }, c: { e: '🐑', n: 'Shp' } },
            { p: { e: '🐧', n: 'Pen' }, c: { e: '🥚', n: 'Egg' } },
            { p: { e: '🦖', n: 'Rex' }, c: { e: '👶', n: 'Bby' } },
            { p: { e: '🦅', n: 'Eag' }, c: { e: '🐥', n: 'Chk' } },
        ];
        const theme = THEMES[difficultyGroup % THEMES.length];

        const items = [];
        for (let i = 1; i <= N; i++) {
            items.push({ id: `p${i}`, emoji: theme.p.e, label: `${theme.p.n} ${i}`, canRow: true });
            items.push({ id: `c${i}`, emoji: theme.c.e, label: `${theme.c.n} ${i}`, canRow: N > 3 || i === 1 || easing > 0 });
        }
        return {
            title: `${N} Protectors & Wards`,
            items,
            isIllegal: (side) => {
                const protectors = side.filter(x => x.startsWith('p')).map(x => x.substring(1));
                const wards = side.filter(x => x.startsWith('c')).map(x => x.substring(1));
                return wards.some(w => !protectors.includes(w)) && protectors.length > 0;
            },
            hint: `A ${theme.c.n} (${theme.c.e}) cannot be with another ${theme.p.n} (${theme.p.e}) unless their own ${theme.p.n} is present.`,
            minMoves: N * 4 - 3,
            boatCapacity: Math.max(2, N - 1) + Math.floor(easing / 2),
        };
    }
};

type Side = 'left' | 'right';

export default function RiverCrossing() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { saveScore, getHighestLevel } = useGameScore();

    const [level, setLevel] = useState(1);
    const [gameState, setGameState] = useState<'intro' | 'playing' | 'won' | 'lost'>('intro');
    const [puzzle, setPuzzle] = useState<Puzzle>(getPuzzleForLevel(1));
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
        const p = getPuzzleForLevel(lvl);
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

        if (boatLoad.length === 0) {
            setErrorMsg('The boat is empty!');
            return;
        }

        const hasRower = boatLoad.some(id => puzzle.items.find(x => x.id === id)?.canRow);
        if (!hasRower) {
            setErrorMsg('Someone needs to row the boat! (Look for the 🛶 icon)');
            return;
        }

        // Only check the side the boat is LEAVING — those items are now unsupervised.
        if (puzzle.isIllegal(newFrom)) {
            setErrorMsg(`Chaos ensued on the ${boatSide === 'left' ? 'left' : 'right'} bank! You left a dangerous combination unsupervised.`);
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
            saveScore('river-crossing', level, Math.max(1, puzzle.minMoves * 2 - moves) * level * 3);
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
                        <Text style={s.rule}>• Tap items to load them onto the boat</Text>
                        <Text style={s.rule}>• Each puzzle shows the boat's max capacity</Text>
                        <Text style={s.rule}>• At least one person in the boat MUST know how to row (🛶)</Text>
                        <Text style={s.rule}>• Press Row → to cross</Text>
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
                                    <View style={s.itemContent}>
                                        <Text style={s.itemEmoji}>{it.emoji}</Text>
                                        <Text style={s.itemLabel}>{it.label}</Text>
                                    </View>
                                    {it.canRow && <Text style={s.rowerIcon}>🛶</Text>}
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* RIVER + BOAT */}
                        <View style={s.river}>
                            <Text style={s.riverLabel}>🌊</Text>
                            <View style={[s.boat, { alignSelf: 'center' }]}>
                                <View style={s.boatItemContainer}>
                                    {boatLoad.map(id => {
                                        const it = puzzle.items.find(x => x.id === id);
                                        return it ? <Text key={id} style={s.boatItem}>{it.emoji}</Text> : null;
                                    })}
                                </View>
                                <Text style={s.boatCapacity}>{boatLoad.length}/{puzzle.boatCapacity} size</Text>
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
                                    <View style={s.itemContent}>
                                        <Text style={s.itemEmoji}>{it.emoji}</Text>
                                        <Text style={s.itemLabel}>{it.label}</Text>
                                    </View>
                                    {it.canRow && <Text style={s.rowerIcon}>🛶</Text>}
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
                    <Text style={s.points}>+{Math.max(1, puzzle.minMoves * 2 - moves) * level * 3} Points</Text>
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
    item: { backgroundColor: '#fff', borderRadius: 12, padding: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderColor: '#e2e8f0' },
    itemContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    itemSelected: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
    itemEmoji: { fontSize: 24 },
    itemLabel: { fontSize: 10, fontWeight: '700', color: '#475569' },
    rowerIcon: { fontSize: 14 },
    river: { width: 80, alignItems: 'center', gap: 8, justifyContent: 'center' },
    riverLabel: { fontSize: 28 },
    boat: { backgroundColor: '#bfdbfe', borderRadius: 10, padding: 8, alignItems: 'center', justifyContent: 'center', width: 70, minHeight: 60 },
    boatCapacity: { fontSize: 9, fontWeight: '700', color: '#3b82f6', marginTop: 4 },
    boatItemContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
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
