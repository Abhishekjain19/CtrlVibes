import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '../supabaseClient';
import StatusOverlay from '../components/StatusOverlay';

// Custom marker icon creator
const createMarkerIcon = (color) => L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px rgba(0,0,0,0.2);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const NGO = () => {
  const [listings, setListings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const userCoords = [12.9716, 77.5946];

  useEffect(() => {
    fetchNGOData();
  }, []);

  const fetchNGOData = async () => {
    setLoading(true);
    // Fetch live food listings
    const { data: food, error: foodErr } = await supabase
      .from('listings')
      .select('*, profiles(full_name)')
      .eq('status', 'Live')
      .eq('type', 'Cooked');
    
    if (food) setListings(food);

    // Fetch notifications
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: notes } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (notes) setNotifications(notes);
    }
    setLoading(false);
  };

  const needs = [
    { id: 1, type: 'Urgent', items: '20kg Grains/Rice', location: 'City Shelter A', posted: '2h ago' },
    { id: 2, type: 'Regular', items: 'Fresh Vegetables', location: 'Community Kitchen B', posted: '5h ago' },
  ];

  return (
    <div className="pt-24 px-6 max-w-7xl mx-auto pb-24 min-h-screen">
      <style>{`
        .leaflet-container { border-radius: 32px; z-index: 0; }
      `}</style>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">NGO Alert Dashboard</h1>
          <p className="text-gray-500 mt-1 font-medium">Real-time surplus orchestration for local shelters.</p>
        </div>
        <button 
          onClick={() => setStatus({ type: 'success', message: 'Urgent need broadcasted to the network!' })}
          className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-gray-200 hover:scale-105 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined">campaign</span>
          Post Urgent Need
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-black text-gray-900 mb-6 tracking-tight">Active Distribution Needs</h2>
          {needs.map(need => (
            <div key={need.id} className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-primary transition-all">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${need.type === 'Urgent' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                    {need.type} Need
                  </span>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">{need.posted}</p>
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-1">{need.items}</h3>
                <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-gray-400">location_on</span>
                  {need.location}
                </p>
              </div>
              <button className="px-8 py-3 bg-gray-50 text-gray-900 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-gray-100 hover:bg-primary hover:text-white hover:border-primary transition-all">
                Match with Surplus
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-6">
           <div className="bg-gray-900 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden group">
             <div className="relative z-10">
               <h2 className="text-xl font-black mb-6 tracking-tight">Institutional Impact</h2>
               <div className="space-y-6">
                 <div>
                   <p className="text-primary text-[10px] font-black uppercase tracking-widest mb-1">Meals Orchestrated</p>
                   <p className="text-5xl font-black tracking-tighter">12.4k</p>
                 </div>
               </div>
             </div>
             <span className="absolute bottom-[-20px] right-[-20px] material-symbols-outlined text-[140px] text-white/5 rotate-12">volunteer_activism</span>
           </div>
        </div>
      </div>

      <div className="mb-12 bg-white rounded-[40px] border border-gray-100 overflow-hidden relative shadow-sm h-[500px]">
        <MapContainer center={userCoords} zoom={14} zoomControl={false} attributionControl={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          {listings.map(l => (
            <Marker key={l.id} position={[userCoords[0] + (Math.random()-0.5)*0.01, userCoords[1] + (Math.random()-0.5)*0.01]} icon={createMarkerIcon('#EF4444')}>
              <Popup>
                <div className="p-2">
                  <p className="font-black text-gray-900 text-xs mb-1">{l.name}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{l.profiles?.full_name}</p>
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-2">{l.quantity} Available</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="bg-white rounded-[40px] border border-gray-100 p-10 shadow-sm">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-10">Platform Pulse</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notifications.length > 0 ? notifications.map((n, i) => (
            <div key={i} className="bg-gray-50 rounded-[32px] p-8 group hover:bg-gray-100 transition-all cursor-pointer">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors shadow-sm">
                  <span className="material-symbols-outlined">{n.type === 'alert' ? 'emergency' : 'notifications'}</span>
                </div>
                <div>
                  <h4 className="font-black text-gray-900 text-sm mb-1">{n.title}</h4>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.1em] mb-3">{new Date(n.created_at).toLocaleTimeString()}</p>
                  <p className="text-xs text-gray-500 font-medium leading-relaxed">{n.description}</p>
                </div>
              </div>
            </div>
          )) : (
            <p className="col-span-full text-center py-10 text-gray-400 font-bold uppercase text-[10px] tracking-widest">No notifications yet</p>
          )}
        </div>
      </div>
      <StatusOverlay status={status} onClose={() => setStatus(null)} />
    </div>
  );
};

export default NGO;
