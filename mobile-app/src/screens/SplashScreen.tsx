import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Shield } from 'lucide-react-native';

export default function SplashScreen() {
    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Shield size={64} color="white" fill="rgba(255,255,255,0.2)" />
                </View>
                <Text style={styles.title}>Family Command Center</Text>
                <Text style={styles.subtitle}>Manage your household with superpowers!</Text>
            </View>
            <View style={styles.footer}>
                <Text style={styles.version}>v2.3</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#6366f1',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)'
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    footer: {
        position: 'absolute',
        bottom: 40,
    },
    version: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
    }
});
