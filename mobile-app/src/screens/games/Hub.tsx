import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import {
    Palette, Dna, Binary, Grid, Calculator, Zap, Table, Mic2, Hexagon,
    GlassWater, Hammer, Type, FlaskConical, Brain, Hash, MapPin,
    Eye, Shuffle, GitFork, RotateCcw
} from 'lucide-react-native';

type GameNavProp = StackNavigationProp<RootStackParamList>;

interface GameDef {
    id: keyof RootStackParamList;
    name: string;
    icon: typeof Calculator;
    color: string;
    category: string;
}

const GAMES: GameDef[] = [
    // Memory
    { id: 'Game_MemoryMatch', name: 'Memory Match', icon: Dna, color: '#8b5cf6', category: '🧠 Memory' },
    { id: 'Game_SimonSays', name: 'Simon Says', icon: Mic2, color: '#6366f1', category: '🧠 Memory' },
    { id: 'Game_PatternMemory', name: 'Pattern Memory', icon: Grid, color: '#7c3aed', category: '🧠 Memory' },
    { id: 'Game_NumberMemory', name: 'Number Memory', icon: Binary, color: '#06b6d4', category: '🧠 Memory' },
    { id: 'Game_NBack', name: 'N-Back', icon: Brain, color: '#4f46e5', category: '🧠 Memory' },
    // Problem Solving
    { id: 'Game_QuickMath', name: 'Quick Math', icon: Calculator, color: '#f59e0b', category: '🧩 Problem Solving' },
    { id: 'Game_WaterJugs', name: 'Water Jugs', icon: GlassWater, color: '#3b82f6', category: '🧩 Problem Solving' },
    { id: 'Game_TowerOfHanoi', name: 'Tower of Hanoi', icon: Hexagon, color: '#8b5cf6', category: '🧩 Problem Solving' },
    { id: 'Game_BallSort', name: 'Ball Sort', icon: FlaskConical, color: '#a855f7', category: '🧩 Problem Solving' },
    { id: 'Game_NumberSequence', name: 'Num Sequence', icon: Hash, color: '#10b981', category: '🧩 Problem Solving' },
    { id: 'Game_PathwayMaze', name: 'Pathway Maze', icon: MapPin, color: '#0d9488', category: '🧩 Problem Solving' },
    // Attention
    { id: 'Game_ReflexChallenge', name: 'Reflex', icon: Zap, color: '#ef4444', category: '⚡ Attention' },
    { id: 'Game_SchulteTable', name: 'Schulte Table', icon: Table, color: '#6366f1', category: '⚡ Attention' },
    { id: 'Game_WhackAMole', name: 'Whack-A-Mole', icon: Hammer, color: '#a855f7', category: '⚡ Attention' },
    { id: 'Game_VisualSearch', name: 'Visual Search', icon: Eye, color: '#0ea5e9', category: '⚡ Attention' },
    { id: 'Game_TrailMaking', name: 'Trail Making', icon: GitFork, color: '#d946ef', category: '⚡ Attention' },
    { id: 'Game_DualTask', name: 'Dual Task', icon: Brain, color: '#f43f5e', category: '⚡ Attention' },
    // Verbal
    { id: 'Game_WordScramble', name: 'Word Scramble', icon: Type, color: '#14b8a6', category: '📝 Verbal' },
    { id: 'Game_AnagramSolver', name: 'Anagram', icon: Shuffle, color: '#d97706', category: '📝 Verbal' },
    // Spatial
    { id: 'Game_ColorChaos', name: 'Color Chaos', icon: Palette, color: '#f43f5e', category: '🔷 Spatial' },
    { id: 'Game_MentalRotation', name: 'Mental Rotation', icon: RotateCcw, color: '#06b6d4', category: '🔷 Spatial' },
];

const CATEGORIES = [...new Set(GAMES.map(g => g.category))];

export default function GamesHubScreen() {
    const navigation = useNavigation<GameNavProp>();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Arcade</Text>
                <Text style={styles.headerSubtitle}>{GAMES.length} games • Play to earn points!</Text>
            </View>

            <FlatList
                data={CATEGORIES}
                keyExtractor={cat => cat}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.list}
                renderItem={({ item: cat }) => (
                    <View style={styles.categorySection}>
                        <Text style={styles.catLabel}>{cat}</Text>
                        <View style={styles.catGrid}>
                            {GAMES.filter(g => g.category === cat).map(game => {
                                const Icon = game.icon;
                                return (
                                    <TouchableOpacity key={game.id} style={styles.item}
                                        onPress={() => navigation.navigate(game.id as any)}>
                                        <View style={[styles.iconWrap, { backgroundColor: game.color + '20' }]}>
                                            <Icon size={28} color={game.color} />
                                        </View>
                                        <Text style={[styles.name, { color: game.color }]}>{game.name}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    headerTitle: { fontSize: 26, fontWeight: '800', color: '#1e293b' },
    headerSubtitle: { fontSize: 14, color: '#64748b', marginTop: 2 },
    list: { padding: 16, paddingBottom: 40 },
    categorySection: { marginBottom: 20 },
    catLabel: { fontSize: 15, fontWeight: '700', color: '#475569', marginBottom: 10 },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    item: {
        width: '47%', borderRadius: 20, padding: 14, backgroundColor: 'white',
        alignItems: 'center', shadowColor: '#64748b', shadowOpacity: 0.08, shadowRadius: 8,
        elevation: 2, shadowOffset: { width: 0, height: 3 },
    },
    iconWrap: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    name: { fontWeight: '700', fontSize: 13, textAlign: 'center' },
});
