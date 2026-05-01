import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import StatusOverlay from '../components/StatusOverlay';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  
  const [mode, setMode] = useState(initialMode);
  const [role, setRole] = useState('consumer'); // consumer, seller
  const [subCategory, setSubCategory] = useState('individual'); // individual/ngo for consumer, restaurant/cloud_kitchen for seller
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    // Reset subcategory when role changes
    if (role === 'consumer') setSubCategory('individual');
    if (role === 'seller') setSubCategory('restaurant');
  }, [role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Role mapping for Dashboard
      let dashboardRole = 'Consumer';
      if (subCategory === 'ngo') dashboardRole = 'NGO';
      if (subCategory === 'restaurant') dashboardRole = 'Restaurant';
      if (subCategory === 'product_seller') dashboardRole = 'Product Seller';

      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
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

        // Fetch user profile to get role and name
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        if (profileError) throw profileError;

        // Persist for session (though supabase handles its own session, we keep this for current Dashboard logic)
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
    <div className="min-h-[calc(100vh-80px)] pt-24 px-6 flex items-start justify-center bg-gray-50 pb-24">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-sm text-gray-500">
            {mode === 'signup' ? 'Join the Zerra ecosystem today.' : 'Enter your details to access your dashboard.'}
          </p>
        </div>

        {/* Toggle Login/Signup */}
        <div className="flex bg-gray-100 p-1 rounded-lg mb-8">
          <button 
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${mode === 'login' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Log In
          </button>
          <button 
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${mode === 'signup' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
              <input 
                type="text" 
                id="name"
                name="name"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Green"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          )}

          {mode === 'signup' && (
            <>
              {/* Role Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">I am a...</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    type="button"
                    onClick={() => setRole('consumer')}
                    className={`py-3 px-4 border rounded-xl flex items-center justify-center gap-2 transition-all ${role === 'consumer' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <span className="material-symbols-outlined text-xl">shopping_bag</span>
                    <span className="font-semibold text-sm">Consumer</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setRole('seller')}
                    className={`py-3 px-4 border rounded-xl flex items-center justify-center gap-2 transition-all ${role === 'seller' ? 'border-secondary bg-secondary/5 text-secondary' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <span className="material-symbols-outlined text-xl">storefront</span>
                    <span className="font-semibold text-sm">Seller</span>
                  </button>
                </div>
              </div>

              {/* Sub-Category Selection */}
              <div className="animate-[fade-in_0.2s_ease-out]">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Specifically...</label>
                <div className="grid grid-cols-2 gap-3">
                  {role === 'consumer' ? (
                    <>
                      <button 
                        type="button"
                        onClick={() => setSubCategory('individual')}
                        className={`py-2 px-3 border rounded-lg text-sm transition-all ${subCategory === 'individual' ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        Individual
                      </button>
                      <button 
                        type="button"
                        onClick={() => setSubCategory('ngo')}
                        className={`py-2 px-3 border rounded-lg text-sm transition-all ${subCategory === 'ngo' ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        NGO / Shelter
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        type="button"
                        onClick={() => setSubCategory('restaurant')}
                        className={`py-2 px-3 border rounded-lg text-sm transition-all ${subCategory === 'restaurant' ? 'border-secondary bg-secondary/5 text-secondary font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        Restaurant
                      </button>
                      <button 
                        type="button"
                        onClick={() => setSubCategory('product_seller')}
                        className={`py-2 px-3 border rounded-lg text-sm transition-all ${subCategory === 'product_seller' ? 'border-secondary bg-secondary/5 text-secondary font-semibold' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        Product Seller
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              id="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hello@example.com"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              id="password"
              name="password"
              autoComplete={mode === 'signup' ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 mt-4 bg-primary text-white rounded-lg font-semibold hover:bg-tertiary transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : mode === 'signup' ? 'Create Account' : 'Log In'}
          </button>
        </form>
        
        <p className="text-center text-xs text-gray-500 mt-6">
          By continuing, you agree to Zerra's Terms of Service and Privacy Policy.
        </p>
      </div>
      <StatusOverlay status={status} onClose={() => setStatus(null)} />
    </div>
  );
};

export default Auth;
