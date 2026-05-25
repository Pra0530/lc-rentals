// Give the service worker access to Firebase Messaging compat scripts
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize Firebase compat app in the service worker
// Replace messagingSenderId placeholder in production deployment if using active FCM keys
firebase.initializeApp({
  messagingSenderId: "your-sender-id-here"
});

const messaging = firebase.messaging();

// Handle background push alerts when browser tab is closed
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message payload:', payload);
  
  const notificationTitle = payload.notification?.title || 'LC Rentals Concierge';
  const notificationOptions = {
    body: payload.notification?.body || 'New status update on your vehicle.',
    icon: '/mclaren.png',
    badge: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
