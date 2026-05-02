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
  const [scannedBarcode, setScannedBarcode] = useState(null);
  const barcodeDetectorRef = useRef(null);

  useEffect(() => {
    if ('BarcodeDetector' in window) {
      barcodeDetectorRef.current = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code', 'data_matrix', 'itf', 'codabar']
      });
    }
  }, []);

  useEffect(() => {
    let interval;
    if (isCameraActive && videoRef.current && barcodeDetectorRef.current) {
      interval = setInterval(async () => {
        try {
          const barcodes = await barcodeDetectorRef.current.detect(videoRef.current);
          if (barcodes.length > 0 && !scannedBarcode) {
            const code = barcodes[0].rawValue;
            setScannedBarcode(code);
            fetchProductFromBarcode(code);
          }
        } catch (err) {
          console.error('Barcode detection error:', err);
        }
      }, 200);
    }
    return () => clearInterval(interval);
  }, [isCameraActive, scannedBarcode]);

  const [barcodeData, setBarcodeData] = useState(null);
  const lastScannedRef = useRef(null);

  const fetchProductFromBarcode = async (code) => {
    if (lastScannedRef.current === code) return;
    lastScannedRef.current = code;
    
    try {
      const resp = await fetch(`/off-api/api/v0/product/${code}.json`);
      if (!resp.ok) throw new Error('OFF API error');
      const data = await resp.json();
      if (data.status === 1) {
        const p = data.product;
        const details = {
          name: p.product_name || p.product_name_en || p.generic_name || 'Unknown Product',
          brand: p.brands || 'Unknown Brand',
          weight: p.quantity || 'Unknown Weight',
          image: p.image_url || p.image_front_url || p.image_small_url,
          barcode: code,
          category: p.categories?.split(',')[0] || 'Packed'
        };
        setBarcodeData(details);
        setProductNameInput(details.name);
        setEditProductName(false);
        setStatus({ type: 'success', message: `Verified: ${details.name}` });
      }
    } catch (e) {
      console.error('OFF API error:', e);
    }
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    setScanResult(null);
    setScannedBarcode(null);
    setBarcodeData(null);
    lastScannedRef.current = null;
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
      
      const maxDim = 1024;
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
                  text: `You are a professional retail auditor. Analyze the provided product packaging image (likely the back or side) and extract:
1. Product Name (e.g. "Pepsi 500ml", "Lays Magic Masala")
2. Brand (e.g. "PepsiCo", "Britannia")
3. Expiry Date: Look for "EXP", "Use By", "Best Before", "BBE", or "MFG + X months". Format: YYYY-MM-DD.
4. Barcode: Find any 8, 12, or 13 digit number.
5. Weight/Qty: e.g. "100g", "500ml".
6. Price/MRP: Look for "MRP", "Rs.", or "₹". Extract the numerical value.

Context: ${barcodeData ? `Verified Barcode Data: ${barcodeData.name} by ${barcodeData.brand}` : 'New Scan'}

Return ONLY a JSON object:
{
  "product_name": "Name",
  "brand": "Brand",
  "expiry_date": "YYYY-MM-DD", 
  "barcode": "Digits or null",
  "quantity": "Amount or null",
  "category": "Category",
  "price": number or null,
  "confidence": "high/medium/low",
  "notes": "Brief notes on where you found the date/price"
}
If date is "Best before 6 months from mfg" and mfg is "01/24", calculate "2024-07-01".`
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
      console.log('AI Raw Response:', text);
      
      let parsed = {};
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          // Robust markdown parsing fallback
          parsed = {
            product_name: text.match(/\*?\*?Product Name\*?\*?:?\s*([^\n\*]+)/i)?.[1]?.trim(),
            brand: text.match(/\*?\*?Brand\*?\*?:?\s*([^\n\*]+)/i)?.[1]?.trim(),
            expiry_date: text.match(/\*?\*?Expiry Date\*?\*?:?\s*(\d{4}-\d{2}-\d{2})/)?.[1],
            barcode: text.match(/\*?\*?Barcode Number\*?\*?:?\s*(\d+)/)?.[1],
            quantity: text.match(/\*?\*?Quantity\/Weight\*?\*?:?\s*([^\n\*]+)/i)?.[1]?.trim(),
            category: text.match(/\*?\*?Category\*?\*?:?\s*([^\n\*]+)/i)?.[1]?.trim(),
            price: text.match(/\*?\*?Price\/MRP\*?\*?:?\s*(\d+)/)?.[1],
            confidence: text.match(/\*?\*?Confidence\*?\*?:?\s*([^\n\*]+)/i)?.[1]?.trim() || 'low',
            notes: text.match(/\*?\*?Notes\*?\*?:?\s*([^\n\*]+)/i)?.[1]?.trim()
          };
        }
      } catch (err) {
        throw new Error('Failed to parse AI response. Try entering details manually.');
      }

      // Cleanup "Not visible" or "unknown" strings from AI
      const clean = (val) => {
        if (val === null || val === undefined) return null;
        if (typeof val !== 'string') return val;
        const low = val.toLowerCase();
        if (low.includes('not visible') || low.includes('unknown') || low.includes('n/a')) return null;
        return val.trim();
      };
      
      parsed.product_name = clean(parsed.product_name);
      parsed.brand = clean(parsed.brand);
      parsed.barcode = clean(parsed.barcode);
      parsed.quantity = clean(parsed.quantity);
      parsed.category = clean(parsed.category);
      parsed.price = clean(parsed.price);

      // If AI found a barcode that real-time scanner missed, fetch its data
      if (parsed.barcode && !barcodeData) {
        await fetchProductFromBarcode(parsed.barcode);
      }

      let productName = barcodeData?.name || parsed.product_name;
      let barcode = barcodeData?.barcode || parsed.barcode;
      let category = barcodeData?.category || parsed.category;
      let weight = barcodeData?.weight || parsed.quantity;
      let brand = barcodeData?.brand || parsed.brand;

      if (!parsed.expiry_date && (!barcode || barcode === 'null') && (!productName || productName === 'unknown')) {
        setScanResult({ error: 'No product info or expiry date found. Try a clearer photo or enter details manually.' });
        setScanLoading(false);
        return;
      }

      const expiry = parsed.expiry_date ? new Date(parsed.expiry_date) : null;
      const now = new Date();
      const daysLeft = expiry ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)) : null;
      const urgency = !expiry ? 'safe' : daysLeft <= 0 ? 'expired' : daysLeft <= 3 ? 'critical' : daysLeft <= 7 ? 'warning' : 'safe';

      setScanResult({ 
        expiryDate: parsed.expiry_date || new Date().toISOString().split('T')[0], 
        daysLeft, 
        urgency, 
        productName: productName || '', 
        brand: brand || '',
        barcode: barcode || null,
        quantity: weight || '',
        category: category || 'Packed',
        price: Number(parsed.price) || 0,
        notes: parsed.notes, 
        imageBase64, 
        confidence: parsed.confidence,
        isManual: !parsed.expiry_date
      });
      setProductNameInput(productName || '');
      setEditProductName(!productName);
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
        const maxDim = 1024;
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
      if (daysLeft <= 0 && !scanResult.isManual) {
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
        category: scanResult.category || 'Packed',
        price: scanResult.price || 0
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
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white rounded-3xl md:rounded-[40px] w-full max-w-lg p-6 md:p-8 relative shadow-2xl z-10 border border-gray-100 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-1">AI Product Intelligence</p>
                  <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Expiry Date Scanner</h3>
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
                        <div className="absolute inset-0 border-4 border-primary/50 m-8 rounded-xl pointer-events-none">
                          <motion.div 
                            animate={{ top: ['0%', '100%', '0%'] }} 
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            className="absolute left-0 right-0 h-1 bg-primary/50 shadow-[0_0_15px_rgba(46,204,113,0.8)] z-20"
                          />
                        </div>
                        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${scannedBarcode ? 'bg-green-500 animate-pulse' : 'bg-primary animate-ping'}`}></div>
                           <span className="text-[10px] font-black text-white uppercase tracking-widest">
                             {scannedBarcode ? `Barcode: ${scannedBarcode}` : 'Scanning Barcode + Expiry...'}
                           </span>
                        </div>
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
                  <p className="font-black text-gray-900 mb-1">Analyzing packaging...</p>
                  <p className="text-xs text-gray-400">Vision AI is reading the product details</p>
                </div>
              )}

              {scanResult && scanResult.error && (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center bg-red-50/50 rounded-[32px] border border-red-100/50">
                  <span className="material-symbols-outlined text-5xl text-red-400 mb-4">error_outline</span>
                  <h4 className="text-red-900 font-black text-lg mb-2">Analysis Incomplete</h4>
                  <p className="text-red-600/70 text-sm font-medium mb-8 leading-relaxed">{scanResult.error}</p>
                  
                  <div className="flex flex-col w-full gap-3">
                    <button 
                      onClick={() => { setScanResult(null); setIsCameraActive(true); startCamera(); }}
                      className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-200 transition-all"
                    >
                      Try Clearer Photo
                    </button>
                    
                    <div className="relative py-4">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-red-100"></div></div>
                      <div className="relative flex justify-center text-[10px] uppercase font-black text-red-300 bg-white px-2">or</div>
                    </div>

                    <button 
                      onClick={() => {
                        setScanResult({
                          productName: productNameInput || (barcodeData?.name) || 'New Item',
                          expiryDate: new Date().toISOString().split('T')[0],
                          daysLeft: 0,
                          urgency: 'normal',
                          confidence: 'manual',
                          isManual: true,
                          barcode: scannedBarcode || barcodeData?.barcode,
                          quantity: barcodeData?.weight || "1",
                          category: barcodeData?.category || 'Packed',
                          price: 0,
                          brand: barcodeData?.brand || ''
                        });
                      }}
                      className="w-full py-4 bg-white border-2 border-gray-200 text-gray-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-primary hover:text-primary transition-all"
                    >
                      Enter Details Manually
                    </button>
                  </div>
                </div>
              )}

              {scanResult && !scanResult.error && (
                <div className="space-y-6">
                  {/* Premium Product Card */}
                  <div className="bg-gray-50 rounded-[32px] overflow-hidden border border-gray-100 shadow-sm">
                    <div className="flex gap-4 p-4">
                      <div className="w-24 h-24 bg-white rounded-2xl flex-shrink-0 border border-gray-100 overflow-hidden flex items-center justify-center">
                        {(barcodeData?.image || scanResult.imageBase64) ? (
                          <img src={barcodeData?.image || `data:image/jpeg;base64,${scanResult.imageBase64}`} alt={scanResult.productName} className="w-full h-full object-contain" />
                        ) : (
                          <span className="material-symbols-outlined text-4xl text-gray-200">image</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center gap-2 group">
                          {editProductName ? (
                            <input 
                              type="text" 
                              value={productNameInput} 
                              onChange={e => setProductNameInput(e.target.value)}
                              onBlur={() => setEditProductName(false)}
                              autoFocus
                              className="font-black text-gray-900 border-b-2 border-primary outline-none bg-transparent w-full transition-colors text-sm"
                            />
                          ) : (
                            <>
                              <h4 className="font-black text-gray-900 truncate text-base">{productNameInput || scanResult.productName}</h4>
                              <button onClick={() => setEditProductName(true)} className="text-gray-300 hover:text-primary transition-colors flex shrink-0">
                                <span className="material-symbols-outlined text-xs">edit</span>
                              </button>
                            </>
                          )}
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{scanResult.brand || 'Verified Product'}</p>
                        <div className="flex items-center gap-3 mt-2">
                           <span className="px-2 py-0.5 bg-white border border-gray-100 rounded-md text-[9px] font-black text-gray-400 tracking-widest">{scanResult.quantity || 'Standard Qty'}</span>
                           <div className="flex items-center gap-1">
                             <span className="text-[9px] font-black text-gray-400 uppercase">₹</span>
                             <input 
                               type="number"
                               value={scanResult.price}
                               onChange={(e) => setScanResult(prev => ({ ...prev, price: e.target.value }))}
                               className="w-12 bg-transparent text-[9px] font-black text-gray-900 border-b border-gray-200 focus:border-primary outline-none"
                             />
                           </div>
                           {scanResult.barcode && <span className="text-[9px] font-bold text-primary font-mono">{scanResult.barcode}</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className={`px-6 py-4 flex items-center justify-between border-t border-gray-100 ${
                      scanResult.urgency === 'expired' ? 'bg-red-50/50' :
                      scanResult.urgency === 'critical' ? 'bg-orange-50/50' : 'bg-green-50/50'
                    }`}>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">AI Expiry Analysis</p>
                        <p className={`text-xl font-black ${
                          scanResult.urgency === 'expired' ? 'text-red-600' :
                          scanResult.urgency === 'critical' ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {scanResult.urgency === 'expired' ? '⛔ EXPIRED' : `${scanResult.daysLeft} Days Left`}
                        </p>
                      </div>
                      <div className="text-right">
                         <input 
                           type="date"
                           value={scanResult.expiryDate}
                           onChange={(e) => {
                             const newDate = e.target.value;
                             const expiry = new Date(newDate);
                             const now = new Date();
                             const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
                             const urgency = daysLeft <= 0 ? 'expired' : daysLeft <= 3 ? 'critical' : 'normal';
                             setScanResult(prev => ({ ...prev, expiryDate: newDate, daysLeft, urgency }));
                           }}
                           className="bg-transparent font-black text-gray-900 text-right outline-none cursor-pointer hover:text-primary transition-colors text-[10px]"
                         />
                         <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{scanResult.isManual ? 'Manual Entry' : `Confidence: ${scanResult.confidence}`}</p>
                      </div>
                    </div>
                  </div>

                  {scanResult.notes && (
                    <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50">
                       <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                         <span className="material-symbols-outlined text-sm">info</span>
                         AI Observation
                       </p>
                       <p className="text-xs text-blue-800 font-medium italic">"{scanResult.notes}"</p>
                    </div>
                  )}

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
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="bg-white rounded-3xl md:rounded-[40px] w-full max-w-lg overflow-hidden relative shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-start shrink-0">
                <div>
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mb-2 inline-block ${selectedTx.status === 'Completed' ? 'bg-green-100 text-green-600' : 'bg-primary/10 text-primary'}`}>{selectedTx.status}</span>
                  <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">{selectedTx.listings?.title || selectedTx.listings?.name}</h3>
                  <p className="text-gray-500 font-medium text-[10px] md:text-xs mt-1">Order #{selectedTx.id.slice(0,8).toUpperCase()}</p>
                </div>
                <button onClick={() => setShowTxModal(false)} className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors"><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="h-48 md:h-64 relative bg-gray-100 shrink-0">
                <MapContainer center={[selectedTx.bid_location_lat || 12.9716, selectedTx.bid_location_lng || 77.5946]} zoom={15} zoomControl={false} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                  <Marker position={[selectedTx.bid_location_lat || 12.9716, selectedTx.bid_location_lng || 77.5946]} icon={deliveryIcon} />
                </MapContainer>
              </div>
              <div className="p-6 md:p-8 space-y-8 text-center overflow-y-auto">
                <div className="bg-gray-50 rounded-2xl md:rounded-[32px] p-6 md:p-10 border border-gray-100">
                  <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Handoff Verification Code</p>
                  <p className="text-4xl md:text-6xl font-black text-gray-900 tracking-widest mb-2 font-mono">{selectedTx.qr_secret}</p>
                  <p className="text-[10px] md:text-[11px] text-gray-500 font-bold uppercase tracking-widest">Share this with the NGO partner upon arrival.</p>
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
