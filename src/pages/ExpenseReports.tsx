import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowLeft, PieChart as PieIcon, BarChart2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../lib/expense-utils';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function ExpenseReports() {
    const navigate = useNavigate();
    const { family } = useAuth();
    const [loading, setLoading] = useState(true);

    const [selectedRange, setSelectedRange] = useState<'all' | 'current' | 'last'>('current');

    // Raw Data
    const [allExpenses, setAllExpenses] = useState<any[]>([]);

    // Computed Data
    const [categoryData, setCategoryData] = useState<any[]>([]);
    const [sevenDayTrend, setSevenDayTrend] = useState<any[]>([]);

    const [totalSpent, setTotalSpent] = useState(0);
    const [currentMonthSpent, setCurrentMonthSpent] = useState(0);
    const [lastMonthSpent, setLastMonthSpent] = useState(0);

    const currency = family?.currency || 'INR';

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data: expenses } = await supabase.from('expenses').select('*');

            if (expenses) {
                setAllExpenses(expenses);

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

                // --- Stable Last 7 Days Trend (Independent of filters) ---
                const trendData = [];
                for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const dayStr = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });

                    // Filter expenses for this day
                    const daySum = expenses.reduce((sum, e) => {
                        const expenseDate = new Date(e.date);
                        if (expenseDate.getDate() === d.getDate() &&
                            expenseDate.getMonth() === d.getMonth() &&
                            expenseDate.getFullYear() === d.getFullYear()) {
                            return sum + e.amount;
                        }
                        return sum;
                    }, 0);

                    trendData.push({ name: dayStr, value: daySum });
                }
                setSevenDayTrend(trendData);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate Category Data based on selected range
    useEffect(() => {
        if (!allExpenses.length) return;

        let filteredExpenses = allExpenses;
        const now = new Date();

        if (selectedRange === 'current') {
            filteredExpenses = allExpenses.filter(e => {
                const d = new Date(e.date);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            });
        } else if (selectedRange === 'last') {
            const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            filteredExpenses = allExpenses.filter(e => {
                const d = new Date(e.date);
                return d.getMonth() === lastMonthDate.getMonth() && d.getFullYear() === lastMonthDate.getFullYear();
            });
        }
        // 'all' includes all expenses, no filtering needed

        // Category Data
        const byCategory = filteredExpenses.reduce((acc: any, curr) => {
            acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
            return acc;
        }, {});
        setCategoryData(Object.entries(byCategory).map(([name, value]) => ({ name, value })));

    }, [selectedRange, allExpenses]);

    if (loading) return <div className="p-8 text-center">Loading reports...</div>;

    const getSummaryValue = () => {
        switch (selectedRange) {
            case 'all': return totalSpent;
            case 'current': return currentMonthSpent;
            case 'last': return lastMonthSpent;
            default: return 0;
        }
    };

    const getSummaryLabel = () => {
        switch (selectedRange) {
            case 'all': return 'Total All Time';
            case 'current': return 'This Month';
            case 'last': return 'Last Month';
            default: return '';
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/expenses')} className="text-gray-500 hover:text-gray-700">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Expense Reports</h1>
            </div>

            {/* Filter Tabs */}
            <div className="flex justify-center flex-col items-center gap-4">
                {/* Filter Controls */}
                <div className="flex bg-gray-100 p-1 rounded-xl w-full max-w-sm">
                    {(['all', 'current', 'last'] as const).map((range) => (
                        <button
                            key={range}
                            onClick={() => setSelectedRange(range)}
                            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${selectedRange === range
                                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {range === 'all' ? 'Total' : range === 'current' ? 'This Month' : 'Last Month'}
                        </button>
                    ))}
                </div>

                {/* Single Summary Card in a fixed container to prevent jumping */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center w-full max-w-sm transition-all duration-300">
                    <h2 className="text-gray-500 font-medium mb-2 text-sm uppercase tracking-wide">{getSummaryLabel()}</h2>
                    <div className="text-5xl font-bold text-gray-900 my-4">
                        {formatCurrency(getSummaryValue(), currency)}
                    </div>
                </div>
            </div>

            {/* Stable Last 7 Days Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-green-500" />
                    Spending Trend (Last 7 Days)
                </h3>
                <ResponsiveContainer width="100%" height="85%">
                    <LineChart
                        data={sevenDayTrend}
                        margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} dy={10} />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(val) => `${currency === 'INR' ? '₹' : '$'}${val}`}
                        />
                        <Tooltip
                            formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value, currency) : ''}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={{ fill: '#10b981', r: 4, strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Category Chart (Filtered by selection) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <PieIcon className="w-5 h-5 text-blue-500" />
                    Spending by Category ({getSummaryLabel()})
                </h3>
                {categoryData.length > 0 ? (
                    <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                        <div className="h-64 w-64 flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {categoryData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value, currency) : ''} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Custom Legend */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {categoryData.map((entry, index) => (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span className="text-gray-600 truncate max-w-[120px]" title={entry.name}>{entry.name}</span>
                                    <span className="font-semibold text-gray-900">{formatCurrency(entry.value, currency)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-20 text-gray-400">No expenses found for this period</div>
                )}
            </div>
        </div>
    );
}
