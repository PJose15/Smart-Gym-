'use client';

import { useState, useEffect, useCallback } from 'react';

interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  subscribe: (memberId: string, gymId: string) => Promise<void>;
  unsubscribe: (memberId: string) => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, []);

  const subscribe = useCallback(async (memberId: string, gymId: string) => {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const reg = await navigator.serviceWorker.ready;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey,
    });

    const subJson = sub.toJSON();
    const res = await fetch('/api/member/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: memberId,
        gym_id: gymId,
        subscription: {
          endpoint: subJson.endpoint,
          keys: { p256dh: subJson.keys?.p256dh, auth: subJson.keys?.auth },
        },
        user_agent: navigator.userAgent,
        platform: /mobile/i.test(navigator.userAgent)
          ? /android/i.test(navigator.userAgent) ? 'android' : 'ios'
          : 'desktop',
      }),
    });

    if (res.ok) setIsSubscribed(true);
  }, []);

  const unsubscribe = useCallback(async (memberId: string) => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/member/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setIsSubscribed(false);
  }, []);

  return { isSupported, isSubscribed, subscribe, unsubscribe };
}
