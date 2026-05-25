import React, { useState, useEffect, useRef } from 'react';
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
import GaragePortal from './components/GaragePortal';

// Firebase Integrations
import { auth, db, onAuthStateChanged, signOut, collection, doc, onSnapshot, setDoc } from './firebase';
import { initializeFCM, sendNativeNotification } from './services/pushNotificationService';

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
  const [isGarageOpen, setIsGarageOpen] = useState(false);

  // Live Fleet state loaded from Cloud Firestore
  const [fleet, setFleet] = useState([]);
  
  // Lifted bookings list
  const [bookings, setBookings] = useState([]);

  // Pricing rules settings
  const [pricingSettings, setPricingSettings] = useState({
    dynamicPricingEnabled: true,
    weekendMultiplier: 1.15,
    utilizationThreshold1: 0.50,
    utilizationSurcharge1: 0.10,
    utilizationThreshold2: 0.75,
    utilizationSurcharge2: 0.25,
    categoryMultipliers: {
      Supercar: 1.0,
      EV: 1.0,
      'Luxury SUV': 1.0
    }
  });

  // SMS Simulator Toast State
  const [activeSmsToast, setActiveSmsToast] = useState(null);

  useEffect(() => {
    const handleSmsEvent = (e) => {
      setActiveSmsToast(e.detail);
      // Auto-dismiss after 6 seconds
      const timer = setTimeout(() => {
        setActiveSmsToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    };

    window.addEventListener("lc_sms_received", handleSmsEvent);
    return () => {
      window.removeEventListener("lc_sms_received", handleSmsEvent);
    };
  }, []);

  // Initialize fleet, user session, bookings, and pricing settings on mount
  useEffect(() => {
    // 1. Initialise user session via Auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setActiveUser({
          uid: user.uid,
          name: user.displayName || user.email.split('@')[0],
          email: user.email,
          phone: user.phoneNumber || ''
        });
        // Request token and initialize FCM (non-blocking)
        initializeFCM(user.uid);
      } else {
        setActiveUser(null);
      }
    });

    // 2. Initialise fleet database real-time sync (standard queries/real-time listener)
    const unsubscribeFleet = onSnapshot(collection(db, "fleet"), (snapshot) => {
      if (snapshot.empty) {
        // Seed default database when Firestore is empty
        FLEET_DATA.forEach(async (car) => {
          await setDoc(doc(db, "fleet", car.id), car);
        });
      } else {
        const fleetList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFleet(fleetList);
      }
    });

    // 3. Initialise bookings real-time sync
    const unsubscribeBookings = onSnapshot(collection(db, "bookings"), (snapshot) => {
      const list = snapshot.docs.map(d => ({ docId: d.id, id: d.id, ...d.data() }));
      setBookings(list);
    });

    // 4. Initialise pricing settings real-time sync
    const unsubscribePricing = onSnapshot(doc(db, "settings", "pricing"), (docSnap) => {
      if (docSnap.exists()) {
        setPricingSettings(docSnap.data());
      } else {
        // Seed default pricing settings in Firestore
        setDoc(doc(db, "settings", "pricing"), {
          dynamicPricingEnabled: true,
          weekendMultiplier: 1.15,
          utilizationThreshold1: 0.50,
          utilizationSurcharge1: 0.10,
          utilizationThreshold2: 0.75,
          utilizationSurcharge2: 0.25,
          categoryMultipliers: {
            Supercar: 1.0,
            EV: 1.0,
            'Luxury SUV': 1.0
          }
        });
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeFleet();
      unsubscribeBookings();
      unsubscribePricing();
    };
  }, []);

  // Live listener to booking status transitions for browser push notifications
  const prevStatusesRef = useRef({});

  useEffect(() => {
    if (!activeUser || bookings.length === 0) return;

    bookings.forEach((booking) => {
      if (booking.userId === activeUser.uid) {
        const bookingId = booking.id || booking.docId;
        const currentStatus = booking.status;
        const oldStatus = prevStatusesRef.current[bookingId];

        if (oldStatus && oldStatus !== currentStatus) {
          // Status changed! Trigger native push notification
          let title = "Booking Status Update";
          let body = `Your booking for ${booking.carName} is now ${currentStatus}.`;
          if (currentStatus === 'Confirmed') {
            title = "Booking Confirmed! 🎉";
            body = `Your luxury experience with the ${booking.carName} has been approved.`;
          } else if (currentStatus === 'Active') {
            title = "Rental Active! 🏎️";
            body = `Enjoy your drive in the ${booking.carName}. Telematics are live.`;
          } else if (currentStatus === 'Completed') {
            title = "Rental Completed";
            body = `Thank you for choosing LC Rentals. Return complete.`;
          }

          sendNativeNotification(title, body);
        }
        prevStatusesRef.current[bookingId] = currentStatus;
      }
    });
  }, [bookings, activeUser]);

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
    // State is automatically synced by the onAuthStateChanged listener
    if (queuedCheckoutCar) {
      setCheckoutCar(queuedCheckoutCar);
      setIsCheckoutOpen(true);
      setQueuedCheckoutCar(null);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error signing out:", err);
    }
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
    console.log("Booking processed successfully in Firestore:", bookingDetails);
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
          bookings={bookings}
          pricingSettings={pricingSettings}
          onClose={() => setIsAdminOpen(false)} 
        />
      </div>
    );
  }

  // Switch to full-screen Customer Garage Portal if open
  if (isGarageOpen) {
    return (
      <div className="app-shell-theme">
        <GaragePortal 
          user={activeUser}
          fleet={fleet}
          pricingSettings={pricingSettings}
          onClose={() => setIsGarageOpen(false)}
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
        onGarageTrigger={() => setIsGarageOpen(true)}
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
        fleet={fleet}
        bookings={bookings}
        pricingSettings={pricingSettings}
        onClose={() => {
          setIsCheckoutOpen(false);
          setCheckoutCar(null);
        }}
        onBookingSuccess={handleBookingSuccess}
      />

      {/* Visual iOS-style SMS Toast Notification Simulator */}
      {activeSmsToast && (
        <div className="sms-toast-simulator animate-slide-in">
          <div className="sms-toast-header">
            <span className="sms-toast-icon">💬</span>
            <div className="sms-toast-title">
              <strong>MESSAGES</strong>
              <span className="sms-toast-time">now</span>
            </div>
            <button className="sms-toast-close" onClick={() => setActiveSmsToast(null)}>×</button>
          </div>
          <div className="sms-toast-body">
            <strong>LC Concierge ({activeSmsToast.to}):</strong> {activeSmsToast.body}
          </div>
        </div>
      )}
    </div>
  );
}
