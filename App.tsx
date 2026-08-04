import React, { useEffect } from 'react';
import { Platform, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import type { LinkingOptions, NavigatorScreenParams } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppProvider, useApp } from './src/context/AppContext';
import { DatabaseService } from './src/services/DatabaseService';
import { TTSService } from './src/services/TTSService';
import { AudioService } from './src/services/AudioService';
import { space, type, readerPalettes } from './src/theme';

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

/* ------------------------------------------------------------------ *
 * Deep linking
 *
 * vercel.json rewrites every non-/api path to index.html, which fixes the
 * hard 404 — but without a `linking` config React Navigation never reads
 * window.location, so /Curriculum and /Settings both booted straight into
 * the Library (the first tab). This maps real URLs onto the navigator.
 *
 * The nesting below MIRRORS the navigators declared above. If a child key
 * does not exist on the stack it is silently ignored and you fall back to
 * the stack's first screen, so these names are load-bearing:
 *
 *   Library    -> LibraryHome | BookDetails | ClassicalLibraryReader
 *   Reading    -> ReaderHome  | Highlights  | TableOfContents
 *   Curriculum -> CurriculumHome | ClassicalLibraryReader | MusicPlayer | ArtViewer
 *
 * Param note: BookDetails, ClassicalLibraryReader, MusicPlayer and ArtViewer
 * all destructure `route.params` unconditionally. React Navigation only
 * attaches `params` when the matched path actually carries one, so every one
 * of those screens is given a REQUIRED path segment. A paramless path such as
 * /curriculum/music would hand the screen `undefined` and crash on the
 * destructure — so no such path is registered.
 * ------------------------------------------------------------------ */
const webOrigin =
  typeof window !== 'undefined' && window.location ? window.location.origin : null;

/**
 * These param lists exist so the linking config is type-checked against the
 * real nesting. Without them PathConfigMap collapses to the non-nested branch
 * and `initialRouteName` / `screens` on a tab entry stop compiling — which is
 * exactly the class of mistake (wrong nesting, silent fallback to the first
 * screen) this config is meant to avoid.
 */
type LibraryStackParamList = {
  LibraryHome: undefined;
  BookDetails: { bookId: string };
  ClassicalLibraryReader: { itemId: string };
};

type ReadingStackParamList = {
  ReaderHome: undefined;
  Highlights: undefined;
  TableOfContents: undefined;
};

type CurriculumStackParamList = {
  CurriculumHome: undefined;
  ClassicalLibraryReader: { itemId: string };
  MusicPlayer: { title: string; filePath?: string; artist?: string };
  ArtViewer: { title: string; imagePath?: string; artist?: string };
};

type RootTabParamList = {
  Library: NavigatorScreenParams<LibraryStackParamList>;
  Reading: NavigatorScreenParams<ReadingStackParamList>;
  Curriculum: NavigatorScreenParams<CurriculumStackParamList>;
  Bookshelf: undefined;
  Collections: undefined;
  Dictionary: undefined;
  Catalog: undefined;
  Stats: undefined;
  Settings: undefined;
};

const linking: LinkingOptions<RootTabParamList> = {
  prefixes: [
    // Web origin first — whatever host it is served from (Vercel prod,
    // preview deploys, localhost) resolves without hardcoding a domain.
    ...(webOrigin ? [webOrigin] : []),
    // Native custom scheme, per app.json.
    'bookvoicepro://',
  ],
  config: {
    initialRouteName: 'Library',
    screens: {
      Library: {
        path: 'library',
        initialRouteName: 'LibraryHome',
        screens: {
          LibraryHome: '',
          BookDetails: 'book/:bookId',
          ClassicalLibraryReader: 'read/:itemId',
        },
      },
      Reading: {
        path: 'reading',
        initialRouteName: 'ReaderHome',
        screens: {
          ReaderHome: '',
          Highlights: 'highlights',
          TableOfContents: 'contents',
        },
      },
      Curriculum: {
        path: 'curriculum',
        initialRouteName: 'CurriculumHome',
        screens: {
          CurriculumHome: '',
          ClassicalLibraryReader: 'read/:itemId',
          // :title is required so `params` is never undefined; filePath /
          // imagePath / artist ride along as query params.
          MusicPlayer: 'music/:title',
          ArtViewer: 'art/:title',
        },
      },
      Bookshelf: 'bookshelf',
      Collections: 'collections',
      Dictionary: 'dictionary',
      Catalog: 'catalog',
      Stats: 'stats',
      Settings: 'settings',
    },
  },
};

const TAB_TITLES: Record<string, string> = {
  Library: 'Library',
  Reading: 'Reading',
  Curriculum: 'Curriculum',
  Bookshelf: 'Bookshelf',
  Collections: 'Collections',
  Dictionary: 'Dictionary',
  Catalog: 'Catalog',
  Stats: 'Stats',
  Settings: 'Settings',
};

const documentTitle = {
  formatter: (_options: any, route: any) => {
    const section = route?.name ? TAB_TITLES[route.name] : undefined;
    return section ? `Annotated · ${section}` : 'Annotated';
  },
};

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
    } catch (error) {
      console.error('Initialization error:', error);
    }
  };

  // The tab bar used to be #1a1a1a / #333 / #4A90E2 — a stock-blue accent on
  // neutral grey, i.e. none of the aubergine-and-gold system. readerPalettes
  // already carries a correct surface/border/accent triple per theme, and
  // readerPalettes.dark is literally colors.surface / colors.border /
  // colors.gold / colors.bronze, so one lookup covers dark, night, sepia
  // and light without branching.
  const palette = readerPalettes[settings.theme] ?? readerPalettes.dark;
  const isWeb = Platform.OS === 'web';

  return (
    <>
      <StatusBar
        style={settings.theme === 'light' || settings.theme === 'sepia' ? 'dark' : 'light'}
        translucent
      />
      <NavigationContainer linking={linking} documentTitle={documentTitle}>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: palette.surface,
              borderTopColor: palette.border,
              borderTopWidth: 1,
              paddingTop: space.sm,
              // Only pin an explicit height on web. On native the tab bar
              // computes 49 + safe-area inset itself, and a hardcoded height
              // here overrides that and eats the home-indicator gap.
              ...(isWeb
                ? { height: 68, paddingBottom: space.sm, paddingHorizontal: space.sm }
                : null),
            },
            tabBarActiveTintColor: palette.accent,
            tabBarInactiveTintColor: palette.accentSoft,
            tabBarLabelStyle: {
              // type.caption already carries fonts.ui + letterSpacing; the
              // size is nudged down because nine tabs share the bar.
              ...type.caption,
              fontSize: 11,
              letterSpacing: 0.2,
              fontWeight: '600',
              marginTop: space.xs / 2,
              marginBottom: isWeb ? 0 : space.xs / 2,
            },
            tabBarIconStyle: {
              marginTop: space.xs / 2,
            },
            tabBarItemStyle: {
              paddingVertical: space.xs,
            },
            tabBarActiveBackgroundColor: 'transparent',
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

// Previously returned a bare string in a fragment, which (a) throws
// "Text strings must be rendered within a <Text> component" on native and
// (b) dropped the `color` prop entirely — so the active tint never reached
// the glyph. Wrapping in <Text> fixes both; monochrome glyphs like ✦ now
// actually turn gold when their tab is focused.
function Icon({ name, color }: { name: string; color: string }) {
  return (
    <Text
      style={{
        fontSize: 18,
        lineHeight: 22,
        color,
        textAlign: 'center',
      }}
    >
      {name}
    </Text>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
