import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;
  const isPublicPage = location.pathname === '/' || location.pathname === '/auth';

  return (
    <>
      {/* Top Navbar: Mobile and Desktop */}
      <nav className={`fixed top-0 left-0 w-full h-16 md:h-20 bg-white/90 backdrop-blur-md border-b border-gray-100 z-[1000] flex items-center justify-between px-6 md:px-10 ${!isPublicPage ? 'md:flex' : 'flex'}`}>
        <Link to="/" className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-2xl md:text-3xl" style={{fontVariationSettings: "'FILL' 1"}}>eco</span>
          <span className="font-black text-xl md:text-2xl text-gray-900 tracking-tighter uppercase">Zerra</span>
        </Link>
        
        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
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

        {/* Mobile Login Button (Only on Public Pages) */}
        {isPublicPage && (
          <Link to="/auth?mode=login" className="flex md:hidden px-4 py-1.5 bg-primary text-white rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg">
            Login
          </Link>
        )}
      </nav>

      {/* Mobile Bottom Navbar (Only shown if NOT on public page) */}
      {!isPublicPage && (
        <nav className="fixed bottom-0 left-0 w-full h-20 bg-white border-t border-gray-100 z-[1000] flex md:hidden items-center justify-around px-4 pb-2 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
          <Link to="/dashboard" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/dashboard') ? 'text-primary' : 'text-gray-400'}`}>
            <span className="material-symbols-outlined text-2xl" style={{fontVariationSettings: isActive('/dashboard') ? "'FILL' 1" : ""}}>dashboard</span>
            <span className="text-[9px] font-black uppercase tracking-wider">Home</span>
          </Link>
          <Link to="/discover" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/discover') ? 'text-primary' : 'text-gray-400'}`}>
            <span className="material-symbols-outlined text-2xl" style={{fontVariationSettings: isActive('/discover') ? "'FILL' 1" : ""}}>explore</span>
            <span className="text-[9px] font-black uppercase tracking-wider">Browse</span>
          </Link>
          <Link to="/inventory" className="relative -top-8 w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-xl shadow-primary/30 border-4 border-white">
            <span className="material-symbols-outlined text-3xl">add</span>
          </Link>
          <Link to="/impact" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/impact') ? 'text-primary' : 'text-gray-400'}`}>
            <span className="material-symbols-outlined text-2xl" style={{fontVariationSettings: isActive('/impact') ? "'FILL' 1" : ""}}>monitoring</span>
            <span className="text-[9px] font-black uppercase tracking-wider">Impact</span>
          </Link>
          <Link to="/profile" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/profile') ? 'text-primary' : 'text-gray-400'}`}>
            <span className="material-symbols-outlined text-2xl" style={{fontVariationSettings: isActive('/profile') ? "'FILL' 1" : ""}}>person</span>
            <span className="text-[9px] font-black uppercase tracking-wider">Profile</span>
          </Link>
        </nav>
      )}
    </>
  );
};

export default Navbar;
