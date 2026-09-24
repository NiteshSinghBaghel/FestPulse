import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  Mail, 
  Phone, 
  School, 
  ShieldCheck, 
  RotateCcw, 
  Save, 
  Sparkles,
  Smartphone,
  ExternalLink
} from 'lucide-react';

interface ProfilePageProps {}

export const ProfilePage: React.FC<ProfilePageProps> = () => {
  const { currentUser, role, updateProfile } = useAuth();

  const [name, setName] = useState(currentUser?.name || '');
  const [college, setCollege] = useState(currentUser?.college || 'Imperial Institute of Technology');
  const [phone, setPhone] = useState(currentUser?.phone || '+91 98765 43210');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ name, college, phone });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="pb-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Account Profile</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Manage your personal details, campus credentials, and verified attendance pass status
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile Badge Card & Sign Out */}
        <div className="space-y-6">
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
            <p className="text-xs text-slate-500 truncate w-full mb-1">{currentUser?.email}</p>
            <p className="text-[11px] text-indigo-600 font-semibold mb-3">{currentUser?.college}</p>

            <span className={`text-[10px] font-extrabold uppercase px-3 py-1 rounded-full ${
              role === 'host'
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
            }`}>
              {role === 'host' ? '⚡ Organizer / Host' : '🎓 Student Pass Holder'}
            </span>
          </div>

          {/* Locked Session Role Card */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-start gap-3 shadow-2xs">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              role === 'host' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-700'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900">
                  Role: {role === 'host' ? 'Host Portal' : 'Student Mode'}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 font-bold border border-slate-200">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Your role was established at login. To switch portals, log out and sign in with the preferred role.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Profile and Rules (Spans 2 cols on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 mb-4">Edit Profile Information</h3>
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Affiliated College / University</label>
                <input
                  type="text"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-xs"
                >
                  <Save className="w-4 h-4" /> Save Profile Changes
                </button>
              </div>

              {savedSuccess && (
                <p className="text-xs text-emerald-600 font-semibold pt-1">
                  ✓ Profile updated successfully!
                </p>
              )}
            </form>
          </div>

          {/* Security & System Info */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200 space-y-3 text-xs text-slate-600 shadow-2xs">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>CampusPass Security & Gate Settlement Rules</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              • All tickets issued contain cryptographically signed tokens verified instantly at gate checkpoints.
              <br />
              • UPI transactions enforce zero client trust with instantaneous pass inventory verification.
              <br />
              • Ticket validation and gate check-ins are logged with real-time timestamps across all devices.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
