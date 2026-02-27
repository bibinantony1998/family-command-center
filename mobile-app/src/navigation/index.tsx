import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/auth/Login';
import RegisterScreen from '../screens/auth/Register';
import JoinFamilyScreen from '../screens/auth/JoinFamily';
import SplashScreen from '../screens/SplashScreen';
import MainTabNavigator from './MainTabNavigator';
import { RootStackParamList } from './types';
import { CallListener } from '../components/CallListener';


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
    const { session, family, loading } = useAuth();
    const [minSplashTime, setMinSplashTime] = React.useState(true);

    // DEBUG: Trace RootNavigator state
    React.useEffect(() => {
        console.log('RootNavigator State:', {
            loading,
            minSplashTime,
            hasSession: !!session,
            hasFamily: !!family,
            activeFamilyId: family?.id
        });
    }, [loading, minSplashTime, session, family]);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setMinSplashTime(false);
        }, 2000); // Show splash for at least 2 seconds
        return () => clearTimeout(timer);
    }, []);

    if (loading || minSplashTime) {
        return <SplashScreen />;
    }

    return (
        <NavigationContainer>
            <CallListener />
            <Stack.Navigator screenOptions={{ headerShown: false }}>

                {!session ? (
                    <Stack.Screen name="Auth" component={AuthNavigator} />
                ) : !family ? (
                    <Stack.Screen name="OnboardingJoinFamily" component={JoinFamilyScreen} />
                ) : (
                    <>
                        <Stack.Screen name="Main" component={MainTabNavigator} />
                        <Stack.Screen name="Profile" component={require('../screens/Profile').default} />
                        <Stack.Screen name="JoinFamily" component={JoinFamilyScreen} />
                        <Stack.Screen name="Chat" component={require('../screens/Chat/ChatScreen').default} />
                        <Stack.Screen name="VideoCall" component={require('../screens/Chat/VideoCallScreen').default} />


                        {/* Expenses */}
                        <Stack.Screen name="AddExpense" component={require('../screens/Expenses/AddExpense').default} />
                        <Stack.Screen name="SettleUp" component={require('../screens/Expenses/SettleUp').default} />
                        <Stack.Screen name="ExpenseReports" component={require('../screens/Expenses/ExpenseReports').default} />

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

                        {/* Games Batch 5 — new games */}
                        <Stack.Screen name="Game_BallSort" component={require('../screens/games/BallSort').default} />
                        <Stack.Screen name="Game_NBack" component={require('../screens/games/NBack').default} />
                        <Stack.Screen name="Game_MentalRotation" component={require('../screens/games/MentalRotation').default} />
                        <Stack.Screen name="Game_NumberSequence" component={require('../screens/games/NumberSequence').default} />
                        <Stack.Screen name="Game_PathwayMaze" component={require('../screens/games/PathwayMaze').default} />
                        <Stack.Screen name="Game_DualTask" component={require('../screens/games/DualTask').default} />
                        <Stack.Screen name="Game_VisualSearch" component={require('../screens/games/VisualSearch').default} />
                        <Stack.Screen name="Game_AnagramSolver" component={require('../screens/games/AnagramSolver').default} />
                        <Stack.Screen name="Game_TrailMaking" component={require('../screens/games/TrailMaking').default} />

                        {/* Games Batch 6 — new games */}
                        <Stack.Screen name="Game_Sudoku" component={require('../screens/games/Sudoku').default} />
                        <Stack.Screen name="Game_TypingSpeed" component={require('../screens/games/TypingSpeed').default} />
                        <Stack.Screen name="Game_Hangman" component={require('../screens/games/Hangman').default} />
                        <Stack.Screen name="Game_WordConnections" component={require('../screens/games/WordConnections').default} />
                        <Stack.Screen name="Game_CodeBreaker" component={require('../screens/games/CodeBreaker').default} />
                        <Stack.Screen name="Game_2048" component={require('../screens/games/Game2048').default} />
                        <Stack.Screen name="Game_LightsOut" component={require('../screens/games/LightsOut').default} />
                        <Stack.Screen name="Game_WordChain" component={require('../screens/games/WordChain').default} />
                        <Stack.Screen name="Game_SlidingPuzzle" component={require('../screens/games/SlidingPuzzle').default} />
                        <Stack.Screen name="Game_RiverCrossing" component={require('../screens/games/RiverCrossing').default} />
                        <Stack.Screen name="Game_MatchstickMath" component={require('../screens/games/MatchstickMath').default} />
                    </>
                )}



            </Stack.Navigator>
        </NavigationContainer>
    );
}
