import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  getAuth, 
  Auth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile as firebaseUpdateProfile,
  updatePassword as firebaseUpdatePassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  UserCredential
} from 'firebase/auth';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Firebase Configuration from applet config
const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
  ...(firebaseConfigJson.measurementId ? { measurementId: firebaseConfigJson.measurementId } : {}),
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

  console.log('Firebase initialized successfully with project:', firebaseConfig.projectId, 'dbId:', dbId || '(default)');
} catch (error) {
  console.error('Firebase initialization error:', error);
}

/**
 * Format Firebase Auth errors into clear, actionable messages
 */
export const getFirebaseErrorMessage = (error: any): string => {
  if (!error) return 'An unexpected error occurred. Please try again.';
  const code = error?.code || '';
  const message = error?.message || '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email is already registered. Please sign in or use "Forgot Password".';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Incorrect email or password. Please verify your credentials or create a new account.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please switch to "Create Account" tab to register.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/too-many-requests':
      return 'Too many failed login attempts. Access temporarily restricted. Please try again in a few moments.';
    case 'auth/network-request-failed':
      return 'Network connection issue. Please check your internet connection.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completing.';
    case 'auth/popup-blocked':
      return 'Browser blocked the popup window. Please allow popups for this site.';
    case 'auth/unauthorized-domain':
      return `This domain (${typeof window !== 'undefined' ? window.location.hostname : 'current domain'}) is not authorized in Firebase Console. Add it in Firebase Console > Authentication > Settings > Authorized Domains.`;
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase Console. Please enable Email/Password & Google in Firebase Authentication settings.';
    default:
      if (message.includes('auth/invalid-credential')) {
        return 'Incorrect email or password. Please verify your credentials or register.';
      }
      return message || 'Authentication failed. Please try again.';
  }
};

/**
 * Register with Email and Password using Firebase Auth
 */
export const firebaseRegisterWithEmail = async (
  email: string, 
  password: string, 
  displayName: string
): Promise<UserCredential> => {
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
  if (displayName && userCredential.user) {
    try {
      await firebaseUpdateProfile(userCredential.user, {
        displayName: displayName.trim(),
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName.trim())}`,
      });
    } catch (e) {
      console.warn('Firebase updateProfile warning:', e);
    }
  }

  return userCredential;
};

/**
 * Sign in with Email and Password using Firebase Auth
 */
export const firebaseLoginWithEmail = async (
  email: string, 
  password: string
): Promise<UserCredential> => {
  if (!auth) throw new Error('Firebase Auth is not initialized');
  return await signInWithEmailAndPassword(auth, email, password);
};

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
 * Send password reset email via Firebase Auth
 */
export const firebaseSendPasswordReset = async (email: string): Promise<void> => {
  if (!auth) throw new Error('Firebase Auth is not initialized');
  await sendPasswordResetEmail(auth, email);
};

/**
 * Update password for current logged-in user
 */
export const firebaseUpdateUserPassword = async (newPassword: string): Promise<void> => {
  if (!auth?.currentUser) throw new Error('No user is currently signed in');
  await firebaseUpdatePassword(auth.currentUser, newPassword);
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

export { 
  app, 
  db, 
  auth, 
  isFirebaseInitialized, 
  onAuthStateChanged,
  firebaseUpdateProfile 
};
export type { FirebaseUser };
