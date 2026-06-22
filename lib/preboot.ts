import { LogBox } from "react-native";

// Override console.error early to completely suppress the expo-notifications warning in Expo Go
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // Check string arguments only to suppress notification warnings.
  // This is completely immune to symbol crashes and infinite recursion loops from JSON.stringify.
  const isNotificationWarning = args.some(arg => 
    typeof arg === 'string' && (
      arg.includes("expo-notifications: Android Push notifications") ||
      arg.includes("removed from Expo Go")
    )
  );

  if (isNotificationWarning) {
    return;
  }
  originalConsoleError(...args);
};

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'Android Push notifications'
]);

import { Alert } from 'react-native';

// Register global error handler for uncaught JS exceptions
if (typeof global !== 'undefined' && (global as any).ErrorUtils) {
  const previousHandler = (global as any).ErrorUtils.getGlobalHandler();
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
    console.warn("[Global Crash Logger] Uncaught Exception caught by ErrorUtils:", error);
    try {
      Alert.alert('Fatal JS Crash', String(error?.message || error));
    } catch(e) {}
    if (previousHandler) {
      previousHandler(error, isFatal);
    }
  });
}

// Register global promise rejection handler
const originalPromiseRejectionHandler = (Promise as any)._onUnhandledRejection;
(Promise as any)._onUnhandledRejection = (id: any, error: any) => {
  console.warn("[Global Crash Logger] Unhandled Promise Rejection:", error);
  try {
    Alert.alert('Unhandled Promise Rejection', String(error?.message || error));
  } catch(e) {}
  if (originalPromiseRejectionHandler) {
    originalPromiseRejectionHandler(id, error);
  }
};

