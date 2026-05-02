import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import StatusOverlay from '../components/StatusOverlay';

const Profile = () => {
  const [profileImage, setProfileImage] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [wishlist, setWishlist] = useState([]);
  const [stats, setStats] = useState({ listings: 0, points: 0, redirected: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(prof);
      
      const { count: listingCount } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', user.id);
      
      setStats({
        listings: listingCount || 0,
        points: prof?.points || 0,
        redirected: prof?.total_redirected_weight || 0
      });

      const { data: wish } = await supabase
        .from('wishlists')
        .select('vendor_id, profiles!wishlists_vendor_id_fkey(full_name)')
        .eq('user_id', user.id);
      
      if (wish) {
        setWishlist(wish.map(w => ({ id: w.vendor_id, name: w.profiles?.full_name || 'Store' })));
      }
    }
    setLoading(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfileImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const removeFromWishlist = async (vendorId) => {
    const { error } = await supabase.from('wishlists').delete().eq('user_id', user.id).eq('vendor_id', vendorId);
    if (!error) setWishlist(prev => prev.filter(v => v.id !== vendorId));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    navigate('/auth');
  };

  const togglePriorityMode = async () => {
    if (!profile) return;
    const newMode = !profile.high_priority_mode;
    const { error } = await supabase
      .from('profiles')
      .update({ high_priority_mode: newMode })
      .eq('id', user.id);
    
    if (!error) {
      setProfile(prev => ({ ...prev, high_priority_mode: newMode }));
    }
  };

  if (loading) return (
    <div className="pt-24 flex items-center justify-center min-h-screen">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="pt-24 px-4 md:px-6 max-w-4xl mx-auto pb-24 min-h-screen">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-center gap-8 md:gap-10 mb-12 md:mb-16 bg-white p-6 md:p-10 rounded-[32px] border border-gray-100 shadow-sm">
        <div className="relative group">
          <div className="w-24 h-24 md:w-32 md:h-32 bg-gray-50 rounded-full flex items-center justify-center border-4 border-white shadow-xl overflow-hidden relative">
            {profileImage ? (
              <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-4xl md:text-6xl text-gray-200">person</span>
            )}
            <button 
              onClick={() => fileInputRef.current.click()}
              className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <span className="material-symbols-outlined text-white">photo_camera</span>
            </button>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
        </div>
        <div className="text-center md:text-left flex-1 min-w-0 w-full">
          <div className="flex flex-col lg:flex-row justify-between items-center lg:items-start gap-6 md:gap-8">
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-1 truncate">{profile?.full_name || 'User'}</h1>
              <p className="text-gray-400 font-medium mb-4 truncate text-sm md:text-base">{user?.email}</p>
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                <span className="px-3 py-1 bg-primary/10 text-primary text-[9px] font-black rounded-full border border-primary/10 tracking-widest uppercase">{profile?.role}</span>
                <span className="px-3 py-1 bg-secondary/10 text-secondary text-[9px] font-black rounded-full border border-secondary/10 tracking-widest uppercase">Verified Hub</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-stretch w-full lg:w-auto">
              <div className="bg-primary/5 border border-primary/10 p-6 rounded-[24px] text-center flex-1 lg:min-w-[160px] flex flex-col justify-center">
                <div className="text-primary font-black text-2xl md:text-3xl tracking-tighter">{stats.points}</div>
                <div className="text-[9px] font-black text-primary/60 uppercase tracking-widest mt-1">Impact Score</div>
                <div className="mt-3 h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-[75%] rounded-full"></div>
                </div>
                <div className="text-[8px] font-bold text-gray-400 mt-2 text-center uppercase tracking-widest">Active: {stats.listings}</div>
              </div>
              {profile?.role === 'NGO' && (
                <div className="bg-red-50 border border-red-100 p-6 rounded-[24px] flex flex-col justify-between flex-1 lg:min-w-[220px]">
                   <div className="mb-4">
                      <h4 className="font-black text-red-600 text-[10px] uppercase tracking-tight">Critical Alert Toggle</h4>
                      <p className="text-[9px] text-red-500/70 font-bold uppercase tracking-widest mt-1">
                        {profile.high_priority_mode ? 'CRITICAL DEMAND ACTIVE' : 'STANDARD MODE'}
                      </p>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-[8px] font-black text-red-400 uppercase tracking-widest">Broadcast Alert</span>
                     <button 
                      onClick={togglePriorityMode}
                      className={`w-10 h-6 rounded-full transition-all relative flex items-center px-1 ${profile.high_priority_mode ? 'bg-red-500' : 'bg-gray-200'}`}
                     >
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all transform ${profile.high_priority_mode ? 'translate-x-4' : 'translate-x-0'}`}></div>
                     </button>
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Detailed Impact Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
        <div className="bg-white border border-gray-100 p-8 rounded-[40px] shadow-sm flex flex-col items-center text-center group hover:border-primary transition-all">
           <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined">eco</span>
           </div>
           <p className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter">{profile?.carbon_offset || 0} kg</p>
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Carbon Offset</p>
        </div>
        <div className="bg-white border border-gray-100 p-8 rounded-[40px] shadow-sm flex flex-col items-center text-center group hover:border-primary transition-all">
           <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined">inventory_2</span>
           </div>
           <p className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter">{profile?.total_items_saved || 0}</p>
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Items Saved</p>
        </div>
      </div>
      
      {/* Institutional Wishlist Section */}
      <div className="mb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
            My Institutional Wishlist
          </h2>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{wishlist.length} Items Saved</span>
        </div>
        {wishlist.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {wishlist.map(vendor => (
              <div key={vendor.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 group hover:border-primary transition-all shadow-sm">
                <div className="w-16 h-16 bg-primary/5 rounded-xl flex items-center justify-center text-primary flex-shrink-0">
                  <span className="material-symbols-outlined text-3xl">storefront</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-900 truncate">{vendor.name}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <Link to="/discover" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View Hub</Link>
                    <button onClick={() => removeFromWishlist(vendor.id)} className="text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-red-500">Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-3xl border border-dashed border-gray-200 p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-gray-200 mb-4">storefront</span>
            <p className="text-gray-400 font-medium italic">Explore the marketplace to find hubs.</p>
            <Link to="/discover" className="inline-block mt-4 text-primary font-black text-[10px] uppercase tracking-widest hover:underline">Go to Marketplace</Link>
          </div>
        )}
      </div>

      {/* History Placeholder Section */}
      <div className="mb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-green-600">history</span>
            {(profile?.role === 'Restaurant' || profile?.role === 'Product Seller') ? 'Selling History' : 'Purchase History'}
          </h2>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Redistribution Log</span>
        </div>
        <div className="bg-gray-50 rounded-3xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400 font-medium italic">No recent transactions to display.</p>
        </div>
      </div>

      {/* Account Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <Link to="/orders" className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between group hover:border-primary hover:bg-primary/[0.02] transition-all shadow-sm">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-primary/5 rounded-xl flex items-center justify-center text-primary transition-colors">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <span className="font-bold text-gray-900">
              {(profile?.role === 'Restaurant' || profile?.role === 'Product Seller') ? 'Selling History' : 'Purchase History'}
            </span>
          </div>
          <span className="material-symbols-outlined text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all">chevron_right</span>
        </Link>
        
        {(profile?.role === 'Restaurant' || profile?.role === 'Product Seller') && (
          <Link to="/inventory" className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between group hover:border-secondary hover:bg-secondary/[0.02] transition-all shadow-sm">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-secondary/5 rounded-xl flex items-center justify-center text-secondary transition-colors">
                <span className="material-symbols-outlined text-2xl">inventory_2</span>
              </div>
              <span className="font-bold text-gray-900">
                {profile?.role === 'Restaurant' ? 'Restaurant Inventory' : 'Store Inventory'}
              </span>
            </div>
            <span className="material-symbols-outlined text-gray-300 group-hover:text-secondary group-hover:translate-x-1 transition-all">chevron_right</span>
          </Link>
        )}

        {profile?.role === 'Restaurant' && (
          <button 
            onClick={() => navigate('/inventory', { state: { mode: 'live' } })}
            className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between group hover:border-amber-500 hover:bg-amber-50 transition-all text-left shadow-sm"
          >
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500 transition-colors">
                <span className="material-symbols-outlined text-2xl">storefront</span>
              </div>
              <span className="font-bold text-gray-900">My Active Marketplace</span>
            </div>
            <span className="material-symbols-outlined text-gray-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all">chevron_right</span>
          </button>
        )}

        <Link to="/settings" className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between group hover:border-blue-500 hover:bg-blue-50 transition-all shadow-sm">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 transition-colors">
              <span className="material-symbols-outlined text-2xl">settings</span>
            </div>
            <span className="font-bold text-gray-900">Account Settings</span>
          </div>
          <span className="material-symbols-outlined text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all">chevron_right</span>
        </Link>

        <button 
          onClick={handleSignOut}
          className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between group hover:border-red-500 hover:bg-red-50 transition-all text-left w-full shadow-sm"
        >
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-500 transition-colors">
              <span className="material-symbols-outlined text-2xl">logout</span>
            </div>
            <span className="font-bold text-red-600">Sign Out</span>
          </div>
        </button>
      </div>
      <StatusOverlay status={status} onClose={() => setStatus(null)} />
    </div>
  );
};

export default Profile;
