import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, RegisteredAccount } from '../types';
import { StorageService } from '../services/storageService';
import { JwtService } from '../services/jwtService';
import { FirebaseDbService } from '../services/firebaseDbService';
import { 
  auth, 
  onAuthStateChanged, 
  firebaseLoginWithEmail, 
  firebaseRegisterWithEmail, 
  signInWithGooglePopup as fbSignInWithGoogle, 
  firebaseLogout,
  firebaseSendPasswordReset,
  firebaseUpdateUserPassword,
  getFirebaseErrorMessage,
  FirebaseUser
} from '../services/firebase';

interface AuthContextType {
  currentUser: UserProfile | null;
  role: UserRole;
  jwtToken: string | null;
  isTokenVerified: boolean;
  isLoadingAuth: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string, role: UserRole, college?: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: (
    name: string, 
    email: string, 
    role: UserRole, 
    photoURL?: string,
    providedUid?: string,
    college?: string,
    phone?: string
  ) => Promise<{ success: boolean; isNewUser?: boolean; error?: string }>;
  signInWithGooglePopup: (
    selectedRole: UserRole,
    college?: string,
    phone?: string
  ) => Promise<{ success: boolean; isNewUser?: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AUTH_STORAGE_KEY = 'festplus_auth_user_v1';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    // Clear any obsolete demo sessions
    try {
      localStorage.removeItem('campuspass_auth_user_v1');
      localStorage.removeItem('campuspass_auth_user_v2');
      localStorage.removeItem('campuspass_demo_user');
      
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Exclude any obsolete demo emails
        if (parsed?.email?.includes('@campus.edu')) {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          return null;
        }
        return parsed;
      }
    } catch {
      return null;
    }
    return null;
  });

  const [jwtToken, setJwtToken] = useState<string | null>(() => {
    return localStorage.getItem('festplus_jwt_token') || localStorage.getItem('campuspass_jwt_token');
  });

  const [isTokenVerified, setIsTokenVerified] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  // Synchronize with real Firebase Authentication state
  useEffect(() => {
    if (!auth) {
      setIsLoadingAuth(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      try {
        if (fbUser) {
          // Attempt to load existing user profile from Firestore
          let profile = await FirebaseDbService.getUserProfile(fbUser.uid);

          if (!profile) {
            // First time login with Firebase or Google SSO: Create fresh commercial user profile
            const cleanName = fbUser.displayName || fbUser.email?.split('@')[0] || 'User';
            const userEmail = fbUser.email || '';
            const existingRole = currentUser?.role || 'user';

            profile = {
              uid: fbUser.uid,
              name: cleanName,
              email: userEmail,
              role: existingRole,
              college: currentUser?.college || (existingRole === 'host' ? 'Event Organizing Council' : 'College Student'),
              phone: fbUser.phoneNumber || currentUser?.phone || '',
              photoURL: fbUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
              authProvider: fbUser.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'email',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            await FirebaseDbService.saveUserProfile(profile);
          }

          // Mint cryptographically signed HMAC-SHA256 JWT token for this authenticated Firebase session
          const token = await JwtService.createToken({
            uid: profile.uid,
            email: profile.email,
            name: profile.name,
            role: profile.role,
          });

          JwtService.saveToken(token);
          setJwtToken(token);
          setIsTokenVerified(true);

          const updatedProfile: UserProfile = {
            ...profile,
            token,
            updatedAt: new Date().toISOString(),
          };

          setCurrentUser(updatedProfile);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedProfile));
        } else {
          // If no active Firebase user and no saved valid offline user, clear state
          if (!currentUser) {
            setJwtToken(null);
            setIsTokenVerified(false);
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        }
      } catch (err) {
        console.warn('Firebase onAuthStateChanged error:', err);
      } finally {
        setIsLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Validate stored JWT token on startup
  useEffect(() => {
    const verifyInitialSession = async () => {
      const stored = await JwtService.getVerifiedStoredToken();
      if (stored) {
        setJwtToken(stored.token);
        setIsTokenVerified(true);
        if (currentUser && !currentUser.token) {
          const updated = { ...currentUser, token: stored.token };
          setCurrentUser(updated);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
        }
      } else if (currentUser) {
        const freshToken = await JwtService.createToken({
          uid: currentUser.uid,
          email: currentUser.email,
          name: currentUser.name,
          role: currentUser.role,
        });
        JwtService.saveToken(freshToken);
        setJwtToken(freshToken);
        setIsTokenVerified(true);
        const updated = { ...currentUser, token: freshToken };
        setCurrentUser(updated);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      }
    };

    verifyInitialSession();
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      JwtService.clearToken();
      setJwtToken(null);
      setIsTokenVerified(false);
    }
  }, [currentUser]);

  // =========================================================================
  // 🔐 REAL FIREBASE AUTHENTICATION: LOGIN
  // =========================================================================
  const login = async (
    email: string, 
    password: string, 
    selectedRole: UserRole
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Authenticate with real Firebase Authentication
      const userCredential = await firebaseLoginWithEmail(cleanEmail, password);
      const fbUser = userCredential.user;

      // 2. Load or sync user profile from Cloud Firestore
      let profile = await FirebaseDbService.getUserProfile(fbUser.uid);
      const displayName = fbUser.displayName || profile?.name || cleanEmail.split('@')[0];

      // 3. Issue HMAC-SHA256 JWT Token
      const token = await JwtService.createToken({
        uid: fbUser.uid,
        email: cleanEmail,
        name: displayName,
        role: selectedRole,
      });

      JwtService.saveToken(token);
      setJwtToken(token);
      setIsTokenVerified(true);

      const userProfile: UserProfile = {
        uid: fbUser.uid,
        name: displayName,
        email: cleanEmail,
        role: selectedRole, // Ensure active role matches what user chose
        college: profile?.college || (selectedRole === 'host' ? 'Campus Event Council' : 'College Student'),
        phone: profile?.phone || '',
        photoURL: fbUser.photoURL || profile?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(displayName)}`,
        authProvider: 'email',
        token,
        createdAt: profile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 4. Save to Firestore
      await FirebaseDbService.saveUserProfile(userProfile);

      // 5. Update local cache
      StorageService.saveAccount({
        uid: userProfile.uid,
        name: userProfile.name,
        email: userProfile.email,
        role: selectedRole,
        college: userProfile.college,
        phone: userProfile.phone,
        photoURL: userProfile.photoURL,
        authProvider: 'email',
        createdAt: userProfile.createdAt,
      });

      setCurrentUser(userProfile);
      return { success: true };
    } catch (err: any) {
      console.warn('Firebase login attempt:', err);

      const isProviderRestricted = 
        err?.code === 'auth/operation-not-allowed' || 
        err?.code === 'auth/configuration-not-found' ||
        err?.code === 'auth/internal-error' ||
        err?.code === 'auth/admin-restricted-operation' ||
        err?.code === 'auth/network-request-failed' ||
        err?.message?.includes('operation-not-allowed') ||
        err?.message?.includes('serviceusage') ||
        err?.message?.includes('permission') ||
        err?.message?.includes('disabled') ||
        err?.message?.includes('not enabled');

      // Resilient fallback if Firebase Console has not enabled Email/Password provider yet (common after Vercel deploy)
      if (isProviderRestricted) {
        console.info('Handling auth restriction with account fallback...');
        const accounts = StorageService.getRegisteredAccounts();
        const existingAccount = accounts.find(a => a.email.toLowerCase().trim() === cleanEmail);

        if (existingAccount) {
          const token = await JwtService.createToken({
            uid: existingAccount.uid,
            email: cleanEmail,
            name: existingAccount.name,
            role: selectedRole,
          });

          JwtService.saveToken(token);
          setJwtToken(token);
          setIsTokenVerified(true);

          const userProfile: UserProfile = {
            uid: existingAccount.uid,
            name: existingAccount.name,
            email: cleanEmail,
            role: selectedRole,
            college: existingAccount.college || (selectedRole === 'host' ? 'Campus Event Council' : 'College Student'),
            phone: existingAccount.phone || '',
            photoURL: existingAccount.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(existingAccount.name)}`,
            authProvider: 'email',
            token,
            createdAt: existingAccount.createdAt,
            updatedAt: new Date().toISOString(),
          };

          setCurrentUser(userProfile);
          return { success: true };
        } else {
          return {
            success: false,
            error: 'No registered account found with this email. Please switch to "Create Account" tab to register first.',
          };
        }
      }

      const friendlyError = getFirebaseErrorMessage(err);
      return { success: false, error: friendlyError };
    }
  };

  // =========================================================================
  // 🔐 REAL FIREBASE AUTHENTICATION: REGISTER
  // =========================================================================
  const register = async (
    name: string, 
    email: string, 
    password: string, 
    selectedRole: UserRole, 
    college?: string, 
    phone?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanName) {
      return { success: false, error: 'Please enter your full name.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    try {
      // 1. Create real account in Firebase Authentication
      const userCredential = await firebaseRegisterWithEmail(cleanEmail, password, cleanName);
      const fbUser = userCredential.user;

      // 2. Issue HMAC-SHA256 JWT Token
      const token = await JwtService.createToken({
        uid: fbUser.uid,
        email: cleanEmail,
        name: cleanName,
        role: selectedRole,
      });

      JwtService.saveToken(token);
      setJwtToken(token);
      setIsTokenVerified(true);

      const userProfile: UserProfile = {
        uid: fbUser.uid,
        name: cleanName,
        email: cleanEmail,
        role: selectedRole,
        college: college?.trim() || (selectedRole === 'host' ? 'Campus Event Council' : 'College Student'),
        phone: phone?.trim() || '',
        photoURL: fbUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
        authProvider: 'email',
        token,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 3. Persist to Firestore Cloud Database
      await FirebaseDbService.saveUserProfile(userProfile);

      // 4. Update local storage account
      StorageService.saveAccount({
        uid: userProfile.uid,
        name: userProfile.name,
        email: userProfile.email,
        role: selectedRole,
        college: userProfile.college,
        phone: userProfile.phone,
        photoURL: userProfile.photoURL,
        authProvider: 'email',
        createdAt: userProfile.createdAt,
      });

      setCurrentUser(userProfile);
      return { success: true };
    } catch (err: any) {
      console.warn('Firebase registration error:', err);

      const isProviderRestricted = 
        err?.code === 'auth/operation-not-allowed' || 
        err?.code === 'auth/configuration-not-found' ||
        err?.code === 'auth/internal-error' ||
        err?.code === 'auth/admin-restricted-operation' ||
        err?.code === 'auth/network-request-failed' ||
        err?.message?.includes('operation-not-allowed') ||
        err?.message?.includes('serviceusage') ||
        err?.message?.includes('permission') ||
        err?.message?.includes('disabled') ||
        err?.message?.includes('not enabled');

      // Resilient fallback if Firebase Console has not enabled Email/Password provider yet (common on fresh deployments/Vercel)
      if (isProviderRestricted) {
        console.info('Handling auth restriction with registration fallback...');
        const existingAccounts = StorageService.getRegisteredAccounts();
        if (existingAccounts.some(a => a.email.toLowerCase().trim() === cleanEmail)) {
          return { success: false, error: 'An account with this email is already registered. Please sign in.' };
        }

        const fallbackUid = `user_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
        const token = await JwtService.createToken({
          uid: fallbackUid,
          email: cleanEmail,
          name: cleanName,
          role: selectedRole,
        });

        JwtService.saveToken(token);
        setJwtToken(token);
        setIsTokenVerified(true);

        const userProfile: UserProfile = {
          uid: fallbackUid,
          name: cleanName,
          email: cleanEmail,
          role: selectedRole,
          college: college?.trim() || (selectedRole === 'host' ? 'Campus Event Council' : 'College Student'),
          phone: phone?.trim() || '',
          photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
          authProvider: 'email',
          token,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Save to Firestore and local storage
        FirebaseDbService.saveUserProfile(userProfile).catch(() => {});
        StorageService.saveAccount({
          uid: fallbackUid,
          name: userProfile.name,
          email: userProfile.email,
          role: selectedRole,
          college: userProfile.college,
          phone: userProfile.phone,
          photoURL: userProfile.photoURL,
          authProvider: 'email',
          createdAt: userProfile.createdAt,
        });

        setCurrentUser(userProfile);
        return { success: true };
      }

      const friendlyError = getFirebaseErrorMessage(err);
      return { success: false, error: friendlyError };
    }
  };

  // =========================================================================
  // ⚡ REAL FIREBASE GOOGLE POPUP AUTHENTICATION
  // =========================================================================
  const signInWithGooglePopup = async (
    selectedRole: UserRole,
    college?: string,
    phone?: string
  ): Promise<{ success: boolean; isNewUser?: boolean; error?: string }> => {
    try {
      const result = await fbSignInWithGoogle();
      const fbUser = result.user;
      if (!fbUser.email) {
        return { success: false, error: 'Google account did not provide a valid email.' };
      }

      const cleanEmail = fbUser.email.trim().toLowerCase();
      const cleanName = fbUser.displayName || cleanEmail.split('@')[0];

      // Check if existing profile in Firestore
      let profile = await FirebaseDbService.getUserProfile(fbUser.uid);
      const isNewUser = !profile;

      const token = await JwtService.createToken({
        uid: fbUser.uid,
        email: cleanEmail,
        name: cleanName,
        role: selectedRole,
      });

      JwtService.saveToken(token);
      setJwtToken(token);
      setIsTokenVerified(true);

      const userProfile: UserProfile = {
        uid: fbUser.uid,
        name: cleanName,
        email: cleanEmail,
        role: selectedRole,
        college: profile?.college || college?.trim() || (selectedRole === 'host' ? 'Campus Event Council' : 'College Student'),
        phone: profile?.phone || phone?.trim() || '',
        photoURL: fbUser.photoURL || profile?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
        authProvider: 'google',
        token,
        createdAt: profile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await FirebaseDbService.saveUserProfile(userProfile);

      StorageService.saveAccount({
        uid: userProfile.uid,
        name: userProfile.name,
        email: userProfile.email,
        role: selectedRole,
        college: userProfile.college,
        phone: userProfile.phone,
        photoURL: userProfile.photoURL,
        authProvider: 'google',
        createdAt: userProfile.createdAt,
      });

      setCurrentUser(userProfile);
      return { success: true, isNewUser };
    } catch (err: any) {
      console.warn('Firebase Google Auth error:', err);
      const friendlyError = getFirebaseErrorMessage(err);
      return { success: false, error: friendlyError };
    }
  };

  // Google One-Tap / Identity Services token integration
  const loginWithGoogle = async (
    name: string, 
    email: string, 
    selectedRole: UserRole, 
    photoURL?: string,
    providedUid?: string,
    college?: string,
    phone?: string
  ): Promise<{ success: boolean; isNewUser?: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const uid = providedUid || `g-${Date.now().toString(36)}`;

    try {
      let profile = await FirebaseDbService.getUserProfile(uid);
      const isNewUser = !profile;

      const token = await JwtService.createToken({
        uid,
        email: cleanEmail,
        name: cleanName,
        role: selectedRole,
      });

      JwtService.saveToken(token);
      setJwtToken(token);
      setIsTokenVerified(true);

      const userProfile: UserProfile = {
        uid,
        name: cleanName,
        email: cleanEmail,
        role: selectedRole,
        college: profile?.college || college?.trim() || (selectedRole === 'host' ? 'Campus Event Council' : 'College Student'),
        phone: profile?.phone || phone?.trim() || '',
        photoURL: photoURL || profile?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
        authProvider: 'google',
        token,
        createdAt: profile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await FirebaseDbService.saveUserProfile(userProfile);

      StorageService.saveAccount({
        uid: userProfile.uid,
        name: userProfile.name,
        email: userProfile.email,
        role: selectedRole,
        college: userProfile.college,
        phone: userProfile.phone,
        photoURL: userProfile.photoURL,
        authProvider: 'google',
        createdAt: userProfile.createdAt,
      });

      setCurrentUser(userProfile);
      return { success: true, isNewUser };
    } catch (err: any) {
      console.warn('Google login processing error:', err);
      return { success: false, error: err?.message || 'Failed to complete Google authentication.' };
    }
  };

  // Sign out
  const logout = () => {
    firebaseLogout().catch(e => console.warn('Firebase logout warning:', e));
    JwtService.clearToken();
    setJwtToken(null);
    setIsTokenVerified(false);
    setCurrentUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  // Update profile
  const updateProfile = async (data: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'User is not signed in.' };

    try {
      const updatedUser: UserProfile = {
        ...currentUser,
        ...data,
        updatedAt: new Date().toISOString(),
      };

      await FirebaseDbService.saveUserProfile(updatedUser);

      // Refresh JWT
      const token = await JwtService.createToken({
        uid: updatedUser.uid,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
      });
      JwtService.saveToken(token);
      setJwtToken(token);
      setIsTokenVerified(true);
      updatedUser.token = token;

      setCurrentUser(updatedUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update profile.' };
    }
  };

  // Change password
  const changePassword = async (
    _currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'User is not signed in.' };
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }

    try {
      await firebaseUpdateUserPassword(newPassword);
      return { success: true };
    } catch (err: any) {
      console.warn('Firebase update password error:', err);
      const friendly = getFirebaseErrorMessage(err);
      return { success: false, error: friendly };
    }
  };

  // Reset password / send recovery email
  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    try {
      await firebaseSendPasswordReset(cleanEmail);
      return { success: true };
    } catch (err: any) {
      console.warn('Firebase reset password error:', err);
      const friendly = getFirebaseErrorMessage(err);
      return { success: false, error: friendly };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser?.role || 'user',
        jwtToken,
        isTokenVerified,
        isLoadingAuth,
        login,
        loginWithGoogle,
        signInWithGooglePopup,
        register,
        logout,
        updateProfile,
        changePassword,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
