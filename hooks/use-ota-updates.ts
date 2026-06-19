import { useEffect, useRef } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';

const UPDATE_NOTIFICATION_ID = 'ota-update-available';
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // re-check every 10 min while app is open

/**
 * Checks for EAS OTA updates in the background.
 * - Fires a local notification if an update is found.
 * - Tapping the notification triggers fetchUpdateAsync + reloadAsync.
 * - Only runs on native (iOS / Android), not web.
 */
export function useOTAUpdates() {
  const lastChecked = useRef<number>(0);

  const checkForUpdate = async () => {
    // Throttle: don't check more than once per interval
    const now = Date.now();
    if (now - lastChecked.current < CHECK_INTERVAL_MS) return;
    lastChecked.current = now;

    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) return;

      // Cancel any previous update notification first (avoid duplicates)
      await Notifications.dismissNotificationAsync(UPDATE_NOTIFICATION_ID).catch(() => {});

      // Fire the local notification
      await Notifications.scheduleNotificationAsync({
        identifier: UPDATE_NOTIFICATION_ID,
        content: {
          title: '🚀 CoreFlow Update Available',
          body: 'A new update is ready. Tap to restart and apply it now.',
          sound: true,
          data: { type: 'ota_update' },
        },
        trigger: null, // fire immediately
      });
    } catch (e) {
      // Silently ignore — update checks should never crash the app
      console.log('[OTA] Update check skipped:', e);
    }
  };

  useEffect(() => {
    // Only run on native builds (not Expo Go dev mode, not web)
    if (Platform.OS === 'web') return;
    if (__DEV__) return; // don't bother in dev

    // Check on mount
    checkForUpdate();

    // Re-check whenever app comes to the foreground
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        checkForUpdate();
      }
    });

    // Handle notification tap → download + restart
    const responseSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data as any;
      if (data?.type !== 'ota_update') return;

      try {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } catch (e) {
        console.error('[OTA] Failed to apply update:', e);
      }
    });

    return () => {
      sub.remove();
      responseSub.remove();
    };
  }, []);
}
