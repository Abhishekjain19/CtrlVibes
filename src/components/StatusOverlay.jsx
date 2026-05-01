import React from 'react';
import { motion } from 'framer-motion';

const StatusOverlay = ({ status, onClose }) => {
  if (!status) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      ></motion.div>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl text-center"
      >
        <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${status.type === 'success' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
          <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            {status.type === 'success' ? 'check_circle' : 'error'}
          </span>
        </div>
        <h3 className="text-xl font-black text-gray-900 mb-2">
          {status.type === 'success' ? 'Confirmed!' : 'Action Required'}
        </h3>
        <p className="text-gray-500 font-medium mb-8 leading-relaxed">
          {status.message}
        </p>
        <button 
          onClick={onClose}
          className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg ${status.type === 'success' ? 'bg-primary text-white hover:shadow-primary/30' : 'bg-gray-900 text-white hover:bg-red-500'}`}
        >
          Continue
        </button>
      </motion.div>
    </div>
  );
};

export default StatusOverlay;
