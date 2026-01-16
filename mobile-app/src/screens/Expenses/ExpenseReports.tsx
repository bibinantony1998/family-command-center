import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Calendar, TrendingUp } from 'lucide-react-native';
import { PointsChart } from '../../components/PointsChart';
import { formatCurrency } from '../../lib/expense-utils';

const { width } = Dimensions.get('window');

export default function ExpenseReportsScreen({ navigation }: any) {
    const { family } = useAuth();
    const [loading, setLoading] = useState(true);
    const [selectedRange, setSelectedRange] = useState<'all' | 'current' | 'last'>('current');

    // Data
    const [totalSpent, setTotalSpent] = useState(0);
    const [currentMonthSpent, setCurrentMonthSpent] = useState(0);
    const [lastMonthSpent, setLastMonthSpent] = useState(0);
    const [trendData, setTrendData] = useState<number[]>([]); // For PointsChart
    const [categoryData, setCategoryData] = useState<{ name: string, value: number, color: string }[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data: expenses } = await supabase.from('expenses').select('*');

            if (expenses) {
                // --- Summary Metrics ---
                const total = expenses.reduce((sum, curr) => sum + curr.amount, 0);
                setTotalSpent(total);

                const now = new Date();
                const currentMonthIdx = now.getMonth();
                const currentYear = now.getFullYear();

                const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastMonthIdx = lastMonthDate.getMonth();
                const lastMonthYear = lastMonthDate.getFullYear();

                let currentSum = 0;
                let lastSum = 0;

                expenses.forEach(e => {
                    const d = new Date(e.date);
                    if (d.getMonth() === currentMonthIdx && d.getFullYear() === currentYear) {
                        currentSum += e.amount;
                    } else if (d.getMonth() === lastMonthIdx && d.getFullYear() === lastMonthYear) {
                        lastSum += e.amount;
                    }
                });

                setCurrentMonthSpent(currentSum);
                setLastMonthSpent(lastSum);

                // Initial Calculations
                calculateCategories(expenses, 'current');
                calculateTrend(expenses, 'current');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const calculateCategories = async (expenses: any[], range: 'all' | 'current' | 'last') => {
        const now = new Date();
        const currentMonthIdx = now.getMonth();
        const currentYear = now.getFullYear();
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthIdx = lastMonthDate.getMonth();
        const lastMonthYear = lastMonthDate.getFullYear();

        const catMap: Record<string, number> = {};

        expenses.forEach(e => {
            const d = new Date(e.date);
            let include = false;

            if (range === 'all') include = true;
            else if (range === 'current') {
                if (d.getMonth() === currentMonthIdx && d.getFullYear() === currentYear) include = true;
            } else if (range === 'last') {
                if (d.getMonth() === lastMonthIdx && d.getFullYear() === lastMonthYear) include = true;
            }

            if (include) {
                catMap[e.category] = (catMap[e.category] || 0) + e.amount;
            }
        });

        const data = Object.keys(catMap).map((key, index) => ({
            name: key,
            value: catMap[key],
            color: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'][index % 6]
        })).sort((a, b) => b.value - a.value);

        setCategoryData(data);
    };

    // Update categories when filter changes
    // Note: We need 'allExpenses' state to do this client side without refetching. 
    // Ideally I should store allExpenses in state. For now, I'll just re-fetch or (better) store in state.
    // Making a quick fix to store allExpenses.
    const [allExpenses, setAllExpenses] = useState<any[]>([]);
    useEffect(() => {
        const fetchForState = async () => {
            const { data } = await supabase.from('expenses').select('*');
            if (data) setAllExpenses(data);
        };
        fetchForState();
    }, []);

    useEffect(() => {
        if (allExpenses.length > 0) {
            calculateCategories(allExpenses, selectedRange);
            calculateTrend(allExpenses, selectedRange);
        }
    }, [selectedRange, allExpenses]);

    const calculateTrend = (expenses: any[], range: 'all' | 'current' | 'last') => {
        const now = new Date();
        const tData: number[] = [];

        if (range === 'current') {
            // Days of current month up to today
            const startParams = { year: now.getFullYear(), month: now.getMonth() };
            const daysInMonth = now.getDate(); // Up to today

            for (let i = 1; i <= daysInMonth; i++) {
                const daySum = expenses.reduce((sum, e) => {
                    const d = new Date(e.date);
                    if (d.getDate() === i && d.getMonth() === startParams.month && d.getFullYear() === startParams.year) {
                        return sum + e.amount;
                    }
                    return sum;
                }, 0);
                tData.push(daySum);
            }
        } else if (range === 'last') {
            // Days of last month
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const year = lastMonth.getFullYear();
            const month = lastMonth.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            for (let i = 1; i <= daysInMonth; i++) {
                const daySum = expenses.reduce((sum, e) => {
                    const d = new Date(e.date);
                    if (d.getDate() === i && d.getMonth() === month && d.getFullYear() === year) {
                        return sum + e.amount;
                    }
                    return sum;
                }, 0);
                tData.push(daySum);
            }
        } else if (range === 'all') {
            // Last 6 months trend
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthIdx = d.getMonth();
                const year = d.getFullYear();

                const monthSum = expenses.reduce((sum, e) => {
                    const ed = new Date(e.date);
                    if (ed.getMonth() === monthIdx && ed.getFullYear() === year) {
                        return sum + e.amount;
                    }
                    return sum;
                }, 0);
                tData.push(monthSum);
            }
        }
        setTrendData(tData);
    };


    const currency = family?.currency || 'INR';
    const displayAmount = selectedRange === 'all' ? totalSpent : selectedRange === 'current' ? currentMonthSpent : lastMonthSpent;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Expense Reports</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Filter Tabs */}
                <View style={styles.tabContainer}>
                    {(['current', 'last', 'all'] as const).map(tab => (
                        <TouchableOpacity
                            key={tab}
                            onPress={() => setSelectedRange(tab)}
                            style={[styles.tab, selectedRange === tab && styles.tabActive]}
                        >
                            <Text style={[styles.tabText, selectedRange === tab && styles.tabTextActive]}>
                                {tab === 'current' ? 'This Month' : tab === 'last' ? 'Last Month' : 'All Time'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Summary Card */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryHeader}>
                        <Calendar size={20} color="white" opacity={0.8} />
                        <Text style={styles.summaryLabel}>Total Spent</Text>
                    </View>
                    <Text style={styles.summaryValue}>{formatCurrency(displayAmount, currency)}</Text>
                </View>

                {/* Trend Chart */}
                <View style={styles.chartSection}>
                    <View style={styles.sectionHeader}>
                        <TrendingUp size={18} color="#475569" />
                        <Text style={styles.sectionTitle}>
                            Trend ({selectedRange === 'current' ? 'This Month' : selectedRange === 'last' ? 'Last Month' : 'Last 6 Months'})
                        </Text>
                    </View>
                    <View style={styles.chartCard}>
                        <PointsChart data={trendData} />
                    </View>
                </View>

                {/* Category Breakdown (Bar List) */}
                <View style={[styles.chartSection, { marginBottom: 40 }]}>
                    <Text style={styles.sectionTitle}>Category Breakdown</Text>
                    <View style={styles.categoryCard}>
                        {categoryData.length === 0 ? (
                            <Text style={styles.emptyText}>No data for this period</Text>
                        ) : (
                            categoryData.map(cat => (
                                <View key={cat.name} style={styles.catRow}>
                                    <View style={styles.catInfo}>
                                        <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                                        <Text style={styles.catName}>{cat.name}</Text>
                                    </View>
                                    <View style={styles.catValueRow}>
                                        <Text style={styles.catValue}>{formatCurrency(cat.value, currency)}</Text>
                                        <View style={styles.catBarBg}>
                                            <View style={[styles.catBarFill, { width: `${displayAmount > 0 ? (cat.value / displayAmount) * 100 : 0}%`, backgroundColor: cat.color }]} />
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    content: {},

    tabContainer: { flexDirection: 'row', padding: 16, gap: 8 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
    tabActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
    tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    tabTextActive: { color: 'white' },

    summaryCard: { marginHorizontal: 16, padding: 24, backgroundColor: '#4f46e5', borderRadius: 24, marginBottom: 24, shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    summaryLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
    summaryValue: { fontSize: 36, fontWeight: 'bold', color: 'white' },

    chartSection: { paddingHorizontal: 16, marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 12 },
    chartCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },

    categoryCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    catRow: { marginBottom: 16 },
    catInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    catDot: { width: 10, height: 10, borderRadius: 5 },
    catName: { fontSize: 14, fontWeight: '500', color: '#334155' },
    catValueRow: { gap: 4 },
    catValue: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
    catBarBg: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, width: '100%', overflow: 'hidden' },
    catBarFill: { height: '100%', borderRadius: 3 },
    emptyText: { textAlign: 'center', color: '#94a3b8', padding: 20 }
});
