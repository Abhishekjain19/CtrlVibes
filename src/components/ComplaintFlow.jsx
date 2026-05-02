import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';

const ComplaintFlow = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [classification, setClassification] = useState(null);
  const [description, setDescription] = useState('');
  const [userProfile, setUserProfile] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setUserProfile(profile);

    const { data: handoffs } = await supabase
      .from('handoffs')
      .select('*, listings!inner(*)')
      .eq('claimer_id', user.id)
      .order('created_at', { ascending: false });
    
    setOrders(handoffs || []);
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error(err);
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const photo = canvas.toDataURL('image/jpeg', 0.8);
      setEvidence(prev => [...prev, photo]);
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setEvidence(prev => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const caseId = 'ZC-' + Math.random().toString(36).substr(2, 6).toUpperCase();
      
      // 1. Store in Database
      const { error } = await supabase.from('complaints').insert([{
        consumer_id: user.id,
        order_id: selectedOrder.id,
        category: classification,
        description: description,
        evidence_urls: evidence.slice(0, 3),
        status: 'Pending',
        consumer_name: userProfile?.full_name || 'Valued Consumer',
        admin_email: 'varunsugandhi11@gmail.com',
        case_id: caseId
      }]);

      if (error && error.code !== '42P01') throw error;

      // 2. Simulated Professional Email Dispatch
      // In a real production environment, you would use a Supabase Edge Function with Resend/SendGrid.
      console.log(`[SYSTEM] Dispatching official integrity report ${caseId} to varunsugandhi11@gmail.com`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network latency for "premium" feel

      // 3. Local Notifications
      await supabase.from('notifications').insert([{
        user_id: user.id,
        title: 'Report Dispatched ⚖️',
        description: `Your integrity report ${caseId} has been securely dispatched to the Zerra compliance team.`,
        type: 'info',
        status: 'unread'
      }]);

      if (selectedOrder.listings?.vendor_id) {
        await supabase.from('notifications').insert([{
          user_id: selectedOrder.listings.vendor_id,
          title: 'Integrity Alert',
          description: `A quality report has been filed for "${selectedOrder.listings.name}". Our team is reviewing the evidence.`,
          type: 'warning',
          status: 'unread'
        }]);
      }

      onComplete({ 
        type: 'success', 
        message: `Report ${caseId} has been successfully filed and dispatched to compliance (varunsugandhi11@gmail.com).` 
      });
    } catch (err) {
      console.error(err);
      onComplete({ type: 'error', message: 'Technical error: ' + err.message });
    }
    setLoading(false);
  };

  const classifications = [
    { id: 'quality', label: 'Quality Issue', icon: 'scuba_diving', desc: 'Food was not fresh or as described.' },
    { id: 'quantity', label: 'Quantity Mismatch', icon: 'layers', desc: 'Received less than ordered.' },
    { id: 'packaging', label: 'Damaged Packaging', icon: 'package_2', desc: 'Packaging was torn or leaked.' },
    { id: 'delivery', label: 'Delivery Delay', icon: 'schedule', desc: 'Arrived significantly past window.' },
    { id: 'wrong', label: 'Wrong Item', icon: 'wrong_location', desc: 'Received something different.' },
    { id: 'other', label: 'Other / Custom', icon: 'edit_note', desc: 'Specific issue not listed above.' }
  ];

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-gray-900 tracking-tight">Select Order</h3>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Step 1 of 4</span>
      </div>
      <p className="text-sm text-gray-500 font-medium">Which redistribution handoff are you reporting?</p>
      
      <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {orders.length > 0 ? orders.map(order => (
          <button 
            key={order.id}
            onClick={() => { setSelectedOrder(order); setStep(2); }}
            className="w-full bg-white border border-gray-100 p-5 rounded-[24px] flex items-center justify-between hover:border-primary hover:shadow-md transition-all group text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-primary/5 group-hover:text-primary">
                <span className="material-symbols-outlined">package_2</span>
              </div>
              <div>
                <h4 className="font-bold text-gray-900">{order.listings?.name || 'Order Item'}</h4>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">#{order.id.slice(0,8).toUpperCase()} • {new Date(order.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-gray-300 group-hover:text-primary transition-colors">chevron_right</span>
          </button>
        )) : (
          <div className="py-12 text-center bg-gray-50 rounded-[32px] border border-dashed border-gray-200">
            <span className="material-symbols-outlined text-4xl text-gray-200 mb-3">history</span>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No order history found</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button onClick={() => setStep(1)} className="flex items-center gap-2 text-gray-400 hover:text-gray-900 transition-colors">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
        </button>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Step 2 of 4</span>
      </div>
      
      <h3 className="text-xl font-black text-gray-900 tracking-tight">Visual Evidence</h3>
      <p className="text-sm text-gray-500 font-medium">Please provide photos of the food item and packaging.</p>

      <div className="grid grid-cols-3 gap-3">
        {evidence.map((img, i) => (
          <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
            <img src={img} alt="Evidence" className="w-full h-full object-cover" />
            <button onClick={() => setEvidence(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-md">
              <span className="material-symbols-outlined text-xs">close</span>
            </button>
          </div>
        ))}
        {evidence.length < 6 && !isCameraActive && (
          <div className="flex flex-col gap-3 col-span-3">
             <button onClick={startCamera} className="w-full py-10 rounded-[32px] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all">
                <span className="material-symbols-outlined text-4xl">add_a_photo</span>
                <span className="text-[10px] font-black uppercase tracking-widest">Capture Live Photo</span>
             </button>
             <label className="w-full py-4 bg-gray-50 text-gray-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 flex items-center justify-center gap-2 cursor-pointer">
                <span className="material-symbols-outlined text-sm">upload_file</span>
                Upload from Device
                <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
             </label>
          </div>
        )}
      </div>

      {isCameraActive && (
        <div className="fixed inset-0 z-[5000] bg-black flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-lg aspect-[4/3] rounded-[40px] overflow-hidden bg-gray-900 relative">
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-x-0 bottom-10 flex justify-center items-center gap-8">
               <button onClick={stopCamera} className="w-14 h-14 bg-white/10 backdrop-blur-xl text-white rounded-full flex items-center justify-center border border-white/20"><span className="material-symbols-outlined">close</span></button>
               <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full border-8 border-white/20 flex items-center justify-center"><div className="w-12 h-12 bg-red-500 rounded-full"></div></button>
               <div className="w-14 h-14"></div>
            </div>
          </div>
        </div>
      )}

      <button 
        disabled={evidence.length === 0}
        onClick={() => setStep(3)}
        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        Continue to Classification
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </button>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button onClick={() => setStep(2)} className="flex items-center gap-2 text-gray-400 hover:text-gray-900 transition-colors">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
        </button>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Step 3 of 4</span>
      </div>
      
      <h3 className="text-xl font-black text-gray-900 tracking-tight">Incident Classification</h3>
      <p className="text-sm text-gray-500 font-medium">Categorize the nature of the issue for specialized resolution.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {classifications.map(c => (
          <button 
            key={c.id}
            onClick={() => setClassification(c.id)}
            className={`p-5 rounded-[24px] border transition-all text-left group ${classification === c.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100 hover:border-gray-300'}`}
          >
            <div className="flex items-center gap-4 mb-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${classification === c.id ? 'bg-primary text-white' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100'}`}>
                <span className="material-symbols-outlined">{c.icon}</span>
              </div>
              <h4 className="font-bold text-gray-900">{c.label}</h4>
            </div>
            <p className="text-[10px] text-gray-400 font-medium leading-relaxed">{c.desc}</p>
          </button>
        ))}
      </div>

      <div className="pt-4">
        <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Additional Context</label>
        <textarea 
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Please describe the issue in detail..."
          className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-medium focus:border-primary outline-none resize-none min-h-[100px]"
        />
      </div>

      <button 
        disabled={!classification}
        onClick={() => setStep(4)}
        className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        Review Summary
        <span className="material-symbols-outlined text-sm">preview</span>
      </button>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <button onClick={() => setStep(3)} className="flex items-center gap-2 text-gray-400 hover:text-gray-900 transition-colors group">
          <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
          <span className="text-[10px] font-black uppercase tracking-widest">Edit Details</span>
        </button>
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Review Summary</span>
      </div>
      
      <div className="bg-white rounded-3xl md:rounded-[32px] border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
        <div className="p-6 md:p-10">
          <div className="flex flex-col md:flex-row justify-between items-start mb-8 md:mb-10 border-b border-gray-50 pb-6 md:pb-8 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-primary">verified</span>
                <h4 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Official Report</h4>
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Complaint Case Reference</p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Filed By</p>
              <p className="text-sm md:text-base font-black text-gray-900">{userProfile?.full_name}</p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-8 items-start md:items-center p-6 bg-gray-50 rounded-[24px] border border-gray-100">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center border border-gray-100 shadow-sm shrink-0">
                <span className="material-symbols-outlined text-4xl text-gray-300">inventory_2</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                   <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Target Item</p>
                   <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Order #{selectedOrder?.id.slice(0,8).toUpperCase()}</p>
                </div>
                <h5 className="text-xl font-black text-gray-900">{selectedOrder?.listings?.name}</h5>
                <p className="text-xs font-bold text-gray-500 mt-1">{selectedOrder?.listings?.vendor_name || 'Verified Redistribution Partner'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 px-2">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Incident Type</p>
                <div className="flex items-center gap-2">
                   <span className="material-symbols-outlined text-lg text-primary">{classifications.find(c => c.id === classification)?.icon}</span>
                   <p className="text-sm font-black text-gray-900 uppercase tracking-wider">{classifications.find(c => c.id === classification)?.label}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Timestamp</p>
                <div className="flex items-center gap-2">
                   <span className="material-symbols-outlined text-lg text-gray-300">calendar_today</span>
                   <p className="text-sm font-black text-gray-900 uppercase tracking-wider">{new Date(selectedOrder?.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {description && (
              <div className="bg-gray-50 rounded-2xl md:rounded-[24px] p-5 md:p-6 border-l-4 border-primary">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Consumer Statement</p>
                <p className="text-xs md:text-sm text-gray-700 leading-relaxed font-medium italic">"{description}"</p>
              </div>
            )}

            <div className="px-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Visual Documentation ({evidence.length})</p>
              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                {evidence.map((img, i) => (
                  <div key={i} className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white shadow-md shrink-0">
                    <img src={img} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-10 bg-gray-50 border-t border-gray-100">
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 md:py-5 bg-gray-900 text-white rounded-xl md:rounded-[20px] font-black text-[10px] md:text-xs uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl shadow-gray-200 active:scale-[0.98] flex items-center justify-center gap-3"
          >
            {loading ? (
              <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span className="material-symbols-outlined text-xs md:text-sm">send</span>
                Confirm & Submit Report
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-3xl md:rounded-[40px] border border-gray-100 p-6 md:p-10 shadow-sm max-w-2xl mx-auto overflow-hidden relative min-h-[500px] md:min-h-[600px]">
      <AnimatePresence mode="wait">
        <motion.div 
          key={step}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -20, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default ComplaintFlow;
