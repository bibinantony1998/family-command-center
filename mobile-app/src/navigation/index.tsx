import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/auth/Login';
import RegisterScreen from '../screens/auth/Register';
import JoinFamilyScreen from '../screens/auth/JoinFamily';
import MainTabNavigator from './MainTabNavigator';
import { RootStackParamList } from './types';

const Stack = createStackNavigator<RootStackParamList>();
const AuthStack = createStackNavigator();

function AuthNavigator() {
    return (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="Login" component={LoginScreen} />
            <AuthStack.Screen name="Register" component={RegisterScreen} />
        </AuthStack.Navigator>
    );
}

export default function RootNavigator() {
    const { session, profile, loading } = useAuth();

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#6366f1" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!session ? (
                    <Stack.Screen name="Auth" component={AuthNavigator} />
                ) : !profile?.family_id ? (
                    <Stack.Screen name="JoinFamily" component={JoinFamilyScreen} />
                ) : (
                    <Stack.Screen name="Main" component={MainTabNavigator} />
                )}

                <Stack.Screen name="Profile" component={require('../screens/Profile').default} />

                {/* Games Batch 1 */}
                <Stack.Screen name="Game_ColorChaos" component={require('../screens/games/ColorChaos').default} />
                <Stack.Screen name="Game_MemoryMatch" component={require('../screens/games/MemoryMatch').default} />
                <Stack.Screen name="Game_NumberMemory" component={require('../screens/games/NumberMemory').default} />

                {/* Games Batch 2 */}
                <Stack.Screen name="Game_PatternMemory" component={require('../screens/games/PatternMemory').default} />
                <Stack.Screen name="Game_QuickMath" component={require('../screens/games/QuickMath').default} />
                <Stack.Screen name="Game_ReflexChallenge" component={require('../screens/games/ReflexChallenge').default} />

                {/* Games Batch 3 */}
                <Stack.Screen name="Game_SchulteTable" component={require('../screens/games/SchulteTable').default} />
                <Stack.Screen name="Game_SimonSays" component={require('../screens/games/SimonSays').default} />
                <Stack.Screen name="Game_TowerOfHanoi" component={require('../screens/games/TowerOfHanoi').default} />

                {/* Games Batch 4 */}
                <Stack.Screen name="Game_WaterJugs" component={require('../screens/games/WaterJugs').default} />
                <Stack.Screen name="Game_WhackAMole" component={require('../screens/games/WhackAMole').default} />
                <Stack.Screen name="Game_WordScramble" component={require('../screens/games/WordScramble').default} />

            </Stack.Navigator>
        </NavigationContainer>
    );
}
