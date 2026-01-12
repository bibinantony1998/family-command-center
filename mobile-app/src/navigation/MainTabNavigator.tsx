import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Users, CheckSquare, Gift, Gamepad2, Menu, ShoppingCart } from 'lucide-react-native';
import { MainTabParamList } from './types';

// Screens
import DashboardScreen from '../screens/Dashboard';
import ChoresScreen from '../screens/Chores';
import RewardsScreen from '../screens/Rewards';
import GamesHubScreen from '../screens/games/Hub';
import MenuScreen from '../screens/Menu';
import GroceriesScreen from '../screens/Groceries';
import NotesScreen from '../screens/Notes';

const Tab = createBottomTabNavigator<MainTabParamList>();

import { useAuth } from '../context/AuthContext';

export default function MainTabNavigator() {
    const { profile } = useAuth();
    const isChild = profile?.role === 'child';

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#6366f1',
                tabBarInactiveTintColor: '#94a3b8',
                tabBarStyle: {
                    borderTopWidth: 1,
                    borderTopColor: '#e2e8f0',
                    elevation: 8,
                    backgroundColor: 'white',
                    height: 80, // Taller bar for better touch targets
                    paddingBottom: 20,
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '600',
                    marginBottom: 4
                },
                tabBarItemStyle: {
                    paddingTop: 8,
                    flex: 1,
                }
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

            {/* Groceries - Host only (Parents) */}
            {!isChild && (
                <Tab.Screen
                    name="Groceries"
                    component={GroceriesScreen}
                    options={{
                        tabBarIcon: ({ color, size }) => <ShoppingCart size={size} color={color} />,
                    }}
                />
            )}

            {/* Rewards - Visible for Kids, Hidden (Menu) for Parents */}
            <Tab.Screen
                name="Rewards"
                component={RewardsScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Gift size={size} color={color} />,
                    tabBarLabel: 'Rewards', // Explicit label
                    tabBarButton: isChild ? undefined : () => null,
                    tabBarItemStyle: isChild ? {
                        paddingTop: 8,
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'flex-start' // Default behavior pushes icon up
                    } : { display: 'none' }
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
                name="Menu"
                component={MenuScreen}
                options={{
                    tabBarIcon: ({ color, size }) => <Menu size={size} color={color} />,
                }}
            />

            {/* Hidden Tabs - Notes is always hidden from bar (access via Menu) */}
            <Tab.Screen
                name="Notes"
                component={NotesScreen}
                options={{
                    tabBarButton: () => null,
                    tabBarItemStyle: { display: 'none' }
                }}
            />
        </Tab.Navigator>
    );
}
