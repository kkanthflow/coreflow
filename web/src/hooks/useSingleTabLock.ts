import { useEffect, useState, useCallback, useRef } from 'react';

export function useSingleTabLock(meetingId: string | undefined) {
  const [isDuplicate, setIsDuplicate] = useState(false);
  const lockResolverRef = useRef<(() => void) | null>(null);

  const releaseLock = useCallback(() => {
    if (lockResolverRef.current) {
      lockResolverRef.current();
      lockResolverRef.current = null;
    }
  }, []);

  const acquireLock = useCallback(() => {
    if (!meetingId) return;

    if ('locks' in navigator) {
      navigator.locks.request(
        `coreflow_meeting_lock_${meetingId}`,
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            // Lock held by another tab!
            setIsDuplicate(true);
            return;
          }

          setIsDuplicate(false);

          // Hold lock until unmount or takeover
          await new Promise<void>((resolve) => {
            lockResolverRef.current = resolve;
          });
        }
      );
    }
  }, [meetingId]);

  // BroadcastChannel for cross-tab communication & takeover
  useEffect(() => {
    if (!meetingId) return;

    const channel = new BroadcastChannel(`coreflow_meeting_channel_${meetingId}`);

    // Announce check for existing tab
    channel.postMessage({ type: 'CHECK_EXISTING' });

    channel.onmessage = (event) => {
      if (event.data?.type === 'CHECK_EXISTING') {
        if (!isDuplicate) {
          channel.postMessage({ type: 'TAB_ACTIVE' });
        }
      } else if (event.data?.type === 'TAB_ACTIVE') {
        setIsDuplicate(true);
      } else if (event.data?.type === 'FORCE_TAKEOVER') {
        // Another tab requested takeover — release our lock
        releaseLock();
        setIsDuplicate(true);
      }
    };

    acquireLock();

    return () => {
      releaseLock();
      channel.close();
    };
  }, [meetingId, acquireLock, releaseLock, isDuplicate]);

  const claimLock = useCallback(() => {
    if (!meetingId) return;

    const channel = new BroadcastChannel(`coreflow_meeting_channel_${meetingId}`);
    channel.postMessage({ type: 'FORCE_TAKEOVER' });
    channel.close();

    // Short delay then acquire
    setTimeout(() => {
      acquireLock();
    }, 150);
  }, [meetingId, acquireLock]);

  return { isDuplicate, claimLock };
}
