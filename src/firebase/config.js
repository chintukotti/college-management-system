import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager, // ✅ CHANGED: Much more stable for single-page apps
  getFirestore
} from 'firebase/firestore';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyBPD3hNLrJk-bfNzBeSxc4Q00dwqkOuLvI",
  authDomain: "cm-system-kt.firebaseapp.com",
  projectId: "cm-system-kt",
  storageBucket: "cm-system-kt.firebasestorage.app",
  messagingSenderId: "935944326232",
  appId: "1:935944326232:web:c2dcc6eda35806cbcd0e2d",
  measurementId: "G-7CK0LTVVP2"
};
const app = initializeApp(firebaseConfig);

const secondaryApp = initializeApp(firebaseConfig, 'Secondary');

export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);

/**
 * Firestore with an IndexedDB-backed cache.
 * Using persistentSingleTabManager to avoid internal assertion failures (ID: ca9)
 * that occur when listeners are rapidly unsubscribed/resubscribed across navigation.
 */
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager()
      })
    });
  } catch (error) {
    console.warn('Firestore persistent cache unavailable, using memory cache:', error?.message);
    return getFirestore(app);
  }
})();

export const messaging = isSupported() ? getMessaging(app) : null;

export default app;