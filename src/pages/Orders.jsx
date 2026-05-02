import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '../supabaseClient';
import StatusOverlay from '../components/StatusOverlay';
import { motion, AnimatePresence } from 'framer-motion';
import QRScanner from '../components/QRScanner';

// Custom marker icons
const deliveryIcon = L.divIcon({
  className: 'delivery-icon',
  html: '<div style="font-size: 24px;">🚚</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const homeIcon = L.divIcon({
  className: 'home-icon',
  html: '<div style="font-size: 24px;">🏠</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const Orders = () => {
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showQRSecret, setShowQRSecret] = useState(false);
  const [status, setStatus] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      setUser(authUser);
      
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', authUser.id).single();
      setProfile(prof);

      let query = supabase.from('handoffs').select('*, listings!inner(name, price, vendor_id, weight, profiles(location_lat, location_lng)), profiles!handoffs_claimer_id_fkey(full_name), delivery_batches(scheduled_at, status)');
      
      if (prof.role === 'Restaurant' || prof.role === 'Product Seller') {
        query = query.eq('listings.vendor_id', authUser.id);
      } else {
        query = query.eq('claimer_id', authUser.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (data) setTransactionHistory(data);
    }
    setLoading(false);
  };

  const [facingMode, setFacingMode] = useState('environment');

  const handleVerifyScan = async (scannedCode) => {
    if (!selectedTx || !scannedCode) return;

    if (scannedCode === selectedTx.qr_secret || scannedCode === selectedTx.id || scannedCode === `ZR-${selectedTx.id.slice(0,8).toUpperCase()}`) {
      const { error: hError } = await supabase
        .from('handoffs')
        .update({ status: 'Completed' })
        .eq('id', selectedTx.id);

      if (!hError) {
        const weight = selectedTx.weight || selectedTx.listings?.weight || 0;
        const quantity = selectedTx.quantity_ordered || 1;
        const vendorId = selectedTx.listings.vendor_id;
        const claimerId = selectedTx.claimer_id;

        // Calculate impact metrics
        const carbonOffset = (weight * 2.5).toFixed(2);
        const meals = Math.floor(weight / 0.5);

        // Update Vendor Stats
        const { data: vendorProf } = await supabase.from('profiles').select('*').eq('id', vendorId).single();
        await supabase.from('profiles').update({ 
          total_redirected_weight: (vendorProf?.total_redirected_weight || 0) + weight,
          total_items_saved: (vendorProf?.total_items_saved || 0) + quantity,
          carbon_offset: Number((vendorProf?.carbon_offset || 0)) + Number(carbonOffset),
          meals_provided: (vendorProf?.meals_provided || 0) + meals
        }).eq('id', vendorId);

        // Update Claimer (NGO/Consumer) Stats
        const { data: myProf } = await supabase.from('profiles').select('*').eq('id', claimerId).single();
        await supabase.from('profiles').update({ 
          points: (myProf?.points || 0) + 100,
          total_redirected_weight: (myProf?.total_redirected_weight || 0) + weight,
          total_items_saved: (myProf?.total_items_saved || 0) + quantity,
          carbon_offset: Number((myProf?.carbon_offset || 0)) + Number(carbonOffset),
          meals_provided: (myProf?.meals_provided || 0) + meals
        }).eq('id', claimerId);

        setStatus({ type: 'success', message: 'Handoff verified! Impact metrics synchronized across the network.' });
        setShowTxModal(false);
        setScanning(false);
        fetchData();
      }
    } else {
      setStatus({ type: 'error', message: 'Invalid verification code. Please check and try again.' });
    }
  };

  const calculateDeliveryTime = (createdAt) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diff = now - created;
    const remaining = Math.max(0, 45 - Math.floor(diff / (1000 * 60)));
    return remaining > 0 ? `Arriving in ${remaining} mins` : "Arriving shortly";
  };

  if (loading) return (
    <div className="pt-24 flex items-center justify-center min-h-screen">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const isSeller = profile?.role === 'Restaurant' || profile?.role === 'Product Seller';

  return (
    <div className="pt-24 px-4 md:px-6 max-w-4xl mx-auto pb-24 min-h-screen">
      <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">{isSeller ? 'Selling History' : 'Purchase History'}</h1>
          <p className="text-gray-500 font-medium">Verified redistribution records and impact tracking.</p>
        </div>
        <Link to="/profile" className="w-12 h-12 bg-white border border-gray-100 rounded-2xl flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors shadow-sm">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
      </div>

      {transactionHistory.length > 0 ? (
        <div className="space-y-4">
          {transactionHistory.map(item => (
            <div 
              key={item.id} 
              onClick={() => { setSelectedTx(item); setShowTxModal(true); setShowQRSecret(false); }}
              className="bg-white rounded-3xl md:rounded-[32px] border border-gray-100 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between cursor-pointer hover:border-primary transition-all shadow-sm group gap-4 md:gap-0"
            >
              <div className="flex items-center gap-4 md:gap-6">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-primary/5 group-hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-3xl">package_2</span>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900">{item.listings?.name}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(item.created_at).toLocaleDateString()}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      item.status === 'Completed' ? 'bg-green-50 text-green-600' : 
                      item.status === 'In Transit' ? 'bg-primary/5 text-primary animate-pulse' : 'bg-gray-50 text-gray-400'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-left md:text-right">
                <p className="font-black text-gray-900 text-lg md:text-xl tracking-tighter">₹{item.bid_amount || item.listings?.price}</p>
                <p className="text-[9px] font-black text-primary uppercase tracking-widest mt-1">{isSeller ? 'Redirected' : 'Acquired'}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-[40px] border border-dashed border-gray-200 p-12 md:p-20 text-center">
           <span className="material-symbols-outlined text-6xl text-gray-200 mb-4">history</span>
           <p className="text-gray-500 font-medium italic">No redistribution records found yet.</p>
        </div>
      )}

      {/* Zepto-Style Transaction Modal */}
      <AnimatePresence>
        {showTxModal && selectedTx && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTxModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div 
              initial={{ y: 100, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: 100, opacity: 0 }}
              className="bg-white rounded-3xl md:rounded-[40px] w-full max-w-lg overflow-hidden relative shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-start">
                <div>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mb-2 inline-block ${
                    selectedTx.status === 'Completed' ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'
                  }`}>
                    {selectedTx.status}
                  </span>
                  <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">{selectedTx.listings?.name}</h3>
                  <p className="text-gray-500 font-medium text-[10px] md:text-xs mt-1">Transaction Ref: {selectedTx.id.slice(0,8).toUpperCase()}</p>
                </div>
                <button onClick={() => setShowTxModal(false)} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Logistics View Logic */}
              {selectedTx.fulfillment_type === 'Self-Pickup' ? (
                <div className="h-48 md:h-64 bg-gray-900 flex flex-col items-center justify-center text-center p-6 md:p-8 relative overflow-hidden">
                   <div className="absolute inset-0 opacity-20">
                      <MapContainer center={[selectedTx.listings?.profiles?.location_lat || 12.9716, selectedTx.listings?.profiles?.location_lng || 77.5946]} zoom={13} zoomControl={false} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                      </MapContainer>
                   </div>
                   <div className="relative z-10">
                      <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4 mx-auto backdrop-blur-md">
                        <span className="material-symbols-outlined text-4xl text-white">directions_run</span>
                      </div>
                      <h4 className="text-xl font-black text-white tracking-tight">Self-Pickup Mode</h4>
                      <button 
                        onClick={() => {
                          const lat = selectedTx.listings?.profiles?.location_lat;
                          const lng = selectedTx.listings?.profiles?.location_lng;
                          if (lat && lng) window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                        }}
                        className="mt-4 px-6 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg"
                      >
                        Navigate to Vendor
                      </button>
                   </div>
                </div>
              ) : (selectedTx.status === 'In Transit' || selectedTx.status === 'Accepted') ? (
                <div className="h-48 md:h-64 relative bg-gray-100">
                  <MapContainer center={[selectedTx.bid_location_lat || 12.9716, selectedTx.bid_location_lng || 77.5946]} zoom={15} zoomControl={false} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                    <Marker position={[selectedTx.bid_location_lat || 12.9716, selectedTx.bid_location_lng || 77.5946]} icon={deliveryIcon} />
                    <Marker position={[selectedTx.listings?.profiles?.location_lat || 12.9716, selectedTx.listings?.profiles?.location_lng || 77.5946]} icon={homeIcon} />
                  </MapContainer>
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                       <span className="flex h-2 w-2 rounded-full bg-primary animate-ping"></span>
                       <span className="text-[9px] font-black text-gray-900 uppercase tracking-widest">
                         {selectedTx.delivery_batches ? 'Batch Delivery active' : 'Direct Dispatch active'}
                       </span>
                    </div>
                    {selectedTx.delivery_batches?.scheduled_at && (
                      <span className="text-[8px] font-bold text-primary uppercase">
                        Scheduled: {new Date(selectedTx.delivery_batches.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Product Details Section */}
              <div className="p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4 md:gap-8">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Fulfillment</p>
                    <p className="text-base md:text-lg font-black text-gray-900 tracking-tighter flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-sm">
                        {selectedTx.fulfillment_type === 'Self-Pickup' ? 'person_pin_circle' : 'local_shipping'}
                      </span>
                      {selectedTx.fulfillment_type}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Market Value</p>
                    <p className="text-base md:text-lg font-black text-gray-900 tracking-tighter">₹{selectedTx.bid_amount || selectedTx.listings?.price}</p>
                  </div>
                </div>

                  {!isSeller && selectedTx.status === 'In Transit' && (
                    <div className="space-y-3">
                      {scanning ? (
                        <div className="relative rounded-[28px] overflow-hidden bg-black border-4 border-primary/20 shadow-2xl" style={{height: '280px'}}>
                           {!window.isSecureContext && (
                             <div className="absolute inset-0 z-50 bg-gray-900/90 flex flex-col items-center justify-center p-6 text-center">
                               <span className="material-symbols-outlined text-4xl text-amber-500 mb-4">security</span>
                               <p className="text-white text-xs font-black uppercase tracking-widest mb-2">Security Restriction</p>
                               <p className="text-gray-400 text-[10px] font-medium leading-relaxed">Camera requires HTTPS or Localhost. Use manual entry below.</p>
                               <button onClick={() => setScanning(false)} className="mt-6 text-primary font-black text-[10px] uppercase tracking-widest">Dismiss</button>
                             </div>
                           )}
                           <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                              <span className="material-symbols-outlined text-3xl text-white/20 animate-spin mb-2">progress_activity</span>
                              <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em]">Initializing Camera...</p>
                           </div>
                           <QRScanner
                              onResult={(text) => {
                                if (text) { handleVerifyScan(text); }
                              }}
                              facingMode={facingMode}
                              className="w-full h-full relative z-20"
                           />
                           <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
                              <div className="w-44 h-44 border-2 border-primary rounded-3xl animate-pulse flex items-center justify-center">
                                 <div className="w-full h-[2px] bg-primary/50 animate-scan shadow-[0_0_15px_rgba(46,204,113,0.6)]"></div>
                              </div>
                           </div>
                           <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-[40]">
                              <button 
                                onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                                className="px-3 py-1.5 bg-white/20 backdrop-blur-md text-white rounded-full text-[9px] font-black uppercase tracking-widest border border-white/20 hover:bg-white/30 transition-colors flex items-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-xs">flip_camera_ios</span>
                                Switch
                              </button>
                              <button 
                                onClick={() => setScanning(false)}
                                className="px-4 py-1.5 bg-white/20 backdrop-blur-md text-white rounded-full text-[9px] font-black uppercase tracking-widest border border-white/20 hover:bg-white/30 transition-colors"
                              >
                                Cancel
                              </button>
                           </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setScanning(true)}
                          className="w-full py-5 bg-primary text-white rounded-[20px] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                        >
                          <span className="material-symbols-outlined text-xl">qr_code_scanner</span>
                          Scan QR to Verify
                        </button>
                      )}

                      {/* Manual QR Code Entry */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id="manual-qr-code"
                          placeholder="Or enter QR code manually..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.value.trim()) {
                              handleVerifyScan(e.target.value.trim());
                              e.target.value = '';
                            }
                          }}
                          className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:font-medium placeholder:text-gray-400"
                        />
                        <button
                          onClick={() => {
                            const input = document.getElementById('manual-qr-code');
                            if (input?.value?.trim()) {
                              handleVerifyScan(input.value.trim());
                              input.value = '';
                            }
                          }}
                          className="px-4 py-3 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-primary transition-colors shrink-0"
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Seller Action: Show QR Code */}
                  {isSeller && (selectedTx.status === 'In Transit' || selectedTx.status === 'Accepted') && (
                    <div className="space-y-4">
                      {showQRSecret ? (
                        <div className="bg-gray-50 rounded-[32px] p-8 border border-gray-100 text-center animate-in fade-in zoom-in-95">
                           <div className="w-48 h-48 bg-white mx-auto mb-6 p-4 rounded-3xl border border-gray-100 shadow-inner flex items-center justify-center">
                              <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${selectedTx.qr_secret || selectedTx.id}`} 
                                alt="QR Code"
                                className="w-full h-full object-contain"
                              />
                           </div>
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Handoff Verification Code</p>
                           <p className="text-4xl font-black text-gray-900 tracking-widest font-mono mb-4">{selectedTx.qr_secret || '---'}</p>
                           <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed px-4">Recipent must scan or enter code to finalize the redistribution cycle.</p>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setShowQRSecret(true)}
                          className="w-full py-6 bg-gray-900 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4"
                        >
                          <span className="material-symbols-outlined text-2xl">qr_code</span>
                          Show Verification QR
                        </button>
                      )}
                    </div>
                  )}

                  {/* Completion Status */}
                  {selectedTx.status === 'Completed' && (
                    <div className="bg-green-50 border border-green-100 rounded-[24px] p-6 flex items-center gap-4">
                       <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-green-600 text-2xl">verified</span>
                       </div>
                       <div>
                          <p className="font-black text-green-700 text-sm">Transfer Successfully Verified</p>
                          <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest mt-0.5">Environmental impact locked into blockchain records.</p>
                       </div>
                    </div>
                  )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <StatusOverlay status={status} onClose={() => setStatus(null)} />
    </div>
  );
};

export default Orders;
