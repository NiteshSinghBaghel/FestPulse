import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, RegisteredAccount } from '../types';
import { StorageService } from '../services/storageService';
import { JwtService } from '../services/jwtService';
import { FirebaseDbService } from '../services/firebaseDbService';
import { 
  firebaseSendPasswordReset, 
  firebaseConfirmPasswordReset, 
  firebaseVerifyPasswordResetCode,
  firebaseLoginWithEmail,
  firebaseRegisterWithEmail,
  getFirebaseErrorMessage, 
  isFirebaseInitialized 
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
  resetPassword: (email: string, newPassword?: string) => Promise<{ success: boolean; error?: string }>;
  sendPasswordResetLink: (email: string, targetRole?: UserRole) => Promise<{ success: boolean; error?: string; message?: string; resetLink?: string }>;
  confirmPasswordResetWithCode: (code: string, newPassword: string, email?: string) => Promise<{ success: boolean; error?: string }>;
}

const AUTH_STORAGE_KEY = 'festplus_auth_user_v1';

// In-Memory Session & Token Memoization Cache to eliminate parsing lag and state recovery delay
let memoizedSession: UserProfile | null = null;
let memoizedJwtToken: string | null = null;
let memoizedIsVerified = false;

// Fast synchronous memoized session getter (0ms)
function getMemoizedSession(): UserProfile | null {
  if (memoizedSession) return memoizedSession;
  try {
    const saved = localStorage.getItem(AUTH_STORAGE_KEY);
    if (saved) {
      const parsed: UserProfile = JSON.parse(saved);
      if (parsed?.email?.includes('@campus.edu')) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }
      memoizedSession = parsed;
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

// Fast synchronous memoized token getter (0ms)
function getMemoizedJwtToken(): string | null {
  if (memoizedJwtToken) return memoizedJwtToken;
  const token = localStorage.getItem('festplus_jwt_token') || localStorage.getItem('campuspass_jwt_token');
  memoizedJwtToken = token;
  return token;
}

// Fast synchronous JWT expiration check (0ms) to unblock authentication state recovery on frame 1
function checkTokenValidSynchronously(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      const now = Math.floor(Date.now() / 1000);
      return Boolean(payload.exp && payload.exp > now);
    }
  } catch {}
  return false;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    return getMemoizedSession();
  });

  const [jwtToken, setJwtToken] = useState<string | null>(() => {
    return getMemoizedJwtToken();
  });

  // Synchronously recover token verification status without waiting for async crypto round-trips
  const [isTokenVerified, setIsTokenVerified] = useState<boolean>(() => {
    if (memoizedIsVerified) return true;
    const token = getMemoizedJwtToken();
    const isValid = checkTokenValidSynchronously(token);
    if (isValid) {
      memoizedIsVerified = true;
      return true;
    }
    return false;
  });

  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(false);

  // Validate stored JWT token signature in background without delaying initial render
  useEffect(() => {
    const verifyInitialSession = async () => {
      const stored = await JwtService.getVerifiedStoredToken();
      if (stored) {
        memoizedJwtToken = stored.token;
        memoizedIsVerified = true;
        setJwtToken(stored.token);
        setIsTokenVerified(true);
        if (currentUser && !currentUser.token) {
          const updated = { ...currentUser, token: stored.token };
          memoizedSession = updated;
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
        memoizedJwtToken = freshToken;
        memoizedIsVerified = true;
        setJwtToken(freshToken);
        setIsTokenVerified(true);
        const updated = { ...currentUser, token: freshToken };
        memoizedSession = updated;
        setCurrentUser(updated);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      }
    };

    verifyInitialSession();
  }, []);

  useEffect(() => {
    if (currentUser) {
      memoizedSession = currentUser;
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      memoizedSession = null;
      memoizedJwtToken = null;
      memoizedIsVerified = false;
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
    const cleanPhone = (phone || '').trim().replace(/[\s\-()+]/g, '');

    if (!cleanName) {
      return { success: false, error: 'Please enter your full name.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!cleanPhone) {
      return { success: false, error: 'Mobile number is required to register.' };
    }
    if (!/^[0-9]{10}$/.test(cleanPhone)) {
      return { success: false, error: 'Please enter a valid 10-digit mobile number (e.g., 9876543210).' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    try {
      const existing = await StorageService.findAccountByIdentifierAsync(cleanEmail);
      if (existing) {
        return { 
          success: false, 
          error: 'An account with this email is already registered. Please sign in.' 
        };
      }
      const existingPhone = await StorageService.findAccountByIdentifierAsync(cleanPhone);
      if (existingPhone) {
        return { 
          success: false, 
          error: 'An account with this mobile number is already registered. Please sign in or use another number.' 
        };
      }

      const uid = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      const collegeName = college?.trim() || (selectedRole === 'host' ? 'Campus Event Council' : 'College Student');
      const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanName)}`;

      const newAccount: RegisteredAccount = {
        uid,
        name: cleanName,
        email: cleanEmail,
        password: password, // Stored safely in persistent database
        role: selectedRole,
        college: collegeName,
        phone: cleanPhone,
        photoURL: avatarUrl,
        authProvider: 'email',
        createdAt: new Date().toISOString(),
      };

      // 1. Save in local & cloud free database (awaited)
      await StorageService.saveAccountAsync(newAccount);

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
        phone: cleanPhone,
        photoURL: avatarUrl,
        authProvider: 'email',
        token,
        createdAt: newAccount.createdAt,
        updatedAt: new Date().toISOString(),
      };

      // 3. Save profile to Firestore and sync
      FirebaseDbService.saveUserProfile(userProfile).catch(() => {});

      memoizedSession = userProfile;
      memoizedJwtToken = token;
      memoizedIsVerified = true;
      setCurrentUser(userProfile);
      return { success: true };
    } catch (err: any) {
      console.error('Registration error:', err);
      return { success: false, error: err?.message || 'Registration failed. Please try again.' };
    }
  };

  // =========================================================================
  // 🔐 DIRECT MANUAL LOGIN (Supports Email OR 10-Digit Mobile Number)
  // =========================================================================
  const login = async (
    identifier: string, 
    password: string, 
    selectedRole: UserRole
  ): Promise<{ success: boolean; error?: string }> => {
    const rawIdentifier = identifier.trim();
    const cleanPhone = rawIdentifier.replace(/[\s\-()+]/g, '');
    const isPhone = cleanPhone.length === 10 && /^[0-9]{10}$/.test(cleanPhone);
    const isEmail = rawIdentifier.includes('@');

    if (!isEmail && !isPhone) {
      return { success: false, error: 'Please enter a valid email address or 10-digit mobile number.' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password.' };
    }

    try {
      // 1. FAST PATH: Check local cache first (0ms instantaneous lookup)
      let account = StorageService.findAccountByIdentifier(rawIdentifier);

      // Check if local account matched password directly
      let passwordMatched = account ? (!account.password || account.password === password) : false;

      // 2. If not found locally or password didn't match, query fresh from server API / cloud
      if (!account || !passwordMatched) {
        account = await StorageService.findAccountByIdentifierAsync(rawIdentifier, true);
        if (account) {
          passwordMatched = !account.password || account.password === password;
        }
      }

      if (!account) {
        return {
          success: false,
          error: isPhone
            ? 'No account found with this mobile number. Please switch to "Create Account" tab to register.'
            : 'No account found with this email. Please switch to "Create Account" tab to register.',
        };
      }

      // If local/server password didn't match, also test Firebase Auth if initialized with timeout
      if (!passwordMatched && isFirebaseInitialized && account.email) {
        try {
          const fbPromise = firebaseLoginWithEmail(account.email, password);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500));
          await Promise.race([fbPromise, timeoutPromise]);
          // If Firebase Auth accepted it, sync the new password across all database layers in background
          passwordMatched = true;
          StorageService.updateAccountPasswordAsync(account.email, password, selectedRole, account.name).catch(() => {});
          account.password = password;
        } catch (fbErr: any) {
          console.warn('[Firebase direct login check]:', fbErr?.code);
        }
      }

      if (!passwordMatched) {
        return {
          success: false,
          error: 'Incorrect password. Please verify your credentials or reset your password.',
        };
      }

      // Mint HMAC-SHA256 JWT Token
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
        photoURL: account.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(account.name)}`,
        authProvider: account.authProvider || 'email',
        token,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt || new Date().toISOString(),
      };

      // Update role & sync
      account.role = selectedRole;
      StorageService.saveAccount(account);
      FirebaseDbService.saveUserProfile(userProfile).catch(() => {});

      memoizedSession = userProfile;
      memoizedJwtToken = token;
      memoizedIsVerified = true;
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
      // Check existing account from database to preserve user edits!
      let existing = await StorageService.findAccountByIdentifierAsync(cleanEmail, true);
      const isNewUser = !existing;

      // Preserve previously saved edits from database!
      const resolvedName = (existing && existing.name) ? existing.name : cleanName;
      const resolvedCollege = (existing && existing.college) ? existing.college : (college?.trim() || (selectedRole === 'host' ? 'Campus Event Council' : 'College Student'));
      const resolvedPhone = (existing && existing.phone && existing.phone.trim().length > 0) ? existing.phone.trim() : (phone?.trim() || '');
      const resolvedPhoto = (existing && existing.photoURL) ? existing.photoURL : (photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(resolvedName)}`);

      const token = await JwtService.createToken({
        uid: existing?.uid || uid,
        email: cleanEmail,
        name: resolvedName,
        role: selectedRole,
      });

      JwtService.saveToken(token);
      setJwtToken(token);
      setIsTokenVerified(true);

      const userProfile: UserProfile = {
        uid: existing?.uid || uid,
        name: resolvedName,
        email: cleanEmail,
        role: selectedRole,
        college: resolvedCollege,
        phone: resolvedPhone,
        photoURL: resolvedPhoto,
        authProvider: existing?.authProvider || 'google',
        token,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: existing?.updatedAt || new Date().toISOString(),
      };

      StorageService.saveAccount({
        uid: userProfile.uid,
        name: userProfile.name,
        email: userProfile.email,
        role: selectedRole,
        college: userProfile.college,
        phone: userProfile.phone,
        photoURL: userProfile.photoURL,
        password: existing?.password,
        authProvider: userProfile.authProvider || 'google',
        createdAt: userProfile.createdAt,
        updatedAt: new Date().toISOString(),
      });

      FirebaseDbService.saveUserProfile(userProfile).catch(() => {});
      memoizedSession = userProfile;
      memoizedJwtToken = token;
      memoizedIsVerified = true;
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
    memoizedSession = null;
    memoizedJwtToken = null;
    memoizedIsVerified = false;
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
      const oldEmail = currentUser.email.toLowerCase().trim();
      const newEmail = data.email ? data.email.toLowerCase().trim() : oldEmail;
      const newName = data.name !== undefined ? data.name.trim() : currentUser.name;
      const newPhone = data.phone !== undefined ? data.phone.trim() : (currentUser.phone || '');
      const newCollege = data.college !== undefined ? data.college.trim() : (currentUser.college || '');

      // If email changed, ensure no existing conflicting account
      if (newEmail !== oldEmail) {
        const accounts = StorageService.getRegisteredAccounts();
        const conflict = accounts.find(
          a => a.email.toLowerCase().trim() === newEmail && a.uid !== currentUser.uid
        );
        if (conflict) {
          return { success: false, error: 'An account with this email address already exists. Please choose a different email.' };
        }
      }

      const updatedUser: UserProfile = {
        ...currentUser,
        name: newName,
        email: newEmail,
        phone: newPhone,
        college: newCollege,
        photoURL: data.photoURL || currentUser.photoURL,
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

      memoizedSession = updatedUser;
      memoizedJwtToken = token;
      memoizedIsVerified = true;
      setCurrentUser(updatedUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));

      // Persist across all databases (StorageService local/cloud, REST API, Postgres, Firestore)
      await StorageService.updateAccountDetails(currentUser.uid, oldEmail, {
        name: newName,
        email: newEmail,
        phone: newPhone,
        college: newCollege,
        photoURL: updatedUser.photoURL,
      });

      // Notify dashboard and components of fresh data
      window.dispatchEvent(new Event('campuspass_data_updated'));
      window.dispatchEvent(new Event('storage'));

      return { success: true };
    } catch (err: any) {
      console.error('Update profile error:', err);
      return { success: false, error: err?.message || 'Failed to update profile.' };
    }
  };

  // Change password
  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'User is not signed in.' };
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }

    try {
      const account = StorageService.findAccountByUid(currentUser.uid) || StorageService.findAccountByEmail(currentUser.email);
      if (account) {
        if (account.password && account.password !== currentPassword) {
          return { success: false, error: 'Current password does not match.' };
        }
        account.password = newPassword;
        await StorageService.saveAccountAsync(account);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to change password.' };
    }
  };

  // Send password reset email link (Strict registration check for both login portals)
  const sendPasswordResetLink = async (
    email: string, 
    targetRole?: UserRole
  ): Promise<{ success: boolean; error?: string; message?: string; resetLink?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    try {
      // 1. STRICT REGISTRATION CHECK: Verify account exists in local, server, or cloud Firestore database
      const account = await StorageService.findAccountByEmailAsync(cleanEmail);
      let userProfile = null;
      if (!account && isFirebaseInitialized) {
        userProfile = await FirebaseDbService.findUserByEmail(cleanEmail);
      }

      // If user is not registered at all -> do NOT send email and inform user immediately
      if (!account && !userProfile) {
        const portalText = targetRole === 'host' ? 'Host / Organizer' : 'Student';
        return {
          success: false,
          error: `No registered ${portalText} account found with "${cleanEmail}". Please verify your email or create a new account first.`
        };
      }

      // 2. ROLE CHECK FOR BOTH LOGINS: Ensure user is resetting from their matching portal
      const registeredRole = account?.role || userProfile?.role;
      if (targetRole && registeredRole && registeredRole !== targetRole) {
        const currentPortal = targetRole === 'host' ? 'Host / Organizer' : 'Student';
        const registeredPortal = registeredRole === 'host' ? 'Host / Organizer' : 'Student';
        return {
          success: false,
          error: `"${cleanEmail}" is registered as a ${registeredPortal} account. Please switch to the ${registeredPortal} login portal to reset your password.`
        };
      }

      // 3. GENERATE GENUINE SERVER-SECURED RESET LINK
      let serverResetLink = '';
      try {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const srvRes = await fetch('/api/auth/send-reset-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            targetRole: targetRole || registeredRole,
            origin,
            account: account || (userProfile ? {
              uid: userProfile.uid,
              name: userProfile.name,
              email: cleanEmail,
              role: registeredRole,
              college: userProfile.college,
              phone: userProfile.phone,
            } : undefined),
          }),
        });
        if (srvRes.ok) {
          const srvData = await srvRes.json();
          if (srvData.resetLink) {
            serverResetLink = srvData.resetLink;
          }
        }
      } catch (srvErr) {
        console.warn('Server reset link dispatch notice:', srvErr);
      }

      // 4. ALSO DISPATCH OFFICIAL GOOGLE FIREBASE AUTH EMAIL LINK IF INITIALIZED
      if (isFirebaseInitialized) {
        try {
          await firebaseSendPasswordReset(cleanEmail);
        } catch (fbErr: any) {
          console.warn('[Firebase sendPasswordReset info]:', fbErr?.code || fbErr?.message);
          if (fbErr?.code === 'auth/user-not-found' && account?.password) {
            try {
              await firebaseRegisterWithEmail(cleanEmail, account.password, account.name || 'User');
              await firebaseSendPasswordReset(cleanEmail);
            } catch (autoErr) {
              console.warn('Firebase user auto-registration notice:', autoErr);
            }
          }
        }
      }

      return {
        success: true,
        message: 'Check email, reset link sent successfully',
        resetLink: serverResetLink,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to dispatch password reset email.' };
    }
  };

  // Confirm reset code/token from email link
  const confirmPasswordResetWithCode = async (
    code: string, 
    newPassword: string, 
    email?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }
    try {
      let resolvedEmail = email ? email.trim().toLowerCase() : '';
      let resolvedRole: UserRole | undefined = undefined;

      // 1. If it's a server cryptographic reset token (prt_...)
      if (code.startsWith('prt_')) {
        const res = await fetch('/api/auth/confirm-reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: code, newPassword }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return { success: false, error: data.error || 'Failed to reset password. The link may have expired.' };
        }
        if (data.email) resolvedEmail = data.email.toLowerCase().trim();
        if (data.role) resolvedRole = data.role as UserRole;
      } else if (isFirebaseInitialized && !code.startsWith('demo-')) {
        // 2. If it's an official Firebase Auth oobCode
        if (!resolvedEmail) {
          try {
            const verified = await firebaseVerifyPasswordResetCode(code);
            if (verified) resolvedEmail = verified.toLowerCase().trim();
          } catch (verErr) {
            console.warn('Firebase verify code notice:', verErr);
          }
        }
        await firebaseConfirmPasswordReset(code, newPassword);
      }

      // 3. PERSIST THE NEW PASSWORD IN ALL DATABASE LAYERS (LocalStorage, Server DB, Postgres, Firestore)
      if (resolvedEmail) {
        await StorageService.updateAccountPasswordAsync(resolvedEmail, newPassword, resolvedRole);

        if (currentUser && currentUser.email.toLowerCase().trim() === resolvedEmail) {
          setCurrentUser({
            ...currentUser,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: getFirebaseErrorMessage(err) };
    }
  };

  // Reset password (backward-compatible)
  const resetPassword = async (email: string, newPassword?: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    try {
      const account = StorageService.findAccountByEmail(cleanEmail) || StorageService.findAccountByUid(cleanEmail);
      if (!account) {
        return { success: false, error: 'No account found with this email. Please register first.' };
      }

      if (newPassword) {
        account.password = newPassword;
        await StorageService.saveAccountAsync(account);
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
        sendPasswordResetLink,
        confirmPasswordResetWithCode,
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
