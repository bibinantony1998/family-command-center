import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, TouchableOpacityProps } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
    title: string;
    isLoading?: boolean;
    variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'default';
}

export const Button = ({ title, isLoading, variant = 'primary', style, ...props }: ButtonProps) => {
    const getBackgroundColor = () => {
        switch (variant) {
            case 'primary':
            case 'default': return '#6366f1'; // indigo-500
            case 'secondary': return '#ec4899'; // pink-500
            case 'destructive': return '#ef4444'; // red-500
            case 'outline':
            case 'ghost': return 'transparent'; // ghost is also transparent
            default: return '#6366f1';
        }
    };

    const getTextColor = () => {
        switch (variant) {
            case 'outline': return '#6366f1';
            case 'ghost': return '#64748b'; // slate-500 for ghost
            case 'destructive': return '#ffffff';
            default: return '#ffffff';
        }
    };

    return (
        <TouchableOpacity
            style={[
                styles.button,
                { backgroundColor: getBackgroundColor() },
                variant === 'outline' && styles.outlineButton,
                // Ghost has no border, no shadow invocation if we want, but keeping base style is safe
                variant === 'ghost' && styles.ghostButton,
                props.disabled && styles.disabled,
                style,
            ]}
            disabled={isLoading || props.disabled}
            {...props}
        >
            {isLoading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <Text style={[styles.text, { color: getTextColor() }]}>{title}</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 2,
    },
    outlineButton: {
        borderWidth: 1,
        borderColor: '#6366f1',
    },
    ghostButton: {
        shadowColor: 'transparent',
        elevation: 0,
        backgroundColor: 'transparent',
    },
    disabled: {
        opacity: 0.6,
    },
    text: {
        fontSize: 16,
        fontWeight: '600',
    },
});
