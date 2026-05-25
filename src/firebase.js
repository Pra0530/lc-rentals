import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import * as realAuth from "firebase/auth";
import * as realFirestore from "firebase/firestore";
import { FLEET_DATA } from "./components/FleetGrid";

// Detect if real Firebase credentials are configured
export const isFirebaseConfigured = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_API_KEY !== "your-api-key-here" &&
  import.meta.env.VITE_FIREBASE_API_KEY.trim() !== ""
);

let firebaseApp = null;
let rawAuth = null;
let rawDb = null;
let rawGoogleProvider = null;

if (isFirebaseConfigured) {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };

  try {
    firebaseApp = initializeApp(firebaseConfig);
    rawAuth = getAuth(firebaseApp);
    rawDb = getFirestore(firebaseApp);
    rawGoogleProvider = new GoogleAuthProvider();
    rawGoogleProvider.addScope("profile");
    rawGoogleProvider.addScope("email");
  } catch (err) {
    console.error("Firebase SDK failed to initialize: ", err);
  }
} else {
  console.log(
    "%c⚠️ LC Rentals: Running in Local Simulation Mode. Configure Firebase keys in .env.local to enable cloud database syncing.",
    "color: #3acbe8; font-weight: bold; font-size: 14px;"
  );
}

// Export auth/db instances (real or mock wrappers)
export const auth = isFirebaseConfigured ? rawAuth : { currentUser: null };
export const db = isFirebaseConfigured ? rawDb : { mock: true };
export const googleProvider = isFirebaseConfigured ? rawGoogleProvider : { mock: true };

/* ==========================================================================
   🔑 Mock Event-Bus Listener and Local Storage Adapters for Offline Mode
   ========================================================================== */

const listeners = {};

const triggerListeners = (path) => {
  if (listeners[path]) {
    const data = getMockStorageData(path);
    listeners[path].forEach((callback) => callback(createMockSnapshot(data)));
  }
};

const getMockStorageData = (path) => {
  if (path === "fleet") {
    const data = localStorage.getItem("lc_fleet_db");
    if (!data) {
      localStorage.setItem("lc_fleet_db", JSON.stringify(FLEET_DATA));
      return FLEET_DATA;
    }
    return JSON.parse(data);
  }
  if (path === "bookings") {
    return JSON.parse(localStorage.getItem("lc_bookings_db") || "[]");
  }
  if (path === "inquiries") {
    return JSON.parse(localStorage.getItem("lc_inquiries_db") || "[]");
  }
  return [];
};

const createMockSnapshot = (docsArray) => ({
  empty: docsArray.length === 0,
  docs: docsArray.map((item) => ({
    id: item.id || item.docId || "mock-id",
    data: () => item
  }))
});

/* ==========================================================================
   ⚡ Conditionally Routed Re-Exports (Real Firebase SDK or Mock Adapters)
   ========================================================================== */

// 1. Auth Functions
export const onAuthStateChanged = isFirebaseConfigured
  ? realAuth.onAuthStateChanged
  : (authInstance, callback) => {
      const activeUser = JSON.parse(localStorage.getItem("lc_active_user") || "null");
      if (!authInstance._callbacks) authInstance._callbacks = [];
      authInstance._callbacks.push(callback);
      // Fire callback on next tick
      setTimeout(() => callback(activeUser), 0);
      return () => {
        authInstance._callbacks = authInstance._callbacks.filter((cb) => cb !== callback);
      };
    };

export const signOut = isFirebaseConfigured
  ? realAuth.signOut
  : (authInstance) => {
      localStorage.removeItem("lc_active_user");
      if (authInstance._callbacks) {
        authInstance._callbacks.forEach((cb) => cb(null));
      }
      return Promise.resolve();
    };

export const signInWithEmailAndPassword = isFirebaseConfigured
  ? realAuth.signInWithEmailAndPassword
  : (authInstance, email, password) => {
      const users = JSON.parse(localStorage.getItem("lc_users_db") || "[]");
      const user = users.find((u) => u.email === email && u.password === password);
      if (!user) {
        return Promise.reject(new Error("auth/user-not-found: Invalid email or password."));
      }
      const firebaseUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.name,
        phoneNumber: user.phone || ""
      };
      localStorage.setItem("lc_active_user", JSON.stringify(firebaseUser));
      if (authInstance._callbacks) {
        authInstance._callbacks.forEach((cb) => cb(firebaseUser));
      }
      return Promise.resolve({ user: firebaseUser });
    };

export const createUserWithEmailAndPassword = isFirebaseConfigured
  ? realAuth.createUserWithEmailAndPassword
  : (authInstance, email, password) => {
      const users = JSON.parse(localStorage.getItem("lc_users_db") || "[]");
      if (users.find((u) => u.email === email)) {
        return Promise.reject(new Error("auth/email-already-in-use: Email already registered."));
      }
      const uid = "usr-" + Math.floor(100000 + Math.random() * 900000);
      const newUser = {
        uid,
        email,
        password,
        name: email.split("@")[0],
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      localStorage.setItem("lc_users_db", JSON.stringify(users));

      const firebaseUser = {
        uid,
        email,
        displayName: newUser.name,
        phoneNumber: ""
      };
      localStorage.setItem("lc_active_user", JSON.stringify(firebaseUser));
      if (authInstance._callbacks) {
        authInstance._callbacks.forEach((cb) => cb(firebaseUser));
      }
      return Promise.resolve({ user: firebaseUser });
    };

export const signInWithPopup = isFirebaseConfigured
  ? realAuth.signInWithPopup
  : (authInstance, providerInstance) => {
      const uid = "google-" + Math.floor(100000 + Math.random() * 900000);
      const googleUser = {
        uid,
        email: "google.guest@lcrentals.com.au",
        displayName: "Google VIP Guest",
        phoneNumber: ""
      };
      localStorage.setItem("lc_active_user", JSON.stringify(googleUser));
      if (authInstance._callbacks) {
        authInstance._callbacks.forEach((cb) => cb(googleUser));
      }
      return Promise.resolve({ user: googleUser });
    };

export const updateProfile = isFirebaseConfigured
  ? realAuth.updateProfile
  : (userInstance, profileData) => {
      const activeUser = JSON.parse(localStorage.getItem("lc_active_user") || "null");
      if (activeUser && activeUser.uid === userInstance.uid) {
        activeUser.displayName = profileData.displayName;
        localStorage.setItem("lc_active_user", JSON.stringify(activeUser));
      }
      // Update in local users database as well
      const users = JSON.parse(localStorage.getItem("lc_users_db") || "[]");
      const index = users.findIndex((u) => u.uid === userInstance.uid);
      if (index >= 0) {
        users[index].name = profileData.displayName;
        localStorage.setItem("lc_users_db", JSON.stringify(users));
      }
      return Promise.resolve();
    };

// 2. Firestore Functions
export const collection = isFirebaseConfigured
  ? realFirestore.collection
  : (dbInstance, path) => ({ path });

export const doc = isFirebaseConfigured
  ? realFirestore.doc
  : (dbInstance, pathOrColRef, docId) => {
      if (typeof pathOrColRef === "string") {
        return { collectionPath: pathOrColRef, id: docId };
      }
      return { collectionPath: pathOrColRef.path, id: docId };
    };

export const onSnapshot = isFirebaseConfigured
  ? realFirestore.onSnapshot
  : (ref, callback) => {
      const path = ref.path || ref.collectionPath;
      if (!listeners[path]) {
        listeners[path] = [];
      }
      listeners[path].push(callback);

      const initialData = getMockStorageData(path);
      setTimeout(() => callback(createMockSnapshot(initialData)), 0);

      return () => {
        listeners[path] = listeners[path].filter((cb) => cb !== callback);
      };
    };

export const setDoc = isFirebaseConfigured
  ? realFirestore.setDoc
  : (docRef, data) => {
      const path = docRef.collectionPath;
      const docId = docRef.id;
      const list = getMockStorageData(path);
      const index = list.findIndex((item) => item.id === docId);
      const newDoc = { id: docId, docId, ...data };
      if (index >= 0) {
        list[index] = newDoc;
      } else {
        list.push(newDoc);
      }
      localStorage.setItem(`lc_${path}_db`, JSON.stringify(list));
      triggerListeners(path);
      return Promise.resolve();
    };

export const addDoc = isFirebaseConfigured
  ? realFirestore.addDoc
  : (colRef, data) => {
      const path = colRef.path;
      const list = getMockStorageData(path);
      const docId = "doc-" + Math.floor(100000 + Math.random() * 900000);
      const newDoc = { id: docId, docId, ...data };
      list.push(newDoc);
      localStorage.setItem(`lc_${path}_db`, JSON.stringify(list));
      triggerListeners(path);
      return Promise.resolve({ id: docId });
    };

export const updateDoc = isFirebaseConfigured
  ? realFirestore.updateDoc
  : (docRef, data) => {
      const path = docRef.collectionPath;
      const docId = docRef.id;
      const list = getMockStorageData(path);
      const index = list.findIndex((item) => item.id === docId || item.docId === docId);
      if (index >= 0) {
        const updatedItem = { ...list[index] };
        Object.keys(data).forEach((key) => {
          if (key.includes(".")) {
            const parts = key.split(".");
            let current = updatedItem;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!current[parts[i]]) current[parts[i]] = {};
              current = current[parts[i]];
            }
            current[parts[parts.length - 1]] = data[key];
          } else {
            updatedItem[key] = data[key];
          }
        });
        list[index] = updatedItem;
        localStorage.setItem(`lc_${path}_db`, JSON.stringify(list));
        triggerListeners(path);
      }
      return Promise.resolve();
    };

export const deleteDoc = isFirebaseConfigured
  ? realFirestore.deleteDoc
  : (docRef) => {
      const path = docRef.collectionPath;
      const docId = docRef.id;
      const list = getMockStorageData(path);
      const newList = list.filter((item) => item.id !== docId && item.docId !== docId);
      localStorage.setItem(`lc_${path}_db`, JSON.stringify(newList));
      triggerListeners(path);
      return Promise.resolve();
    };
