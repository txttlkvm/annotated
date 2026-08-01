import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import LibraryScreen from './src/screens/LibraryScreen';
import ReaderScreen from './src/screens/ReaderScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { BookProvider } from './src/context/BookContext';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <BookProvider>
      <NavigationContainer>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: '#1a1a1a',
              borderTopColor: '#333',
              borderTopWidth: 1,
            },
            tabBarActiveTintColor: '#4A90E2',
            tabBarInactiveTintColor: '#666',
          }}
        >
          <Tab.Screen
            name="Library"
            component={LibraryScreen}
            options={{
              tabBarLabel: 'Library',
              tabBarIcon: ({ color }) => <LibraryIcon color={color} />,
            }}
          />
          <Tab.Screen
            name="Reader"
            component={ReaderScreen}
            options={{
              tabBarLabel: 'Reading',
              tabBarIcon: ({ color }) => <ReaderIcon color={color} />,
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              tabBarLabel: 'Settings',
              tabBarIcon: ({ color }) => <SettingsIcon color={color} />,
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </BookProvider>
  );
}

const LibraryIcon = ({ color }: { color: string }) => (
  <Text style={{ color, fontSize: 20 }}>📚</Text>
);

const ReaderIcon = ({ color }: { color: string }) => (
  <Text style={{ color, fontSize: 20 }}>📖</Text>
);

const SettingsIcon = ({ color }: { color: string }) => (
  <Text style={{ color, fontSize: 20 }}>⚙️</Text>
);

import { Text } from 'react-native';
