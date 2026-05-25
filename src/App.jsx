import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import FleetGrid, { FLEET_DATA } from './components/FleetGrid';
import CarDetailModal from './components/CarDetailModal';
import LeadForm from './components/LeadForm';
import Experiences from './components/Experiences';
import FAQ from './components/FAQ';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import CheckoutPortal from './components/CheckoutPortal';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedCarForInquiry, setSelectedCarForInquiry] = useState(null);
  
  // Modal states
  const [detailCar, setDetailCar] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Authentication states
  const [activeUser, setActiveUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Checkout states
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutCar, setCheckoutCar] = useState(null);
  const [queuedCheckoutCar, setQueuedCheckoutCar] = useState(null);

  // Admin View state
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Live Fleet state loaded from localStorage
  const [fleet, setFleet] = useState([]);

  // Initialize fleet and user session on mount
  useEffect(() => {
    // 1. Initialise user session
    const savedUser = localStorage.getItem('active_user');
    if (savedUser) {
      setActiveUser(JSON.parse(savedUser));
    }

    // 2. Initialise fleet database
    const savedFleet = localStorage.getItem('lc_fleet');
    if (savedFleet) {
      setFleet(JSON.parse(savedFleet));
    } else {
      localStorage.setItem('lc_fleet', JSON.stringify(FLEET_DATA));
      setFleet(FLEET_DATA);
    }
  }, []);

  const handleSearchFilter = (filterType) => {
    setActiveFilter(filterType);
  };

  const handleOpenDetails = (car) => {
    setDetailCar(car);
    setIsDetailOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailOpen(false);
    setTimeout(() => {
      setDetailCar(null);
    }, 300);
  };

  const handleInquireCar = (car) => {
    setSelectedCarForInquiry(car);
    const element = document.getElementById('booking-form');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Auth triggers
  const handleAuthSuccess = (userData) => {
    setActiveUser(userData);
    
    if (queuedCheckoutCar) {
      setCheckoutCar(queuedCheckoutCar);
      setIsCheckoutOpen(true);
      setQueuedCheckoutCar(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('active_user');
    setActiveUser(null);
  };

  // Rent/Checkout triggers
  const handleRentNow = (car) => {
    if (!activeUser) {
      setQueuedCheckoutCar(car);
      setIsAuthOpen(true);
    } else {
      setCheckoutCar(car);
      setIsCheckoutOpen(true);
    }
  };

  const handleBookingSuccess = (bookingDetails) => {
    const savedUser = localStorage.getItem('active_user');
    if (savedUser) {
      setActiveUser(JSON.parse(savedUser));
    }
  };

  // Filter out cars under maintenance from appearing on the Landing Page Catalog
  const activeFleetForLanding = fleet.filter(car => car.status !== 'Maintenance');

  // Switch to full-screen Admin Console if open
  if (isAdminOpen) {
    return (
      <div className="app-shell-theme">
        <AdminPanel 
          fleet={fleet} 
          setFleet={setFleet} 
          onClose={() => setIsAdminOpen(false)} 
        />
      </div>
    );
  }

  return (
    <div className="app-shell-theme">
      <Navbar 
        user={activeUser}
        onAuthTrigger={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onAdminTrigger={() => setIsAdminOpen(true)}
      />
      
      <Hero onSearch={handleSearchFilter} />
      
      <FleetGrid 
        // Pass the live fleet database (with maintenance cars filtered out)
        activeFilter={activeFilter} 
        setActiveFilter={setActiveFilter}
        onViewDetails={handleOpenDetails}
        onInquire={handleRentNow}
        fleetOverride={activeFleetForLanding} // Provide live override
      />
      
      <Experiences />
      
      <LeadForm 
        selectedCar={selectedCarForInquiry}
        setSelectedCar={setSelectedCarForInquiry}
      />
      
      <FAQ />
      
      <Footer />

      {/* Standalone Detail Modal */}
      <CarDetailModal 
        car={detailCar}
        isOpen={isDetailOpen}
        onClose={handleCloseDetails}
        onSelectCar={handleRentNow}
      />

      {/* Authentication Modal */}
      <AuthModal 
        isOpen={isAuthOpen}
        onClose={() => {
          setIsAuthOpen(false);
          setQueuedCheckoutCar(null);
        }}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Stripe checkout Portal */}
      <CheckoutPortal 
        car={checkoutCar}
        user={activeUser}
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          setCheckoutCar(null);
        }}
        onBookingSuccess={handleBookingSuccess}
      />
    </div>
  );
}
