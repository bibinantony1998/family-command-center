import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ChatProvider } from './src/context/ChatContext';
import RootNavigator from './src/navigation/index';
import { PermissionsAndroid, Platform, Linking } from 'react-native';
import { supabase } from './src/lib/supabase';

function App() {
  useEffect(() => {
    // Helper to parse URL and set session
    const handleUrl = (url: string) => {
      console.log('Deep link received:', url);

      // Extract tokens from URL (hash fragment for implicit flow)
      // Format: ...#access_token=...&refresh_token=...&...
      const hashIndex = url.indexOf('#');
      if (hashIndex !== -1) {
        const hash = url.substring(hashIndex + 1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          console.log('Setting session from URL...');
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }).then(({ error }) => {
            if (error) console.error('Error setting session:', error);
            else console.log('Session set successfully.');
          });
        } else {
          console.log('No tokens found in URL hash');
        }
      } else {
        // Handle code flow if query params are used instead of hash
        const queryIndex = url.indexOf('?');
        if (queryIndex !== -1) {
          supabase.auth.getSession();
        }
      }
    };

    // 1. Handle incoming links when app is already open
    const handleDeepLink = (event: { url: string }) => {
      handleUrl(event.url);
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    // 2. Handle incoming links when app was closed
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
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
