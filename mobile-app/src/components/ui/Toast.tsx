import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { X, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type?: ToastType;
    onClose: () => void;
    duration?: number;
}

export const Toast = ({ message, type = 'info', onClose, duration = 4000 }: ToastProps) => {
    const insets = useSafeAreaInsets();
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Slide in
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            })
        ]).start();

        // Auto close
        const timer = setTimeout(() => {
            handleClose();
        }, duration);

        return () => clearTimeout(timer);
    }, []);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -100,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            })
        ]).start(() => onClose());
    };

    const getBgColor = () => {
        switch (type) {
            case 'success': return '#10b981'; // emerald-500
            case 'error': return '#ef4444'; // red-500
            case 'info': return '#3b82f6'; // blue-500
            default: return '#3b82f6';
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle color="white" size={20} />;
            case 'error': return <AlertCircle color="white" size={20} />;
            default: return <AlertCircle color="white" size={20} />;
        }
    };

    return (
        <Animated.View style={[
            styles.container,
            {
                top: insets.top + 10,
                transform: [{ translateY }],
                opacity
            }
        ]}>
            <View style={[styles.content, { backgroundColor: getBgColor() }]}>
                <View style={styles.row}>
                    {getIcon()}
                    <Text style={styles.text}>{message}</Text>
                </View>
                <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                    <X color="white" size={18} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 20,
        right: 20,
        zIndex: 9999,
        alignItems: 'center',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 5,
        width: '100%',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    text: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
        flex: 1,
    },
    closeBtn: {
        padding: 4,
        marginLeft: 8,
    }
});
