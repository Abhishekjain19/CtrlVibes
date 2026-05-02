import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '../supabaseClient';
import StatusOverlay from '../components/StatusOverlay';
import { motion } from 'framer-motion';

// Custom marker icon creator
const createMarkerIcon = (color, label) => L.divIcon({
  className: 'custom-div-icon',
  html: `
    <div class="flex flex-col items-center group">
      <div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3);" class="group-hover:scale-125 transition-transform"></div>
      <div style="margin-top: 4px; background: white; padding: 3px 8px; border-radius: 8px; font-size: 9px; font-weight: 900; color: #1a1a1a; border: 1px solid #eee; white-space: nowrap; box-shadow: 0 4px 15px rgba(0,0,0,0.1);" class="backdrop-blur-md bg-white/90">
        ${label}
      </div>
    </div>
  `,
  iconSize: [80, 40],
  iconAnchor: [40, 7]
});

const userLocationIcon = L.divIcon({
  className: 'user-location-icon',
  html: '<div style="font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">📍</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 24]
});

const Dashboard = () => {
  const [role, setRole] = useState(localStorage.getItem('userRole') || 'Consumer');
  const [userName, setUserName] = useState(localStorage.getItem('userName') || 'Alex Green');
  const [showQuickList, setShowQuickList] = useState(false);
  const [optimizeItem, setOptimizeItem] = useState(null);
  const [listings, setListings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const userCoords = [12.9716, 77.5946];

  useEffect(() => {
    fetchProfile();
    fetchListings();
    fetchNotifications();
    if (role !== 'Consumer' && role !== 'NGO') fetchIncomingRequests();
  }, [role]);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (data) setUserProfile(data);
    }
  };

  const fetchListings = async () => {
    const { data, error } = await supabase
      .from('listings')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false });
    if (data) setListings(data);
  };

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setNotifications(data);
    }
  };

  const fetchIncomingRequests = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('handoffs')
        .select('*, listings(name, vendor_id), profiles!handoffs_claimer_id_fkey(full_name)')
        .eq('listings.vendor_id', user.id)
        .eq('status', 'Requested');
      
      if (data) setIncomingRequests(data.filter(r => r.listings)); // Filter out null listings due to inner join quirks
    }
  };

  const handleAcceptRequest = async (requestId, listingId, claimerId, itemName) => {
    // Fetch vendor details
    const { data: { user: vendor } } = await supabase.auth.getUser();
    const { data: vendorProfile } = await supabase.from('profiles').select('full_name').eq('id', vendor?.id).single();
    const vendorName = vendorProfile?.full_name || 'The Seller';

    const qrSecret = Math.random().toString(36).substring(2, 15);
    
    // Fetch handoff to check for batch_id
    const { data: handoff } = await supabase.from('handoffs').select('batch_id').eq('id', requestId).single();
    let batchIdToSet = handoff?.batch_id;
    if (!batchIdToSet) {
       const { data: bData } = await supabase.from('delivery_batches').select('id').eq('status', 'Gathering').limit(1);
       if (bData && bData.length > 0) batchIdToSet = bData[0].id;
    }

    const { error } = await supabase
      .from('handoffs')
      .update({ 
        status: 'In Transit',
        qr_secret: qrSecret,
        batch_id: batchIdToSet
      })
      .eq('id', requestId);
    
    if (!error) {
      await supabase.from('listings').update({ status: 'Reserved' }).eq('id', listingId);
      
      // Notify the Claimer
      await supabase.from('notifications').insert([{
        user_id: claimerId,
        title: 'Order Accepted! 🛍️',
        description: `${vendorName} has accepted your request for "${itemName}". The item is being prepared for delivery.`,
        type: 'success',
        status: 'unread'
      }]);

      setStatus({ type: 'success', message: `Request accepted! ${itemName} is now In Transit.` });
      fetchIncomingRequests();
      fetchListings();
      fetchNotifications();
    }
  };

  const handleRejectRequest = async (requestId, claimerId, itemName) => {
    const { data: { user: vendor } } = await supabase.auth.getUser();
    const { data: vendorProfile } = await supabase.from('profiles').select('full_name').eq('id', vendor?.id).single();
    const vendorName = vendorProfile?.full_name || 'The Seller';

    const { error } = await supabase
      .from('handoffs')
      .update({ status: 'Rejected' })
      .eq('id', requestId);
    
    if (!error) {
      // Notify the Claimer
      await supabase.from('notifications').insert([{
        user_id: claimerId,
        title: 'Request Declined',
        description: `${vendorName} was unable to accept your request for "${itemName}" at this time.`,
        type: 'warning',
        status: 'unread'
      }]);

      setStatus({ type: 'success', message: 'Request rejected.' });
      fetchIncomingRequests();
      fetchNotifications();
    }
  };

  const handleNotificationClick = (item) => {
    // Interactions now handled by inline buttons
  };

  const handleAddFood = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
       setStatus({ type: 'error', message: 'Please login first' });
       return;
    }

    const newListing = {
      vendor_id: user.id,
      name: formData.get('foodName'),
      quantity: formData.get('quantity'),
      weight: formData.get('weight') || 0,
      urgency: formData.get('urgency'),
      price: formData.get('price') || 0,
      stock: parseInt(formData.get('quantity')) || 1,
      status: 'Live',
      type: role === 'Product Seller' ? 'Packed' : 'Cooked'
    };

    const { error } = await supabase.from('listings').insert([newListing]);
    if (!error) {
      setShowQuickList(false);
      fetchListings();
      setStatus({ type: 'success', message: 'Listing published successfully!' });
    } else {
       console.error(error);
       setStatus({ type: 'error', message: 'Error publishing listing' });
    }
  };

  const handleOptimizeUpdate = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newStock = parseInt(formData.get('quantity')) || 0;
    
    const { error } = await supabase.from('listings').update({ 
      quantity: formData.get('quantity'), 
      stock: newStock 
    }).eq('id', optimizeItem.id);
    
    if (!error) {
      setOptimizeItem(null);
      fetchListings();
      setStatus({ type: 'success', message: 'Inventory optimized!' });
    } else {
      setStatus({ type: 'error', message: 'Failed to update inventory.' });
    }
  };

  const handleOptimizeDelete = async () => {
    const { error } = await supabase.from('listings').delete().eq('id', optimizeItem.id);
    if (!error) {
      setOptimizeItem(null);
      fetchListings();
      setStatus({ type: 'success', message: 'Item removed.' });
    } else {
      setStatus({ type: 'error', message: 'Failed to remove item.' });
    }
  };



  return (
    <div className="pt-24 px-6 max-w-7xl mx-auto pb-24 min-h-screen">
      <style>{`
        .leaflet-container { border-radius: 40px; }
        .custom-map-tooltip { background: white; border-radius: 8px; padding: 4px 8px; font-weight: 800; font-size: 10px; text-transform: uppercase; }
      `}</style>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-12 gap-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight">Welcome, {userName}</h1>
          <p className="text-sm md:text-base text-gray-500 mt-2 font-medium">
            {role === 'NGO' && 'Rapid acquisition and redistribution alerts.'}
            {role === 'Restaurant' && 'Frictionless surplus orchestration.'}
            {role === 'Product Seller' && 'Inventory management and sell-through optimization.'}
            {role === 'Consumer' && 'Hyper-local surplus discovery and impact.'}
          </p>
        </div>
        
        {(role === 'Restaurant' || role === 'Product Seller') && (
          <button 
            onClick={() => setShowQuickList(true)}
            className="w-full md:w-auto px-8 md:px-10 py-4 md:py-5 bg-gray-900 text-white rounded-2xl md:rounded-[24px] font-black text-[10px] md:text-xs uppercase tracking-[0.2em] shadow-2xl shadow-gray-200 hover:scale-105 transition-all flex items-center justify-center gap-3"
          >
            <span className="material-symbols-outlined">add_circle</span>
            Add {role === 'Restaurant' ? 'Food' : 'Inventory'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          {/* NGO VIEW */}
          {role === 'NGO' && (
            <>
              <div className="bg-red-50 border border-red-100 rounded-3xl md:rounded-[40px] p-6 md:p-10 relative overflow-hidden group">
                <div className="relative z-10">
                  <span className="px-3 py-1 bg-red-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest mb-4 inline-block">Priority Alert</span>
                  <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-2">Institutional Priority Active</h2>
                  <p className="text-gray-600 font-medium max-w-md text-sm">Nearby surplus is reserved for your facility. Claim within the priority window.</p>
                  <button className="mt-8 w-full md:w-auto px-10 py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all">View All Alerts</button>
                </div>
                <span className="absolute right-[-20px] top-[-20px] material-symbols-outlined text-[100px] md:text-[160px] text-red-500/5 rotate-12 transition-transform group-hover:scale-110">emergency</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-auto md:h-[calc(100vh-280px)]">
              {/* Map View */}
              <div className="bg-white rounded-3xl md:rounded-[40px] border border-gray-100 shadow-sm overflow-hidden relative h-[400px] md:h-full">
                <MapContainer 
                  center={[12.9716, 77.5946]} 
                  zoom={13} 
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                >
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                  <MarkerClusterGroup>
                    {listings.map(item => (
                      <Marker 
                        key={item.id} 
                        position={[item.profiles?.location_lat || 12.9716, item.profiles?.location_lng || 77.5946]}
                        icon={item.type === 'Cooked' ? foodIcon : packedIcon}
                      >
                        <Popup className="custom-popup">
                          <div className="p-2">
                            <h4 className="font-black text-gray-900">{item.name}</h4>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.type}</p>
                          </div>
                        </Popup>
                       <Marker 
                        key={l.id} 
                        position={[userCoords[0] + (Math.random()-0.5)*0.01, userCoords[1] + (Math.random()-0.5)*0.01]} 
                        icon={createMarkerIcon('#EF4444', `${l.name} • ${l.profiles?.full_name?.split(' ')[0] || 'Seller'}`)}
                       >
                         <Popup>
                           <div className="p-2 text-center">
                             <p className="font-black text-gray-900 text-xs mb-1">{l.name}</p>
                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{l.profiles?.full_name || 'Verified Vendor'}</p>
                             <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{l.quantity} Available</p>
                           </div>
                         </Popup>
                       </Marker>
                     ))}
                   </MapContainer>
                </div>
              </div>
            </>
          )}

          {/* RESTAURANT VIEW */}
          {role === 'Restaurant' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
                <div className="bg-white border border-gray-100 rounded-3xl md:rounded-[40px] p-8 md:p-10 shadow-sm">
                   <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Total Redirected</p>
                   <p className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter">{userProfile?.total_redirected || 0} <span className="text-lg md:text-xl text-gray-300">kg</span></p>
                   <p className="text-[10px] md:text-xs text-gray-500 font-medium mt-6">Top {userProfile?.top_performer_percent || 0}% performer in your district.</p>
                </div>
                <div className="bg-primary rounded-3xl md:rounded-[40px] p-8 md:p-10 text-white shadow-xl shadow-primary/20">
                   <p className="text-[9px] md:text-[10px] font-black text-white/60 uppercase tracking-widest mb-4">NGO Network</p>
                   <p className="text-4xl md:text-5xl font-black tracking-tighter">Live</p>
                   <p className="text-[10px] md:text-xs text-white/80 font-medium mt-6">Connected to {userProfile?.connected_ngos || 0} local shelters.</p>
                </div>
                <Link to="/logistics" className="bg-gray-900 rounded-3xl md:rounded-[40px] p-8 md:p-10 text-white shadow-xl group hover:scale-[1.02] transition-all sm:col-span-2 md:col-span-1">
                   <div className="flex justify-between items-start mb-4">
                      <p className="text-[9px] md:text-[10px] font-black text-white/40 uppercase tracking-widest">Logistics Intelligence</p>
                      <span className="material-symbols-outlined text-primary group-hover:animate-pulse">route</span>
                   </div>
                   <p className="text-3xl md:text-4xl font-black tracking-tighter">Batching</p>
                   <p className="text-[10px] md:text-xs text-white/60 font-medium mt-6 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      Optimization Active
                   </p>
                </Link>
              </div>

              <div className="bg-white rounded-3xl md:rounded-[40px] border border-gray-100 p-8 md:p-10 shadow-sm">
                 <h3 className="text-lg md:text-xl font-black text-gray-900 mb-8 tracking-tight">Active Listings</h3>
                 <div className="space-y-4">
                   {listings.filter(l => l.status === 'Live' && l.type === 'Cooked').length > 0 ? (
                     listings.filter(l => l.status === 'Live' && l.type === 'Cooked').map(l => (
                       <div key={l.id} className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl border border-gray-100 group hover:border-primary transition-all">
                         <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-gray-100 text-primary">
                             <span className="material-symbols-outlined">restaurant</span>
                           </div>
                           <div>
                             <p className="font-black text-gray-900">{l.name}</p>
                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{l.quantity} • Posted {new Date(l.created_at).toLocaleTimeString()}</p>
                           </div>
                         </div>
                         <button className="px-6 py-2 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase">Verify Scan</button>
                       </div>
                     ))
                   ) : (
                     <p className="text-center py-10 text-gray-400 font-bold uppercase text-[10px] tracking-widest">No Active Listings</p>
                   )}
                 </div>
              </div>

            </>
          )}

          {/* PRODUCT SELLER VIEW */}
          {role === 'Product Seller' && (
            <div className="bg-white rounded-[40px] border border-gray-100 p-10 shadow-sm">
               <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-10 flex items-center gap-3">
                  <span className="material-symbols-outlined text-tertiary">inventory_2</span>
                  Inventory Monitor
               </h3>
               <div className="space-y-4">
                 {listings.filter(l => l.type === 'Packed').length > 0 ? (
                   listings.filter(l => l.type === 'Packed').map(l => (
                     <div key={l.id} className="flex items-center justify-between p-8 bg-gray-50 rounded-[32px] border border-gray-100 group hover:border-tertiary transition-all">
                       <div className="flex items-center gap-6">
                         <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-gray-300 font-black">
                           {l.name[0]}
                         </div>
                         <div>
                            <p className="font-black text-gray-900">{l.name}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Stock: {l.quantity}</p>
                         </div>
                       </div>
                       <button onClick={() => setOptimizeItem(l)} className="px-8 py-3 bg-white border border-gray-200 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-tertiary hover:text-white hover:border-tertiary transition-all">Optimize</button>
                     </div>
                   ))
                 ) : (
                   <p className="text-center py-20 text-gray-300 font-black uppercase text-xs tracking-[0.2em]">Vault is empty</p>
                 )}
               </div>
            </div>
          )}

          {/* CONSUMER VIEW */}
          {role === 'Consumer' && (
            <div className="bg-white rounded-3xl md:rounded-[40px] border border-gray-200 overflow-hidden relative shadow-sm h-[400px] md:h-[600px] z-0">
               <MapContainer center={userCoords} zoom={14} zoomControl={false} attributionControl={false} style={{ height: '100%', width: '100%' }}>
                 <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                 <Marker position={userCoords} icon={userLocationIcon}>
                    <Popup>
                       <p className="font-black text-xs">You are here</p>
                    </Popup>
                 </Marker>
                 {listings.filter(l => l.status === 'Live').map(l => (
                   <Marker 
                    key={l.id} 
                    position={[userCoords[0] + (Math.random()-0.5)*0.01, userCoords[1] + (Math.random()-0.5)*0.01]} 
                    icon={createMarkerIcon('#118DFF', `${l.name} • ${l.profiles?.full_name?.split(' ')[0] || 'Seller'}`)}
                   >
                     <Popup>
                       <div className="p-2 text-center">
                         <p className="font-black text-gray-900 text-xs mb-1">{l.name}</p>
                         <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{l.profiles?.full_name || 'Verified Vendor'}</p>
                         <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">{l.quantity} Available</p>
                         <button className="w-full py-2 bg-primary text-white rounded-lg text-[9px] font-black uppercase">View Hub</button>
                       </div>
                     </Popup>
                   </Marker>
                 ))}
               </MapContainer>
               
               <div className="absolute bottom-6 md:bottom-10 left-6 md:left-10 right-6 md:right-10 z-[500]">
                  <div className="bg-gray-900/90 backdrop-blur-xl rounded-3xl md:rounded-[32px] p-6 md:p-10 flex flex-col md:flex-row justify-between items-center gap-6 md:gap-8 border border-white/10 shadow-2xl">
                     <div className="text-center md:text-left">
                        <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">Active Surplus Heatmap</h3>
                        <p className="text-white/50 text-xs md:text-sm mt-1">High listing density detected in your current zone.</p>
                     </div>
                     <Link to="/discover" className="w-full md:w-auto text-center px-8 md:px-10 py-4 md:py-5 bg-primary text-white rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/20">Explore Marketplace</Link>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* SIDEBAR: Platform Pulse */}
        <div className="space-y-8">
           <div className="bg-white rounded-3xl md:rounded-[40px] border border-gray-100 p-8 md:p-10 shadow-sm min-h-[400px] md:min-h-[600px] flex flex-col">
              <div className="flex items-center justify-between mb-10">
                <h3 className="font-black text-gray-900 text-xs uppercase tracking-widest flex items-center gap-2">
                  Platform Pulse
                  <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
                </h3>
                <Link to="/notifications" className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">View Notifications</Link>
              </div>
              
              <div className="space-y-8 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {[
                  ...notifications.map(n => ({ ...n, pulseType: 'notification' })),
                  ...incomingRequests.map(r => ({
                    id: r.id,
                    title: 'New Request Received',
                    description: `${r.profiles?.full_name} has requested your surplus: ${r.listings?.name}. Bid: ₹${r.bid_amount}${r.bid_location_text ? ` | Loc: ${r.bid_location_text}` : ''}`,
                    created_at: r.created_at,
                    pulseType: 'request',
                    type: 'request',
                    requestData: r
                  }))
                ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).length > 0 ? [
                  ...notifications.map(n => ({ ...n, pulseType: 'notification' })),
                  ...incomingRequests.map(r => ({
                    id: r.id,
                    title: 'New Request Received',
                    description: `${r.profiles?.full_name} has requested your surplus: ${r.listings?.name}. Bid: ₹${r.bid_amount}${r.bid_location_text ? ` | Loc: ${r.bid_location_text}` : ''}`,
                    created_at: r.created_at,
                    pulseType: 'request',
                    type: 'request',
                    requestData: r
                  }))
                ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((n, i) => (
                  <div key={i} onClick={() => handleNotificationClick(n)} className="group cursor-pointer">
                    <div className="flex items-start gap-4">
                       <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-colors flex-shrink-0 ${
                         n.type === 'priority' ? 'bg-red-50 border-red-100 text-red-500' : 
                         n.type === 'request' ? 'bg-purple-50 border-purple-100 text-purple-600' :
                         'bg-gray-50 border-gray-100 text-gray-400 group-hover:text-primary'
                       }`}>
                          <span className="material-symbols-outlined text-xl">
                            {n.type === 'priority' ? 'emergency_home' : n.type === 'alert' ? 'emergency' : n.type === 'request' ? 'person_pin' : 'notifications'}
                          </span>
                       </div>
                       <div>
                          <p className={`font-black text-sm leading-tight mb-1 ${n.type === 'priority' ? 'text-red-600' : 'text-gray-900'}`}>{n.title}</p>
                          <p className={`text-xs font-medium leading-relaxed mb-2 ${n.type === 'priority' ? 'text-red-500/80' : 'text-gray-500'}`}>{n.description}</p>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{new Date(n.created_at).toLocaleTimeString()}</p>
                          
                          {n.pulseType === 'request' && (
                            <div className="flex items-center gap-3 mt-3">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleAcceptRequest(n.id, n.requestData.listing_id, n.requestData.claimer_id, n.requestData.listings?.name); }}
                                className="px-4 py-1.5 bg-primary text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-all"
                              >
                                Accept
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleRejectRequest(n.id, n.requestData.claimer_id, n.requestData.listings?.name); }}
                                className="px-4 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                       </div>
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-20">
                    <span className="material-symbols-outlined text-6xl text-gray-100 mb-4">notifications_off</span>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Quiet on the Pulse</p>
                  </div>
                )}
              </div>
              
              <button className="w-full py-5 mt-10 bg-gray-50 text-gray-900 border border-gray-100 rounded-2xl md:rounded-[24px] font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-colors">Mark All Read</button>
           </div>
        </div>
      </div>

      {/* QUICK LIST MODAL */}
      {showQuickList && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4 animate-[fade-in_0.3s_ease-out]">
          <div className="bg-white rounded-3xl md:rounded-[40px] w-full max-w-xl p-8 md:p-12 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowQuickList(false)}
              className="absolute top-6 md:top-10 right-6 md:top-10 text-gray-400 hover:text-gray-900"
            >
              <span className="material-symbols-outlined text-2xl md:text-3xl">close</span>
            </button>
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-2">Publish Surplus</h2>
            <p className="text-gray-500 font-medium mb-8 md:mb-10 text-sm">Invisible orchestration will route to NGOs first.</p>
            
            <form onSubmit={handleAddFood} className="space-y-6 md:space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Item Name</label>
                <input name="foodName" required placeholder="e.g. Veg Biryani" className="w-full bg-gray-50 border border-gray-200 rounded-2xl md:rounded-3xl p-5 md:p-6 font-black text-gray-900 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Quantity</label>
                  <input name="quantity" required placeholder="e.g. 25 Plates" className="w-full bg-gray-50 border border-gray-200 rounded-2xl md:rounded-3xl p-5 md:p-6 font-black text-gray-900 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Urgency</label>
                  <select name="urgency" className="w-full bg-gray-50 border border-gray-200 rounded-2xl md:rounded-3xl p-5 md:p-6 font-black text-gray-900 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all appearance-none">
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Price (₹)</label>
                  <input name="price" type="number" placeholder="e.g. 150" className="w-full bg-gray-50 border border-gray-200 rounded-2xl md:rounded-3xl p-5 md:p-6 font-black text-gray-900 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-4">Weight (kg)</label>
                  <input name="weight" type="number" step="0.1" required placeholder="e.g. 5.5" className="w-full bg-gray-50 border border-gray-200 rounded-2xl md:rounded-3xl p-5 md:p-6 font-black text-gray-900 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all" />
                </div>
              </div>
              <button type="submit" className="w-full py-5 md:py-6 bg-gray-900 text-white rounded-2xl md:rounded-3xl font-black text-[10px] md:text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all">
                 Confirm & Publish
              </button>
            </form>
          </div>
        </div>
      )}
      {/* OPTIMIZE MODAL */}
      {optimizeItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[2000] flex items-center justify-center p-4 animate-[fade-in_0.3s_ease-out]">
          <div className="bg-white rounded-3xl md:rounded-[40px] w-full max-w-xl p-8 md:p-12 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setOptimizeItem(null)}
              className="absolute top-6 md:top-10 right-6 md:top-10 text-gray-400 hover:text-gray-900"
            >
              <span className="material-symbols-outlined text-2xl md:text-3xl">close</span>
            </button>
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-2">Optimize Inventory</h2>
            <p className="text-gray-500 font-medium mb-8 md:mb-10 text-sm">Adjust stock levels or remove this item.</p>
            
            <form onSubmit={handleOptimizeUpdate} className="space-y-6 md:space-y-8">
              <div>
                <label className="block text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] mb-4 px-4">Current Stock</label>
                <input 
                  type="number" 
                  name="quantity"
                  required
                  defaultValue={optimizeItem.stock || optimizeItem.quantity}
                  min="0"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-5 font-bold text-gray-900 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button 
                  type="button"
                  onClick={handleOptimizeDelete}
                  className="flex-1 py-5 bg-red-50 text-red-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-red-100 transition-colors order-2 sm:order-1"
                >
                  Delete Item
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-5 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-primary transition-colors order-1 sm:order-2"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <StatusOverlay status={status} onClose={() => setStatus(null)} />
    </div>
  );
};

export default Dashboard;
