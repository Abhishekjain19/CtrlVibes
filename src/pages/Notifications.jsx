import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';
import StatusOverlay from '../components/StatusOverlay';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Fetch general notifications
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*, handoffs(listing_id)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (notifs) setNotifications(notifs);

      // Fetch incoming requests from handoffs
      const { data: requests } = await supabase
        .from('handoffs')
        .select('*, listings(name, vendor_id), profiles!handoffs_claimer_id_fkey(full_name)')
        .eq('listings.vendor_id', user.id)
        .eq('status', 'Requested');
      
      if (requests) setIncomingRequests(requests.filter(r => r.listings));
    }
  };

  const handleAccept = async (id, listingId, claimerId, itemName, notifId = null) => {
    // Fetch handoff and listing details
    const { data: handoff } = await supabase.from('handoffs').select('*, listings(*)').eq('id', id).single();
    if (!handoff) return;

    let batchIdToSet = handoff.batch_id;
    if (!batchIdToSet) {
       const { data: bData } = await supabase.from('delivery_batches').select('id').eq('status', 'Gathering').limit(1);
       if (bData && bData.length > 0) batchIdToSet = bData[0].id;
    }

    const qrSecret = Math.random().toString(36).substring(2, 15);
    const { error: hError } = await supabase
      .from('handoffs')
      .update({ 
        status: 'In Transit',
        qr_secret: qrSecret,
        batch_id: batchIdToSet
      })
      .eq('id', id);
      
    if (!hError) {
      if (listingId && handoff.listings) {
        const listing = handoff.listings;
        const qtyOrdered = handoff.quantity_ordered || 1;
        const currentStock = listing.stock || 1;
        const newStock = Math.max(0, currentStock - qtyOrdered);

        let newStatus = 'Live';
        if (newStock <= 0 || listing.type === 'Cooked') {
          newStatus = 'Claimed'; // Hidden from marketplace
        }

        await supabase.from('listings').update({ 
          status: newStatus,
          stock: newStock 
        }).eq('id', listingId);
      }
      
      if (notifId) {
        await supabase.from('notifications').update({ status: 'accepted' }).eq('id', notifId);
      }

      // Fetch vendor name for better notification context
      const { data: vendorProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', handoff.listings?.vendor_id)
        .single();
      
      const vendorName = vendorProfile?.full_name || 'The Seller';

      // Notify the Claimer
      await supabase.from('notifications').insert([{
        user_id: claimerId,
        title: 'Order Accepted! 🛍️',
        description: `${vendorName} has accepted your request for "${itemName}". The item is being prepared for delivery.`,
        type: 'success',
        status: 'unread'
      }]);

      setStatus({ type: 'success', message: `Request accepted! ${itemName} is now In Transit.` });
      fetchData();
    }
  };

  const handleReject = async (id, claimerId, itemName, notifId = null) => {
    // Fetch handoff details to get vendor_id
    const { data: handoff } = await supabase
      .from('handoffs')
      .select('*, listings(vendor_id)')
      .eq('id', id)
      .single();

    const { error: hError } = await supabase
      .from('handoffs')
      .update({ status: 'Rejected' })
      .eq('id', id);
      
    if (!hError) {
      if (notifId) {
        await supabase.from('notifications').update({ status: 'rejected' }).eq('id', notifId);
      }

      const { data: vendorProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', handoff?.listings?.vendor_id)
        .single();
      
      const vendorName = vendorProfile?.full_name || 'The Seller';

      // Notify the Claimer
      await supabase.from('notifications').insert([{
        user_id: claimerId,
        title: 'Request Declined',
        description: `${vendorName} was unable to accept your request for "${itemName}" at this time.`,
        type: 'warning',
        status: 'unread'
      }]);

      setStatus({ type: 'success', message: 'Request rejected.' });
      fetchData();
    }
  };

  const handleNotificationClick = (item) => {
    // Buttons in the card already handle interactions, no need for prompt on click
  };

  const combinedNotifications = [
    ...notifications.map(n => ({ ...n, pulseType: 'notification' })),
    ...incomingRequests.map(r => ({
      id: r.id,
      title: 'New Request Received',
      description: `${r.profiles?.full_name} has requested your surplus: ${r.listings?.name}. Bid Amount: ₹${r.bid_amount}${r.bid_location_text ? ` | Location: ${r.bid_location_text}` : ''}`,
      created_at: r.created_at,
      pulseType: 'request',
      type: 'request',
      status: 'pending',
      requestData: r
    }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="pt-24 px-6 max-w-4xl mx-auto pb-24 min-h-screen">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Platform Notifications</h1>
        <p className="text-gray-500 mt-1">Real-time alerts and logistical updates from across the Zerra ecosystem.</p>
      </div>

      <div className="space-y-4">
        {combinedNotifications.length > 0 ? combinedNotifications.map((notif, idx) => (
          <motion.div 
            key={notif.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => handleNotificationClick(notif)}
            className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col md:flex-row items-start gap-6 group hover:border-primary/30 transition-all cursor-pointer"
          >
            <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${
              notif.type === 'success' ? 'bg-green-50 text-primary' : 
              notif.type === 'warning' ? 'bg-amber-50 text-amber-600' : 
              notif.type === 'request' ? 'bg-purple-50 text-purple-600' :
              'bg-blue-50 text-blue-600'
            }`}>
              <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>
                {notif.type === 'success' ? 'check_circle' : 
                 notif.type === 'warning' ? 'inventory_2' : 
                 notif.type === 'request' ? 'person_pin' :
                 'notifications'}
              </span>
            </div>
            
            <div className="flex-1 w-full">
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-lg font-bold text-gray-900 leading-tight group-hover:text-primary transition-colors">{notif.title}</h3>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {new Date(notif.created_at).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-gray-500 font-medium text-sm leading-relaxed mb-4">{notif.description}</p>
              
              {notif.pulseType === 'request' && notif.status === 'pending' && (
                <div className="flex items-center gap-4 mt-4">
                  <button onClick={(e) => { e.stopPropagation(); handleAccept(notif.id, notif.requestData.listing_id, notif.requestData.claimer_id, notif.requestData.listings?.name); }} className="px-6 py-2 bg-primary text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-md hover:scale-105 transition-all">
                    Accept
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleReject(notif.id, notif.requestData.claimer_id, notif.requestData.listings?.name); }} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all">
                    Reject
                  </button>
                </div>
              )}
              {notif.type === 'request' && notif.status === 'accepted' && (
                <p className="text-xs font-bold text-green-600 uppercase mt-2">Request Accepted</p>
              )}
              {notif.type === 'request' && notif.status === 'rejected' && (
                <p className="text-xs font-bold text-red-600 uppercase mt-2">Request Rejected</p>
              )}
            </div>

            <div className="hidden md:block w-2 h-2 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity self-center"></div>
          </motion.div>
        )) : (
          <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
            <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">notifications_off</span>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">No notifications found</p>
          </div>
        )}
      </div>

      <button className="w-full mt-10 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all">
        Load Previous Notifications
      </button>
      <StatusOverlay status={status} onClose={() => setStatus(null)} />
    </div>
  );
};

export default Notifications;
