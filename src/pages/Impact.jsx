import React, { useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, LabelList
} from 'recharts';
import { supabase } from '../supabaseClient';
import StatusOverlay from '../components/StatusOverlay';
import ComplaintFlow from '../components/ComplaintFlow';

const Impact = () => {
  const [activeTab, setActiveTab] = useState('analytics');
  const [selectedMetric, setSelectedMetric] = useState('orders');
  const [stats, setStats] = useState({ orders: 0, fuelSaved: 0, moneySaved: 0, weightRedirected: 0, carbonOffset: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // Power BI Inspired Corporate Palette
  const colors = {
    primary: '#118DFF', // Power BI Blue
    success: '#0DB670', // Teal/Green
    accent1: '#E66C37', // Orange
    bg: '#F3F2F1'
  };

  const [monthlyData, setMonthlyData] = useState([]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await checkRole();
      await fetchImpactStats();
      setLoading(false);
    };
    init();
  }, []);

  const checkRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        setUserRole(profile?.role);
      }
    } catch (err) {
      console.error('Role check error:', err);
    }
  };

  const fetchImpactStats = async () => {
    try {
      // 1. Fetch ALL completed handoffs for Global Source of Truth
      const { data: allCompleted } = await supabase
        .from('handoffs')
        .select('weight, bid_amount, quantity_ordered, created_at, listings(weight, price)')
        .eq('status', 'Completed');

      // 2. Fetch logistics batches for REAL Fuel Savings (Algorithmic based on consolidation)
      const { data: batches } = await supabase
        .from('delivery_batches')
        .select('id, scheduled_at, created_at, handoffs(id)');
      
      // Calculate Global Stats
      const totalItems = (allCompleted || []).reduce((acc, h) => acc + (Number(h.quantity_ordered) || 1), 0);
      const totalWeight = (allCompleted || []).reduce((acc, h) => acc + (Number(h.weight) || Number(h.listings?.weight) || 0), 0);
      const totalValue = (allCompleted || []).reduce((acc, h) => acc + (Number(h.bid_amount) || Number(h.listings?.price) || 0), 0);
      const totalCarbon = Number((totalWeight * 2.5).toFixed(1)); // Standard CO2 offset factor
      
      // Fuel Savings: Every handoff in a batch (beyond the first) represents a saved individual trip
      const batchedTripsSaved = (batches || []).reduce((acc, b) => acc + (b.handoffs?.length > 1 ? b.handoffs.length - 1 : 0), 0);
      const fuelPerTrip = 0.85; // Average liters saved per consolidation trip
      const realFuelSaved = Number((batchedTripsSaved * fuelPerTrip).toFixed(1));
      
      setStats({
        orders: totalItems, 
        fuelSaved: realFuelSaved, 
        moneySaved: totalValue, 
        weightRedirected: totalWeight,
        carbonOffset: totalCarbon
      });

      // 3. Generate Monthly Data Dynamically
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now = new Date();
      const last6Months = [];
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        last6Months.push({
          month: months[d.getMonth()],
          monthIdx: d.getMonth(),
          year: d.getFullYear(),
          orders: 0,
          fuelSaved: 0,
          moneySaved: 0,
          weightRedirected: 0,
          carbonOffset: 0
        });
      }

      // Populate history from Handoffs
      if (allCompleted) {
        allCompleted.forEach(h => {
          const hDate = new Date(h.created_at);
          const target = last6Months.find(m => m.monthIdx === hDate.getMonth() && m.year === hDate.getFullYear());
          if (target) {
            target.orders += (Number(h.quantity_ordered) || 1);
            const weightVal = Number(h.weight) || Number(h.listings?.weight) || 0;
            target.weightRedirected += weightVal;
            target.moneySaved += (Number(h.bid_amount) || Number(h.listings?.price) || 0);
            target.carbonOffset += Number((weightVal * 2.5).toFixed(1));
          }
        });
      }

      // Populate Fuel History from Batches
      if (batches) {
        batches.forEach(b => {
          const bDate = new Date(b.scheduled_at || b.created_at);
          const target = last6Months.find(m => m.monthIdx === bDate.getMonth() && m.year === bDate.getFullYear());
          if (target && b.handoffs?.length > 1) {
            target.fuelSaved += Number(((b.handoffs.length - 1) * fuelPerTrip).toFixed(1));
          }
        });
      }

      setMonthlyData(last6Months);
    } catch (err) {
      console.error('Impact Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const metricConfig = {
    weightRedirected: { label: 'Weight Saved', key: 'weightRedirected', color: colors.success, unit: ' kg', icon: 'scale', display: stats.weightRedirected },
    orders: { label: 'Total Redistributed', key: 'orders', color: colors.primary, unit: ' items', icon: 'shopping_cart', display: stats.orders },
    moneySaved: { label: 'Value Recovered', key: 'moneySaved', color: colors.accent1, unit: ' ₹', icon: 'payments', display: stats.moneySaved },
    fuelSaved: { label: 'Fuel Saved', key: 'fuelSaved', color: '#FFD700', unit: ' L', icon: 'local_gas_station', display: stats.fuelSaved }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length && selectedMetric) {
      return (
        <div className="bg-white border border-gray-200 shadow-xl p-3 rounded-sm">
          <p className="text-xs font-bold text-gray-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-3 py-0.5">
              <div className="w-2 h-2" style={{ backgroundColor: entry.color }}></div>
              <span className="text-[11px] text-gray-600 font-medium">{entry.name}:</span>
              <span className="text-[11px] text-gray-900 font-bold ml-auto">
                {entry.dataKey === 'moneySaved' ? `₹${Number(entry.value).toLocaleString()}` : `${entry.value}${metricConfig[selectedMetric].unit}`}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderAnalytics = () => (
    <div className="space-y-6 bg-white/50 p-5 md:p-8 rounded-3xl md:rounded-[40px] border border-gray-100 min-h-auto md:min-h-[700px] shadow-sm">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {Object.entries(metricConfig).map(([key, config]) => (
          <button 
            key={key} 
            onClick={() => setSelectedMetric(key)}
            className={`bg-white p-6 md:p-8 rounded-2xl md:rounded-[32px] border-2 transition-all text-left group ${selectedMetric === key ? 'border-primary shadow-xl scale-[1.02]' : 'border-gray-50 hover:border-gray-200 hover:shadow-md'}`} 
          >
            <div className="flex justify-between items-start">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${selectedMetric === key ? 'text-primary' : 'text-gray-400'}`}>{config.label}</p>
                <p className="text-xl md:text-3xl font-black text-gray-900 tracking-tight">
                  {key === 'moneySaved' ? `₹${(Number(config.display)/1000).toFixed(1)}k` : `${config.display}${config.unit}`}
                </p>
              </div>
              <span className={`material-symbols-outlined transition-colors text-2xl md:text-3xl ${selectedMetric === key ? 'text-primary' : 'text-gray-200'}`}>{config.icon}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Dynamic Main Chart Area */}
      <div className="bg-white p-6 md:p-10 rounded-3xl md:rounded-[40px] border border-gray-100 min-h-[400px] md:min-h-[500px] flex flex-col transition-all duration-500 shadow-sm overflow-hidden">
        {!selectedMetric ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-50 py-10">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-gray-50 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl md:text-4xl text-gray-300">analytics</span>
            </div>
            <div>
              <p className="text-[10px] md:text-sm font-black text-gray-800 uppercase tracking-widest">No Metric Selected</p>
              <p className="text-[9px] md:text-xs text-gray-400 font-medium mt-1 italic">Select a performance indicator above</p>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-gray-50 pb-6 mb-6 md:mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">{metricConfig[selectedMetric].label} Analysis</h2>
                <p className="text-[9px] md:text-[10px] text-gray-400 font-black uppercase mt-1 tracking-[0.2em]">Temporal Growth Report</p>
              </div>
              <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-full">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: metricConfig[selectedMetric].color }}></div>
                <span className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest">{metricConfig[selectedMetric].label}</span>
              </div>
            </div>
            <div className="h-[350px] md:h-[450px] w-full animate-in fade-in zoom-in-95 duration-1000">
              <ResponsiveContainer width="100%" height="100%">
                {(selectedMetric === 'orders' || selectedMetric === 'weightRedirected') ? (
                  <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#999', fontSize: 10, fontWeight: 900}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#999', fontSize: 10, fontWeight: 900}} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey={metricConfig[selectedMetric].key} 
                      name={metricConfig[selectedMetric].label}
                      stroke={metricConfig[selectedMetric].color} 
                      strokeWidth={4} 
                      fill={metricConfig[selectedMetric].color} 
                      fillOpacity={0.1} 
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F0F0" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#999', fontSize: 10, fontWeight: 900}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#999', fontSize: 10, fontWeight: 900}} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey={metricConfig[selectedMetric].key} 
                      name={metricConfig[selectedMetric].label} 
                      fill={metricConfig[selectedMetric].color}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="pt-24 min-h-screen bg-[#F3F2F1] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 px-4 md:px-6 max-w-7xl mx-auto pb-24 min-h-screen bg-[#F3F2F1]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-10 gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
            {activeTab === 'analytics' ? 'Impact Intelligence' : 'Integrity Protection'}
          </h1>
          <p className="text-gray-500 mt-1 font-medium text-sm md:text-base">
            {activeTab === 'analytics' ? 'Corporate redistribution metrics and growth analysis.' : 'Official report filing and case management.'}
          </p>
        </div>
        {['consumer', 'ngo'].includes(userRole?.toLowerCase()) && (
          <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm w-full md:w-auto overflow-hidden">
            <button 
              onClick={() => setActiveTab('analytics')} 
              className={`flex-1 md:flex-none px-6 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${activeTab === 'analytics' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('complaint')} 
              className={`flex-1 md:flex-none px-6 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest ${activeTab === 'complaint' ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}
            >
              Complaints
            </button>
          </div>
        )}
      </div>

      {activeTab === 'complaint' && ['consumer', 'ngo'].includes(userRole?.toLowerCase()) ? (
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
           <div className="mb-10 text-center max-w-xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-3">Integrity Protection</h2>
              <p className="text-gray-500 font-medium leading-relaxed italic text-sm md:text-base">"Trust is our most valuable currency."</p>
              <p className="text-gray-400 text-[10px] md:text-xs mt-4 font-medium px-4">Use this interface to report discrepancies in received items. Every report is linked to your identity and order for accountability.</p>
           </div>
           <ComplaintFlow onComplete={setStatus} />
        </div>
      ) : renderAnalytics()}
      <StatusOverlay status={status} onClose={() => setStatus(null)} />
    </div>
  );
};

export default Impact;
