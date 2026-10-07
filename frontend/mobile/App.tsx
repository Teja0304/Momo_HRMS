import { LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { theme } from './src/theme/theme';

// Ignore non-critical dev server connection warnings
LogBox.ignoreLogs([
  'Cannot connect to Expo CLI',
  'Running "main" with',
]);

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
          <StatusBar style="dark" />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
