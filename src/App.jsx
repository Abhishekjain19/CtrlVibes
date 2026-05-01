import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Discover from './pages/Discover';
import Impact from './pages/Impact';
import Profile from './pages/Profile';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import NGO from './pages/NGO';
import Notifications from './pages/Notifications';
import Logistics from './pages/Logistics';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/impact" element={<Impact />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/ngo" element={<NGO />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/logistics" element={<Logistics />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Router>
  );
}

export default App;
