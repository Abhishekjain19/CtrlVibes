import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import StatusOverlay from '../components/StatusOverlay';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const Discover = () => {
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || 'Consumer');
  const [userName, setUserName] = useState(localStorage.getItem('userName') || 'A User');
  const [selectedItem, setSelectedItem] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [ngoLocation, setNgoLocation] = useState('');
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const [activeBatch, setActiveBatch] = useState(null);
  const [showVendorMap, setShowVendorMap] = useState(false);
  const [vendorLocation, setVendorLocation] = useState(null);
  const [userLiveLocation, setUserLiveLocation] = useState(null);

  useEffect(() => {
    if (selectedItem && selectedItem.profiles?.role === 'Product Seller') {
      fetchNearbyBatch();
    } else {
      setActiveBatch(null);
    }
  }, [selectedItem]);

  const fetchNearbyBatch = async () => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      
      // Call RPC or simple query to find gathering batches within ~3km
      // For simplicity, we'll query public.delivery_batches directly
      const { data, error } = await supabase
        .from('delivery_batches')
        .select('*')
        .eq('status', 'Gathering')
        .gt('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true });

      if (data && data.length > 0) {
        // Simple client-side distance check (approx 0.03 degrees ~ 3km)
        const nearby = data.find(b => 
          Math.abs(b.center_lat - lat) < 0.03 && 
          Math.abs(b.center_lng - lng) < 0.03
        );
        if (nearby) setActiveBatch(nearby);
      }
    });
  };

  useEffect(() => {
    fetchItems();
    fetchWishlist();
    fetchRequests();
    fetchUserRole();
  }, []);

  const fetchUserRole = async () => {
    const role = localStorage.getItem('userRole');
    const name = localStorage.getItem('userName');
    if (role) setUserRole(role);
    if (name) setUserName(name);
  };

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('listings')
      .select('*, profiles(full_name, role)')
      .eq('status', 'Live');
    
    if (data) setItems(data);
    setLoading(false);
  };

  const fetchWishlist = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('wishlists')
        .select('vendor_id')
        .eq('user_id', user.id);
      
      if (data) setWishlist(data.map(w => w.vendor_id));
    }
  };

  const fetchRequests = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('handoffs')
        .select('listing_id')
        .eq('claimer_id', user.id);
      
      if (data) setRequests(data.map(r => r.listing_id));
    }
  };

  const toggleWishlist = async (vendorId, vendorRole) => {
    if (vendorRole !== 'Restaurant') {
      setStatus({ type: 'error', message: 'Only restaurants can be added to your wishlist!' });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus({ type: 'error', message: 'Please login to wishlist restaurants' });
      return;
    }

    const isWishlisted = wishlist.includes(vendorId);
    if (isWishlisted) {
      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', user.id)
        .eq('vendor_id', vendorId);
      
      if (!error) setWishlist(prev => prev.filter(id => id !== vendorId));
    } else {
      const { error } = await supabase
        .from('wishlists')
        .insert([{ user_id: user.id, vendor_id: vendorId }]);
      
      if (!error) setWishlist(prev => [...prev, vendorId]);
    }
  };

  const [orderQuantity, setOrderQuantity] = useState(1);

  const [fulfillmentType, setFulfillmentType] = useState('Delivery');

  const handleReserve = async (item) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setStatus({ type: 'error', message: 'Please login to reserve items' });
      return;
    }

    const name = userName || user.email;

    // Capture current location if not provided
    let lat = 12.9716;
    let lng = 77.5946;

    if (!ngoLocation) {
        const getPosition = () => {
          return new Promise((resolve) => {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => resolve({ lat: 12.9716, lng: 77.5946 }),
                { timeout: 5000 }
              );
            } else {
              resolve({ lat: 12.9716, lng: 77.5946 });
            }
          });
        };

        const pos = await getPosition();
        lat = pos.lat;
        lng = pos.lng;
    }

    // Restaurant items are sold as a whole batch (all available stock)
    // Product Seller items allow selecting specific units
    const isRestaurant = item.profiles?.role === 'Restaurant';
    const finalQuantity = isRestaurant ? (item.stock || 1) : orderQuantity;

    // Ensure we have a batch ID assigned
    let currentBatchId = activeBatch ? activeBatch.id : null;
    if (!currentBatchId) {
       const { data: batchData } = await supabase
         .from('delivery_batches')
         .select('id')
         .eq('status', 'Gathering')
         .limit(1);
       if (batchData && batchData.length > 0) {
         currentBatchId = batchData[0].id;
       }
    }

    const { error } = await supabase
      .from('handoffs')
      .insert([{
        listing_id: item.id,
        claimer_id: user.id,
        status: 'Requested',
        batch_id: currentBatchId,
        bid_amount: bidAmount || item.price || 0,
        bid_location_lat: lat,
        bid_location_lng: lng,
        bid_location_text: ngoLocation,
        weight: item.weight || 0,
        quantity_ordered: finalQuantity,
        fulfillment_type: fulfillmentType,
        qr_code: `ZR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
      }]);

    if (!error) {
      // Update inventory stock
      const currentStock = item.stock || 1;
      const newStock = Math.max(0, currentStock - finalQuantity);
      
      await supabase
        .from('listings')
        .update({ 
          stock: newStock,
          status: newStock <= 0 ? 'Sold' : 'Live'
        })
        .eq('id', item.id);

      // Notify the vendor
      if (item.vendor_id) {
        await supabase.from('notifications').insert([{
          user_id: item.vendor_id,
          title: 'New Bid Request!',
          description: `${userName} has requested ${finalQuantity}x "${item.name}" for ₹${bidAmount || item.price || 0}. Check your dashboard to respond.`,
          type: 'request',
          status: 'unread'
        }]);
      }

      setRequests(prev => [...prev, item.id]);
      setStatus({ type: 'success', message: 'Request sent successfully! Track it in your Profile.' });
      fetchItems();
      setBidAmount('');
      setNgoLocation('');
      setOrderQuantity(1);
    } else {
      setStatus({ type: 'error', message: 'Failed to send request: ' + error.message });
    }
  };

  const getFilteredItems = () => {
    if (filter === 'all') return items;
    if (filter === 'Food') return items.filter(i => i.type === 'Cooked');
    if (filter === 'Packed Items') return items.filter(i => i.type === 'Packed');
    return items;
  };

  const renderItemDetails = () => (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedItem(null)}></div>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-2xl bg-white rounded-3xl md:rounded-[40px] overflow-hidden shadow-2xl max-h-[95vh] md:max-h-[90vh] flex flex-col md:flex-row"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 w-full">
          <div className="aspect-square bg-gray-100 flex items-center justify-center relative">
             <span className="material-symbols-outlined text-9xl text-gray-200">
               {selectedItem.type === 'Cooked' ? 'restaurant' : 'inventory_2'}
             </span>
             <div className="absolute top-6 left-6 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{selectedItem.type}</p>
             </div>
          </div>
          <div className="p-6 md:p-8 flex flex-col max-h-[50vh] md:max-h-[80vh] overflow-y-auto">
             <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">{selectedItem.name}</h2>
                  <p className="text-gray-500 font-bold mt-1 italic">{selectedItem.profiles?.full_name}</p>
                </div>
                <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-gray-900 p-2">
                  <span className="material-symbols-outlined">close</span>
                </button>
             </div>

             <div className="space-y-4 mb-6 flex-1">
                <div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Description</p>
                   <p className="text-sm text-gray-600 leading-relaxed font-medium">High-fidelity surplus listed from institutional network. Guaranteed freshness and handled with redistribution protocols.</p>
                </div>

                 {/* Vendor Location Map Trigger */}
                 <div
                   onClick={async () => {
                     const { data: vp } = await supabase
                       .from('profiles')
                       .select('location_lat, location_lng, full_name')
                       .eq('id', selectedItem.vendor_id)
                       .single();
                     const loc = (vp && vp.location_lat && vp.location_lng)
                       ? { lat: parseFloat(vp.location_lat), lng: parseFloat(vp.location_lng), name: vp.full_name }
                       : { lat: 12.9716, lng: 77.5946, name: (selectedItem.profiles && selectedItem.profiles.full_name) || 'Vendor' };
                     setVendorLocation(loc);
                     if (navigator.geolocation) {
                       navigator.geolocation.getCurrentPosition(
                         function(pos) { setUserLiveLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
                         function() { setUserLiveLocation(null); },
                         { timeout: 5000 }
                       );
                     }
                     setShowVendorMap(true);
                   }}
                   className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl p-3 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all group"
                 >
                   <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                     <span className="material-symbols-outlined text-primary text-lg">location_on</span>
                   </div>
                   <div className="flex-1 min-w-0">
                     <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Vendor Location</p>
                     <p className="text-sm font-black text-gray-900 truncate">{(selectedItem.profiles && selectedItem.profiles.full_name) || 'View on Map'}</p>
                   </div>
                   <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors text-sm">open_in_new</span>
                 </div>

                 {userRole === 'NGO' && (
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                      {['Delivery', 'Self-Pickup'].map(type => (
                        <button 
                          key={type}
                          onClick={() => setFulfillmentType(type)}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${fulfillmentType === type ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Alter Bid Amount (₹)</label>
                      <input 
                        type="number" 
                        value={bidAmount} 
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder={`Default: ₹${selectedItem.price || 0}`}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>

                    {fulfillmentType === 'Delivery' && (
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">NGO Delivery Location</label>
                        <input 
                          type="text" 
                          value={ngoLocation} 
                          onChange={(e) => setNgoLocation(e.target.value)}
                          placeholder="e.g. 12th Cross, Indiranagar"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                      </div>
                    )}
                  </div>
                )}

                {activeBatch && (
                  <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-center gap-4 mb-4">
                     <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-xl animate-pulse">local_shipping</span>
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Scheduled Logistics Batch</p>
                        <p className="text-sm font-black text-gray-900">Next Delivery: {new Date(activeBatch.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-[9px] text-gray-400 font-bold mt-0.5">Orders in your area are being grouped for carbon-neutral delivery.</p>
                     </div>
                  </div>
                )}

                {selectedItem.profiles?.role === 'Restaurant' ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-amber-600 text-lg">restaurant</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Full Batch Sale</p>
                      <p className="text-sm font-black text-gray-900">{parseInt(selectedItem.stock) || 1} units — entire stock</p>
                      <p className="text-[9px] text-gray-400 font-bold mt-0.5">Restaurant items are dispatched as a complete batch.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Available Stock</p>
                      <p className="text-lg font-black text-gray-900">{parseInt(selectedItem.stock) > 1 ? parseInt(selectedItem.stock) : (parseInt(selectedItem.quantity) || 1)} <span className="text-xs font-bold text-gray-400">units</span></p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col justify-center">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Select Qty</p>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setOrderQuantity(prev => Math.max(1, prev - 1))}
                          className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">remove</span>
                        </button>
                        <span className="text-base font-black text-gray-900 w-6 text-center">{orderQuantity}</span>
                        <button 
                          onClick={() => setOrderQuantity(prev => Math.min(Math.max((parseInt(selectedItem.stock) > 1 ? parseInt(selectedItem.stock) : parseInt(selectedItem.quantity)) || 1, 1), prev + 1))}
                          className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
             </div>

             <div className="pt-5 mt-5 border-t border-gray-100 flex items-center justify-between gap-4 sticky bottom-0 bg-white">
                <div className="shrink-0">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Price</p>
                   <p className="text-xl md:text-2xl font-black text-primary tracking-tighter">
                     {selectedItem.price ? `₹${selectedItem.price}` : 'Free'}
                   </p>
                </div>
                <button 
                  onClick={() => {
                    handleReserve(selectedItem);
                    setSelectedItem(null);
                  }}
                  className="shrink-0 px-5 md:px-7 py-3 md:py-3.5 bg-gray-900 text-white rounded-xl md:rounded-[20px] font-black text-[10px] md:text-xs uppercase tracking-[0.15em] shadow-xl hover:bg-primary transition-all"
                >
                  Confirm Request
                </button>
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="pt-24 px-6 max-w-7xl mx-auto pb-24 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="w-full md:w-auto">
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Marketplace</h1>
          <p className="text-gray-500 mt-1 text-sm md:text-base font-medium">Discover surplus available for immediate redistribution.</p>
        </div>
        
        <div className="flex items-center gap-3 overflow-x-auto pb-2 w-full md:w-auto no-scrollbar">
          {['all', 'Food', 'Packed Items'].map(cat => (
            <button 
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-5 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all border ${filter === cat ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
            >
              {cat === 'all' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : getFilteredItems().length > 0 ? (
          getFilteredItems().map(item => (
            <div 
              key={item.id} 
              onClick={() => setSelectedItem(item)}
              className={`rounded-[32px] border shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden group flex flex-col h-full cursor-pointer ${requests.includes(item.id) ? 'border-green-200 bg-green-50/30 shadow-green-100/50' : 'bg-white border-gray-100 hover:shadow-primary/5'}`}
            >
              <div className="aspect-[16/10] overflow-hidden relative bg-gray-100 flex items-center justify-center">
                <span className={`material-symbols-outlined text-6xl ${requests.includes(item.id) ? 'text-green-200' : 'text-gray-200'}`}>{item.type === 'Cooked' ? 'restaurant' : 'inventory_2'}</span>
                <div className={`absolute top-4 left-4 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${requests.includes(item.id) ? 'bg-green-500 text-white border-green-400' : 'bg-white/90 text-primary border-white/20'}`}>
                  {requests.includes(item.id) ? 'Pending Request' : (item.type === 'Cooked' ? 'Food' : 'Packed')}
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWishlist(item.vendor_id, item.profiles?.role);
                  }}
                  className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-lg group/heart transition-all hover:scale-110 active:scale-95"
                  title="Wishlist Restaurant"
                >
                  <span className={`material-symbols-outlined text-xl transition-colors ${wishlist.includes(item.vendor_id) ? 'text-red-500 fill-current' : 'text-gray-400 group-hover/heart:text-red-400'}`} style={{ fontVariationSettings: wishlist.includes(item.vendor_id) ? "'FILL' 1" : "'FILL' 0" }}>
                    favorite
                  </span>
                </button>
              </div>
              <div className="p-6 md:p-8 flex-1 flex flex-col">
                <h3 className={`text-xl font-bold mb-1 transition-colors ${requests.includes(item.id) ? 'text-green-800' : 'text-gray-900 group-hover:text-primary'}`}>{item.name}</h3>
                <p className="text-sm text-gray-500 mb-6 font-medium">{item.profiles?.full_name || 'Anonymous Vendor'}</p>
                
                <div className="pt-6 border-t border-gray-100 flex justify-between items-center mt-auto">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{requests.includes(item.id) ? 'Status' : 'Reserve for'}</p>
                    <p className={`text-2xl font-extrabold ${requests.includes(item.id) ? 'text-green-600' : 'text-primary'}`}>
                      {requests.includes(item.id) ? 'Sent' : (item.price ? `₹${item.price}` : 'Free')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-500 mb-2">
                      {item.profiles?.role === 'Product Seller' ? `${parseInt(item.stock) > 1 ? parseInt(item.stock) : (parseInt(item.quantity) || 1)} units left` : item.quantity}
                    </p>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!requests.includes(item.id)) {
                          // For Product Sellers, open the detail modal so the user can select quantity
                          // For Restaurants, reserve immediately (whole batch, no quantity choice)
                          if (item.profiles?.role === 'Product Seller') {
                            setSelectedItem(item);
                          } else {
                            handleReserve(item);
                          }
                        }
                      }}
                      className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${requests.includes(item.id) ? 'bg-green-500 text-white cursor-default' : 'bg-gray-900 text-white hover:bg-primary'}`}
                    >
                      {requests.includes(item.id) ? 'Requested' : (item.profiles?.role === 'Product Seller' ? 'Select Units' : 'Reserve')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-gray-50 rounded-[40px] border border-dashed border-gray-200">
             <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">No active listings found in this category</p>
          </div>
        )}
      </div>
      {selectedItem && renderItemDetails()}

      {/* Vendor Location Map Modal */}
      {showVendorMap && vendorLocation && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowVendorMap(false)}></div>
          <div className="relative w-full max-w-2xl bg-white rounded-3xl md:rounded-[40px] overflow-hidden shadow-2xl h-[80vh] md:h-[70vh]">
            <div className="absolute top-5 left-5 z-[4001] bg-white px-3 md:px-4 py-2 rounded-xl md:rounded-2xl shadow-lg border border-gray-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-sm">location_on</span>
              <p className="text-[9px] md:text-[10px] font-black text-gray-900 uppercase tracking-widest">{vendorLocation.name}</p>
            </div>
            <button
              onClick={() => setShowVendorMap(false)}
              className="absolute top-5 right-5 z-[4001] w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg border border-gray-100 text-gray-400 hover:text-gray-900"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
            {userLiveLocation && (
              <div className="absolute bottom-5 left-5 z-[4001] bg-white px-3 md:px-4 py-2 rounded-xl md:rounded-2xl shadow-lg border border-gray-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                <p className="text-[9px] md:text-[10px] font-black text-gray-600 uppercase tracking-widest">Your Live Location</p>
              </div>
            )}
            <MapContainer
              center={[vendorLocation.lat, vendorLocation.lng]}
              zoom={15}
              style={{ width: '100%', height: '100%' }}
              zoomControl={false}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
              <Marker position={[vendorLocation.lat, vendorLocation.lng]}>
                <Popup><b>{vendorLocation.name}</b><br/>Vendor Location</Popup>
              </Marker>
              <Circle center={[vendorLocation.lat, vendorLocation.lng]} radius={200} color="#22c55e" fillColor="#22c55e" fillOpacity={0.1} />
              {userLiveLocation && (
                <Marker position={[userLiveLocation.lat, userLiveLocation.lng]}>
                  <Popup>Your live location</Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        </div>
      )}

      <StatusOverlay status={status} onClose={() => setStatus(null)} />
    </div>
  );
};

export default Discover;
