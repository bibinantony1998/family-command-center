import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Users, CheckSquare, Gift, ShoppingCart, StickyNote, Gamepad2 } from 'lucide-react-native';
import { MainTabParamList } from './types';

// Screens
import DashboardScreen from '../screens/Dashboard';
import ChoresScreen from '../screens/Chores';
import RewardsScreen from '../screens/Rewards';
import GroceriesScreen from '../screens/Groceries';
import NotesScreen from '../screens/Notes';
import GamesHubScreen from '../screens/games/Hub';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#6366f1',
                tabBarInactiveTintColor: '#94a3b8',
                tabBarStyle: {
                    borderTopWidth: 1,
                    borderTopColor: '#e2e8f0',
                    height: 60,
                    paddingBottom: 8,
                    paddingTop: 8,
                },
            }}
        >
            <Tab.Screen
                name="Dashboard"
                component={DashboardScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
                    tabBarLabel: 'Home'
                }}
            />
            <Tab.Screen
                name="Chores"
                component={ChoresScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <CheckSquare size={size} color={color} />,
                }}
            />
            <Tab.Screen
                name="Rewards"
                component={RewardsScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Gift size={size} color={color} />,
                }}
            />
            <Tab.Screen
                name="Games"
                component={GamesHubScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Gamepad2 size={size} color={color} />,
                }}
            />
            <Tab.Screen
                name="Groceries"
                component={GroceriesScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <ShoppingCart size={size} color={color} />,
                }}
            />
            <Tab.Screen
                name="Notes"
                component={NotesScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <StickyNote size={size} color={color} />,
                }}
            />
        </Tab.Navigator>
    );
}
