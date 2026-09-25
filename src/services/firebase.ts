import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  Auth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithCredential,
  signOut as firebaseSignOut 
} from 'firebase/auth';
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

let app: any;
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

  // Initialize anonymous authentication session for smooth Firestore access if not already signed in
  if (!auth.currentUser) {
    signInAnonymously(auth).catch((err) => {
      console.warn('Firebase anonymous auth notice (offline or rules fallback):', err?.message || err);
    });
  }

  console.log('Firebase initialized successfully with project:', firebaseConfig.projectId, 'dbId:', dbId || '(default)');
} catch (error) {
  console.error('Firebase initialization error:', error);
}

/**
 * Triggers official Google Sign-In with Popup
 */
export const signInWithGooglePopup = async () => {
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  return await signInWithPopup(auth, provider);
};

/**
 * Signs in using a Google ID token from Google Identity Services (One Tap or GIS button)
 */
export const signInWithGoogleIdToken = async (idToken: string) => {
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const credential = GoogleAuthProvider.credential(idToken);
  return await signInWithCredential(auth, credential);
};

/**
 * Signs out from Firebase Authentication
 */
export const firebaseLogout = async () => {
  if (auth) {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn('Firebase signout warning:', e);
    }
  }
};

export { app, db, auth, isFirebaseInitialized };

