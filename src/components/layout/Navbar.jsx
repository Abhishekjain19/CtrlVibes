import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;
  const isPublicPage = location.pathname === '/' || location.pathname === '/auth';

  return (
    <>
      {/* Desktop Top Navbar */}
      <nav className="fixed top-0 left-0 w-full h-20 bg-white/90 backdrop-blur-md border-b border-gray-200 z-[1000] hidden md:flex items-center justify-between px-10">
        <Link to="/" className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-3xl" style={{fontVariationSettings: "'FILL' 1"}}>eco</span>
          <span className="font-extrabold text-2xl text-gray-900 tracking-tighter uppercase">Zerra</span>
        </Link>
        
        <div className="flex items-center gap-8">
          {!isPublicPage ? (
            <>
              <Link to="/dashboard" className={`text-sm font-bold transition-colors ${isActive('/dashboard') ? 'text-primary' : 'text-gray-500 hover:text-gray-900'}`}>Dashboard</Link>
              <Link to="/discover" className={`text-sm font-bold transition-colors ${isActive('/discover') ? 'text-primary' : 'text-gray-500 hover:text-gray-900'}`}>Marketplace</Link>
              <Link to="/impact" className={`text-sm font-bold transition-colors ${isActive('/impact') ? 'text-primary' : 'text-gray-500 hover:text-gray-900'}`}>Impact</Link>
              <Link to="/logistics" className={`text-sm font-bold transition-colors ${isActive('/logistics') ? 'text-primary' : 'text-gray-500 hover:text-gray-900'}`}>Logistics</Link>
              <Link to="/profile" className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full border border-gray-200 hover:bg-gray-200 transition-all">
                <span className="material-symbols-outlined text-xl text-gray-600">person</span>
                <span className="text-sm font-bold text-gray-900">Account</span>
              </Link>
            </>
          ) : (
            <Link to="/auth?mode=login" className="px-6 py-2 bg-primary text-white rounded-lg font-bold text-sm shadow-sm hover:bg-tertiary transition-all">
              Log In
            </Link>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Navbar (Only shown if NOT on public page) */}
      {!isPublicPage && (
        <nav className="fixed bottom-0 left-0 w-full h-20 bg-white border-t border-gray-200 z-[1000] flex md:hidden items-center justify-around px-4 pb-2">
          <Link to="/dashboard" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/dashboard') ? 'text-primary' : 'text-gray-400'}`}>
            <span className="material-symbols-outlined text-2xl" style={{fontVariationSettings: isActive('/dashboard') ? "'FILL' 1" : ""}}>dashboard</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
          </Link>
          <Link to="/discover" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/discover') ? 'text-primary' : 'text-gray-400'}`}>
            <span className="material-symbols-outlined text-2xl" style={{fontVariationSettings: isActive('/discover') ? "'FILL' 1" : ""}}>explore</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Browse</span>
          </Link>
          <Link to="/inventory" className="relative -top-8 w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/30 border-4 border-gray-50">
            <span className="material-symbols-outlined text-3xl">add</span>
          </Link>
          <Link to="/impact" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/impact') ? 'text-primary' : 'text-gray-400'}`}>
            <span className="material-symbols-outlined text-2xl" style={{fontVariationSettings: isActive('/impact') ? "'FILL' 1" : ""}}>monitoring</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Impact</span>
          </Link>
          <Link to="/profile" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/profile') ? 'text-primary' : 'text-gray-400'}`}>
            <span className="material-symbols-outlined text-2xl" style={{fontVariationSettings: isActive('/profile') ? "'FILL' 1" : ""}}>person</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Profile</span>
          </Link>
        </nav>
      )}
    </>
  );
};

export default Navbar;
