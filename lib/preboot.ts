import { LogBox } from "react-native";

// Override console.error early to completely suppress the expo-notifications warning in Expo Go
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const message = args.join(" ");
  if (
    message.includes("expo-notifications: Android Push notifications") ||
    message.includes("removed from Expo Go")
  ) {
    return;
  }
  originalConsoleError(...args);
};

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'Android Push notifications'
]);

// Register global error handler for uncaught JS exceptions
if (typeof global !== 'undefined' && (global as any).ErrorUtils) {
  const previousHandler = (global as any).ErrorUtils.getGlobalHandler();
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
    console.warn("[Global Crash Logger] Uncaught Exception caught by ErrorUtils:", error);
    if (previousHandler) {
      previousHandler(error, isFatal);
    }
  });
}

// Register global promise rejection handler
const originalPromiseRejectionHandler = (Promise as any)._onUnhandledRejection;
(Promise as any)._onUnhandledRejection = (id: any, error: any) => {
  console.warn("[Global Crash Logger] Unhandled Promise Rejection:", error);
  if (originalPromiseRejectionHandler) {
    originalPromiseRejectionHandler(id, error);
  }
};

