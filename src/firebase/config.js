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
  apiKey: "AIzaSyCumTvMAncI1nJgK517NtQ0ma5hQdfFOF4",
  authDomain: "cm-system-c3de7.firebaseapp.com",
  projectId: "cm-system-c3de7",
  storageBucket: "cm-system-c3de7.firebasestorage.app",
  messagingSenderId: "765093265855",
  appId: "1:765093265855:web:64a76cdb149908aab3610a",
  measurementId: "G-4TV6R81PB8"
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
