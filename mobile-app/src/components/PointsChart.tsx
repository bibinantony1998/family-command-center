import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 64; // Adjusted for padding
const CHART_HEIGHT = 160;
const PADDING_LEFT = 35; // Space for Y-axis labels
const GRAPH_WIDTH = CHART_WIDTH - PADDING_LEFT;

interface PointsChartProps {
    data: number[];
}

export const PointsChart: React.FC<PointsChartProps> = ({ data = [0, 0, 0, 0, 0] }) => {
    // Safe guard for empty data
    const chartData = data.length > 0 ? data : [0, 0, 0, 0, 0];

    // Normalize data
    const max = Math.max(...chartData);
    const min = 0;
    // Ensure range is at least 100 or 10% of max + 10 to avoid flat lines when all values are 0
    const range = (max - min) || (max > 0 ? max : 100);

    const formatValue = (val: number) => {
        if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
        return Math.round(val).toString();
    };

    // Create points
    const points = chartData.map((value, index) => {
        const x = PADDING_LEFT + (index / (Math.max(1, chartData.length - 1))) * GRAPH_WIDTH;
        const y = CHART_HEIGHT - ((value - min) / range) * CHART_HEIGHT;
        return `${x},${y}`;
    });

    const pathD = points.length > 0 ? `M ${points.join(' L ')}` : '';

    return (
        <View style={styles.container}>
            <Svg width={CHART_WIDTH} height={CHART_HEIGHT + 20}>
                {/* Grid Lines & Y-Axis Labels */}
                <Line x1={PADDING_LEFT} y1="0" x2={CHART_WIDTH} y2="0" stroke="#f1f5f9" strokeWidth="1" />
                <SvgText x="0" y="10" fill="#94a3b8" fontSize="10">{formatValue(max)}</SvgText>

                <Line x1={PADDING_LEFT} y1={CHART_HEIGHT / 2} x2={CHART_WIDTH} y2={CHART_HEIGHT / 2} stroke="#f1f5f9" strokeWidth="1" />
                <SvgText x="0" y={CHART_HEIGHT / 2 + 4} fill="#94a3b8" fontSize="10">{formatValue(max / 2)}</SvgText>

                <Line x1={PADDING_LEFT} y1={CHART_HEIGHT} x2={CHART_WIDTH} y2={CHART_HEIGHT} stroke="#f1f5f9" strokeWidth="1" />
                <SvgText x="0" y={CHART_HEIGHT} fill="#94a3b8" fontSize="10">0</SvgText>

                {/* The Line */}
                <Path
                    d={pathD}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="3"
                />

                {/* Data Points */}
                {chartData.map((value, index) => {
                    const x = PADDING_LEFT + (index / (Math.max(1, chartData.length - 1))) * GRAPH_WIDTH;
                    const y = CHART_HEIGHT - ((value - min) / range) * CHART_HEIGHT;
                    return (
                        <Circle
                            key={index}
                            cx={x}
                            cy={y}
                            r="4"
                            fill="white"
                            stroke="#6366f1"
                            strokeWidth="2"
                        />
                    );
                })}
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16
    }
});
