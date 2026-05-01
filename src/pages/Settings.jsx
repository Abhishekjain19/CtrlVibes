import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import StatusOverlay from '../components/StatusOverlay';

const Settings = () => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ full_name: '', phone: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) setProfile(data);
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
        address: profile.address
      })
      .eq('id', user.id);

    if (!error) {
      setStatus({ type: 'success', message: 'Profile updated successfully.' });
    } else {
      setStatus({ type: 'error', message: error.message });
    }
  };

  if (loading) return (
    <div className="pt-24 flex items-center justify-center min-h-screen">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="pt-24 px-6 max-w-2xl mx-auto pb-24 min-h-screen">
      <div className="mb-12 flex items-center gap-6">
        <Link to="/profile" className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Account Settings</h1>
          <p className="text-gray-500 font-medium">Manage your personal and institutional credentials.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-[40px] border border-gray-100 p-10 shadow-sm space-y-8">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name / Hub Name</label>
          <input 
            type="text" 
            value={profile.full_name} 
            onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 font-bold text-gray-900 focus:border-primary outline-none transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address (Read Only)</label>
          <input 
            type="email" 
            value={user?.email} 
            disabled
            className="w-full bg-gray-100 border border-gray-100 rounded-2xl px-6 py-4 font-bold text-gray-400 cursor-not-allowed"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact Number</label>
          <input 
            type="tel" 
            value={profile.phone || ''} 
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            placeholder="+91 00000 00000"
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 font-bold text-gray-900 focus:border-primary outline-none transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Default Pickup/Delivery Address</label>
          <textarea 
            rows="3"
            value={profile.address || ''} 
            onChange={(e) => setProfile({ ...profile, address: e.target.value })}
            placeholder="Enter full institutional address..."
            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 font-bold text-gray-900 focus:border-primary outline-none transition-all resize-none"
          />
        </div>

        <div className="pt-6">
          <button type="submit" className="w-full py-5 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl shadow-gray-200">
            Update Profile Credentials
          </button>
        </div>
      </form>

      <StatusOverlay status={status} onClose={() => setStatus(null)} />
    </div>
  );
};

export default Settings;
