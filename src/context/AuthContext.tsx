import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, RegisteredAccount } from '../types';
import { StorageService } from '../services/storageService';

interface AuthContextType {
  currentUser: UserProfile | null;
  role: UserRole;
  login: (email: string, password: string, role: UserRole) => { success: boolean; error?: string };
  register: (name: string, email: string, password: string, role: UserRole, college?: string, phone?: string) => { success: boolean; error?: string };
  loginWithGoogle: (name: string, email: string, role: UserRole, photoURL?: string) => { success: boolean; error?: string };
  logout: () => void;
  updateProfile: (data: Partial<UserProfile>) => void;
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

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [currentUser]);

  // Email & Password Login: Role is determined at login time!
  const login = (email: string, password: string, selectedRole: UserRole): { success: boolean; error?: string } => {
    const cleanEmail = email.trim().toLowerCase();
    const account = StorageService.findAccountByEmail(cleanEmail);

    if (!account) {
      return {
        success: false,
        error: 'No account found with this email. Please switch to "Create Account" tab to register.'
      };
    }

    if (account.password && account.password !== password) {
      return {
        success: false,
        error: 'Incorrect password. Please verify and try again.'
      };
    }

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
      createdAt: account.createdAt,
      updatedAt: new Date().toISOString(),
    };

    // Update account with latest role choice
    StorageService.saveAccount({
      ...account,
      role: selectedRole,
    });

    setCurrentUser(updatedUser);
    return { success: true };
  };

  // Email & Password Registration
  const register = (
    name: string, 
    email: string, 
    password: string, 
    selectedRole: UserRole, 
    college?: string, 
    phone?: string
  ): { success: boolean; error?: string } => {
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

    const uid = selectedRole === 'host' ? `host-${Date.now().toString(36)}` : `usr-${Date.now().toString(36)}`;
    const newAccount: RegisteredAccount = {
      uid,
      name: cleanName,
      email: cleanEmail,
      password,
      role: selectedRole,
      college: college?.trim() || (selectedRole === 'host' ? 'Campus Event Committee' : 'College Student'),
      phone: phone?.trim() || '',
      photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
      authProvider: 'email',
      createdAt: new Date().toISOString(),
    };

    StorageService.saveAccount(newAccount);

    const userProfile: UserProfile = {
      uid: newAccount.uid,
      name: newAccount.name,
      email: newAccount.email,
      role: selectedRole,
      college: newAccount.college,
      phone: newAccount.phone,
      photoURL: newAccount.photoURL,
      authProvider: 'email',
      createdAt: newAccount.createdAt,
      updatedAt: new Date().toISOString(),
    };

    setCurrentUser(userProfile);
    return { success: true };
  };

  // Google Sign-In with specified role
  const loginWithGoogle = (
    name: string, 
    email: string, 
    selectedRole: UserRole, 
    photoURL?: string
  ): { success: boolean; error?: string } => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    let account = StorageService.findAccountByEmail(cleanEmail);

    if (!account) {
      const uid = selectedRole === 'host' ? `host-g-${Date.now().toString(36)}` : `usr-g-${Date.now().toString(36)}`;
      account = {
        uid,
        name: cleanName || (selectedRole === 'host' ? 'Event Organizer' : 'Campus Student'),
        email: cleanEmail,
        role: selectedRole,
        college: selectedRole === 'host' ? 'University Organizing Body' : 'Campus University',
        photoURL: photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`,
        authProvider: 'google',
        createdAt: new Date().toISOString(),
      };
      StorageService.saveAccount(account);
    } else {
      account.role = selectedRole;
      StorageService.saveAccount(account);
    }

    const userProfile: UserProfile = {
      uid: account.uid,
      name: account.name,
      email: account.email,
      role: selectedRole,
      college: account.college || 'Campus University',
      phone: account.phone || '',
      photoURL: account.photoURL || photoURL,
      authProvider: 'google',
      createdAt: account.createdAt,
      updatedAt: new Date().toISOString(),
    };

    setCurrentUser(userProfile);
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const updateProfile = (data: Partial<UserProfile>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...data, updatedAt: new Date().toISOString() };
    setCurrentUser(updated);

    // Also update in accounts store
    const account = StorageService.findAccountByEmail(currentUser.email);
    if (account) {
      StorageService.saveAccount({
        ...account,
        name: data.name ?? account.name,
        college: data.college ?? account.college,
        phone: data.phone ?? account.phone,
        photoURL: data.photoURL ?? account.photoURL,
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser?.role || 'user',
        login,
        loginWithGoogle,
        register,
        logout,
        updateProfile,
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
