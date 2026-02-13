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
    // Helper to parse URL and set session
    const handleUrl = async (url: string) => {
      console.log('Deep link received:', url);

      try {
        // Handle PKCE flow (code in query params) - STANDARD FOR SUPABASE MOBILE
        if (url.includes('code=')) {
          const params = new URLSearchParams(url.split('?')[1]);
          const code = params.get('code');
          if (code) {
            console.log('Exchanging code for session...');
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) console.error('Error exchanging code:', error);
            else console.log('Session established via PKCE code.');
            return;
          }
        }

        // Handle Implicit flow (tokens in hash) - LEGACY / WEB
        // Format: ...#access_token=...&refresh_token=...&...
        const hashIndex = url.indexOf('#');
        if (hashIndex !== -1) {
          const hash = url.substring(hashIndex + 1);
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            console.log('Setting session from URL hash...');
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            }).then(({ error }) => {
              if (error) console.error('Error setting session:', error);
              else console.log('Session set successfully.');
            });
          }
        }
      } catch (e) {
        console.error('Error handling URL:', e);
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
