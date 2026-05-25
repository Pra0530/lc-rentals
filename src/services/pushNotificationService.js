import { db } from '../firebase';
import { doc, updateDoc } from '../firebase';

// Check if Notification API is supported by the browser
export const isNotificationSupported = typeof window !== 'undefined' && 'Notification' in window;

export const requestNotificationPermission = async () => {
  if (!isNotificationSupported) {
    console.warn("This browser does not support desktop notifications.");
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    console.log(`[Push Notification Service] Permission status: ${permission}`);
    return permission;
  } catch (err) {
    console.error("Failed to request notification permission:", err);
    return 'default';
  }
};

export const sendNativeNotification = (title, body) => {
  if (!isNotificationSupported || Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: '/mclaren.png', // Fallback to our existing public asset
      badge: '/favicon.ico',
      silent: false
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch (err) {
    console.error("Error displaying native browser notification:", err);
    return false;
  }
};

// FCM Token Manager (Mock/Production bridge)
export const savePushTokenToFirestore = async (userId, token) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { fcmToken: token });
    console.log(`[Push Notification Service] Registered FCM Token for user ${userId}: ${token}`);
  } catch (err) {
    // If running in local simulation where Firestore isn't real, log it
    console.log(`[Push Notification Service Simulator] Saved FCM Token locally for user ${userId}: ${token}`);
  }
};

// VAPID key check
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
export const isFCMConfigured = !!(vapidKey && vapidKey !== 'your-vapid-key-here' && vapidKey.trim() !== '');

export const initializeFCM = async (userId) => {
  if (!isFCMConfigured || !isNotificationSupported || Notification.permission !== 'granted') {
    console.log("[Push Notification Service] FCM Messaging running in local notification simulation mode.");
    return null;
  }

  try {
    // Dynamically import to prevent bundler problems in environments without service workers
    const { getMessaging, getToken, onMessage } = await import('firebase/messaging');
    const { initializeApp } = await import('firebase/app');

    // Get Firebase configuration
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    if (!apiKey || apiKey === 'your-api-key-here') {
      return null;
    }

    const firebaseConfig = {
      apiKey: apiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };

    // Initialize dedicated messaging app node
    const app = initializeApp(firebaseConfig, "messaging-app");
    const messaging = getMessaging(app);

    // Retrieve Token
    const currentToken = await getToken(messaging, { vapidKey });
    if (currentToken) {
      await savePushTokenToFirestore(userId, currentToken);

      // Handle active foreground alerts
      onMessage(messaging, (payload) => {
        console.log('[Push Service Message Received (Foreground)]', payload);
        sendNativeNotification(
          payload.notification?.title || "LC Rentals Alert",
          payload.notification?.body || ""
        );
      });

      return currentToken;
    } else {
      console.warn('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (error) {
    console.error('An error occurred while retrieving FCM token:', error);
    return null;
  }
};
