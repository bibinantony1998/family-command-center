import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Users, CheckSquare, Gift, Gamepad2, Menu, ShoppingCart, ArrowRightLeft } from 'lucide-react-native';
import { MainTabParamList } from './types';

// Screens
import DashboardScreen from '../screens/Dashboard';
import ChoresScreen from '../screens/Chores';
import RewardsScreen from '../screens/Rewards';
import GamesHubScreen from '../screens/games/Hub';
import MenuScreen from '../screens/Menu';
import GroceriesScreen from '../screens/Groceries';
import NotesScreen from '../screens/Notes';
import ExpensesScreen from '../screens/Expenses';

const Tab = createBottomTabNavigator<MainTabParamList>();

import { useAuth } from '../context/AuthContext';

import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { View } from 'react-native';

export default function MainTabNavigator() {
    const insets = useSafeAreaInsets();
    const { profile } = useAuth();
    const isChild = profile?.role === 'child';

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }} edges={['top', 'left', 'right']}>
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
                        height: 60 + (insets.bottom > 0 ? insets.bottom : 20), // Dynamic height
                        paddingBottom: insets.bottom > 0 ? insets.bottom : 20, // Safe area padding
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

                {/* Expenses (Split) - Parents Only */}
                {!isChild && (
                    <Tab.Screen
                        name="Split"
                        component={ExpensesScreen}
                        options={{
                            tabBarIcon: ({ color, size }) => <ArrowRightLeft size={size} color={color} />,
                            tabBarLabel: 'Split'
                        }}
                    />
                )}

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
        </SafeAreaView>
    );
}
