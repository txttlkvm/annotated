import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Font from 'expo-font';

import { AppProvider, useApp } from './src/context/AppContext';
import { DatabaseService } from './src/services/DatabaseService';
import { TTSService } from './src/services/TTSService';
import { AudioService } from './src/services/AudioService';

import LibraryScreen from './src/screens/LibraryScreen';
import ReaderScreen from './src/screens/ReaderScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import StatsScreen from './src/screens/StatsScreen';
import BookDetailsScreen from './src/screens/BookDetailsScreen';
import HighlightsScreen from './src/screens/HighlightsScreen';
import CurriculumScreen from './src/screens/CurriculumScreen';
import ClassicalLibraryReaderScreen from './src/screens/ClassicalLibraryReaderScreen';
import MusicPlayerScreen from './src/screens/MusicPlayerScreen';
import ArtViewerScreen from './src/screens/ArtViewerScreen';
import DictionaryScreen from './src/screens/DictionaryScreen';
import CollectionsScreen from './src/screens/CollectionsScreen';
import BookshelfScreen from './src/screens/BookshelfScreen';
import TableOfContentsScreen from './src/screens/TableOfContentsScreen';
import CatalogScreen from './src/screens/CatalogScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function LibraryNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="LibraryHome" component={LibraryScreen} />
      <Stack.Screen name="BookDetails" component={BookDetailsScreen} />
      <Stack.Screen name="ClassicalLibraryReader" component={ClassicalLibraryReaderScreen} />
    </Stack.Navigator>
  );
}

function CurriculumNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="CurriculumHome" component={CurriculumScreen} />
      <Stack.Screen name="ClassicalLibraryReader" component={ClassicalLibraryReaderScreen} />
      <Stack.Screen name="MusicPlayer" component={MusicPlayerScreen} />
      <Stack.Screen name="ArtViewer" component={ArtViewerScreen} />
    </Stack.Navigator>
  );
}

function ReaderNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ReaderHome" component={ReaderScreen} />
      <Stack.Screen name="Highlights" component={HighlightsScreen} />
      <Stack.Screen name="TableOfContents" component={TableOfContentsScreen} />
    </Stack.Navigator>
  );
}

function MainApp() {
  const { settings } = useApp();

  useEffect(() => {
    initializeServices();
  }, []);

  const initializeServices = async () => {
    try {
      await DatabaseService.init();
      await TTSService.init();
      await AudioService.init();
      await Font.loadAsync({
        Georgia: require('./assets/fonts/Georgia.ttf'),
        'Georgia-Bold': require('./assets/fonts/Georgia-Bold.ttf'),
      }).catch(() => {});
    } catch (error) {
      console.error('Initialization error:', error);
    }
  };

  return (
    <>
      <StatusBar
        style={settings.theme === 'light' ? 'dark' : 'light'}
        translucent
      />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: settings.theme === 'light' ? '#f5f5f5' : '#1a1a1a',
              borderTopColor: settings.theme === 'light' ? '#e0e0e0' : '#333',
              borderTopWidth: 1,
              paddingBottom: 4,
            },
            tabBarActiveTintColor: '#4A90E2',
            tabBarInactiveTintColor: settings.theme === 'light' ? '#999' : '#666',
          }}
        >
          <Tab.Screen
            name="Library"
            component={LibraryNavigator}
            options={{
              tabBarLabel: 'Library',
              tabBarIcon: ({ color }) => <Icon name="📚" color={color} />,
            }}
          />
          <Tab.Screen
            name="Reading"
            component={ReaderNavigator}
            options={{
              tabBarLabel: 'Reading',
              tabBarIcon: ({ color }) => <Icon name="📖" color={color} />,
            }}
          />
          <Tab.Screen
            name="Curriculum"
            component={CurriculumNavigator}
            options={{
              tabBarLabel: 'Curriculum',
              tabBarIcon: ({ color }) => <Icon name="✦" color={color} />,
            }}
          />
          <Tab.Screen
            name="Bookshelf"
            component={BookshelfScreen}
            options={{
              tabBarLabel: 'Shelf',
              tabBarIcon: ({ color }) => <Icon name="🏛" color={color} />,
            }}
          />
          <Tab.Screen
            name="Collections"
            component={CollectionsScreen}
            options={{
              tabBarLabel: 'Collections',
              tabBarIcon: ({ color }) => <Icon name="📑" color={color} />,
            }}
          />
          <Tab.Screen
            name="Dictionary"
            component={DictionaryScreen}
            options={{
              tabBarLabel: 'Dictionary',
              tabBarIcon: ({ color }) => <Icon name="📓" color={color} />,
            }}
          />
          <Tab.Screen
            name="Catalog"
            component={CatalogScreen}
            options={{
              tabBarLabel: 'Catalog',
              tabBarIcon: ({ color }) => <Icon name="📕" color={color} />,
            }}
          />
          <Tab.Screen
            name="Stats"
            component={StatsScreen}
            options={{
              tabBarLabel: 'Stats',
              tabBarIcon: ({ color }) => <Icon name="📊" color={color} />,
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              tabBarLabel: 'Settings',
              tabBarIcon: ({ color }) => <Icon name="⚙️" color={color} />,
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}

function Icon({ name }: { name: string; color: string }) {
  return <>{name}</>;
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
