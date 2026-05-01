import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import StatusOverlay from '../components/StatusOverlay';

// Custom marker icon
const deliveryIcon = L.divIcon({
  className: 'delivery-icon',
  html: '<div style="font-size: 24px;">🚚</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const Inventory = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showScanner, setShowScanner] = useState(false);
  const [inventoryMode, setInventoryMode] = useState(location.state?.mode || 'private'); // private, live, history
  const [inventory, setInventory] = useState([]);
  const [sellingHistory, setSellingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [selectedTx, setSelectedTx] = useState(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const [status, setStatus] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [scanModal, setScanModal] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null); // {expiryDate, daysLeft, urgency, analysis, imageBase64}
  const [editProductName, setEditProductName] = useState(false);
  const [productNameInput, setProductNameInput] = useState('');

  const [isCameraActive, setIsCameraActive] = useState(false);
  const canvasRef = useRef(null);

  const startCamera = async () => {
    setIsCameraActive(true);
    setScanResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Camera access denied or unavailable' });
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      const maxDim = 800;
      let { videoWidth: width, videoHeight: height } = video;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, width, height);
      const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      stopCamera();
      analyzeExpiryWithAI(base64);
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const NVIDIA_KEY = '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';

  const analyzeExpiryWithAI = async (imageBase64) => {
    setScanLoading(true);
    try {
      const resp = await fetch('/nvidia-api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${NVIDIA_KEY}`
        },
        body: JSON.stringify({
          model: "meta/llama-3.2-90b-vision-instruct",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `You are a high-precision retail product analyzer. Analyze the packaging image and extract:
1. Product Name (be specific, e.g. "Amul Gold Milk 500ml")
2. Expiry Date (Format: YYYY-MM-DD)
3. Barcode Number (If a barcode/UPC/EAN is visible, extract the digits)
4. Quantity/Weight (e.g. "500g", "1 Litre")
5. Category (e.g. "Dairy", "Beverage", "Snack", "Bakery")

Return ONLY a JSON object:
{
  "expiry_date": "YYYY-MM-DD", 
  "product_name": "Name",
  "barcode": "Digits or null",
  "quantity": "Amount or null",
  "category": "Category or null",
  "confidence": "high/medium/low",
  "notes": "Brief notes"
}
If no expiry date is found, set "expiry_date": null.
If barcode is not clear, set "barcode": null.`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 512,
          temperature: 0.1
        })
      });
      const data = await resp.json();
      const text = data.choices?.[0]?.message?.content || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      const parsed = JSON.parse(jsonMatch[0]);

      let productName = parsed.product_name;
      let barcode = parsed.barcode;

      // If barcode found but name is missing, try OpenFoodFacts
      if (barcode && (!productName || productName === 'unknown')) {
        try {
          const offResp = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
          const offData = await offResp.json();
          if (offData.status === 1) {
            productName = offData.product.product_name || productName;
          }
        } catch (offErr) {
          console.error("OpenFoodFacts lookup failed", offErr);
        }
      }

      if (!parsed.expiry_date && (!barcode || barcode === 'null') && (!productName || productName === 'unknown')) {
        setScanResult({ error: 'No product info or expiry date found. Try a clearer photo of the packaging or barcode.' });
        setScanLoading(false);
        return;
      }

      const expiry = parsed.expiry_date ? new Date(parsed.expiry_date) : null;
      const now = new Date();
      const daysLeft = expiry ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)) : null;
      const urgency = !expiry ? 'safe' : daysLeft <= 0 ? 'expired' : daysLeft <= 3 ? 'critical' : daysLeft <= 7 ? 'warning' : 'safe';

      setScanResult({ 
        expiryDate: parsed.expiry_date || 'Manual Entry Required', 
        daysLeft, 
        urgency, 
        productName: productName === 'unknown' ? '' : productName, 
        barcode: barcode === 'null' ? null : barcode,
        quantity: parsed.quantity,
        category: parsed.category,
        notes: parsed.notes, 
        imageBase64, 
        confidence: parsed.confidence 
      });
      setProductNameInput(productName === 'unknown' ? '' : productName || '');
      setEditProductName(productName === 'unknown');
    } catch (e) {
      setScanResult({ error: 'AI analysis failed: ' + e.message });
    }
    setScanLoading(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        analyzeExpiryWithAI(base64);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const applyAIScanToInventory = async (targetItemId) => {
    if (!scanResult || scanResult.error) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const expiryDate = scanResult.expiryDate;
    const daysLeft = scanResult.daysLeft;

    if (!targetItemId) {
      // Batch Scan -> CREATE NEW ITEM
      if (daysLeft <= 0) {
        setStatus({ type: 'error', message: 'Item is expired. Not added to inventory.' });
        setScanModal(false);
        return;
      }
      
      const shouldAutoList = daysLeft <= 3;
      const { error } = await supabase.from('listings').insert([{
        vendor_id: user.id,
        name: productNameInput || scanResult.productName || 'Scanned Item',
        expiry_date: expiryDate,
        status: shouldAutoList ? 'Live' : 'Pending',
        urgency: daysLeft <= 3 ? 'High' : daysLeft <= 7 ? 'Medium' : 'Low',
        type: 'Packed',
        ai_analysis: scanResult.notes,
        expiry_notified: shouldAutoList,
        quantity: scanResult.quantity || "1",
        stock: 1,
        barcode: scanResult.barcode,
        category: scanResult.category
      }]);

      if (!error) {
        if (shouldAutoList && !scanResult.notified) {
          const { data: profiles } = await supabase.from('profiles').select('id').in('role', ['NGO', 'Consumer']);
          if (profiles?.length) {
            await supabase.from('notifications').insert(profiles.map(p => ({
              user_id: p.id,
              title: '⚡ Near-Expiry Deal Alert!',
              description: `${productNameInput || scanResult.productName || 'A product'} is expiring in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — grab it at a discount now!`,
              type: 'expiry_alert',
              status: 'unread'
            })));
          }
        }
        setStatus({ type: 'success', message: 'New item added to inventory.' });
      } else {
        setStatus({ type: 'error', message: 'Failed to add item to inventory.' });
      }
    } else if (daysLeft <= 0) {
      // Expired: delete from inventory
      await supabase.from('listings').delete().eq('id', targetItemId);
      setStatus({ type: 'error', message: 'Item expired and removed from inventory.' });
    } else {
      // Update expiry + auto-push to market if near expiry
      const shouldAutoList = daysLeft <= 3;
      await supabase.from('listings').update({
        expiry_date: expiryDate,
        status: shouldAutoList ? 'Live' : 'Pending',
        urgency: daysLeft <= 3 ? 'High' : daysLeft <= 7 ? 'Medium' : 'Low',
        ai_analysis: scanResult.notes,
        expiry_notified: shouldAutoList
      }).eq('id', targetItemId);

      if (shouldAutoList && !scanResult.notified) {
        // Fetch all NGO/Consumer users and notify
        const { data: users } = await supabase.from('profiles').select('id').in('role', ['NGO', 'Consumer']);
        if (users?.length) {
          await supabase.from('notifications').insert(
            users.map(u => ({
              user_id: u.id,
              title: '⚡ Near-Expiry Deal Alert!',
              description: `${scanResult.productName || 'A product'} is expiring in ${daysLeft} day${daysLeft === 1 ? '' : 's'} — grab it at a discount now!`,
              type: 'expiry_alert',
              status: 'unread'
            }))
          );
        }
        setStatus({ type: 'success', message: `Item expires in ${daysLeft} days — pushed to marketplace & users notified!` });
      } else {
        setStatus({ type: 'success', message: `Expiry updated: ${daysLeft} days remaining.` });
      }
    }

    setScanModal(false);
    setScanResult(null);
    checkRoleAndFetch();
  };

  useEffect(() => {
    checkRoleAndFetch();
  }, [inventoryMode]);

  async function checkRoleAndFetch() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    setRole(profile?.role);

    if (profile?.role === 'Restaurant' || profile?.role === 'Product Seller') {
      if (inventoryMode === 'history') {
        const { data: hist } = await supabase
          .from('handoffs')
          .select('*, listings!inner(*), profiles!handoffs_claimer_id_fkey(full_name)')
          .eq('listings.vendor_id', user.id)
          .order('created_at', { ascending: false });
        
        if (hist) setSellingHistory(hist);
      } else {
        const { data } = await supabase
          .from('listings')
          .select('*')
          .eq('vendor_id', user.id)
          .eq('type', profile.role === 'Product Seller' ? 'Packed' : 'Cooked')
          .order('created_at', { ascending: false });
        
        if (data) {
          if (inventoryMode === 'live') {
            setInventory(data.filter(i => i.status === 'Live'));
          } else {
            setInventory(data.filter(i => i.status !== 'Live'));
          }
        }
      }
    }
    setLoading(false);
  };

  const calculateDaysRemaining = (date) => {
    if (!date) return 15;
    const diff = new Date(date) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const listToMarketplace = async (id) => {
    const { error } = await supabase
      .from('listings')
      .update({ status: 'Live' })
      .eq('id', id);
    
    if (!error) checkRoleAndFetch();
  };

  if (!loading && role !== 'Restaurant' && role !== 'Product Seller') {
    return (
      <div className="pt-40 px-6 max-w-7xl mx-auto text-center">
        <div className="bg-white rounded-[40px] border border-gray-100 p-20 shadow-sm max-w-2xl mx-auto">
          <span className="material-symbols-outlined text-6xl text-red-100 mb-6 scale-150">lock</span>
          <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Institutional Access Only</h1>
          <p className="text-gray-500 font-medium mb-8">The Private Inventory Vault is reserved for verified Restaurants and Product Sellers.</p>
          <button onClick={() => navigate('/dashboard')} className="px-10 py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all">Return to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 px-6 max-w-7xl mx-auto pb-24 min-h-screen">
      <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex items-center gap-6">
           <Link to="/profile" className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
           </Link>
           <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Inventory Intelligence</h1>
              <p className="text-gray-500 mt-1 font-medium">Smart expiry monitoring and automated surplus orchestration.</p>
           </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button onClick={() => setInventoryMode('private')} className={`px-6 py-2 text-xs font-black rounded-lg transition-all uppercase tracking-widest ${inventoryMode === 'private' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>Private Vault</button>
            <button onClick={() => setInventoryMode('live')} className={`px-6 py-2 text-xs font-black rounded-lg transition-all uppercase tracking-widest ${inventoryMode === 'live' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>Active</button>
            <button onClick={() => setInventoryMode('history')} className={`px-6 py-2 text-xs font-black rounded-lg transition-all uppercase tracking-widest ${inventoryMode === 'history' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400'}`}>History</button>
          </div>
          <button onClick={() => { window._scanTargetId = null; setScanResult(null); setScanModal(true); }} className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-black transition-all">
            <span className="material-symbols-outlined">barcode_scanner</span>
            Batch Scan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="py-20 text-center">
             <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
             <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Syncing with Vault...</p>
          </div>
        ) : inventoryMode === 'history' ? (
          sellingHistory.length > 0 ? (
            <div className="space-y-4">
              {sellingHistory.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => { setSelectedTx(item); setShowTxModal(true); }}
                  className="bg-white rounded-[32px] border border-gray-100 p-8 flex items-center justify-between cursor-pointer hover:border-primary transition-all shadow-sm group"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-primary/5 group-hover:text-primary transition-colors">
                      <span className="material-symbols-outlined text-3xl">package_2</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">{item.listings?.title || item.listings?.name}</h4>
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
                  <div className="text-right">
                    <p className="font-black text-gray-900 text-xl tracking-tighter">₹{item.bid_amount || item.listings?.price}</p>
                    <p className="text-[9px] font-black text-primary uppercase tracking-widest mt-1">Selling Record</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center bg-gray-50 rounded-[40px] border border-dashed border-gray-200">
               <span className="material-symbols-outlined text-6xl text-gray-200 mb-4">history</span>
               <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">No redistribution history found</p>
            </div>
          )
        ) : inventory.length > 0 ? (
          inventory.map(item => {
            const daysLeft = calculateDaysRemaining(item.expiry_date);
            const isCritical = daysLeft <= 2;
            return (
              <div key={item.id} className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm flex flex-col lg:flex-row items-center gap-8 group hover:shadow-xl transition-all duration-500">
                <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                   <span className="material-symbols-outlined text-4xl text-gray-300">inventory_2</span>
                </div>
                <div className="flex-1 text-center lg:text-left">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-2 mb-2">
                    <h3 className="text-xl font-black text-gray-900">{item.name || item.title}</h3>
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${daysLeft <= 2 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                      {daysLeft <= 0 ? 'Expired' : `${daysLeft} Days to Expiry`}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center lg:justify-start gap-6">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Quantity: <span className="text-gray-900">{item.stock || item.quantity}</span></div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Price: <span className="text-gray-900">{item.price ? `₹${item.price}` : 'Free'}</span></div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => { window._scanTargetId = item.id; setScanResult(null); setScanModal(true); }} className="px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all border-2 border-gray-100 hover:border-gray-200 bg-white text-gray-600 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm">barcode_scanner</span>
                    Scan Expiry
                  </button>
                  <button onClick={() => item.status !== 'Live' && listToMarketplace(item.id)} className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-sm ${item.status === 'Live' ? 'bg-green-50 text-green-600' : 'bg-primary text-white hover:bg-tertiary'}`}>
                    {item.status === 'Live' ? 'Item is Live' : 'Push to Market'}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-20 text-center bg-gray-50 rounded-[40px] border border-dashed border-gray-200">
             <span className="material-symbols-outlined text-6xl text-gray-200 mb-4">inventory</span>
             <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Your {inventoryMode} vault is currently empty</p>
          </div>
        )}
      </div>

      {/* AI Scanner Modal */}
      <AnimatePresence>
        {scanModal && (
          <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setScanModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white rounded-[40px] w-full max-w-md p-8 relative shadow-2xl z-10 border border-gray-100">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-1">NVIDIA NIM Vision AI</p>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">Expiry Date Scanner</h3>
                </div>
                <button onClick={() => setScanModal(false)} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {!scanResult && !scanLoading && (
                <div className="space-y-4">
                  <div className="relative rounded-3xl overflow-hidden bg-gray-900 aspect-[4/3] flex items-center justify-center">
                    {!isCameraActive ? (
                      <button onClick={startCamera} className="text-white flex flex-col items-center gap-2">
                         <span className="material-symbols-outlined text-4xl">videocam</span>
                         <span className="font-bold text-xs tracking-widest uppercase">Start Camera</span>
                      </button>
                    ) : (
                      <>
                        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline />
                        <div className="absolute inset-0 border-4 border-primary/50 m-8 rounded-xl pointer-events-none"></div>
                        <button onClick={captureFrame} className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center hover:scale-105 transition-transform z-10">
                          <div className="w-12 h-12 bg-primary rounded-full pointer-events-none"></div>
                        </button>
                      </>
                    )}
                  </div>
                  
                  <div className="text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">OR</p>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-gray-50 text-gray-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 flex items-center justify-center gap-2">
                       <span className="material-symbols-outlined text-sm">upload</span>
                       Upload Image
                    </button>
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              )}

              {scanLoading && (
                <div className="py-12 text-center">
                  <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="font-black text-gray-900 mb-1">Analyzing with NVIDIA NIM...</p>
                  <p className="text-xs text-gray-400">Vision AI is reading the expiry date</p>
                </div>
              )}

              {scanResult && scanResult.error && (
                <div className="bg-red-50 border border-red-100 rounded-3xl p-6 text-center">
                  <span className="material-symbols-outlined text-3xl text-red-400 mb-2 block">error</span>
                  <p className="font-black text-red-700 text-sm mb-1">{scanResult.error}</p>
                  <button onClick={() => { setScanResult(null); fileInputRef.current?.click(); }} className="mt-4 px-6 py-2 bg-gray-900 text-white rounded-xl font-black text-xs uppercase tracking-widest">Try Again</button>
                </div>
              )}

              {scanResult && !scanResult.error && (
                <div className="space-y-4">
                  <div className={`rounded-3xl p-6 border ${
                    scanResult.urgency === 'expired' ? 'bg-red-50 border-red-200' :
                    scanResult.urgency === 'critical' ? 'bg-orange-50 border-orange-200' :
                    scanResult.urgency === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`material-symbols-outlined text-2xl ${
                        scanResult.urgency === 'expired' ? 'text-red-500' :
                        scanResult.urgency === 'critical' ? 'text-orange-500' :
                        scanResult.urgency === 'warning' ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {scanResult.urgency === 'expired' ? 'dangerous' : scanResult.urgency === 'critical' ? 'warning' : 'check_circle'}
                      </span>
                      <div className="flex-1 w-full max-w-[200px]">
                        {editProductName || scanResult.productName === 'unknown' ? (
                          <input 
                            type="text" 
                            value={productNameInput} 
                            onChange={e => setProductNameInput(e.target.value)}
                            onBlur={() => { setEditProductName(false); setScanResult(r => ({...r, productName: productNameInput || 'unknown'})) }}
                            onKeyDown={e => { if (e.key === 'Enter') { setEditProductName(false); setScanResult(r => ({...r, productName: productNameInput || 'unknown'})) } }}
                            autoFocus
                            placeholder="Enter product name..."
                            className="font-black text-gray-900 border-b-2 border-gray-300 focus:border-primary outline-none bg-transparent w-full transition-colors mb-1 text-base"
                          />
                        ) : (
                          <div className="flex items-center gap-2 group mb-1">
                            <p className="font-black text-gray-900 truncate">{scanResult.productName || 'Product'}</p>
                            <button onClick={() => { setProductNameInput(scanResult.productName === 'unknown' ? '' : scanResult.productName || ''); setEditProductName(true); }} className="text-gray-300 hover:text-primary transition-colors flex shrink-0">
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-gray-500">Confidence: {scanResult.confidence}</p>
                      </div>
                    </div>
                    <p className={`text-2xl font-black ${
                      scanResult.urgency === 'expired' ? 'text-red-700' :
                      scanResult.urgency === 'critical' ? 'text-orange-700' :
                      scanResult.urgency === 'warning' ? 'text-yellow-700' : 'text-green-700'
                    }`}>
                      {scanResult.urgency === 'expired' ? '⛔ EXPIRED' :
                       scanResult.urgency === 'critical' ? `🔴 ${scanResult.daysLeft} days left` :
                       scanResult.urgency === 'warning' ? `🟡 ${scanResult.daysLeft} days left` :
                       `🟢 ${scanResult.daysLeft} days left`}
                    </p>
                    
                    <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                       <div className="space-y-1">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Barcode</p>
                          <p className="text-xs font-bold text-gray-700 font-mono">{scanResult.barcode || 'Not Detected'}</p>
                       </div>
                       <div className="space-y-1 text-right">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Quantity</p>
                          <p className="text-xs font-bold text-gray-700">{scanResult.quantity || 'Unknown'}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Category</p>
                          <p className="text-xs font-bold text-gray-700">{scanResult.category || 'General'}</p>
                       </div>
                       <div className="space-y-1 text-right">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Expiry</p>
                          {scanResult.expiryDate === 'Manual Entry Required' ? (
                            <input 
                              type="date" 
                              onChange={(e) => setScanResult(prev => ({...prev, expiryDate: e.target.value}))}
                              className="text-xs font-bold text-primary border-b border-primary/20 outline-none bg-transparent"
                            />
                          ) : (
                            <p className="text-xs font-bold text-gray-700">{scanResult.expiryDate}</p>
                          )}
                       </div>
                    </div>
                    {scanResult.notes && <p className="text-[10px] text-gray-500 mt-4 italic bg-white/50 p-2 rounded-lg">{scanResult.notes}</p>}
                  </div>

                  {scanResult.urgency === 'expired' ? (
                    <p className="text-sm text-red-600 font-bold text-center">This item will be deleted from inventory.</p>
                  ) : scanResult.urgency === 'critical' ? (
                    <p className="text-sm text-orange-700 font-bold text-center">Will auto-list on marketplace & notify all users.</p>
                  ) : null}

                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => applyAIScanToInventory(window._scanTargetId)}
                      className={`w-full py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 ${
                        scanResult.urgency === 'expired' ? 'bg-red-600 hover:bg-red-700' :
                        scanResult.urgency === 'critical' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-primary hover:bg-primary/80'
                      }`}
                    >
                      {scanResult.urgency === 'expired' ? 'Confirm Deletion' : 'Save to Inventory'}
                    </button>
                    
                    {!window._scanTargetId && (
                      <button 
                        onClick={async () => {
                          await applyAIScanToInventory(null);
                          setScanResult(null);
                          setIsCameraActive(true);
                          startCamera();
                        }}
                        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">add_circle</span>
                        Save & Scan Next
                      </button>
                    )}

                    <div className="flex gap-3">
                      <button onClick={() => { setScanResult(null); setIsCameraActive(true); startCamera(); }} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200">
                        Rescan
                      </button>
                      <button onClick={() => setScanModal(false)} className="flex-1 py-3 bg-white border border-gray-200 text-gray-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Zepto-type Transaction Modal (Seller View) */}
      <AnimatePresence>
        {showTxModal && selectedTx && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTxModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="bg-white rounded-[40px] w-full max-w-lg overflow-hidden relative shadow-2xl flex flex-col">
              <div className="p-8 border-b border-gray-100 flex justify-between items-start">
                <div>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mb-2 inline-block ${selectedTx.status === 'Completed' ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'}`}>{selectedTx.status}</span>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight">{selectedTx.listings?.title || selectedTx.listings?.name}</h3>
                  <p className="text-gray-500 font-medium text-xs mt-1">Order #{selectedTx.id.slice(0,8).toUpperCase()}</p>
                </div>
                <button onClick={() => setShowTxModal(false)} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors"><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="h-64 relative bg-gray-100">
                <MapContainer center={[selectedTx.bid_location_lat || 12.9716, selectedTx.bid_location_lng || 77.5946]} zoom={15} zoomControl={false} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                  <Marker position={[selectedTx.bid_location_lat || 12.9716, selectedTx.bid_location_lng || 77.5946]} icon={deliveryIcon} />
                </MapContainer>
              </div>
              <div className="p-8 space-y-8 text-center">
                <div className="bg-gray-50 rounded-[32px] p-10 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Handoff Verification Code</p>
                  <p className="text-6xl font-black text-gray-900 tracking-widest mb-2 font-mono">{selectedTx.qr_secret}</p>
                  <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">Share this with the NGO partner upon arrival.</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <StatusOverlay status={status} onClose={() => setStatus(null)} />
    </div>
  );
};

export default Inventory;
