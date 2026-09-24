import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Configuration
const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
};

let app;
let db: Firestore;
let auth: Auth;
let isFirebaseInitialized = false;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  
  // Connect to custom databaseId if specified in config, otherwise default
  const dbId = firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== '(default)'
    ? firebaseConfigJson.firestoreDatabaseId
    : undefined;

  db = dbId ? getFirestore(app, dbId) : getFirestore(app);
  auth = getAuth(app);
  isFirebaseInitialized = true;

  // Initialize anonymous authentication session for smooth Firestore access
  signInAnonymously(auth).catch((err) => {
    console.warn('Firebase anonymous auth notice (offline or rules fallback):', err?.message || err);
  });

  console.log('Firebase initialized successfully with project:', firebaseConfig.projectId, 'dbId:', dbId || '(default)');
} catch (error) {
  console.error('Firebase initialization error:', error);
}

export { app, db, auth, isFirebaseInitialized };
