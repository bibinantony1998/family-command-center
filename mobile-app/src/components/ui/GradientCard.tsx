import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

interface GradientCardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    fromColor?: string;
    toColor?: string;
}

export const GradientCard: React.FC<GradientCardProps> = ({
    children,
    style,
    fromColor = '#8b5cf6', // Violet-500
    toColor = '#c026d3'    // Fuchsia-600
}) => {
    return (
        <View style={[styles.container, style]}>
            <View style={StyleSheet.absoluteFill}>
                <Svg height="100%" width="100%">
                    <Defs>
                        <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
                            <Stop offset="0" stopColor={fromColor} />
                            <Stop offset="1" stopColor={toColor} />
                        </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />
                </Svg>
            </View>
            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
    },
    content: {
        padding: 20,
    }
});
