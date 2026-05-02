import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const batchIcon = L.divIcon({
  className: 'custom-batch-icon',
  html: `<div style="background-color: #2ECC71; width: 32px; height: 32px; border-radius: 50%; border: 4px solid white; box-shadow: 0 0 20px rgba(46, 204, 113, 0.4); display: flex; align-items: center; justify-center;">
           <span class="material-symbols-outlined" style="font-size: 18px; color: white;">local_shipping</span>
         </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const Logistics = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    fuelSaved: 0,
    co2Reduced: 0,
    totalBatches: 0
  });
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const initialize = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser(authUser);
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', authUser.id).single();
        setRole(profile?.role);
        fetchLogisticsData(authUser, profile?.role);
      }
    };
    initialize();
    const interval = setInterval(() => {
      if (user) fetchLogisticsData(user, role);
    }, 10000);
    return () => clearInterval(interval);
  }, [user, role]);

  const fetchLogisticsData = async (authUser, userRole) => {
    if (!authUser) return;

    let query = supabase
      .from('delivery_batches')
      .select(`
        *,
        handoffs (id, status, claimer_id, listing_id, listings(id, vendor_id, name))
      `)
      .order('scheduled_at', { ascending: true });

    const { data: batchesData, error } = await query;

    if (batchesData) {
      // Security Filtering: Only show clusters the user is part of
      let filteredBatches = batchesData;
      
      if (userRole === 'Consumer' || userRole === 'NGO') {
        filteredBatches = batchesData.filter(b => 
          b.handoffs?.some(h => h.claimer_id === authUser.id)
        );
      } else if (userRole === 'Restaurant' || userRole === 'Product Seller') {
        filteredBatches = batchesData.filter(b => 
          b.handoffs?.some(h => h.listings?.vendor_id === authUser.id)
        );
      }

      setBatches(filteredBatches);
      
      // Calculate efficiency stats based on filtered view
      const batchedItems = filteredBatches.reduce((acc, b) => acc + (b.handoffs?.length > 1 ? b.handoffs.length : 0), 0);
      
      setStats({
        fuelSaved: (batchedItems * 1.2).toFixed(1),
        co2Reduced: (batchedItems * 2.5).toFixed(1),
        totalBatches: filteredBatches.length
      });
    }
    setLoading(false);
  };

  const getTimeRemaining = (expiry) => {
    const diff = new Date(expiry) - new Date();
    if (diff <= 0) return "Closing...";
    const mins = Math.floor(diff / 1000 / 60);
    const secs = Math.floor((diff / 1000) % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="pt-24 px-6 max-w-7xl mx-auto pb-24 min-h-screen">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 gap-6">
        <div className="w-full md:w-auto">
          <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight">Logistics Intelligence</h1>
          <p className="text-gray-500 mt-1 font-medium text-sm md:text-base">Algorithmic batching for sustainable fuel and cost optimization.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full lg:w-auto">
          <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm text-center">
             <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Fuel Saved</p>
             <p className="text-xl md:text-2xl font-black text-gray-900">{stats.fuelSaved}L</p>
          </div>
          <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm text-center">
             <p className="text-[10px] font-black text-tertiary uppercase tracking-widest mb-1">CO2 Offset</p>
             <p className="text-xl md:text-2xl font-black text-gray-900">{stats.co2Reduced}kg</p>
          </div>
          <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm text-center">
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Clusters</p>
             <p className="text-xl md:text-2xl font-black text-gray-900">{stats.totalBatches}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-[500px] lg:h-[600px]">
        {/* Map Cluster View */}
        <div className="lg:col-span-2 bg-white rounded-3xl md:rounded-[40px] border border-gray-100 shadow-sm overflow-hidden relative h-[400px] lg:h-full">
          <MapContainer 
            center={[12.9716, 77.5946]} 
            zoom={13} 
            attributionControl={false}
            className="h-full w-full z-0"
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            {batches.map(batch => (
              <React.Fragment key={batch.id}>
                <Circle 
                  center={[batch.center_lat, batch.center_lng]}
                  radius={3000} // Updated to 3km radius as per logistics plan
                  pathOptions={{ 
                    color: batch.status === 'Gathering' ? '#3498DB' : '#2ECC71', 
                    fillColor: batch.status === 'Gathering' ? '#3498DB' : '#2ECC71', 
                    fillOpacity: 0.1,
                    dashArray: batch.status === 'Gathering' ? '10, 10' : '0'
                  }}
                />
                <Marker position={[batch.center_lat, batch.center_lng]} icon={batchIcon}>
                  <Popup>
                    <div className="font-black text-xs uppercase tracking-widest text-primary mb-1">{batch.status}</div>
                    <div className="font-black">Cluster #{batch.id.slice(0, 4)}</div>
                    <div className="text-[10px] font-bold text-gray-500 mt-1">{batch.handoffs?.length || 0} Orders Consolidated</div>
                  </Popup>
                </Marker>
              </React.Fragment>
            ))}
          </MapContainer>
          
          <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-2">
             <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-900">Live Cluster Mapping</span>
             </div>
             <div className="bg-blue-500/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-blue-400 shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Active Buffer Windows (3KM)</span>
             </div>
          </div>
        </div>

        {/* Batch Queue */}
        <div className="bg-gray-50 rounded-3xl md:rounded-[40px] p-6 md:p-8 border border-gray-200 overflow-y-auto space-y-4 no-scrollbar max-h-[500px] md:max-h-full">
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Active Buffers</h3>
              <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">Gathering</span>
           </div>
           
           <AnimatePresence mode="popLayout">
           {batches.filter(b => b.status === 'Gathering').length > 0 ? (
             batches.filter(b => b.status === 'Gathering').map(batch => (
               <motion.div 
                 key={batch.id}
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.9 }}
                 className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm group hover:border-blue-400 transition-all relative overflow-hidden"
               >
                 <div className="absolute top-0 right-0 px-3 py-1 bg-blue-500 text-white text-[8px] font-black uppercase tracking-widest">
                    3HR Window
                 </div>
                 
                 <div className="flex justify-between items-start mb-4">
                    <div>
                       <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Buffer ID: {batch.id.slice(0,6)}</p>
                       <h4 className="font-black text-gray-900">Anchor Hub Cluster</h4>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Dispatch In</p>
                       <p className="text-sm font-black text-gray-900">{getTimeRemaining(batch.scheduled_at)}</p>
                    </div>
                 </div>
                 
                 <div className="flex items-center gap-2 mb-4">
                    <div className="flex -space-x-2">
                       {[...Array(Math.min(batch.handoffs?.length || 1, 4))].map((_, i) => (
                         <div key={i} className="w-8 h-8 rounded-full bg-blue-50 border-2 border-white flex items-center justify-center">
                            <span className="material-symbols-outlined text-xs text-blue-400">package_2</span>
                         </div>
                       ))}
                    </div>
                    <p className="text-[10px] font-bold text-gray-400">
                       <span className="text-blue-500 font-black">{batch.handoffs?.length || 0} Orders</span> Mapped
                    </p>
                 </div>

                 {/* Displaying My Items in the Batch */}
                 {batch.handoffs && batch.handoffs.length > 0 && (
                   <div className="mb-6 space-y-2">
                     <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1 mb-2">Items in this Buffer</p>
                     {batch.handoffs
                       .filter(h => 
                         (role === 'Restaurant' || role === 'Product Seller') ? h.listings?.vendor_id === user?.id 
                         : h.claimer_id === user?.id
                       )
                       .map(h => (
                       <div key={h.id} className="flex justify-between items-center bg-gray-50 rounded-xl p-2 px-3 border border-gray-100">
                         <div className="flex items-center gap-2 overflow-hidden">
                           <span className="material-symbols-outlined text-[14px] text-gray-400">inventory_2</span>
                           <span className="text-xs font-bold text-gray-900 truncate">{h.listings?.title || h.listings?.name || 'Unknown Item'}</span>
                         </div>
                         <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${h.status === 'Completed' ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'}`}>
                           {h.status || 'Pending'}
                         </span>
                       </div>
                     ))}
                   </div>
                 )}

                 <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (batch.handoffs?.length || 1) * 25)}%` }}
                      transition={{ duration: 1 }}
                    />
                 </div>
               </motion.div>
             ))
           ) : (
             <div className="py-20 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                   <span className="material-symbols-outlined text-3xl text-gray-300">hub</span>
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Awaiting Buffer Signal</p>
                <p className="text-[9px] text-gray-300 font-bold uppercase mt-1">No active anchor orders in your region.</p>
             </div>
           )}
           </AnimatePresence>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
         <div className="bg-white p-6 md:p-8 rounded-3xl md:rounded-[40px] border border-gray-100 shadow-sm">
            <span className="material-symbols-outlined text-3xl text-primary mb-4">route</span>
            <h5 className="font-black text-gray-900 mb-1 text-sm uppercase">Smart Routing</h5>
            <p className="text-xs text-gray-500 font-medium">Dynamic delivery paths updated in real-time based on traffic and cluster density.</p>
         </div>
         <div className="bg-white p-6 md:p-8 rounded-3xl md:rounded-[40px] border border-gray-100 shadow-sm">
            <span className="material-symbols-outlined text-3xl text-tertiary mb-4">nest_eco_leaf</span>
            <h5 className="font-black text-gray-900 mb-1 text-sm uppercase">Carbon Credits</h5>
            <p className="text-xs text-gray-500 font-medium">Earn institutional carbon credits for every consolidated redistribution run.</p>
         </div>
         <div className="bg-white p-6 md:p-8 rounded-3xl md:rounded-[40px] border border-gray-100 shadow-sm">
            <span className="material-symbols-outlined text-3xl text-amber-500 mb-4">schedule</span>
            <h5 className="font-black text-gray-900 mb-1 text-sm uppercase">Buffer Buffer</h5>
            <p className="text-xs text-gray-500 font-medium">Fixed 3-hour pooling window ensures maximum efficiency without compromising freshness.</p>
         </div>
         <div className="bg-white p-6 md:p-8 rounded-3xl md:rounded-[40px] border border-gray-100 shadow-sm">
            <span className="material-symbols-outlined text-3xl text-gray-900 mb-4">monitoring</span>
            <h5 className="font-black text-gray-900 mb-1 text-sm uppercase">Cost Arbitrage</h5>
            <p className="text-xs text-gray-500 font-medium">Save up to 40% on delivery costs through shared-mile redistribution logic.</p>
         </div>
      </div>
    </div>
  );
};

export default Logistics;
