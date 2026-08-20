// src/firebase/config.js

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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

// Secondary app: lets an admin create accounts without being signed out of
// their own session (createUserWithEmailAndPassword logs in the new user).
const secondaryApp = initializeApp(firebaseConfig, 'Secondary');

export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);

/**
 * Firestore with an IndexedDB-backed cache.
 *
 * Documents already pulled once are kept on the device, which lets the app
 * survive reconnects and serve repeat listener/query results locally instead
 * of re-reading them from the server. Multi-tab manager keeps several open
 * tabs sharing one cache rather than fighting over the lock.
 *
 * Falls back to the default in-memory Firestore if persistence is unavailable
 * (private browsing, unsupported browser, storage disabled).
 */
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (error) {
    console.warn('Firestore persistent cache unavailable, using memory cache:', error?.message);
    return getFirestore(app);
  }
})();

export const messaging = isSupported() ? getMessaging(app) : null;

export default app;
