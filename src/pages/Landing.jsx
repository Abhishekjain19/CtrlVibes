import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import heroBg from '../assets/hero-bg.png';
import fact1 from '../assets/fact-1.png';
import fact2 from '../assets/fact-2.png';
import fact3 from '../assets/fact-3.png';

const Landing = () => {
  const detailedFacts = [
    { title: "Global Scale", text: "1.3 Billion tons of food is wasted globally every year.", image: fact1 },
    { title: "Direct Impact", text: "Zerra has rescued 50,000+ meals this quarter.", image: fact2 },
    { title: "Climate Action", text: "Food waste accounts for 8% of global emissions.", image: fact3 },
    { title: "Water Scarcity", text: "Saving 1kg of food saves 1,000L of water.", image: fact1 },
    { title: "Global Hunger", text: "We can feed 2B people with the food we waste.", image: fact2 },
  ];

  const loopFacts = [...detailedFacts, ...detailedFacts];

  return (
    <div className="pt-20 space-y-32 mb-24 overflow-x-hidden bg-white">
      {/* Redesigned Premium Hero Section */}
      <section className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center min-h-[700px]">
        <div className="order-2 lg:order-1 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-[1px] bg-primary"></div>
              <span className="text-primary text-[10px] font-black uppercase tracking-[0.3em]">
                Institutional Redistribution
              </span>
            </div>
            
            <div className="space-y-1">
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-gray-900 tracking-tighter leading-none">
                Rescuing Surplus.
              </h1>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-gray-400 tracking-tighter leading-none">
                Empowering
              </h1>
              <h1 className="text-5xl sm:text-6xl md:text-8xl font-black text-primary tracking-tighter leading-none">
                Communities.
              </h1>
            </div>

            <p className="text-lg md:text-xl text-gray-500 max-w-md font-medium leading-relaxed pt-4">
              The definitive institutional bridge for high-fidelity food redistribution. Built for premium purveyors and strategic partners.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link to="/auth?mode=signup" className="px-10 py-4 rounded-xl font-black text-[11px] uppercase tracking-widest text-white bg-gray-900 shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3 group">
                Get Started
                <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </Link>
            </div>
          </motion.div>
        </div>

        <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, x: 30 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="w-full max-w-[500px] aspect-[4/4] rounded-[60px] overflow-hidden shadow-2xl shadow-primary/10 relative border-8 border-white"
          >
            <img src={heroBg} alt="Sustainability" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            
            {/* Floating Impact Card (Reduced Size) */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-xl" style={{fontVariationSettings: "'FILL' 1"}}>trending_up</span>
                </div>
                <div>
                  <p className="text-lg font-black text-gray-900 tracking-tighter">1.3B Tons</p>
                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Global Waste</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
          {/* Decorative Elements */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-3xl -z-10"></div>
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl -z-10"></div>
        </div>
      </section>

      {/* Ecosystem Architecture */}
      <section className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 md:mb-20">
          <span className="text-primary text-[10px] font-black uppercase tracking-widest mb-4 inline-block">The Foundation</span>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 tracking-tighter">Ecosystem Architecture</h2>
          <p className="text-gray-500 text-lg md:text-xl max-w-2xl mx-auto font-medium">A multi-layered distribution engine designed for institutional efficiency and community impact.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          <div className="bg-white rounded-3xl md:rounded-[32px] border border-gray-100 shadow-sm p-10 md:p-12 flex flex-col items-center text-center group hover:shadow-xl hover:shadow-primary/5 transition-all duration-500">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/5 rounded-2xl md:rounded-3xl flex items-center justify-center mb-8 md:mb-10 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-3xl md:text-4xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>recycling</span>
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">Loss Mitigation</h3>
            <p className="text-gray-500 leading-relaxed font-medium text-sm md:text-base">Advanced logistical protocols to ensure surplus items are recovered before expiration.</p>
          </div>
          <div className="bg-white rounded-3xl md:rounded-[32px] border border-gray-100 shadow-sm p-10 md:p-12 flex flex-col items-center text-center group hover:shadow-xl hover:shadow-secondary/5 transition-all duration-500">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-secondary/5 rounded-2xl md:rounded-3xl flex items-center justify-center mb-8 md:mb-10 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-3xl md:text-4xl text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>handshake</span>
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">Strategic Partners</h3>
            <p className="text-gray-500 leading-relaxed font-medium text-sm md:text-base">A refined network connecting premium purveyors with certified community partners.</p>
          </div>
          <div className="bg-white rounded-3xl md:rounded-[32px] border border-gray-100 shadow-sm p-10 md:p-12 flex flex-col items-center text-center group hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-500">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-500/5 rounded-2xl md:rounded-3xl flex items-center justify-center mb-8 md:mb-10 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-3xl md:text-4xl text-blue-600" style={{ fontVariationSettings: "'FILL' 1" }}>route</span>
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4">Intelligent Routing</h3>
            <p className="text-gray-500 leading-relaxed font-medium text-sm md:text-base">Proprietary routing engine that optimizes redistribution based on distance and urgency.</p>
          </div>
        </div>
      </section>

      {/* Horizontal Auto-Scroll Fact Section */}
      <section className="pt-20 pb-32 bg-gray-50/50 border-y border-gray-100 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 mb-12 md:mb-16 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <span className="text-primary text-[10px] font-black uppercase tracking-widest mb-4 inline-block">Real-time Data</span>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter">Critical Insights</h2>
            <p className="text-gray-500 text-base md:text-lg font-medium mt-2">Dynamic global statistics powered by Zerra analytics.</p>
          </div>
        </div>

        <div className="relative">
          <motion.div 
            className="flex gap-10 whitespace-nowrap"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ 
              x: {
                repeat: Infinity,
                repeatType: "loop",
                duration: 35,
                ease: "linear"
              }
            }}
          >
            {loopFacts.map((fact, idx) => (
              <div key={idx} className="inline-block w-[300px] md:w-[450px] shrink-0">
                <div className="aspect-[16/10] rounded-[32px] overflow-hidden mb-8 bg-gray-200 shadow-lg border border-white">
                  <img src={fact.image} alt={fact.title} className="w-full h-full object-cover" />
                </div>
                <div className="px-4">
                  <p className="text-primary text-[10px] font-black uppercase tracking-widest mb-3">{fact.title}</p>
                  <p className="text-gray-900 font-bold text-xl leading-snug whitespace-normal tracking-tight">{fact.text}</p>
                </div>
              </div>
            ))}
          </motion.div>
          <div className="absolute inset-y-0 left-0 w-48 bg-gradient-to-r from-white to-transparent z-10"></div>
          <div className="absolute inset-y-0 right-0 w-48 bg-gradient-to-l from-white to-transparent z-10"></div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
