import React, { useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, LabelList
} from 'recharts';
import { supabase } from '../supabaseClient';
import StatusOverlay from '../components/StatusOverlay';

const Impact = () => {
  const [activeTab, setActiveTab] = useState('analytics');
  const [selectedMetric, setSelectedMetric] = useState('orders');
  const [stats, setStats] = useState({ orders: 0, fuelSaved: 0, moneySaved: 0 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  // Power BI Inspired Corporate Palette
  const colors = {
    primary: '#118DFF', // Power BI Blue
    success: '#0DB670', // Teal/Green
    accent1: '#E66C37', // Orange
    bg: '#F3F2F1'
  };

  const [monthlyData, setMonthlyData] = useState([]);

  useEffect(() => {
    fetchImpactStats();
  }, []);

  const fetchImpactStats = async () => {
    setLoading(true);
    
    // 1. Fetch overall totals
    const { data: weights } = await supabase.from('profiles').select('total_redirected_weight');
    const totalWeight = (weights || []).reduce((acc, curr) => acc + (Number(curr.total_redirected_weight) || 0), 0);

    const { data: completedHandoffs } = await supabase
      .from('handoffs')
      .select('created_at, weight, bid_amount, status')
      .eq('status', 'Completed');

    const totalOrders = completedHandoffs?.length || 0;
    const totalMoney = (completedHandoffs || []).reduce((acc, curr) => acc + (Number(curr.bid_amount) || 0), 0);
    
    setStats({
      orders: totalOrders,
      fuelSaved: Math.round(totalOrders * 0.15), 
      moneySaved: totalMoney,
      weightRedirected: totalWeight
    });

    // 2. Generate Monthly Data Dynamically
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
        weightRedirected: 0
      });
    }

    if (completedHandoffs) {
      completedHandoffs.forEach(h => {
        const hDate = new Date(h.created_at);
        const target = last6Months.find(m => m.monthIdx === hDate.getMonth() && m.year === hDate.getFullYear());
        if (target) {
          target.orders += 1;
          target.weightRedirected += (Number(h.weight) || 0);
          target.moneySaved += (Number(h.bid_amount) || 0);
          target.fuelSaved = Math.round(target.orders * 0.15);
        }
      });
    }

    setMonthlyData(last6Months);
    setLoading(false);
  };

  const metricConfig = {
    weightRedirected: { label: 'Weight Saved', key: 'weightRedirected', color: colors.success, unit: ' kg', icon: 'scale', display: stats.weightRedirected },
    orders: { label: 'Total Redistributed', key: 'orders', color: colors.primary, unit: ' items', icon: 'shopping_cart', display: stats.orders },
    moneySaved: { label: 'Value Recovered', key: 'moneySaved', color: colors.accent1, unit: ' ₹', icon: 'payments', display: stats.moneySaved }
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
                {entry.dataKey === 'moneySaved' ? `₹${entry.value.toLocaleString()}` : `${entry.value}${metricConfig[selectedMetric].unit}`}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderAnalytics = () => (
    <div className="space-y-6 bg-[#F3F2F1] p-8 rounded-xl min-h-[700px]">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(metricConfig).map(([key, config]) => (
          <button 
            key={key} 
            onClick={() => setSelectedMetric(key)}
            className={`bg-white p-6 shadow-sm border-b-4 transition-all text-left group ${selectedMetric === key ? 'shadow-md scale-[1.02]' : 'hover:shadow-md'}`} 
            style={{ borderColor: config.color }}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${selectedMetric === key ? 'text-gray-900' : 'text-gray-400'}`}>{config.label}</p>
                <p className="text-3xl font-bold text-gray-900">
                  {key === 'moneySaved' ? `₹${(config.display/1000).toFixed(1)}k` : `${config.display}${config.unit}`}
                </p>
              </div>
              <span className={`material-symbols-outlined transition-colors ${selectedMetric === key ? '' : 'text-gray-200'}`} style={{ color: selectedMetric === key ? config.color : '' }}>{config.icon}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Dynamic Main Chart Area */}
      <div className="bg-white p-8 shadow-sm min-h-[500px] flex flex-col transition-all duration-500">
        {!selectedMetric ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 opacity-50">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-gray-300">analytics</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 uppercase tracking-widest">No Metric Selected</p>
              <p className="text-xs text-gray-400 font-medium mt-1 italic">Select a performance indicator above to generate report</p>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-gray-100 pb-4 mb-8 flex justify-between items-center animate-in fade-in slide-in-from-top-4 duration-700">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{metricConfig[selectedMetric].label} Analysis</h2>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-widest">Temporal Growth Report</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3" style={{ backgroundColor: metricConfig[selectedMetric].color }}></div>
                <span className="text-[10px] font-bold text-gray-400 uppercase">{metricConfig[selectedMetric].label} ({metricConfig[selectedMetric].unit || 'qty'})</span>
              </div>
            </div>
            <div className="h-[400px] animate-in fade-in zoom-in-95 duration-1000">
              <ResponsiveContainer width="100%" height="100%">
                {(selectedMetric === 'orders' || selectedMetric === 'weightRedirected') ? (
                  <AreaChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="#EEEEEE" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#666', fontSize: 11}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#666', fontSize: 11}} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey={selectedMetric} 
                      name={metricConfig[selectedMetric].label}
                      stroke={metricConfig[selectedMetric].color} 
                      strokeWidth={2} 
                      fill={metricConfig[selectedMetric].color} 
                      fillOpacity={0.1} 
                    >
                      <LabelList dataKey={selectedMetric} position="top" style={{ fontSize: '10px', fontWeight: 'bold', fill: metricConfig[selectedMetric].color }} />
                    </Area>
                  </AreaChart>
                ) : (
                  <BarChart data={monthlyData} margin={{ top: 20 }}>
                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="#EEEEEE" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#666', fontSize: 11}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#666', fontSize: 11}} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar 
                      dataKey={metricConfig[selectedMetric].key} 
                      name={metricConfig[selectedMetric].label} 
                      fill={metricConfig[selectedMetric].color}
                    >
                      <LabelList 
                        dataKey={metricConfig[selectedMetric].key} 
                        position="top" 
                        style={{ fontSize: '10px', fontWeight: 'bold', fill: '#666' }} 
                        formatter={(val) => selectedMetric === 'moneySaved' ? `₹${(val/1000).toFixed(0)}k` : val}
                      />
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="pt-24 px-6 max-w-7xl mx-auto pb-24 min-h-screen bg-[#F3F2F1]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Impact Analysis Report</h1>
          <p className="text-sm text-gray-500">Zerra Corporate Redistribution Metrics</p>
        </div>
        <div className="flex bg-white p-1 shadow-sm border border-gray-200">
          <button onClick={() => setActiveTab('analytics')} className={`px-6 py-2 text-xs font-bold transition-all ${activeTab === 'analytics' ? 'bg-[#118DFF] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>DASHBOARD</button>
          <button onClick={() => setActiveTab('complaint')} className={`px-6 py-2 text-xs font-bold transition-all ${activeTab === 'complaint' ? 'bg-[#118DFF] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>SUPPORT</button>
        </div>
      </div>

      {activeTab === 'analytics' ? renderAnalytics() : (
        <div className="max-w-2xl bg-white shadow-sm p-10 border-t-4 border-[#118DFF]">
          <h2 className="text-xl font-bold text-gray-800 mb-1">Impact Support Hub</h2>
          <p className="text-sm text-gray-500 mb-8">Report discrepancies or request deeper data exports.</p>
          <form className="space-y-6" onSubmit={(e) => {
            e.preventDefault();
            setStatus({ type: 'success', message: 'Case submitted to the Data Integrity Team.' });
          }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Request Category</label>
                <select className="w-full bg-gray-50 border border-gray-200 px-4 py-2 text-sm focus:border-[#118DFF] outline-none font-bold">
                  <option>Data Correction</option>
                  <option>Custom Export</option>
                  <option>Certification</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Detailed Description</label>
              <textarea rows="4" className="w-full bg-gray-50 border border-gray-200 px-4 py-2 text-sm focus:border-[#118DFF] outline-none font-medium resize-none" placeholder="Provide context..."></textarea>
            </div>
            <button type="submit" className="px-10 py-3 bg-[#118DFF] text-white font-bold text-xs uppercase tracking-widest hover:bg-[#0078D4] transition-all">Submit Case</button>
          </form>
        </div>
      )}
      <StatusOverlay status={status} onClose={() => setStatus(null)} />
    </div>
  );
};

export default Impact;
