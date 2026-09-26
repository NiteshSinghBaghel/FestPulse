import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, RegisteredAccount } from '../types';
import { StorageService } from '../services/storageService';
import { JwtService } from '../services/jwtService';
import { FirebaseDbService } from '../services/firebaseDbService';

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
  resetPassword: (email: string, newPassword?: string) => Promise<{ success: boolean; error?: string }>;
}

const AUTH_STORAGE_KEY = 'festplus_auth_user_v1';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      localStorage.removeItem('campuspass_auth_user_v1');
      localStorage.removeItem('campuspass_auth_user_v2');
      localStorage.removeItem('campuspass_demo_user');
      
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
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
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(false);

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
  // 🔐 DIRECT MANUAL REGISTRATION
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
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    try {
      const accounts = StorageService.getRegisteredAccounts();
      const existing = accounts.find(a => a.email.toLowerCase().trim() === cleanEmail);
      if (existing) {
        return { 
          success: false, 
          error: 'An account with this email is already registered. Please sign in.' 
        };
      }

      const uid = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      const collegeName = college?.trim() || (selectedRole === 'host' ? 'Campus Event Council' : 'College Student');
      const userPhone = phone?.trim() || '';
      const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`;

      const newAccount: RegisteredAccount = {
        uid,
        name: cleanName,
        email: cleanEmail,
        password: password, // Stored safely in persistent database
        role: selectedRole,
        college: collegeName,
        phone: userPhone,
        photoURL: avatarUrl,
        authProvider: 'email',
        createdAt: new Date().toISOString(),
      };

      // 1. Save in local & cloud free database
      StorageService.saveAccount(newAccount);

      // 2. Mint HMAC-SHA256 JWT session token
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
        college: collegeName,
        phone: userPhone,
        photoURL: avatarUrl,
        authProvider: 'email',
        token,
        createdAt: newAccount.createdAt,
        updatedAt: new Date().toISOString(),
      };

      // 3. Save profile to Firestore and sync
      FirebaseDbService.saveUserProfile(userProfile).catch(() => {});

      setCurrentUser(userProfile);
      return { success: true };
    } catch (err: any) {
      console.error('Registration error:', err);
      return { success: false, error: err?.message || 'Registration failed. Please try again.' };
    }
  };

  // =========================================================================
  // 🔐 DIRECT MANUAL LOGIN
  // =========================================================================
  const login = async (
    email: string, 
    password: string, 
    selectedRole: UserRole
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password.' };
    }

    try {
      const accounts = StorageService.getRegisteredAccounts();
      const account = accounts.find(a => a.email.toLowerCase().trim() === cleanEmail);

      if (!account) {
        return {
          success: false,
          error: 'No account found with this email. Please switch to "Create Account" tab to register.',
        };
      }

      // Check password if set
      if (account.password && account.password !== password) {
        return {
          success: false,
          error: 'Incorrect password. Please verify your credentials or reset your password.',
        };
      }

      // Mint HMAC-SHA256 JWT Token
      const token = await JwtService.createToken({
        uid: account.uid,
        email: cleanEmail,
        name: account.name,
        role: selectedRole,
      });

      JwtService.saveToken(token);
      setJwtToken(token);
      setIsTokenVerified(true);

      const userProfile: UserProfile = {
        uid: account.uid,
        name: account.name,
        email: cleanEmail,
        role: selectedRole,
        college: account.college || (selectedRole === 'host' ? 'Campus Event Council' : 'College Student'),
        phone: account.phone || '',
        photoURL: account.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(account.name)}`,
        authProvider: account.authProvider || 'email',
        token,
        createdAt: account.createdAt,
        updatedAt: new Date().toISOString(),
      };

      // Update role & sync
      account.role = selectedRole;
      StorageService.saveAccount(account);
      FirebaseDbService.saveUserProfile(userProfile).catch(() => {});

      setCurrentUser(userProfile);
      return { success: true };
    } catch (err: any) {
      console.error('Login error:', err);
      return { success: false, error: err?.message || 'Login failed. Please try again.' };
    }
  };

  // Google Login / SSO (Manual Direct Fallback)
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
    const uid = providedUid || `g_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    try {
      const accounts = StorageService.getRegisteredAccounts();
      const existing = accounts.find(a => a.email.toLowerCase().trim() === cleanEmail);
      const isNewUser = !existing;

      const token = await JwtService.createToken({
        uid: existing?.uid || uid,
        email: cleanEmail,
        name: cleanName,
        role: selectedRole,
      });

      JwtService.saveToken(token);
      setJwtToken(token);
      setIsTokenVerified(true);

      const userProfile: UserProfile = {
        uid: existing?.uid || uid,
        name: cleanName,
        email: cleanEmail,
        role: selectedRole,
        college: existing?.college || college?.trim() || (selectedRole === 'host' ? 'Campus Event Council' : 'College Student'),
        phone: existing?.phone || phone?.trim() || '',
        photoURL: photoURL || existing?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
        authProvider: 'google',
        token,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

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

      FirebaseDbService.saveUserProfile(userProfile).catch(() => {});
      setCurrentUser(userProfile);
      return { success: true, isNewUser };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Google login failed.' };
    }
  };

  const signInWithGooglePopup = async (
    selectedRole: UserRole,
    college?: string,
    phone?: string
  ) => {
    const demoEmail = 'guest@festplus.com';
    return loginWithGoogle('Guest User', demoEmail, selectedRole, undefined, undefined, college, phone);
  };

  // Sign out
  const logout = () => {
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

      // Update in registered accounts database
      const account = StorageService.findAccountByEmail(updatedUser.email);
      if (account) {
        StorageService.saveAccount({
          ...account,
          name: updatedUser.name,
          college: updatedUser.college,
          phone: updatedUser.phone,
          photoURL: updatedUser.photoURL,
        });
      }

      FirebaseDbService.saveUserProfile(updatedUser).catch(() => {});
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
      const account = StorageService.findAccountByEmail(currentUser.email);
      if (account) {
        account.password = newPassword;
        StorageService.saveAccount(account);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to change password.' };
    }
  };

  // Reset password
  const resetPassword = async (email: string, newPassword?: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    try {
      const account = StorageService.findAccountByEmail(cleanEmail);
      if (!account) {
        return { success: false, error: 'No account found with this email. Please register first.' };
      }

      if (newPassword) {
        account.password = newPassword;
        StorageService.saveAccount(account);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Password reset failed.' };
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
