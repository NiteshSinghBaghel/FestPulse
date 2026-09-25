import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, RegisteredAccount } from '../types';
import { StorageService } from '../services/storageService';
import { JwtService } from '../services/jwtService';
import { FirebaseDbService } from '../services/firebaseDbService';
import { signInWithGooglePopup as fbSignInWithGoogle, firebaseLogout } from '../services/firebase';

interface AuthContextType {
  currentUser: UserProfile | null;
  role: UserRole;
  jwtToken: string | null;
  isTokenVerified: boolean;
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
  resetPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AUTH_STORAGE_KEY = 'campuspass_auth_user_v2';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    // Clear any obsolete v1 demo session
    if (localStorage.getItem('campuspass_auth_user_v1')) {
      localStorage.removeItem('campuspass_auth_user_v1');
    }
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [jwtToken, setJwtToken] = useState<string | null>(() => {
    return localStorage.getItem('campuspass_jwt_token');
  });

  const [isTokenVerified, setIsTokenVerified] = useState<boolean>(false);

  // Validate stored JWT on initial mount
  useEffect(() => {
    const verifyInitialSession = async () => {
      const stored = await JwtService.getVerifiedStoredToken();
      if (stored) {
        setJwtToken(stored.token);
        setIsTokenVerified(true);
        // Ensure currentUser is updated with token
        if (currentUser && !currentUser.token) {
          const updated = { ...currentUser, token: stored.token };
          setCurrentUser(updated);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
        }
      } else if (currentUser) {
        // If JWT token is missing or expired, generate a fresh valid token for current session
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
      } else {
        setIsTokenVerified(false);
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

  // Secure Email & Password Login with Cryptographic Salted Hash & JWT Issuance
  const login = async (email: string, password: string, selectedRole: UserRole): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const account = StorageService.findAccountByEmail(cleanEmail);

    if (!account) {
      return {
        success: false,
        error: 'No account found with this email. Please switch to "Create Account" tab to register.'
      };
    }

    // Cryptographic Password Verification
    const isPasswordValid = await JwtService.verifyPassword(
      password,
      account.passwordHash,
      account.salt,
      account.password
    );

    if (!isPasswordValid) {
      return {
        success: false,
        error: 'Incorrect password. Cryptographic validation failed.'
      };
    }

    // Auto-upgrade legacy account to salted SHA-256 hash if it didn't have one
    if (!account.passwordHash || !account.salt) {
      const { hash, salt } = await JwtService.hashPassword(password);
      account.passwordHash = hash;
      account.salt = salt;
      delete account.password; // Remove plaintext password
    }

    // Issue Cryptographically Signed HMAC-SHA256 JWT Token
    const token = await JwtService.createToken({
      uid: account.uid,
      email: account.email,
      name: account.name,
      role: selectedRole,
    });

    JwtService.saveToken(token);
    setJwtToken(token);
    setIsTokenVerified(true);

    // Role is strictly locked to what was chosen at login
    const updatedUser: UserProfile = {
      uid: account.uid,
      name: account.name,
      email: account.email,
      role: selectedRole,
      college: account.college || (selectedRole === 'host' ? 'Campus Event Council' : 'College Student'),
      phone: account.phone || '',
      photoURL: account.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(account.name)}`,
      authProvider: account.authProvider || 'email',
      token,
      createdAt: account.createdAt,
      updatedAt: new Date().toISOString(),
    };

    // Update account with latest role and hash in storage
    StorageService.saveAccount({
      ...account,
      role: selectedRole,
    });

    setCurrentUser(updatedUser);
    return { success: true };
  };

  // Secure Email & Password Registration with Cryptographic Salted Hash & JWT
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
      return { success: false, error: 'Full name is required.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Valid email address is required.' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }

    const existing = StorageService.findAccountByEmail(cleanEmail);
    if (existing) {
      return { 
        success: false, 
        error: 'An account with this email already exists. Please sign in instead.' 
      };
    }

    // Cryptographic Password Hashing with Salt
    const { hash, salt } = await JwtService.hashPassword(password);

    const uid = selectedRole === 'host' ? `host-${Date.now().toString(36)}` : `usr-${Date.now().toString(36)}`;
    const newAccount: RegisteredAccount = {
      uid,
      name: cleanName,
      email: cleanEmail,
      passwordHash: hash,
      salt,
      role: selectedRole,
      college: college?.trim() || (selectedRole === 'host' ? 'Campus Event Committee' : 'College Student'),
      phone: phone?.trim() || '',
      photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
      authProvider: 'email',
      createdAt: new Date().toISOString(),
    };

    StorageService.saveAccount(newAccount);

    // Issue Cryptographically Signed HMAC-SHA256 JWT Token
    const token = await JwtService.createToken({
      uid: newAccount.uid,
      email: newAccount.email,
      name: newAccount.name,
      role: selectedRole,
    });

    JwtService.saveToken(token);
    setJwtToken(token);
    setIsTokenVerified(true);

    const userProfile: UserProfile = {
      uid: newAccount.uid,
      name: newAccount.name,
      email: newAccount.email,
      role: selectedRole,
      college: newAccount.college,
      phone: newAccount.phone,
      photoURL: newAccount.photoURL,
      authProvider: 'email',
      token,
      createdAt: newAccount.createdAt,
      updatedAt: new Date().toISOString(),
    };

    setCurrentUser(userProfile);
    return { success: true };
  };

  // Google Sign-In & Registration with Real Firebase & Cryptographic JWT Issuance
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

    let account = StorageService.findAccountByEmail(cleanEmail);
    const isNewUser = !account;

    if (!account) {
      const uid = providedUid || (selectedRole === 'host' ? `host-g-${Date.now().toString(36)}` : `usr-g-${Date.now().toString(36)}`);
      account = {
        uid,
        name: cleanName || (selectedRole === 'host' ? 'Campus Event Host' : 'Campus Student'),
        email: cleanEmail,
        role: selectedRole,
        college: college?.trim() || (selectedRole === 'host' ? 'Campus Event Council' : 'College Student'),
        phone: phone?.trim() || '',
        photoURL: photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
        authProvider: 'google',
        createdAt: new Date().toISOString(),
      };
      StorageService.saveAccount(account);
      // Persist to Cloud Firestore accounts collection
      FirebaseDbService.saveAccount(account).catch(err => {
        console.warn('Firestore user account cloud backup notice:', err);
      });
    } else {
      account = {
        ...account,
        role: selectedRole,
        name: cleanName || account.name,
        photoURL: photoURL || account.photoURL,
        college: college?.trim() || account.college,
        phone: phone?.trim() || account.phone,
        authProvider: 'google',
      };
      StorageService.saveAccount(account);
      FirebaseDbService.saveAccount(account).catch(err => {
        console.warn('Firestore user account cloud update notice:', err);
      });
    }

    // Issue Signed HMAC-SHA256 JWT Token
    const token = await JwtService.createToken({
      uid: account.uid,
      email: account.email,
      name: account.name,
      role: selectedRole,
    });

    JwtService.saveToken(token);
    setJwtToken(token);
    setIsTokenVerified(true);

    const userProfile: UserProfile = {
      uid: account.uid,
      name: account.name,
      email: account.email,
      role: selectedRole,
      college: account.college || (selectedRole === 'host' ? 'Campus Event Council' : 'College Student'),
      phone: account.phone || '',
      photoURL: account.photoURL || photoURL,
      authProvider: 'google',
      token,
      createdAt: account.createdAt,
      updatedAt: new Date().toISOString(),
    };

    setCurrentUser(userProfile);
    return { success: true, isNewUser };
  };

  // Real Google Sign-in Popup via Firebase Authentication
  const signInWithGooglePopup = async (
    selectedRole: UserRole,
    college?: string,
    phone?: string
  ): Promise<{ success: boolean; isNewUser?: boolean; error?: string }> => {
    try {
      const result = await fbSignInWithGoogle();
      const gUser = result.user;
      if (!gUser.email) {
        return { success: false, error: 'Google account did not return a valid email address.' };
      }
      return await loginWithGoogle(
        gUser.displayName || gUser.email.split('@')[0],
        gUser.email,
        selectedRole,
        gUser.photoURL || undefined,
        gUser.uid,
        college,
        phone
      );
    } catch (err: any) {
      console.warn('Firebase signInWithGooglePopup error:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        return { success: false, error: 'Google sign-in popup was closed before completing.' };
      }
      if (err?.code === 'auth/popup-blocked') {
        return { success: false, error: 'Popup blocked by browser. Please allow popups or use Google One-Tap.' };
      }
      if (err?.code === 'auth/unauthorized-domain') {
        return { 
          success: false, 
          error: `unauthorized-domain: ${window.location.hostname} is not yet added in Firebase Authorized Domains.` 
        };
      }
      return { success: false, error: err?.message || 'Google authentication failed' };
    }
  };

  const logout = () => {
    firebaseLogout().catch(e => console.warn('Firebase logout notice:', e));
    JwtService.clearToken();
    setJwtToken(null);
    setIsTokenVerified(false);
    setCurrentUser(null);
  };

  const updateProfile = async (data: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'User is not logged in.' };

    const oldEmail = currentUser.email.toLowerCase().trim();
    const newEmail = data.email ? data.email.toLowerCase().trim() : oldEmail;

    if (newEmail !== oldEmail) {
      if (!newEmail.includes('@')) {
        return { success: false, error: 'Please enter a valid email address.' };
      }
      const existing = StorageService.findAccountByEmail(newEmail);
      if (existing && existing.uid !== currentUser.uid) {
        return { success: false, error: 'This email is already associated with another account.' };
      }
    }

    // Update in accounts database
    const accounts = StorageService.getRegisteredAccounts();
    const accountIdx = accounts.findIndex(a => a.email.toLowerCase().trim() === oldEmail || a.uid === currentUser.uid);

    let updatedAccount: RegisteredAccount | null = null;
    if (accountIdx >= 0) {
      updatedAccount = {
        ...accounts[accountIdx],
        name: data.name !== undefined ? data.name : accounts[accountIdx].name,
        email: newEmail,
        college: data.college !== undefined ? data.college : accounts[accountIdx].college,
        phone: data.phone !== undefined ? data.phone : accounts[accountIdx].phone,
        photoURL: data.photoURL !== undefined ? data.photoURL : accounts[accountIdx].photoURL,
      };
      accounts[accountIdx] = updatedAccount;
      StorageService.saveRegisteredAccounts(accounts);
      StorageService.saveAccount(updatedAccount);
    }

    // Refresh JWT session token with updated claims
    const token = await JwtService.createToken({
      uid: currentUser.uid,
      email: newEmail,
      name: data.name || currentUser.name,
      role: currentUser.role,
    });
    JwtService.saveToken(token);
    setJwtToken(token);
    setIsTokenVerified(true);

    const updatedUser: UserProfile = {
      ...currentUser,
      ...data,
      email: newEmail,
      token,
      updatedAt: new Date().toISOString(),
    };

    setCurrentUser(updatedUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));

    return { success: true };
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'You must be logged in to change your password.' };
    }
    if (!newPassword || newPassword.trim().length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }

    const cleanEmail = currentUser.email.toLowerCase().trim();
    let account = StorageService.findAccountByEmail(cleanEmail);

    if (!account) {
      account = {
        uid: currentUser.uid,
        name: currentUser.name,
        email: cleanEmail,
        role: currentUser.role,
        authProvider: currentUser.authProvider || 'email',
        createdAt: currentUser.createdAt || new Date().toISOString(),
      };
    }

    // Verify current password if account already had a password set
    if (account.password || account.passwordHash) {
      const isCurrentValid = await JwtService.verifyPassword(
        currentPassword,
        account.passwordHash,
        account.salt,
        account.password
      );
      if (!isCurrentValid) {
        return { success: false, error: 'Current password is incorrect. Please verify and try again.' };
      }
    }

    // Compute cryptographic salted SHA-256 hash
    const { hash, salt } = await JwtService.hashPassword(newPassword.trim());
    account.passwordHash = hash;
    account.salt = salt;
    delete account.password; // Remove legacy plaintext password

    StorageService.saveAccount(account);

    // Refresh JWT session token
    const token = await JwtService.createToken({
      uid: account.uid,
      email: account.email,
      name: account.name,
      role: currentUser.role,
    });
    JwtService.saveToken(token);
    setJwtToken(token);
    setIsTokenVerified(true);

    return { success: true };
  };

  const resetPassword = async (
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'You must be logged in to reset your password.' };
    }
    if (!newPassword || newPassword.trim().length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }

    const cleanEmail = currentUser.email.toLowerCase().trim();
    let account = StorageService.findAccountByEmail(cleanEmail);

    if (!account) {
      account = {
        uid: currentUser.uid,
        name: currentUser.name,
        email: cleanEmail,
        role: currentUser.role,
        authProvider: currentUser.authProvider || 'email',
        createdAt: currentUser.createdAt || new Date().toISOString(),
      };
    }

    // Compute cryptographic salted SHA-256 hash
    const { hash, salt } = await JwtService.hashPassword(newPassword.trim());
    account.passwordHash = hash;
    account.salt = salt;
    delete account.password;

    StorageService.saveAccount(account);

    // Refresh JWT session token
    const token = await JwtService.createToken({
      uid: account.uid,
      email: account.email,
      name: account.name,
      role: currentUser.role,
    });
    JwtService.saveToken(token);
    setJwtToken(token);
    setIsTokenVerified(true);

    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser?.role || 'user',
        jwtToken,
        isTokenVerified,
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
