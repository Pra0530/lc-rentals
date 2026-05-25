import React, { useState, useEffect, useRef } from 'react';
import { 
  Car, X, ShieldCheck, Key, Lock, Unlock, Zap, MapPin, 
  AlertCircle, Fuel, BatteryCharging, Radio, CreditCard, 
  Sparkles, RefreshCw, Volume2, VolumeX, ShieldAlert, Calendar
} from 'lucide-react';
import { db, collection, onSnapshot, doc, updateDoc } from '../firebase';
import { calculateDynamicPrice } from '../utils/pricingCalculator';

// Helper to interpolate coordinate paths (same as AdminPanel)
const interpolateRoute = (route, steps = 150) => {
  const points = [];
  for (let i = 0; i < route.length; i++) {
    const start = route[i];
    const end = route[(i + 1) % route.length];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const lat = start[0] + (end[0] - start[0]) * t;
      const lng = start[1] + (end[1] - start[1]) * t;
      points.push([lat, lng]);
    }
  }
  return points;
};

// Sydney routes (reused from AdminPanel)
const ROUTES = [
  interpolateRoute([
    [-33.9461, 151.1772],
    [-33.9210, 151.2060],
    [-33.8980, 151.2180],
    [-33.8780, 151.2210],
    [-33.8590, 151.2130],
    [-33.8450, 151.2100],
    [-33.8290, 151.2050]
  ]),
  interpolateRoute([
    [-33.8850, 151.2010],
    [-33.8860, 151.1810],
    [-33.8840, 151.1550],
    [-33.8760, 151.1250],
    [-33.8610, 151.0820],
    [-33.8420, 151.0250],
    [-33.8150, 151.0020]
  ]),
  interpolateRoute([
    [-33.8735, 151.2010],
    [-33.8690, 151.1850],
    [-33.8620, 151.1710],
    [-33.8450, 151.1520],
    [-33.8290, 151.1290],
    [-33.8050, 151.1080]
  ]),
  interpolateRoute([
    [-33.8960, 151.2230],
    [-33.8980, 151.2330],
    [-33.9050, 151.2350],
    [-33.9080, 151.2270],
    [-33.9010, 151.2210],
    [-33.8960, 151.2230]
  ])
];

const STREETS = [
  "M1 Harbour Bridge Link",
  "A44 Parramatta Highway",
  "A4 Victoria Road Corridor",
  "Centennial Park Scenic Cruise"
];

export default function GaragePortal({ user, fleet, pricingSettings = {}, onClose }) {
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [activeTab, setActiveTab] = useState('keys'); // 'keys' or 'logs'
  
  // Smart Command States
  const [isLocked, setIsLocked] = useState(true);
  const [isEngineStarted, setIsEngineStarted] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isHonking, setIsHonking] = useState(false);
  const [commandLoading, setCommandLoading] = useState(null); // 'lock', 'engine', 'flash', 'honk'
  const [soundEnabled, setSoundEnabled] = useState(true);

  // OBD/Diagnostic Log Terminal entries
  const [obdLogs, setObdLogs] = useState([
    "ECU systems active.",
    "GSM Telematics online.",
    "GPS tracking linked.",
    "Lock status: Secured."
  ]);

  // Telemetry Simulation values
  const [telemetry, setTelemetry] = useState({
    speed: 0,
    fuel: 85,
    tirePressure: [34, 34, 34, 34],
    currentRoad: "Secured Port Terminal"
  });

  // Booking Extension variables
  const [isExtending, setIsExtending] = useState(false);
  const [extendDate, setExtendDate] = useState('');
  const [isExtendProcessing, setIsExtendProcessing] = useState(false);
  const [isExtendSuccess, setIsExtendSuccess] = useState(false);
  const [extensionCosts, setExtensionCosts] = useState({ base: 0, cover: 0, gst: 0, total: 0, days: 0 });

  // Map references
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const pathIndexRef = useRef(0);
  const simulationTimerRef = useRef(null);

  // Fetch only this user's bookings in real-time
  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = onSnapshot(collection(db, "bookings"), (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({ docId: doc.id, ...doc.data() }))
        .filter(b => b.userId === user.uid);
      setBookings(list);
    });

    return () => unsubscribe();
  }, [user]);

  // Handle active selection and fallback
  useEffect(() => {
    if (bookings.length > 0) {
      // Prioritize active bookings first, then pending/confirmed, then others
      const activeBooking = bookings.find(b => b.status === 'Active');
      const nextBooking = bookings.find(b => b.status === 'Confirmed' || b.status === 'Pending');
      
      if (activeBooking) {
        setSelectedBooking(activeBooking);
      } else if (nextBooking) {
        setSelectedBooking(nextBooking);
      } else if (!selectedBooking) {
        setSelectedBooking(bookings[0]);
      }
    } else {
      setSelectedBooking(null);
    }
  }, [bookings]);

  // Web Audio API engine sound generator
  const playIgnitionSound = () => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      
      // Sweep frequency to simulate engine startup and idle
      osc.frequency.setValueAtTime(45, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.4); // Rev roar
      osc.frequency.exponentialRampToValueAtTime(85, ctx.currentTime + 1.2);  // Fallback to idle rumble
      
      // Gain curve (volume profile)
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.1); // Crank load
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.4);  // Roar peak
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 1.5); // Constant idle rumble
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 3.0);         // Fade out
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 3.0);
    } catch (e) {
      console.warn("Web Audio API failed or blocked: ", e);
    }
  };

  // Web Audio API beep sound generator
  const playBeepSound = () => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const playTone = (time, pitch) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(pitch, time);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.15, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.3);
      };
      
      playTone(ctx.currentTime, 550);
      playTone(ctx.currentTime + 0.35, 550);
    } catch (e) {
      console.warn("Audio feedback blocked:", e);
    }
  };

  // Add system telemetry logs to console
  const addLog = (text) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setObdLogs(prev => [`[${time}] ${text}`, ...prev.slice(0, 15)]);
  };

  // Telemetry Simulation loop for active bookings
  useEffect(() => {
    if (selectedBooking && selectedBooking.status === 'Active') {
      const routeIndex = selectedBooking.referenceNumber.charCodeAt(3) % 4; // Deterministic route mapping
      const routeCoords = ROUTES[routeIndex];
      const roadName = STREETS[routeIndex];
      
      // Reset simulation state
      pathIndexRef.current = 0;
      setTelemetry({
        speed: 0,
        fuel: 85,
        tirePressure: [34, 34, 34, 34],
        currentRoad: roadName
      });
      addLog("Telemetry tracking established.");
      addLog(`Route assigned: ${roadName}`);

      simulationTimerRef.current = setInterval(() => {
        // Increment coordinate index
        pathIndexRef.current = (pathIndexRef.current + 1) % routeCoords.length;
        const currentCoord = routeCoords[pathIndexRef.current];
        const nextCoord = routeCoords[(pathIndexRef.current + 1) % routeCoords.length];
        
        // Calculate bearing/rotation angle
        let bearing = 0;
        if (currentCoord && nextCoord) {
          const dy = nextCoord[0] - currentCoord[0];
          const dx = nextCoord[1] - currentCoord[1];
          bearing = Math.atan2(dx, dy) * (180 / Math.PI);
        }

        // Simulating driving speed, fuel depletion, tire fluctuations
        setTelemetry(prev => {
          const speedVar = isEngineStarted 
            ? Math.floor(65 + Math.sin(pathIndexRef.current * 0.1) * 35) 
            : 0;
          const drainRate = isEngineStarted ? 0.05 : 0;
          const newFuel = Math.max(0, parseFloat((prev.fuel - drainRate).toFixed(2)));
          
          const tires = prev.tirePressure.map(val => {
            const delta = (Math.random() - 0.5) * 0.4;
            return parseFloat(Math.min(37, Math.max(28, val + delta)).toFixed(1));
          });

          return {
            speed: speedVar,
            fuel: newFuel,
            tirePressure: tires,
            currentRoad: speedVar > 0 ? roadName : "Idling at junction"
          };
        });

        // Update Leaflet marker coordinates and rotation dynamically
        if (mapRef.current && currentCoord) {
          if (markerRef.current) {
            markerRef.current.setLatLng(currentCoord);
            
            // Apply SVG arrow rotation based on direction
            const markerElement = markerRef.current.getElement();
            if (markerElement) {
              const arrowIcon = markerElement.querySelector('.gps-arrow-icon');
              if (arrowIcon) {
                arrowIcon.style.transform = `rotate(${bearing}deg)`;
              }
            }
          } else {
            // Instantiate marker
            const customIcon = window.L.divIcon({
              html: `
                <div class="custom-gps-marker">
                  <div class="gps-arrow-icon" style="transform: rotate(${bearing}deg)">▲</div>
                  <div class="gps-pulse-cyan"></div>
                </div>
              `,
              className: 'gps-marker-container',
              iconSize: [38, 38],
              iconAnchor: [19, 19]
            });
            markerRef.current = window.L.marker(currentCoord, { icon: customIcon }).addTo(mapRef.current);
          }
          // Follow vehicle
          mapRef.current.panTo(currentCoord);
        }
      }, 1000);
    } else {
      // Clear simulation if booking is not Active
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
      if (markerRef.current && mapRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      setIsEngineStarted(false);
    }

    return () => {
      if (simulationTimerRef.current) {
        clearInterval(simulationTimerRef.current);
      }
    };
  }, [selectedBooking, isEngineStarted]);

  // Leaflet map initialization
  useEffect(() => {
    if (selectedBooking && selectedBooking.status === 'Active' && mapContainerRef.current) {
      // Wait for DOM layout to settle before maps paint
      setTimeout(() => {
        if (!mapRef.current && window.L) {
          const routeIndex = selectedBooking.referenceNumber.charCodeAt(3) % 4;
          const initialCoord = ROUTES[routeIndex][0];

          mapRef.current = window.L.map(mapContainerRef.current, {
            center: initialCoord,
            zoom: 14,
            zoomControl: false,
            dragging: false,
            scrollWheelZoom: false,
            touchZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false
          });

          // Style tiles in Cyber-Dark
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
          
          // Force layout sizing updates
          mapRef.current.invalidateSize();
        }
      }, 100);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [selectedBooking]);

  // Trigger vehicle lock commands
  const handleSmartLock = (lockVal) => {
    const cmd = lockVal ? 'lock' : 'unlock';
    setCommandLoading(cmd);
    addLog(`Sending remote ${cmd} command packet...`);
    
    setTimeout(() => {
      setIsLocked(lockVal);
      if (lockVal) {
        setIsEngineStarted(false);
        addLog("Lock state: Locked. Engine deactivated.");
      } else {
        addLog("Lock state: Unlocked.");
      }
      setCommandLoading(null);
      playBeepSound();
      
      // Dispatch local iOS Concierge notification simulator
      const alertMsg = lockVal 
        ? `${selectedBooking.carName} secured and locked successfully.` 
        : `${selectedBooking.carName} unlocked. Keyless engine start is active.`;
      
      const event = new CustomEvent("lc_sms_received", {
        detail: {
          to: user.phone || "+61 491 570 156",
          body: `[Security Alert] ${alertMsg}`
        }
      });
      window.dispatchEvent(event);
    }, 1200);
  };

  // Trigger engine ignition commands
  const handleEngineTrigger = () => {
    if (isLocked) {
      alert("Unlock vehicle doors first before starting the ignition.");
      return;
    }
    
    const nextState = !isEngineStarted;
    setCommandLoading('engine');
    addLog(nextState ? "Engaging starter motor..." : "Deactivating ECU fuel pumps...");
    
    setTimeout(() => {
      setIsEngineStarted(nextState);
      setCommandLoading(null);
      if (nextState) {
        addLog("Ignition success. Supercar idle running.");
        playIgnitionSound();
      } else {
        addLog("Engine killed. Running aux power.");
      }
    }, 1500);
  };

  // Honk / Flash command triggers
  const handleAlertCommand = (type) => {
    setCommandLoading(type);
    addLog(type === 'flash' ? "Flashed hazard matrix lamps." : "Triggered active horn decibels.");
    
    setTimeout(() => {
      setCommandLoading(null);
      if (type === 'flash') {
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 3000);
      } else {
        setIsHonking(true);
        playBeepSound();
        setTimeout(() => setIsHonking(false), 800);
      }
    }, 600);
  };

  // Calculate extension prices on selected date change
  const handleExtendDateChange = (dateVal) => {
    setExtendDate(dateVal);
    if (!selectedBooking || !dateVal) return;

    const originalEnd = new Date(selectedBooking.endDate);
    const newEnd = new Date(dateVal);
    const diffTime = newEnd - originalEnd;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      setExtensionCosts({ base: 0, cover: 0, gst: 0, total: 0, days: 0 });
      return;
    }

    const activeRentalsCount = bookings.filter(b => b.status === 'Active').length;
    const totalFleetCount = fleet.filter(c => c.status !== 'Maintenance').length;

    const matchedCar = fleet.find(c => c.id === selectedBooking.carId);
    const dailyPrice = matchedCar ? matchedCar.price : selectedBooking.basePrice / selectedBooking.days;

    const dynamicPricing = calculateDynamicPrice(
      dailyPrice,
      selectedBooking.endDate,
      dateVal,
      activeRentalsCount,
      totalFleetCount,
      pricingSettings
    );

    const base = dynamicPricing.basePrice;
    const cover = selectedBooking.insurancePrice > 0 ? 50 * diffDays : 0;
    const subtotal = base + cover;
    const gst = Math.round(subtotal * 0.1);
    const total = subtotal + gst;

    setExtensionCosts({ base, cover, gst, total, days: diffDays, dynamicPricing });
  };

  // Save Booking Extension in Firestore
  const handleProcessExtension = async () => {
    if (!selectedBooking || extensionCosts.days <= 0) return;
    
    setIsExtendProcessing(true);
    addLog("Authorizing rental extension with Stripe payment intent...");

    setTimeout(async () => {
      try {
        const bookingRef = doc(db, "bookings", selectedBooking.docId || selectedBooking.id);
        const updatedDays = selectedBooking.days + extensionCosts.days;
        const updatedTotal = selectedBooking.total + extensionCosts.total;
        
        await updateDoc(bookingRef, {
          endDate: extendDate,
          days: updatedDays,
          total: updatedTotal,
          basePrice: selectedBooking.basePrice + extensionCosts.base,
          insurancePrice: selectedBooking.insurancePrice + extensionCosts.cover,
          gst: selectedBooking.gst + extensionCosts.gst
        });

        addLog(`Extension finalized. Return date shifted to ${extendDate}.`);
        setIsExtendProcessing(false);
        setIsExtendSuccess(true);

        // Dispatch extension payment confirmation text
        const event = new CustomEvent("lc_sms_received", {
          detail: {
            to: user.phone || "+61 491 570 156",
            body: `Booking Extended! Your rental ${selectedBooking.referenceNumber} has been extended to ${extendDate}. Saved card charged $${extensionCosts.total} AUD. Receipt in your dashboard.`
          }
        });
        window.dispatchEvent(event);
      } catch (err) {
        console.error("Booking extension update failed in Firestore:", err);
        alert("Failed to extend booking. Please try again.");
        setIsExtendProcessing(false);
      }
    }, 2000);
  };

  const getStatusClass = (status) => {
    if (status === 'Active') return 'status-active';
    if (status === 'Confirmed') return 'status-confirmed';
    if (status === 'Pending') return 'status-pending';
    if (status === 'Completed') return 'status-completed';
    return 'status-cancelled';
  };

  const matchedCar = selectedBooking ? fleet.find(c => c.id === selectedBooking.carId) : null;
  const activeRentals = bookings.filter(b => b.status === 'Active');
  const pastUpcomingRentals = bookings.filter(b => b.status !== 'Active');

  return (
    <div className="admin-panel-overlay">
      <div className="admin-panel-container customer-garage-container">
        
        {/* Header section */}
        <header className="admin-header customer-garage-header">
          <div className="admin-header-brand">
            <div className="garage-logo-badge">
              <Key size={18} />
            </div>
            <div>
              <h2>My Garage</h2>
              <p className="font-tiny text-cyan font-bold">LC RENTALS OWNER HUB</p>
            </div>
          </div>

          <div className="customer-header-profile">
            <span className="sound-toggle-btn" onClick={() => setSoundEnabled(!soundEnabled)}>
              {soundEnabled ? <Volume2 size={16} className="text-cyan" /> : <VolumeX size={16} />}
            </span>
            <div className="user-info-plate">
              <span className="font-small font-bold">{user ? user.name : "Guest Owner"}</span>
              <span className="font-tiny text-muted">{user ? user.email : ""}</span>
            </div>
            <button className="admin-close-btn" onClick={onClose} aria-label="Close Garage">
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Dashboard Panels */}
        <div className="admin-split-layout customer-garage-split">
          
          {/* Left panel: Active rentals selector & Reservation lists */}
          <aside className="admin-sidebar customer-garage-sidebar">
            <div className="sidebar-tab-navigation">
              <button 
                className={`sidebar-tab-btn ${activeTab === 'keys' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('keys')}
              >
                <Key size={14} /> Active Keys ({activeRentals.length})
              </button>
              <button 
                className={`sidebar-tab-btn ${activeTab === 'logs' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('logs')}
              >
                <Calendar size={14} /> Log History ({pastUpcomingRentals.length})
              </button>
            </div>

            <div className="sidebar-items-list-wrap">
              {activeTab === 'keys' ? (
                <>
                  {activeRentals.length > 0 ? (
                    activeRentals.map(booking => (
                      <div 
                        key={booking.docId || booking.id}
                        className={`garage-vehicle-item-card ${selectedBooking?.id === booking.id ? 'card-selected' : ''}`}
                        onClick={() => setSelectedBooking(booking)}
                      >
                        <div className="item-header-meta">
                          <span className={`status-pill ${getStatusClass(booking.status)}`}>{booking.status}</span>
                          <span className="font-tiny text-muted">{booking.referenceNumber}</span>
                        </div>
                        <h4>{booking.carName}</h4>
                        <p className="font-tiny text-muted">Returns: {booking.endDate}</p>
                      </div>
                    ))
                  ) : (
                    <div className="sidebar-empty-fallback text-center">
                      <Car size={32} className="text-muted margin-bottom-small" />
                      <p className="font-small text-muted">No active rental keys found.</p>
                      <p className="font-tiny text-muted">Active bookings will sync here on checkout.</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {pastUpcomingRentals.length > 0 ? (
                    pastUpcomingRentals.map(booking => (
                      <div 
                        key={booking.docId || booking.id}
                        className={`garage-vehicle-item-card ${selectedBooking?.id === booking.id ? 'card-selected' : ''}`}
                        onClick={() => setSelectedBooking(booking)}
                      >
                        <div className="item-header-meta">
                          <span className={`status-pill ${getStatusClass(booking.status)}`}>{booking.status}</span>
                          <span className="font-tiny text-muted">{booking.referenceNumber}</span>
                        </div>
                        <h4>{booking.carName}</h4>
                        <p className="font-tiny text-muted">Dates: {booking.startDate} to {booking.endDate}</p>
                      </div>
                    ))
                  ) : (
                    <div className="sidebar-empty-fallback text-center">
                      <RefreshCw size={32} className="text-muted margin-bottom-small" />
                      <p className="font-small text-muted">No booking log records found.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>

          {/* Right panel: Active controls / Telemetry HUD */}
          <main className="admin-content-view customer-garage-main-view">
            {selectedBooking ? (
              <div className="garage-selected-booking-details-wrap">
                
                {/* Booking Status Card */}
                <div className="glass-panel garage-overview-billboard margin-bottom-medium">
                  <div className="billboard-details">
                    <div className="billboard-meta-badge font-tiny text-cyan font-bold uppercase tracking-wider">
                      Selected Rental Info
                    </div>
                    <h2>{selectedBooking.carName}</h2>
                    <p className="font-small text-muted">
                      Reference: <strong className="text-cyan">{selectedBooking.referenceNumber}</strong> | 
                      Dates: <strong>{selectedBooking.startDate}</strong> to <strong>{selectedBooking.endDate}</strong> ({selectedBooking.days} days)
                    </p>
                  </div>
                  <div className="billboard-action-buttons">
                    <div className={`status-badge-lg ${getStatusClass(selectedBooking.status)}`}>
                      {selectedBooking.status} Status
                    </div>
                    
                    {(selectedBooking.status === 'Active' || selectedBooking.status === 'Confirmed') && (
                      <button 
                        className="btn btn-secondary btn-extension-trigger"
                        onClick={() => {
                          setExtendDate(selectedBooking.endDate);
                          setExtensionCosts({ base: 0, cover: 0, gst: 0, total: 0, days: 0 });
                          setIsExtendSuccess(false);
                          setIsExtending(true);
                        }}
                      >
                        <Calendar size={14} /> Extend Rental
                      </button>
                    )}
                  </div>
                </div>

                {/* Grid layout for active simulation telemetry, maps and keys */}
                {selectedBooking.status === 'Active' ? (
                  <div className="garage-active-console-grid">
                    
                    {/* Column 1: Live HUD Gauges & controls */}
                    <div className="console-column-controls">
                      
                      {/* Sub-widget 1: Virtual Smart Key Console */}
                      <div className="glass-panel smart-key-fob-widget margin-bottom-medium">
                        <div className="fob-header margin-bottom-small">
                          <Radio size={16} className={`pulse-cyan-infinite ${isEngineStarted ? 'text-cyan' : ''}`} />
                          <h3 className="font-bold">E-Key Virtual Remote</h3>
                        </div>

                        {/* Visual Key card */}
                        <div className={`key-visual-badge-card ${isLocked ? 'badge-locked' : 'badge-unlocked'} ${isEngineStarted ? 'ignition-active' : ''}`}>
                          <div className="card-top">
                            <span className="brand">LC KEYLINK</span>
                            <span className="battery font-tiny">📶 OBD connected</span>
                          </div>
                          
                          <div className="card-middle text-center">
                            <div className="indicator-symbol">
                              {isLocked ? <Lock size={26} /> : <Unlock size={26} className="text-cyan pulse-cyan-infinite" />}
                            </div>
                            <span className="lock-text font-small uppercase font-bold tracking-wider">
                              {isLocked ? "System Armed" : isEngineStarted ? "Engine Running" : "System Unlocked"}
                            </span>
                          </div>

                          <div className="card-bottom">
                            <div>
                              <p className="font-tiny text-muted">Exotic Model</p>
                              <p className="font-small font-bold">{selectedBooking.carName}</p>
                            </div>
                            <div>
                              <p className="font-tiny text-muted">Secured ID</p>
                              <p className="font-small font-bold">{selectedBooking.referenceNumber}</p>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Buttons */}
                        <div className="smart-fob-controls-grid margin-top-small">
                          <button 
                            className={`btn-fob-key ${isLocked ? 'btn-fob-active' : ''}`}
                            onClick={() => handleSmartLock(true)}
                            disabled={commandLoading !== null}
                          >
                            {commandLoading === 'lock' ? <RefreshCw className="animate-spin" size={18} /> : <Lock size={18} />}
                            <span className="font-tiny">Lock</span>
                          </button>
                          
                          <button 
                            className={`btn-fob-key ${!isLocked && !isEngineStarted ? 'btn-fob-active' : ''}`}
                            onClick={() => handleSmartLock(false)}
                            disabled={commandLoading !== null}
                          >
                            {commandLoading === 'unlock' ? <RefreshCw className="animate-spin" size={18} /> : <Unlock size={18} />}
                            <span className="font-tiny">Unlock</span>
                          </button>

                          <button 
                            className="btn-fob-key"
                            onClick={() => handleAlertCommand('flash')}
                            disabled={commandLoading !== null}
                          >
                            {commandLoading === 'flash' ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                            <span className="font-tiny">Flash Lights</span>
                          </button>

                          <button 
                            className={`btn-fob-key btn-fob-ignition ${isEngineStarted ? 'engine-ignited-glow' : ''}`}
                            onClick={handleEngineTrigger}
                            disabled={commandLoading !== null}
                          >
                            {commandLoading === 'engine' ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                            <span className="font-tiny font-bold">{isEngineStarted ? "Engine Stop" : "Engine Start"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Sub-widget 2: Live Diagnostic Logs Console */}
                      <div className="glass-panel diagnostic-logs-terminal-widget">
                        <div className="terminal-header">
                          <Radio size={14} className="text-cyan" />
                          <span className="font-tiny font-bold tracking-wider uppercase">OBD System Diagnostics</span>
                        </div>
                        <div className="terminal-scroller margin-top-small font-mono text-cyan">
                          {obdLogs.map((log, idx) => (
                            <div key={idx} className="terminal-row">{log}</div>
                          ))}
                        </div>
                      </div>

                    </div>

                    {/* Column 2: Live GPS Map Tracking & Telemetry Dashboard */}
                    <div className="console-column-telemetry">
                      
                      {/* Telemetry Numbers HUD */}
                      <div className="glass-panel telemetry-gauges-ledger-wrap margin-bottom-medium">
                        <div className="hud-gauges-grid">
                          {/* Gauge 1: Speedometer */}
                          <div className="hud-gauge-card text-center">
                            <span className="font-tiny text-muted uppercase font-bold">Velocity</span>
                            <div className="gauge-large-value">
                              <span className="value-num">{telemetry.speed}</span>
                              <span className="value-unit">km/h</span>
                            </div>
                            <div className="speed-intensity-bar">
                              <div className="speed-fill" style={{ width: `${Math.min(100, (telemetry.speed / 130) * 100)}%` }}></div>
                            </div>
                          </div>

                          {/* Gauge 2: Fuel/Charge */}
                          <div className="hud-gauge-card text-center">
                            <span className="font-tiny text-muted uppercase font-bold">
                              {selectedBooking.carCategory === 'EV' ? 'Battery Charge' : 'Fuel Level'}
                            </span>
                            <div className="gauge-large-value">
                              <span className="value-num">{Math.round(telemetry.fuel)}</span>
                              <span className="value-unit">%</span>
                            </div>
                            <div className="fuel-intensity-bar">
                              <div 
                                className={`fuel-fill ${selectedBooking.carCategory === 'EV' ? 'bg-cyan' : 'bg-green'}`} 
                                style={{ width: `${telemetry.fuel}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>

                        {/* Tire Pressure & Diagnostics */}
                        <div className="diagnostics-sub-ledger margin-top-small">
                          <div className="diag-header-row">
                            <span className="font-tiny text-muted uppercase font-bold">OBD Diagnostic Safe-check</span>
                            <span className="font-tiny text-cyan font-bold">System Status: OK</span>
                          </div>
                          
                          <div className="tire-pressures-mini-grid margin-top-small">
                            <div className="tire-card">
                              <span className="font-tiny text-muted">FL Tyre</span>
                              <span className="font-small font-bold">{telemetry.tirePressure[0]} psi</span>
                            </div>
                            <div className="tire-card">
                              <span className="font-tiny text-muted">FR Tyre</span>
                              <span className="font-small font-bold">{telemetry.tirePressure[1]} psi</span>
                            </div>
                            <div className="tire-card">
                              <span className="font-tiny text-muted">RL Tyre</span>
                              <span className="font-small font-bold">{telemetry.tirePressure[2]} psi</span>
                            </div>
                            <div className="tire-card">
                              <span className="font-tiny text-muted">RR Tyre</span>
                              <span className="font-small font-bold">{telemetry.tirePressure[3]} psi</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Mini Live Map */}
                      <div className="glass-panel customer-telemetry-map-widget">
                        <div className="map-header-bar">
                          <MapPin size={14} className="text-cyan animate-bounce" />
                          <span className="font-tiny font-bold text-muted">LIVE GPS TRACER:</span>
                          <span className="font-tiny text-cyan font-bold ml-1">{telemetry.currentRoad}</span>
                        </div>
                        <div ref={mapContainerRef} className="customer-mini-map-box"></div>
                      </div>

                    </div>

                  </div>
                ) : (
                  /* Inactive / Non-active booking fallback */
                  <div className="glass-panel customer-inactive-instructions-card">
                    <div className="instruct-icon-avatar">
                      <ShieldAlert size={28} />
                    </div>
                    <h3>Control Keys Locked</h3>
                    <p className="font-small text-muted">
                      Your remote access and telemetry dashboard will unlock automatically once our staff handles keys and transitions your reservation to <strong>Active</strong>.
                    </p>

                    <div className="instruction-check-steps margin-top-medium">
                      <div className="instruct-step">
                        <span className="step-num">1</span>
                        <div>
                          <h4>Booking Review</h4>
                          <p className="font-tiny text-muted">Our admin confirms your document checklist and signature credentials.</p>
                        </div>
                      </div>
                      <div className="instruct-step">
                        <span className="step-num">2</span>
                        <div>
                          <h4>Handover Inspection</h4>
                          <p className="font-tiny text-muted">An inspector verifies fuel, tyres, and completes checkout logs with your signature.</p>
                        </div>
                      </div>
                      <div className="instruct-step">
                        <span className="step-num">3</span>
                        <div>
                          <h4>Keys Activated</h4>
                          <p className="font-tiny text-muted">Your virtual fob and telemetry tracking activates instantly here in real-time.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              /* No bookings found fallback */
              <div className="sidebar-empty-fallback text-center full-height-fallback">
                <Car size={48} className="text-muted margin-bottom-medium" />
                <h2>No Vehicles Registered</h2>
                <p className="font-small text-muted">
                  There are no active or past bookings registered to your client profile.
                </p>
                <p className="font-tiny text-muted">
                  Visit our catalog to select your first supercar.
                </p>
              </div>
            )}
          </main>

        </div>

      </div>

      {/* Booking Extension Modal */}
      {isExtending && selectedBooking && (
        <div className="modal-overlay extension-modal-overlay">
          <div className="glass-panel modal-container extension-modal-container animate-slide-up">
            
            <header className="modal-header">
              <h3 className="font-bold flex-align-icon text-cyan">
                <Calendar size={18} /> Request Rental Extension
              </h3>
              <button className="modal-close" onClick={() => setIsExtending(false)}>
                <X size={18} />
              </button>
            </header>

            {!isExtendSuccess ? (
              <div className="extension-modal-content">
                <p className="font-small text-muted">
                  Select your new return date. We will extend your checkout agreement, recalculate charges, and bill your saved card:
                </p>

                <div className="saved-card-badge-row glass-panel margin-top-small">
                  <CreditCard size={18} className="text-cyan" />
                  <div>
                    <span className="font-small font-bold uppercase tracking-wider block">Saved Payment Token</span>
                    <span className="font-tiny text-muted">{selectedBooking.cardBrand || "Visa"} ending in •••• {selectedBooking.cardLast4 || "4242"}</span>
                  </div>
                </div>

                <div className="form-group margin-top-medium">
                  <label className="form-label" htmlFor="new-return-date">New Return Date</label>
                  <input 
                    type="date"
                    id="new-return-date"
                    required
                    min={selectedBooking.endDate}
                    value={extendDate}
                    onChange={(e) => handleExtendDateChange(e.target.value)}
                    className="form-input"
                  />
                </div>

                {/* Ledger calculations */}
                {extensionCosts.days > 0 && (
                  <div className="extension-pricing-ledger glass-panel margin-top-medium animate-slide-up">
                    <div className="ledger-row font-tiny">
                      <span>Original Return Date</span>
                      <strong>{selectedBooking.endDate}</strong>
                    </div>
                    <div className="ledger-row font-tiny">
                      <span>New Return Date</span>
                      <strong>{extendDate}</strong>
                    </div>
                    <div className="ledger-row font-tiny">
                      <span>Additional Extension</span>
                      <strong className="text-cyan">{extensionCosts.days} day{extensionCosts.days > 1 ? 's' : ''}</strong>
                    </div>
                    
                    <div className="ledger-row font-tiny border-top-thin">
                      <span>Daily rate ({selectedBooking.carName})</span>
                      <span>${selectedBooking.basePrice / selectedBooking.days} AUD</span>
                    </div>

                    {extensionCosts.dynamicPricing?.weekendDays > 0 && (
                      <div className="ledger-row font-tiny text-muted">
                        <span>Weekend Days ({extensionCosts.dynamicPricing.weekendDays}d)</span>
                        <span className="text-cyan">+{Math.round(((pricingSettings.weekendMultiplier || 1.15) - 1) * 100)}% surge applied</span>
                      </div>
                    )}

                    {extensionCosts.dynamicPricing?.utilizationSurchargeMultiplier > 0 && (
                      <div className="ledger-row font-tiny text-muted animate-pulse">
                        <span>🔥 High Demand Surcharge</span>
                        <span className="text-cyan">+{Math.round(extensionCosts.dynamicPricing.utilizationSurchargeMultiplier * 100)}% applied</span>
                      </div>
                    )}

                    <div className="ledger-row font-tiny">
                      <span>Base Extension Charge</span>
                      <span>${extensionCosts.base} AUD</span>
                    </div>

                    {selectedBooking.insurancePrice > 0 && (
                      <div className="ledger-row font-tiny">
                        <span>Excess Cover extension ($50/day)</span>
                        <span>${extensionCosts.cover} AUD</span>
                      </div>
                    )}

                    <div className="ledger-row font-tiny">
                      <span>GST (10%)</span>
                      <span>${extensionCosts.gst} AUD</span>
                    </div>

                    <div className="ledger-row font-small font-bold border-top-glow total-row">
                      <span>Extension Total:</span>
                      <span className="text-cyan">${extensionCosts.total} AUD</span>
                    </div>
                  </div>
                )}

                <div className="extension-modal-actions margin-top-medium">
                  <button 
                    className="btn btn-secondary w-full"
                    onClick={() => setIsExtending(false)}
                    disabled={isExtendProcessing}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary w-full"
                    onClick={handleProcessExtension}
                    disabled={isExtendProcessing || extensionCosts.days <= 0}
                  >
                    {isExtendProcessing ? (
                      <span className="flex-align-icon"><RefreshCw className="animate-spin" size={16} /> Processing Gateway...</span>
                    ) : (
                      <span className="flex-align-icon"><Sparkles size={16} /> Authorize &amp; Charge Saved Card</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Success screen for extension */
              <div className="extension-success-screen text-center animate-slide-up">
                <div className="success-icon-badge margin-bottom-small">
                  <ShieldCheck size={36} />
                </div>
                <h3>Extension Authorized</h3>
                <p className="font-small text-muted margin-bottom-medium">
                  Your billing transaction was processed successfully. Booking reference <strong>{selectedBooking.referenceNumber}</strong> has been updated.
                </p>
                <div className="receipt-invoice-bill glass-panel text-left font-small">
                  <div className="bill-row">
                    <span>New End Date:</span>
                    <strong>{extendDate}</strong>
                  </div>
                  <div className="bill-row">
                    <span>Charged Amount:</span>
                    <strong className="text-cyan">${extensionCosts.total} AUD</strong>
                  </div>
                  <div className="bill-row">
                    <span>Receipt Transaction:</span>
                    <span className="font-mono text-muted">Stripe PI_{Math.random().toString(36).substring(7)}</span>
                  </div>
                </div>
                <button 
                  className="btn btn-primary w-full margin-top-medium"
                  onClick={() => setIsExtending(false)}
                >
                  Return to Garage
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
