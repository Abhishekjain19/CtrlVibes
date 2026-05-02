import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import StatusOverlay from '../components/StatusOverlay';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  
  const [mode, setMode] = useState(initialMode);
  const [role, setRole] = useState('consumer'); // consumer, seller
  const [subCategory, setSubCategory] = useState('individual'); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    if (role === 'consumer') setSubCategory('individual');
    if (role === 'seller') setSubCategory('restaurant');
  }, [role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let dashboardRole = 'Consumer';
      if (subCategory === 'ngo') dashboardRole = 'NGO';
      if (subCategory === 'restaurant') dashboardRole = 'Restaurant';
      if (subCategory === 'product_seller') dashboardRole = 'Product Seller';

      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: dashboardRole,
              sub_category: subCategory,
            }
          }
        });
        if (signUpError) throw signUpError;
        setStatus({ type: 'success', message: 'Registration successful! Please log in.' });
        setMode('login');
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        if (profileError) throw profileError;

        localStorage.setItem('userRole', profile.role);
        localStorage.setItem('userName', profile.full_name);
        
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center p-4 md:p-6 lg:p-10 font-['Inter']">
      <div className="w-full max-w-6xl bg-white rounded-[40px] md:rounded-[60px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col lg:flex-row min-h-[80vh] border border-gray-100">
        {/* Left Side: Visual/Branding */}
        <div className="w-full lg:w-[45%] bg-[#0A0A0A] p-8 md:p-12 lg:p-20 flex flex-col justify-center gap-10 relative overflow-hidden text-white">
          <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
            <div className="absolute top-[-10%] right-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-primary rounded-full blur-[100px] md:blur-[150px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[250px] md:w-[400px] h-[250px] md:h-[400px] bg-secondary rounded-full blur-[80px] md:blur-[120px] delay-700 animate-pulse"></div>
          </div>
          
          <div className="relative z-10">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl md:rounded-2xl flex items-center justify-center transform group-hover:rotate-12 transition-transform">
                <span className="material-symbols-outlined text-black text-2xl md:text-3xl">eco</span>
              </div>
              <span className="text-xl md:text-2xl font-black tracking-tighter">ZERRA</span>
            </Link>
          </div>

          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] mb-6 md:mb-8 tracking-tighter">
              Ecosystem <br />
              <span className="text-primary italic font-serif">Redefined.</span>
            </h1>
            <p className="text-gray-400 text-sm md:text-base lg:text-lg font-medium leading-relaxed max-w-sm">
              Join the elite network of conscious vendors and NGOs closing the loop on surplus food waste.
            </p>
          </div>


        </div>

        {/* Right Side: Auth Form */}
        <div className="flex-1 p-8 md:p-12 lg:p-24 flex flex-col justify-center relative bg-white">
          <div className="max-w-md mx-auto w-full">
            <div className="mb-8 md:mb-12">
              <div className="flex bg-gray-100 p-1 rounded-2xl mb-8">
                <button 
                  type="button"
                  onClick={() => setMode('login')}
                  className={`flex-1 py-3 text-xs md:text-sm font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'login' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Log In
                </button>
                <button 
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`flex-1 py-3 text-xs md:text-sm font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'signup' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Sign Up
                </button>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-2">
                {mode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h2>
              <p className="text-gray-500 font-medium text-sm md:text-base">
                {mode === 'login' 
                  ? 'Access your institutional dashboard and impact metrics.' 
                  : 'Establish your node in the Zerra redistribution network.'}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-black uppercase tracking-widest rounded-2xl animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
              {mode === 'signup' && (
                <>
                  <div className="space-y-1.5 md:space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">Identity</label>
                    <input 
                      type="text"
                      placeholder="Full Name / Hub Name"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl px-5 md:px-6 py-3.5 md:py-4 text-sm font-bold text-gray-900 focus:border-primary outline-none transition-all placeholder:text-gray-300 placeholder:font-medium"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5 md:space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">I am a...</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        type="button"
                        onClick={() => setRole('consumer')}
                        className={`py-3 px-4 border rounded-xl flex items-center justify-center gap-2 transition-all ${role === 'consumer' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                      >
                        <span className="material-symbols-outlined text-xl">shopping_bag</span>
                        <span className="font-black text-[10px] uppercase tracking-widest">Consumer</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setRole('seller')}
                        className={`py-3 px-4 border rounded-xl flex items-center justify-center gap-2 transition-all ${role === 'seller' ? 'border-secondary bg-secondary/5 text-secondary' : 'border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                      >
                        <span className="material-symbols-outlined text-xl">storefront</span>
                        <span className="font-black text-[10px] uppercase tracking-widest">Seller</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 md:space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">Entity Sub-Category</label>
                    <div className="grid grid-cols-2 gap-3">
                      {role === 'consumer' ? (
                        <>
                          <button 
                            type="button"
                            onClick={() => setSubCategory('individual')}
                            className={`py-3 px-3 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${subCategory === 'individual' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                          >
                            Individual
                          </button>
                          <button 
                            type="button"
                            onClick={() => setSubCategory('ngo')}
                            className={`py-3 px-3 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${subCategory === 'ngo' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                          >
                            NGO / Shelter
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            type="button"
                            onClick={() => setSubCategory('restaurant')}
                            className={`py-3 px-3 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${subCategory === 'restaurant' ? 'border-secondary bg-secondary/5 text-secondary' : 'border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                          >
                            Restaurant
                          </button>
                          <button 
                            type="button"
                            onClick={() => setSubCategory('product_seller')}
                            className={`py-3 px-3 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${subCategory === 'product_seller' ? 'border-secondary bg-secondary/5 text-secondary' : 'border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                          >
                            Product Seller
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5 md:space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">Email Address</label>
                <input 
                  type="email"
                  placeholder="name@institution.com"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl px-5 md:px-6 py-3.5 md:py-4 text-sm font-bold text-gray-900 focus:border-primary outline-none transition-all placeholder:text-gray-300 placeholder:font-medium"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5 md:space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] ml-1">Secure Password</label>
                <input 
                  type="password"
                  placeholder="••••••••••••"
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl md:rounded-2xl px-5 md:px-6 py-3.5 md:py-4 text-sm font-bold text-gray-900 focus:border-primary outline-none transition-all placeholder:text-gray-300 placeholder:font-medium"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="pt-4 md:pt-6">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-4 md:py-5 bg-[#0A0A0A] text-white rounded-xl md:rounded-2xl font-black text-xs md:text-sm uppercase tracking-[0.2em] hover:bg-black transition-all shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Initializing Node...' : (mode === 'login' ? 'Authenticate' : 'Register Entity')}
                </button>
              </div>
            </form>

            <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest mt-12">
              Eco-Luxe Redefinition &copy; 2026 Zerra Platform
            </p>
          </div>
        </div>
      </div>
      <StatusOverlay status={status} onClose={() => setStatus(null)} />
    </div>
  );
};

export default Auth;
