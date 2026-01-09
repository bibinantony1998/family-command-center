import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { Palette, Dna, Binary, Grid, Calculator, Zap, Table, Mic2, Hexagon, GlassWater, Hammer, Type } from 'lucide-react-native';

type GameNavProp = StackNavigationProp<RootStackParamList>;

const GAMES = [
    { id: 'Game_ColorChaos', name: 'Color Chaos', icon: Palette, color: '#f43f5e', bg: '#ffe4e6' },
    { id: 'Game_MemoryMatch', name: 'Memory Match', icon: Dna, color: '#8b5cf6', bg: '#ede9fe' },
    { id: 'Game_NumberMemory', name: 'Number Memory', icon: Binary, color: '#06b6d4', bg: '#cffafe' },
    { id: 'Game_PatternMemory', name: 'Pattern Memory', icon: Grid, color: '#10b981', bg: '#d1fae5' },
    { id: 'Game_QuickMath', name: 'Quick Math', icon: Calculator, color: '#f59e0b', bg: '#fef3c7' },
    { id: 'Game_ReflexChallenge', name: 'Reflex', icon: Zap, color: '#ef4444', bg: '#fee2e2' },
    { id: 'Game_SchulteTable', name: 'Schulte Table', icon: Table, color: '#6366f1', bg: '#e0e7ff' },
    { id: 'Game_SimonSays', name: 'Simon Says', icon: Mic2, color: '#ec4899', bg: '#fce7f3' }, // Mic2 as proxy
    { id: 'Game_TowerOfHanoi', name: 'Hanoi Tower', icon: Hexagon, color: '#8b5cf6', bg: '#f3e8ff' },
    { id: 'Game_WaterJugs', name: 'Water Jugs', icon: GlassWater, color: '#3b82f6', bg: '#dbeafe' },
    { id: 'Game_WhackAMole', name: 'Whack-A-Mole', icon: Hammer, color: '#a855f7', bg: '#f3e8ff' },
    { id: 'Game_WordScramble', name: 'Word Scramble', icon: Type, color: '#14b8a6', bg: '#ccfbf1' },
];

export default function GamesHubScreen() {
    const navigation = useNavigation<GameNavProp>();

    const renderItem = ({ item }: { item: typeof GAMES[0] }) => {
        const Icon = item.icon;
        return (
            <TouchableOpacity
                style={[styles.item, { backgroundColor: item.bg }]}
                onPress={() => navigation.navigate(item.id as any)}
            >
                <Icon size={32} color={item.color} />
                <Text style={[styles.name, { color: item.color }]}>{item.name}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Arcade</Text>
                <Text style={styles.headerSubtitle}>Play games, earn points!</Text>
            </View>

            <FlatList
                data={GAMES}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                numColumns={2}
                columnWrapperStyle={{ gap: 16 }}
                contentContainerStyle={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: 'white' },
    headerTitle: { fontSize: 32, fontWeight: 'black', color: '#1e293b' },
    headerSubtitle: { fontSize: 16, color: '#64748b' },
    list: { padding: 16 },
    item: {
        flex: 1, aspectRatio: 1, borderRadius: 24, padding: 16,
        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
    },
    name: { marginTop: 12, fontWeight: 'bold', fontSize: 14, textAlign: 'center' }
});
