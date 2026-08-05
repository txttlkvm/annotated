import React, { useEffect } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import type { LinkingOptions, NavigatorScreenParams } from '@react-navigation/native';
import { createBottomTabNavigator, BottomTabBar } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AppProvider, useApp } from './src/context/AppContext';
import { DatabaseService } from './src/services/DatabaseService';
import { TTSService } from './src/services/TTSService';
import { AudioService } from './src/services/AudioService';
import { colors, layout, space, type } from './src/theme';
import { Icon } from './src/components/icons';
import { AlertHost } from './src/components/Alert';

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
import MoreScreen, { type MoreStackParamList } from './src/screens/MoreScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/* ------------------------------------------------------------------ *
 * NAVIGATION SHAPE
 *
 * This app used to run NINE bottom tabs. Every one of the owner's five
 * reference apps runs four or five, because a bar of nine forces 11px
 * labels, truncates half of them, and gives every destination the same
 * weight — a dictionary sitting beside the library as an equal.
 *
 * Nothing was deleted in the consolidation. The four screens that were
 * only ever a menu entry (Bookshelf, Collections, Dictionary, Stats)
 * plus Settings and a second Highlights entry moved behind the fifth
 * tab, MoreScreen, which pushes each of them onto its own stack so they
 * get a real back gesture instead of a tab-press dead end.
 *
 *   Library    LibraryHome | BookDetails | ClassicalLibraryReader
 *   Reading    ReaderHome  | Highlights  | TableOfContents          (labelled "Read")
 *   Curriculum CurriculumHome | ClassicalLibraryReader | MusicPlayer | ArtViewer
 *   Catalog    (single screen)
 *   More       MoreHome | Bookshelf | Collections | Dictionary | Highlights | Stats | Settings
 *
 * NOTE on the "Reading" route name. The tab READS as "Read" — that is its
 * label — but the ROUTE keeps its old name because BookDetailsScreen calls
 * `navigation.navigate('Reading', { screen: 'ReaderHome' })`. React
 * Navigation resolves that by route name, and a rename here would turn
 * "Continue reading" in the book detail sheet into a silent no-op.
 * ------------------------------------------------------------------ */

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

/**
 * The More stack. Its screen names are the keys of `MoreStackParamList`, which
 * MoreScreen exports and types its own `navigate` calls against — so a screen
 * added here without a matching entry there fails to compile rather than
 * failing silently at runtime.
 */
function MoreNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreHome" component={MoreScreen} />
      <Stack.Screen name="Bookshelf" component={BookshelfScreen} />
      <Stack.Screen name="Collections" component={CollectionsScreen} />
      <Stack.Screen name="Dictionary" component={DictionaryScreen} />
      <Stack.Screen name="Highlights" component={HighlightsScreen} />
      <Stack.Screen name="Stats" component={StatsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
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
 * the stack's first screen, so these names are load-bearing — and they
 * moved with the tab consolidation: the five screens that used to answer
 * to /bookshelf, /collections, /dictionary, /stats and /settings now live
 * under /more/… because they are children of the More stack.
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
  // sourceUrl streams/loads directly from a remote URL — the normal path now.
  // filePath/imagePath are the legacy native-download path, kept only for
  // whatever still calls it during the ClassicalLibraryReaderScreen wind-down.
  MusicPlayer: { title: string; sourceUrl?: string; filePath?: string; artist?: string };
  ArtViewer: { title: string; sourceUrl?: string; imagePath?: string; artist?: string };
};

type RootTabParamList = {
  Library: NavigatorScreenParams<LibraryStackParamList>;
  Reading: NavigatorScreenParams<ReadingStackParamList>;
  Curriculum: NavigatorScreenParams<CurriculumStackParamList>;
  Catalog: undefined;
  More: NavigatorScreenParams<MoreStackParamList>;
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
      Catalog: 'catalog',
      More: {
        path: 'more',
        initialRouteName: 'MoreHome',
        screens: {
          MoreHome: '',
          Bookshelf: 'bookshelf',
          Collections: 'collections',
          Dictionary: 'dictionary',
          Highlights: 'highlights',
          Stats: 'stats',
          Settings: 'settings',
        },
      },
    },
  },
};

/**
 * `documentTitle.formatter` is handed the DEEPEST focused route, not the tab —
 * `getCurrentRoute()` walks all the way down. The old map was keyed by tab name
 * ('Library', 'Settings'…), so once the tabs gained stacks almost every lookup
 * missed and the browser tab just said "Annotated". Keyed by leaf route name it
 * actually reports where you are.
 */
const ROUTE_TITLES: Record<string, string> = {
  LibraryHome: 'Library',
  BookDetails: 'Book',
  ClassicalLibraryReader: 'Reading',
  ReaderHome: 'Reader',
  TableOfContents: 'Contents',
  CurriculumHome: 'Curriculum',
  MusicPlayer: 'Music',
  ArtViewer: 'Art',
  Catalog: 'Catalog',
  MoreHome: 'More',
  Bookshelf: 'Bookshelf',
  Collections: 'Collections',
  Dictionary: 'Dictionary',
  Highlights: 'Highlights',
  Stats: 'Statistics',
  Settings: 'Settings',
};

const documentTitle = {
  formatter: (options: any, route: any) => {
    const section = options?.title ?? (route?.name ? ROUTE_TITLES[route.name] : undefined);
    return section ? `Annotated · ${section}` : 'Annotated';
  },
};

const isWeb = Platform.OS === 'web';

/**
 * The tab bar is APP CHROME, so it is painted from the fixed aubergine-and-gold
 * palette rather than from `readerPalettes[settings.theme]`. It used to follow
 * the reader theme, which meant picking the cream reading ground turned the bar
 * cream while every screen above it stayed aubergine. Only the READER changes
 * ground; the chrome does not.
 */
function AppTabBar(props: BottomTabBarProps) {
  return (
    <View style={styles.tabBarOuter}>
      <BottomTabBar {...props} />
    </View>
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
    } catch (error) {
      console.error('Initialization error:', error);
    }
  };

  return (
    <>
      <StatusBar
        style={settings.theme === 'light' || settings.theme === 'sepia' ? 'dark' : 'light'}
        translucent
      />
      <AlertHost />
      <NavigationContainer linking={linking} documentTitle={documentTitle}>
        <Tab.Navigator
          tabBar={AppTabBar}
          screenOptions={{
            headerShown: false,
            // Without this, `shouldUseHorizontalLabels` puts the label BESIDE
            // the icon on any landscape or >=768px viewport — i.e. on every
            // desktop browser, which is half of where this app is used. The
            // references are all icon-above-label; pin it.
            tabBarLabelPosition: 'below-icon',
            tabBarStyle: {
              // The bar's CONTENT is capped to the same phone column every
              // screen uses; `AppTabBar` paints the background and the top rule
              // full-bleed behind it, so on a 1365px desktop the rule still
              // reaches both edges while five tabs do not spread 273px apart.
              width: '100%',
              maxWidth: layout.maxWidth,
              alignSelf: 'center',
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              // Only pin an explicit height on web. `getTabBarHeight` returns a
              // custom height VERBATIM — it stops adding the safe-area inset —
              // so hardcoding one on native eats the home-indicator gap.
              ...(isWeb
                ? { height: 74, paddingTop: space.sm, paddingBottom: space.md }
                : null),
            },
            tabBarActiveTintColor: colors.gold,
            tabBarInactiveTintColor: colors.bronze,
            tabBarLabelStyle: {
              // type.caption already carries fonts.ui + letterSpacing. Five tabs
              // instead of nine means the label can go back to a readable 12.
              ...type.caption,
              fontSize: 12,
              letterSpacing: 0.2,
              fontWeight: '600',
              marginTop: 3,
              marginBottom: isWeb ? 0 : 2,
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
              tabBarIcon: ({ color, focused }) => (
                <Icon name="library" size={23} color={color} strokeWidth={focused ? 2 : 1.65} />
              ),
            }}
          />
          <Tab.Screen
            name="Reading"
            component={ReaderNavigator}
            options={{
              tabBarLabel: 'Read',
              tabBarIcon: ({ color, focused }) => (
                <Icon name="read" size={23} color={color} strokeWidth={focused ? 2 : 1.65} />
              ),
            }}
          />
          <Tab.Screen
            name="Curriculum"
            component={CurriculumNavigator}
            options={{
              tabBarLabel: 'Curriculum',
              tabBarIcon: ({ color, focused }) => (
                <Icon name="curriculum" size={23} color={color} strokeWidth={focused ? 2 : 1.65} />
              ),
            }}
          />
          <Tab.Screen
            name="Catalog"
            component={CatalogScreen}
            options={{
              tabBarLabel: 'Catalog',
              tabBarIcon: ({ color, focused }) => (
                <Icon name="catalog" size={23} color={color} strokeWidth={focused ? 2 : 1.65} />
              ),
            }}
          />
          <Tab.Screen
            name="More"
            component={MoreNavigator}
            options={{
              tabBarLabel: 'More',
              tabBarIcon: ({ color, focused }) => (
                <Icon name="more" size={23} color={color} strokeWidth={focused ? 2 : 1.65} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}

const styles = StyleSheet.create({
  /** Full-bleed chrome behind the capped tab row. */
  tabBarOuter: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
