import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ChatProvider } from './src/context/ChatContext';
import RootNavigator from './src/navigation/index';

import { PermissionsAndroid, Platform } from 'react-native';

function App() {
  React.useEffect(() => {
    const requestPermission = async () => {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
        } catch (err) {
          console.warn(err);
        }
      }
    };

    requestPermission();
  }, []);
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ChatProvider>
          <RootNavigator />
        </ChatProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default App;
