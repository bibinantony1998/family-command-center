import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 80;
const CHART_HEIGHT = 160;

interface PointsChartProps {
    data: number[];
}

export const PointsChart: React.FC<PointsChartProps> = ({ data = [0, 0, 0, 0, 0] }) => {
    // Normalize data
    const max = Math.max(...data, 100);
    const min = 0;
    const range = max - min;

    // Create points
    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * CHART_WIDTH;
        const y = CHART_HEIGHT - ((value - min) / range) * CHART_HEIGHT;
        return `${x},${y}`;
    });

    const pathD = `M ${points.join(' L ')}`;

    return (
        <View style={styles.container}>
            <Svg width={CHART_WIDTH} height={CHART_HEIGHT + 20}>
                {/* Grid Lines */}
                <Line x1="0" y1="0" x2={CHART_WIDTH} y2="0" stroke="#f1f5f9" strokeWidth="1" />
                <Line x1="0" y1={CHART_HEIGHT / 2} x2={CHART_WIDTH} y2={CHART_HEIGHT / 2} stroke="#f1f5f9" strokeWidth="1" />
                <Line x1="0" y1={CHART_HEIGHT} x2={CHART_WIDTH} y2={CHART_HEIGHT} stroke="#f1f5f9" strokeWidth="1" />

                {/* The Line */}
                <Path
                    d={pathD}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="3"
                />

                {/* Data Points */}
                {data.map((value, index) => {
                    const x = (index / (data.length - 1)) * CHART_WIDTH;
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

                {data.length > 0 && <SvgText
                    x={CHART_WIDTH}
                    y={CHART_HEIGHT - ((data[data.length - 1] - min) / range) * CHART_HEIGHT - 10}
                    fill="#6366f1"
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="end"
                >
                    {data[data.length - 1]} pts
                </SvgText>}
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
