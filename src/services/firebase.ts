export const isFirebaseInitialized = false;
export const app = null;
export const db = null;
export const auth = null;

export type FirebaseUser = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
};

export const getFirebaseErrorMessage = (error: any): string =>
  error?.message || 'Firebase integration is disabled. Use MongoDB Atlas authentication.';

export const firebaseRegisterWithEmail = async (_email?: string, _password?: string, _name?: string): Promise<any> => {
  throw new Error('Firebase authentication is disabled. Use MongoDB Atlas authentication.');
};

export const firebaseLoginWithEmail = async (_email?: string, _password?: string): Promise<any> => {
  throw new Error('Firebase authentication is disabled. Use MongoDB Atlas authentication.');
};

export const signInWithGooglePopup = async (): Promise<any> => {
  throw new Error('Google Sign-In requires Firebase, which is disabled.');
};

export const signInWithGoogleIdToken = async (): Promise<any> => {
  throw new Error('Google Sign-In requires Firebase, which is disabled.');
};

export const firebaseSendPasswordReset = async (_email?: string): Promise<void> => {
  throw new Error('Firebase password reset is disabled.');
};

export const firebaseConfirmPasswordReset = async (_code?: string, _newPassword?: string): Promise<void> => {
  throw new Error('Firebase password reset is disabled.');
};

export const firebaseVerifyPasswordResetCode = async (_code?: string): Promise<string> => {
  throw new Error('Firebase password reset is disabled.');
};

export const firebaseUpdateUserPassword = async (): Promise<void> => {
  throw new Error('Firebase password updates are disabled.');
};

export const firebaseLogout = async (): Promise<void> => {};

export const firebaseUpdateProfile = async (): Promise<void> => {};

export const onAuthStateChanged = (): (() => void) => () => {};
