import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Save,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Edit3,
  User,
  Mail,
  Phone,
  Building2,
  LogOut
} from 'lucide-react';

interface ProfilePageProps {}

export const ProfilePage: React.FC<ProfilePageProps> = () => {
  const { currentUser, role, updateProfile, changePassword, logout } = useAuth();

  // Edit Profile toggle & fields state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [college, setCollege] = useState(currentUser?.college || '');

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Sync state when currentUser updates
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
      setCollege(currentUser.college || '');
    }
  }, [currentUser]);

  // Change password toggle & form state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!name.trim()) {
      setProfileError('Full Name cannot be empty.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setProfileError('Please enter a valid email address.');
      return;
    }

    const cleanPhone = phone.trim().replace(/[\s\-()+]/g, '');
    if (cleanPhone && !/^[0-9]{10}$/.test(cleanPhone)) {
      setProfileError('Please enter a valid 10-digit phone number (e.g., 9876543210).');
      return;
    }

    setProfileLoading(true);

    try {
      const res = await updateProfile({
        name: name.trim(),
        email: email.trim(),
        phone: cleanPhone,
        college: college.trim(),
      });

      if (res.success) {
        setProfileSuccess('Saved successfully');
        setTimeout(() => {
          setProfileSuccess(null);
          setIsEditProfileOpen(false);
        }, 2200);
      } else {
        setProfileError(res.error || 'Failed to update profile details.');
      }
    } catch (err: any) {
      setProfileError(err?.message || 'An error occurred while saving profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCancelEditProfile = () => {
    setIsEditProfileOpen(false);
    setProfileError(null);
    setProfileSuccess(null);
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
      setCollege(currentUser.college || '');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.trim().length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setPasswordLoading(true);

    try {
      const res = await changePassword(currentPassword, newPassword);

      if (res.success) {
        setPasswordSuccess('Saved successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setPasswordSuccess(null);
          setIsChangePasswordOpen(false);
        }, 2500);
      } else {
        setPasswordError(res.error || 'Current password is incorrect. Please verify and try again.');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'An unexpected error occurred while updating your password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCancelChangePassword = () => {
    setIsChangePasswordOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordSuccess(null);
  };

  const isMinLength = newPassword.length >= 6;
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="pb-20 w-full px-4 sm:px-6 lg:px-10 xl:px-12 pt-4 sm:pt-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Account Profile</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Manage your personal details and account password
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Profile Badge Card & Role info */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-3xl ring-4 ring-indigo-500/20 overflow-hidden bg-slate-100 mb-3 shadow-xs">
              {currentUser?.photoURL ? (
                <img src={currentUser.photoURL} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-black text-indigo-600">
                  {currentUser?.name?.charAt(0) || 'U'}
                </div>
              )}
            </div>

            <h2 className="text-lg font-black text-slate-900 truncate w-full">{currentUser?.name}</h2>
            <p className="text-xs text-slate-500 truncate w-full">{currentUser?.email}</p>
          </div>

          {/* Quick Sign Out Action */}
          <div>
            <button
              type="button"
              onClick={logout}
              className="w-full py-3 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200/80 text-rose-700 font-black text-xs flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer shadow-2xs"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              <span>Sign Out of Fest-Plus</span>
            </button>
          </div>
        </div>

        {/* Right Column: Edit Profile & Password Management (Spans 8 or 9 cols on desktop) */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          
          {/* Card 1: Profile Information (Read-only by default, click "Edit Profile" to edit) */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs transition-all">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Profile Details</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isEditProfileOpen ? 'Modify your personal account details below' : 'View and manage your account details'}
                  </p>
                </div>
              </div>

              {/* Edit Profile Button / Cancel Toggle */}
              {!isEditProfileOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditProfileOpen(true);
                    setProfileError(null);
                    setProfileSuccess(null);
                  }}
                  className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs cursor-pointer self-start sm:self-auto"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Profile
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelEditProfile}
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              )}
            </div>

            {/* Read-Only Summary: Shown when NOT editing */}
            {!isEditProfileOpen ? (
              <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Full Name
                  </span>
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <User className="w-4 h-4 text-slate-400" />
                    <span>{currentUser?.name || 'Not provided'}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Email Address
                  </span>
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm truncate">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{currentUser?.email || 'Not provided'}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Phone Number
                  </span>
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span>{currentUser?.phone || 'Not added yet'}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    {role === 'host' ? 'Organizing Body / Institution' : 'College / University'}
                  </span>
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>{currentUser?.college || (role === 'host' ? 'Campus Event Council' : 'Not added yet')}</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Editable Form: Opens only when user clicks 'Edit Profile' */
              <form onSubmit={handleSaveProfile} className="mt-5 pt-5 border-t border-slate-100 space-y-4 text-xs animate-fadeIn">
                {profileError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="text-xs font-medium leading-relaxed">{profileError}</span>
                  </div>
                )}

                {profileSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="text-xs font-medium leading-relaxed">{profileSuccess}</span>
                  </div>
                )}

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 text-sm"
                      placeholder="Your full legal name"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 text-sm"
                      placeholder="name@domain.com"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Changing email will update your login credentials.</p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 text-sm"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {role === 'host' ? 'Organizing Body / University' : 'College / University'}
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 text-sm"
                      placeholder={role === 'host' ? 'Campus Event Council / University Name' : 'e.g. Stanford University, IIT Delhi'}
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {profileLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Profile Changes</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelEditProfile}
                    disabled={profileLoading}
                    className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Card 2: Password Management (Collapsed by default, opens upon clicking 'Change Password') */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs transition-all">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Account Password</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isChangePasswordOpen 
                      ? 'Enter your current password and choose a new password'
                      : '•••••••••••• • Encrypted and protected'}
                  </p>
                </div>
              </div>

              {/* Toggle Button: When closed, shows "Change Password"; When open, shows Cancel "X" */}
              {!isChangePasswordOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsChangePasswordOpen(true);
                    setPasswordError(null);
                    setPasswordSuccess(null);
                  }}
                  className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs cursor-pointer self-start sm:self-auto"
                >
                  <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                  Change Password
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancelChangePassword}
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              )}
            </div>

            {/* Change Password Form: Appears ONLY when user clicks 'Change Password' */}
            {isChangePasswordOpen && (
              <form onSubmit={handlePasswordSubmit} className="mt-5 pt-5 border-t border-slate-100 space-y-4 text-xs animate-fadeIn">
                {/* Alert messages */}
                {passwordError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="text-xs font-medium leading-relaxed">{passwordError}</span>
                  </div>
                )}

                {passwordSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="text-xs font-medium leading-relaxed">{passwordSuccess}</span>
                  </div>
                )}

                {/* Current Password Field */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 text-sm"
                      placeholder="Enter your current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password Field */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 text-sm"
                      placeholder="Enter new strong password (min. 6 characters)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password Field */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 text-sm"
                      placeholder="Re-type your new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Requirements Guide */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500">
                  <span className={`flex items-center gap-1 ${isMinLength ? 'text-emerald-600 font-bold' : ''}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isMinLength ? 'text-emerald-600' : 'text-slate-300'}`} />
                    Minimum 6 characters
                  </span>
                  <span className={`flex items-center gap-1 ${isMatch ? 'text-emerald-600 font-bold' : ''}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isMatch ? 'text-emerald-600' : 'text-slate-300'}`} />
                    Passwords match
                  </span>
                </div>

                {/* Submit & Cancel Buttons */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="py-2.5 px-6 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {passwordLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Save New Password</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelChangePassword}
                    disabled={passwordLoading}
                    className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
