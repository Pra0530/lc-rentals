import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, Car, Calendar, TrendingUp, Plus, Trash2, ShieldAlert, Check, X, FileText } from 'lucide-react';
import { FLEET_DATA } from './FleetGrid';
import { db, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from '../firebase';
import { sendSMS } from '../services/smsService';

export default function AdminPanel({ fleet, setFleet, onClose }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [bookings, setBookings] = useState([]);
  
  // Real-time IoT Telemetry States
  const [telemetry, setTelemetry] = useState({});
  const [selectedTelemetryRef, setSelectedTelemetryRef] = useState(null);
  
  const mapRef = useRef(null);
  const markersRef = useRef({});
  
  // Fleet form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCar, setNewCar] = useState({
    name: '',
    category: 'Supercar',
    price: 300,
    image: '/mclaren.png',
    engine: '',
    acceleration: '',
    topSpeed: '',
    seats: 2,
    transmission: 'Automatic',
    features: '',
    description: ''
  });

  // Inspection states
  const [activeInspectionBooking, setActiveInspectionBooking] = useState(null);
  const [inspectionType, setInspectionType] = useState('checkout'); // checkout or checkin
  const [inspectionChecks, setInspectionChecks] = useState({
    exterior: false,
    interior: false,
    fluids: false,
    tires: false,
    fuel: 'Full',
    notes: ''
  });
  const [inspectorSig, setInspectorSig] = useState('');

  // Fetch bookings in real-time on mount (using onSnapshot standard real-time queries)
  useEffect(() => {
    const unsubscribeBookings = onSnapshot(collection(db, "bookings"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
      setBookings(list);
    });
    return () => unsubscribeBookings();
  }, []);

  // Sydney routes for telemetry simulation
  const routesList = [
    [
      [-33.9461, 151.1772], // Airport Hub
      [-33.9210, 151.2060], // Mascot M1 approach
      [-33.8980, 151.2180], // Zetland M1
      [-33.8780, 151.2210], // Darlinghurst M1
      [-33.8590, 151.2130], // Circular Quay
      [-33.8450, 151.2100], // Sydney Harbour Bridge
      [-33.8290, 151.2050]  // North Sydney
    ],
    [
      [-33.8850, 151.2010], // Central Station
      [-33.8860, 151.1810], // Camperdown (Parramatta Rd)
      [-33.8840, 151.1550], // Leichhardt
      [-33.8760, 151.1250], // Haberfield / M4 approach
      [-33.8610, 151.0820], // Strathfield
      [-33.8420, 151.0250], // Silverwater
      [-33.8150, 151.0020]  // Parramatta CBD
    ],
    [
      [-33.8735, 151.2010], // Darling Harbour
      [-33.8690, 151.1850], // ANZAC Bridge
      [-33.8620, 151.1710], // Rozelle (Victoria Rd)
      [-33.8450, 151.1520], // Gladesville Bridge
      [-33.8290, 151.1290], // Ryde
      [-33.8050, 151.1080]  // Macquarie Park
    ],
    [
      [-33.8960, 151.2230], // Moore Park
      [-33.8980, 151.2330], // Centennial Park Gate
      [-33.9050, 151.2350], // Grand Drive East
      [-33.9080, 151.2270], // Grand Drive South
      [-33.9010, 151.2210], // Grand Drive West
      [-33.8960, 151.2230]  // Loop back
    ]
  ];

  const streetsList = [
    "M1 Harbour Bridge Link",
    "A44 Parramatta Highway",
    "A4 Victoria Road Corridor",
    "Centennial Park Scenic Cruise"
  ];

  // Sync telemetry list with active bookings in Firestore
  useEffect(() => {
    const activeBookings = bookings.filter(b => b.status === 'Active');
    
    // Helpers for interpolation
    const interpolateRoute = (route, steps = 150) => {
      const points = [];
      for (let i = 0; i < route.length; i++) {
        const start = route[i];
        const end = route[(i + 1) % route.length];
        for (let step = 0; step < steps; step++) {
          const t = step / steps;
          const lat = start[0] + (end[0] - start[0]) * t;
          const lng = start[1] + (end[1] - start[1]) * t;
          points.push([lat, lng]);
        }
      }
      return points;
    };

    const makePingPongRoute = (route) => {
      const reversed = [...route].reverse().slice(1, -1);
      return [...route, ...reversed];
    };

    setTelemetry(prev => {
      const nextTelemetry = { ...prev };
      let updated = false;

      // 1. Remove closed rentals
      Object.keys(nextTelemetry).forEach(ref => {
        if (!activeBookings.some(b => b.referenceNumber === ref)) {
          delete nextTelemetry[ref];
          updated = true;
          if (selectedTelemetryRef === ref) {
            setSelectedTelemetryRef(null);
          }
        }
      });

      // 2. Add newly activated rentals
      activeBookings.forEach((b, idx) => {
        if (!nextTelemetry[b.referenceNumber]) {
          const routeIdx = idx % routesList.length;
          const rawRoute = routesList[routeIdx];
          const pingPongRoute = makePingPongRoute(rawRoute);
          const fullPath = interpolateRoute(pingPongRoute, 180);
          
          const initialIndex = Math.floor(Math.random() * fullPath.length);

          nextTelemetry[b.referenceNumber] = {
            carName: b.carName,
            renterName: b.renterName,
            refNum: b.referenceNumber,
            path: fullPath,
            currentIndex: initialIndex,
            currentCoord: fullPath[initialIndex],
            speed: 55 + Math.random() * 25,
            fuel: 80 + Math.random() * 20,
            tirePressure: [34.2, 34.0, 34.5, 34.1].map(p => p + (Math.random() * 1.5 - 0.75)),
            streetName: streetsList[routeIdx],
            status: "Normal",
            isEv: b.carCategory === "EV" || b.carName.toLowerCase().includes("tesla")
          };
          updated = true;
        }
      });

      return updated ? nextTelemetry : prev;
    });
  }, [bookings]);

  // Periodic Telemetry Simulator timer (accelerating, fuel depletion, tire fluctuations)
  useEffect(() => {
    if (activeTab !== 'dashboard') return;

    const intervalId = setInterval(() => {
      setTelemetry(prev => {
        const nextTelemetry = {};
        let changed = false;

        Object.keys(prev).forEach(ref => {
          const car = prev[ref];
          
          const nextIndex = (car.currentIndex + 1) % car.path.length;
          const nextCoord = car.path[nextIndex];
          
          const speedVar = Math.random() * 10 - 5;
          let nextSpeed = Math.max(10, Math.min(110, car.speed + speedVar));
          if (car.streetName.includes("Scenic")) {
            nextSpeed = Math.max(15, Math.min(40, nextSpeed));
          }

          const nextFuel = Math.max(4, car.fuel - 0.02); // slowly deplete fuel/battery

          const nextTire = car.tirePressure.map(p => {
            const pressureVar = Math.random() * 0.1 - 0.05;
            return Math.max(29, Math.min(40, p + pressureVar));
          });

          let nextStatus = "Normal";
          if (nextFuel < 18) {
            nextStatus = "Low Range Alert";
          } else if (nextSpeed > 95 && !car.streetName.includes("Scenic")) {
            nextStatus = "Speed Warning";
          }

          nextTelemetry[ref] = {
            ...car,
            currentIndex: nextIndex,
            currentCoord: nextCoord,
            speed: nextSpeed,
            fuel: nextFuel,
            tirePressure: nextTire,
            status: nextStatus
          };
          changed = true;
        });

        return changed ? nextTelemetry : prev;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [activeTab]);

  // Map Initializer useEffect (runs exactly once on dashboard mount)
  useEffect(() => {
    const L = window.L;
    if (!L || activeTab !== 'dashboard') return;

    const mapContainer = document.getElementById("gps-tracker-map");
    if (!mapContainer) return;

    if (mapContainer._leaflet_id) {
      mapContainer._leaflet_id = null;
      mapContainer.innerHTML = '';
    }

    const map = L.map("gps-tracker-map", {
      center: [-33.8730, 151.2100],
      zoom: 11,
      scrollWheelZoom: false
    });
    mapRef.current = map;

    // Standard OSM layer (styled globally via tile filter in index.css)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(map);

    // Sydney Airport HQ Hub marker
    const hubMarker = L.circleMarker([-33.9461, 151.1772], {
      color: '#3acbe8',
      fillColor: '#3acbe8',
      fillOpacity: 0.8,
      radius: 8
    }).addTo(map);
    hubMarker.bindPopup(`
      <div style="font-family: inherit; color: #fff; text-align: left; padding: 4px;">
        <strong style="color: #3acbe8; font-size: 0.95rem;">LC Handover Hub</strong><br/>
        Sydney Airport HQ Terminal Suite<br/>
        <span style="font-size: 0.75rem; color: #aaa;">Fleet Handover & Logistics</span>
      </div>
    `);

    markersRef.current = {};

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, [activeTab]);

  // Marker Synchronization useEffect (handles moving car coordinate and rotation updates)
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map) return;

    // 1. Remove deleted markers
    Object.keys(markersRef.current).forEach(ref => {
      if (!telemetry[ref]) {
        markersRef.current[ref].remove();
        delete markersRef.current[ref];
      }
    });

    // 2. Sync active coordinates and headings
    Object.keys(telemetry).forEach(ref => {
      const car = telemetry[ref];
      const coord = car.currentCoord;
      
      const prevIndex = (car.currentIndex - 1 + car.path.length) % car.path.length;
      const prevCoord = car.path[prevIndex];
      const getAngle = (p1, p2) => {
        if (!p1 || !p2) return 0;
        const dy = p2[0] - p1[0];
        const dx = p2[1] - p1[1];
        return Math.atan2(dx, dy) * 180 / Math.PI;
      };
      const angle = getAngle(prevCoord, coord);

      // Neon-green directional car marker styled as standard GPS arrows
      const carIconHtml = `
        <div class="gps-car-wrapper" style="transform: rotate(${angle}deg); transform-origin: center; display: flex; justify-content: center; align-items: center; width: 26px; height: 26px; filter: drop-shadow(0 0 5px #4caf50);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 20C7 20.6 7.4 21 8 21H16C16.6 21 17 20.6 17 20V4C17 3.4 16.6 3 16 3H8C7.4 3 7 3.4 7 4V20Z" fill="#4caf50" stroke="#000" stroke-width="1.5"/>
            <path d="M9 8h6M9 15h6" stroke="#000" stroke-width="1.5"/>
            <rect x="5" y="5" width="2" height="4" rx="0.5" fill="#000"/>
            <rect x="17" y="5" width="2" height="4" rx="0.5" fill="#000"/>
            <rect x="5" y="15" width="2" height="4" rx="0.5" fill="#000"/>
            <rect x="17" y="15" width="2" height="4" rx="0.5" fill="#000"/>
          </svg>
        </div>
      `;

      const customIcon = L.divIcon({
        html: carIconHtml,
        className: 'custom-gps-icon',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      if (!markersRef.current[ref]) {
        const marker = L.marker(coord, { icon: customIcon }).addTo(map);
        marker.bindPopup(() => {
          return `
            <div style="font-family: inherit; color: #fff; text-align: left; padding: 4px; min-width: 165px;">
              <strong style="color: #4caf50; font-size: 0.95rem;">🚗 Live: ${car.carName}</strong><br/>
              Renter: ${car.renterName}<br/>
              Speed: <strong>${Math.round(car.speed)} km/h</strong><br/>
              ${car.isEv ? 'Battery' : 'Fuel'}: <strong>${Math.round(car.fuel)}%</strong><br/>
              Street: <span style="font-size: 0.75rem; color: #ccc;">${car.streetName}</span>
            </div>
          `;
        }, { closeButton: false });

        markersRef.current[ref] = marker;
      } else {
        const marker = markersRef.current[ref];
        marker.setLatLng(coord);
        marker.setIcon(customIcon);
      }
    });
  }, [telemetry]);

  // Helper to change booking status in Firestore
  const handleUpdateBookingStatus = async (refNum, newStatus, inspectionData = null) => {
    const targetBooking = bookings.find(b => b.referenceNumber === refNum);
    if (!targetBooking) return;
    
    try {
      const bookingDocRef = doc(db, "bookings", targetBooking.docId);
      const updatePayload = { status: newStatus };
      if (inspectionData) {
        // Use object bracket dot notation for nested inspection updates
        updatePayload[`inspection.${inspectionType}`] = inspectionData;
      }
      await updateDoc(bookingDocRef, updatePayload);

      // Trigger SMS alerts
      let smsBody = `LC Concierge: Your booking for ${targetBooking.carName} is ${newStatus}.`;
      if (newStatus === 'Confirmed') {
        smsBody = `LC Concierge: Your booking (Ref: ${refNum}) for the ${targetBooking.carName} is CONFIRMED. We look forward to your luxury experience.`;
      } else if (newStatus === 'Active') {
        smsBody = `LC Concierge: Your rental (Ref: ${refNum}) for the ${targetBooking.carName} is now ACTIVE. Handover inspection complete. Enjoy the journey!`;
      } else if (newStatus === 'Completed') {
        smsBody = `LC Concierge: Your rental (Ref: ${refNum}) for the ${targetBooking.carName} is COMPLETED. Return inspection complete. Thank you for choosing LC Rentals.`;
      } else if (newStatus === 'Cancelled') {
        smsBody = `LC Concierge: Your booking (Ref: ${refNum}) for the ${targetBooking.carName} has been CANCELLED. Please contact us for details.`;
      }
      
      const phoneNumber = targetBooking.phone || targetBooking.renterPhone || '+61400123456';
      await sendSMS(phoneNumber, smsBody);
    } catch (err) {
      console.error("Error updating booking status in Firestore:", err);
    }
  };

  // Fleet management actions in Firestore
  const handleAddCar = async (e) => {
    e.preventDefault();
    
    const formattedCar = {
      name: newCar.name,
      category: newCar.category,
      price: Number(newCar.price),
      image: newCar.image,
      engine: newCar.engine || 'V8 Engine',
      acceleration: newCar.acceleration || '3.5s',
      topSpeed: newCar.topSpeed || '300 km/h',
      seats: Number(newCar.seats),
      transmission: newCar.transmission,
      features: newCar.features ? newCar.features.split(',').map(f => f.trim()) : ['Premium Audio', 'GPS Navigator'],
      description: newCar.description || 'A premium vehicle addition to the elite LC Rentals fleet.',
      status: 'Active' // Active or Maintenance
    };

    const carDocId = newCar.name.toLowerCase().replace(/\s+/g, '-');

    try {
      await setDoc(doc(db, "fleet", carDocId), formattedCar);
      // Reset Form
      setNewCar({
        name: '',
        category: 'Supercar',
        price: 300,
        image: '/mclaren.png',
        engine: '',
        acceleration: '',
        topSpeed: '',
        seats: 2,
        transmission: 'Automatic',
        features: '',
        description: ''
      });
      setShowAddForm(false);
    } catch (err) {
      console.error("Error adding vehicle to Firestore:", err);
    }
  };

  const handleToggleMaintenance = async (carId) => {
    const car = fleet.find(c => c.id === carId);
    if (!car) return;
    
    try {
      await updateDoc(doc(db, "fleet", carId), {
        status: car.status === 'Maintenance' ? 'Active' : 'Maintenance'
      });
    } catch (err) {
      console.error("Error toggling maintenance status:", err);
    }
  };

  const handleDeleteCar = async (carId) => {
    if (confirm('Are you sure you want to remove this vehicle from the fleet?')) {
      try {
        await deleteDoc(doc(db, "fleet", carId));
      } catch (err) {
        console.error("Error deleting vehicle from Firestore:", err);
      }
    }
  };

  const handleUpdatePrice = async (carId, newPrice) => {
    try {
      await updateDoc(doc(db, "fleet", carId), {
        price: Number(newPrice)
      });
    } catch (err) {
      console.error("Error updating price in Firestore:", err);
    }
  };

  // Metrics Calculations
  const totalRevenue = bookings.reduce((sum, b) => b.status !== 'Cancelled' ? sum + b.total : sum, 0);
  const activeRentalsCount = bookings.filter(b => b.status === 'Active').length;
  const maintenanceCount = fleet.filter(car => car.status === 'Maintenance').length;
  const occupancyRate = fleet.length > 0 ? Math.round((activeRentalsCount / fleet.length) * 100) : 0;

  // Open Inspection
  const triggerInspection = (booking, type) => {
    setActiveInspectionBooking(booking);
    setInspectionType(type);
    setInspectionChecks({
      exterior: false,
      interior: false,
      fluids: false,
      tires: false,
      fuel: 'Full',
      notes: ''
    });
    setInspectorSig('');
  };

  const submitInspection = (e) => {
    e.preventDefault();
    if (!inspectorSig) {
      alert('Please sign off as the inspector.');
      return;
    }

    const inspectionData = {
      timestamp: new Date().toLocaleString(),
      inspectorSignature: inspectorSig,
      checks: { ...inspectionChecks }
    };

    const nextStatus = inspectionType === 'checkout' ? 'Active' : 'Completed';
    handleUpdateBookingStatus(activeInspectionBooking.referenceNumber, nextStatus, inspectionData);
    setActiveInspectionBooking(null);
  };

  return (
    <div className="admin-portal-overlay">
      <div className="admin-portal-container">
        
        {/* Sidebar Nav */}
        <aside className="admin-sidebar glass-panel">
          <div className="admin-brand">
            <span className="brand-l">L</span>
            <span className="brand-c">C</span>
            <span className="brand-text">ADMIN</span>
          </div>

          <nav className="admin-nav">
            <button 
              className={`admin-nav-btn ${activeTab === 'dashboard' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <TrendingUp size={16} /> Dashboard
            </button>
            <button 
              className={`admin-nav-btn ${activeTab === 'bookings' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('bookings')}
            >
              <Calendar size={16} /> Bookings ({bookings.length})
            </button>
            <button 
              className={`admin-nav-btn ${activeTab === 'fleet' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('fleet')}
            >
              <Car size={16} /> Fleet Manager ({fleet.length})
            </button>
          </nav>

          <button onClick={onClose} className="btn btn-secondary admin-close-portal-btn">
            Exit Console
          </button>
        </aside>

        {/* Content area */}
        <main className="admin-main-content">
          
          {/* TAB 1: DASHBOARD SUMMARY */}
          {activeTab === 'dashboard' && (
            <div className="admin-tab-content animate-slide-up">
              <h2 className="admin-content-title">Dashboard Overview</h2>
              
              <div className="metrics-grid">
                <div className="glass-card metric-card">
                  <div className="metric-header">
                    <span className="metric-label">Total Revenue</span>
                    <DollarSign size={20} className="metric-icon-gold" />
                  </div>
                  <span className="metric-value">${totalRevenue.toLocaleString()} AUD</span>
                  <span className="metric-trend text-green">✦ Live sales hold</span>
                </div>

                <div className="glass-card metric-card">
                  <div className="metric-header">
                    <span className="metric-label">Active Rentals</span>
                    <Calendar size={20} className="metric-icon-gold" />
                  </div>
                  <span className="metric-value">{activeRentalsCount} Vehicles</span>
                  <span className="metric-trend text-blue">Occupancy Rate: {occupancyRate}%</span>
                </div>

                <div className="glass-card metric-card">
                  <div className="metric-header">
                    <span className="metric-label">Fleet Size</span>
                    <Car size={20} className="metric-icon-gold" />
                  </div>
                  <span className="metric-value">{fleet.length} Listings</span>
                  <span className="metric-trend text-muted">{maintenanceCount} under maintenance</span>
                </div>
              </div>

              {/* Live GPS Tracker & Telemetry Console Widget */}
              <div className="gps-console-widget glass-panel" style={{ marginTop: '2rem', padding: '1.5rem', textAlign: 'left' }}>
                <div className="gps-widget-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h3 className="widget-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>Live Fleet Satellite GPS Telemetry</h3>
                  <div className="gps-legend" style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem' }}>
                    <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="dot-green"></span>
                      <span>Active Telemetry Lock</span>
                    </div>
                    <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="dot-gold"></span>
                      <span>SYD Handover Hub</span>
                    </div>
                  </div>
                </div>

                <div className="gps-widget-split">
                  {/* Left: Map */}
                  <div id="gps-tracker-map" className="gps-map-container"></div>
                  
                  {/* Right: Telemetry Sidepanel */}
                  <div className="telemetry-hud-sidebar glass-panel">
                    <h4 className="telemetry-sidebar-header">Active Telemetry HUD</h4>
                    <div className="telemetry-list-container">
                      {Object.keys(telemetry).map(ref => {
                        const car = telemetry[ref];
                        const isSelected = selectedTelemetryRef === ref;
                        
                        return (
                          <div 
                            key={ref} 
                            className={`telemetry-row-card ${isSelected ? 'telemetry-selected' : ''}`}
                            onClick={() => {
                              setSelectedTelemetryRef(ref);
                              // Pan map directly to coordination path index
                              if (mapRef.current) {
                                mapRef.current.setView(car.currentCoord, 13, { animate: true });
                                if (markersRef.current[ref]) {
                                  markersRef.current[ref].openPopup();
                                }
                              }
                            }}
                          >
                            <div className="telemetry-card-top">
                              <span className="telemetry-car-name">{car.carName}</span>
                              <span className={`telemetry-status-pill status-${car.status.replace(/ /g, '-').toLowerCase()}`}>
                                {car.status === 'Normal' ? 'Live' : car.status}
                              </span>
                            </div>
                            <div className="telemetry-card-renter">Renter: {car.renterName}</div>
                            <div className="telemetry-card-metrics">
                              <div className="metric-pill">
                                <span className="metric-pill-label">Speed</span>
                                <span className="metric-pill-value">{Math.round(car.speed)} km/h</span>
                              </div>
                              <div className="metric-pill">
                                <span className="metric-pill-label">{car.isEv ? 'Battery' : 'Fuel'}</span>
                                <span className="metric-pill-value">{Math.round(car.fuel)}%</span>
                              </div>
                            </div>
                            
                            {/* Fuel/Battery progress bar */}
                            <div className="telemetry-progress-wrap">
                              <div 
                                className={`telemetry-progress-bar ${car.isEv ? 'bg-ev' : 'bg-gas'} ${car.fuel < 20 ? 'bg-low' : ''}`} 
                                style={{ width: `${car.fuel}%` }}
                              />
                            </div>
                            
                            {/* Detailed diagnostics shown when selected */}
                            {isSelected && (
                              <div className="telemetry-details-expanded animate-slide-up">
                                <div className="diagnostics-header">Tire Pressure Indicators</div>
                                <div className="tire-grid">
                                  <div className="tire-item">FL: {car.tirePressure[0].toFixed(1)} psi</div>
                                  <div className="tire-item">FR: {car.tirePressure[1].toFixed(1)} psi</div>
                                  <div className="tire-item">RL: {car.tirePressure[2].toFixed(1)} psi</div>
                                  <div className="tire-item">RR: {car.tirePressure[3].toFixed(1)} psi</div>
                                </div>
                                <div className="diagnostics-street">Road: <span>{car.streetName}</span></div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {Object.keys(telemetry).length === 0 && (
                        <div className="telemetry-empty-state">
                          <p>No active rentals streaming telemetry.</p>
                          <p className="font-tiny text-muted">Bookings marked "Active" will stream dynamic tracking feeds here.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent booking widgets */}
              <div className="dashboard-grid-widgets">
                <div className="glass-card recent-bookings-widget text-left">
                  <h3 className="widget-title">Recent Inquiries &amp; Bookings</h3>
                  <div className="widget-list">
                    {bookings.slice(-5).reverse().map((b) => (
                      <div key={b.referenceNumber} className="widget-row-item">
                        <div>
                          <strong>{b.userName}</strong>
                          <p className="font-tiny text-muted">{b.carName} — {b.days} Days</p>
                        </div>
                        <span className={`status-badge status-${b.status ? b.status.toLowerCase() : 'pending'}`}>
                          {b.status || 'Pending'}
                        </span>
                      </div>
                    ))}
                    {bookings.length === 0 && <p className="text-muted text-center py-4">No active booking records yet.</p>}
                  </div>
                </div>

                <div className="glass-card recent-bookings-widget text-left">
                  <h3 className="widget-title">Fleet Utilization</h3>
                  <div className="widget-list">
                    {fleet.map((car) => {
                      const count = bookings.filter(b => b.carName === car.name && b.status !== 'Cancelled').length;
                      return (
                        <div key={car.id} className="widget-row-item">
                          <span>{car.name}</span>
                          <strong>{count} booking{count !== 1 ? 's' : ''}</strong>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MANAGE BOOKINGS */}
          {activeTab === 'bookings' && (
            <div className="admin-tab-content animate-slide-up text-left">
              <h2 className="admin-content-title">Customer Bookings &amp; Logs</h2>

              <div className="table-responsive">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Ref Code</th>
                      <th>Renter</th>
                      <th>Vehicle</th>
                      <th>Duration</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b.referenceNumber}>
                        <td><code>{b.referenceNumber}</code></td>
                        <td>
                          <div>
                            <strong>{b.renterName || b.userName}</strong>
                            <p className="font-tiny text-muted">{b.userEmail}</p>
                          </div>
                        </td>
                        <td>{b.carName}</td>
                        <td>{b.startDate} to {b.endDate} ({b.days}d)</td>
                        <td>${b.total.toLocaleString()} AUD</td>
                        <td>
                          <span className={`status-badge status-${b.status ? b.status.toLowerCase() : 'pending'}`}>
                            {b.status || 'Pending'}
                          </span>
                        </td>
                        <td>
                          <div className="actions-button-group">
                            {(b.status === 'Pending' || !b.status) && (
                              <button 
                                onClick={() => handleUpdateBookingStatus(b.referenceNumber, 'Confirmed')}
                                className="btn-action-badge text-green"
                                title="Approve booking"
                              >
                                <Check size={16} /> Approve
                              </button>
                            )}
                            {b.status === 'Confirmed' && (
                              <button 
                                onClick={() => triggerInspection(b, 'checkout')}
                                className="btn-action-badge text-gold"
                                title="Checkout Inspection"
                              >
                                <FileText size={16} /> Handover Checks
                              </button>
                            )}
                            {b.status === 'Active' && (
                              <button 
                                onClick={() => triggerInspection(b, 'checkin')}
                                className="btn-action-badge text-blue"
                                title="Checkin Inspection"
                              >
                                <FileText size={16} /> Return Checks
                              </button>
                            )}
                            {b.status !== 'Completed' && b.status !== 'Cancelled' && (
                              <button 
                                onClick={() => handleUpdateBookingStatus(b.referenceNumber, 'Cancelled')}
                                className="btn-action-badge text-red"
                                title="Cancel booking"
                              >
                                <X size={16} /> Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {bookings.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center text-muted py-4">No reservations logged in database.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: FLEET MANAGER */}
          {activeTab === 'fleet' && (
            <div className="admin-tab-content animate-slide-up text-left">
              <div className="admin-title-row">
                <h2 className="admin-content-title">Manage Fleet Inventory</h2>
                <button 
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="btn btn-primary"
                >
                  <Plus size={16} /> Add Vehicle
                </button>
              </div>

              {/* Add form slider */}
              {showAddForm && (
                <form onSubmit={handleAddCar} className="glass-panel add-car-form animate-slide-up">
                  <h3>Register New Fleet Vehicle</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Vehicle Name</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. Aston Martin Vantage"
                        className="form-input"
                        value={newCar.name}
                        onChange={(e) => setNewCar(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category Tier</label>
                      <select 
                        className="form-select"
                        value={newCar.category}
                        onChange={(e) => setNewCar(prev => ({ ...prev, category: e.target.value }))}
                      >
                        <option value="Supercar">Supercar</option>
                        <option value="Sports">Sports / Performance</option>
                        <option value="SUV">Luxury SUV</option>
                        <option value="EV">Electric (EV)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Daily Price (AUD)</label>
                      <input 
                        type="number" 
                        required 
                        className="form-input"
                        value={newCar.price}
                        onChange={(e) => setNewCar(prev => ({ ...prev, price: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Static Visual Asset</label>
                      <select 
                        className="form-select"
                        value={newCar.image}
                        onChange={(e) => setNewCar(prev => ({ ...prev, image: e.target.value }))}
                      >
                        <option value="/mclaren.png">McLaren Showroom Asset</option>
                        <option value="/porsche.png">Porsche Coastal Road Asset</option>
                        <option value="/range_rover.png">Range Rover Mansion Asset</option>
                        <option value="/tesla.png">Tesla Charging Station Asset</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Engine Specs</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 5.2L V12 Twin-Turbo"
                        className="form-input"
                        value={newCar.engine}
                        onChange={(e) => setNewCar(prev => ({ ...prev, engine: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Seats</label>
                      <input 
                        type="number" 
                        className="form-input"
                        value={newCar.seats}
                        onChange={(e) => setNewCar(prev => ({ ...prev, seats: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">0-100 Acceleration</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 3.2s"
                        className="form-input"
                        value={newCar.acceleration}
                        onChange={(e) => setNewCar(prev => ({ ...prev, acceleration: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Top Speed</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 314 km/h"
                        className="form-input"
                        value={newCar.topSpeed}
                        onChange={(e) => setNewCar(prev => ({ ...prev, topSpeed: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Key Highlights (Comma separated)</label>
                    <input 
                      type="text" 
                      placeholder="Leather dashboard, Active wing, Launch control"
                      className="form-input"
                      value={newCar.features}
                      onChange={(e) => setNewCar(prev => ({ ...prev, features: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea 
                      rows="2"
                      placeholder="Enter premium vehicle marketing descriptions..."
                      className="form-input"
                      value={newCar.description}
                      onChange={(e) => setNewCar(prev => ({ ...prev, description: e.target.value }))}
                    ></textarea>
                  </div>

                  <div className="actions-button-group margin-top-small">
                    <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Add to Grid
                    </button>
                  </div>
                </form>
              )}

              <div className="table-responsive">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price/Day</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fleet.map((car) => (
                      <tr key={car.id}>
                        <td>
                          <img src={car.image} alt={car.name} className="admin-table-thumbnail" />
                        </td>
                        <td>
                          <strong>{car.name}</strong>
                          <p className="font-tiny text-muted">{car.engine} | {car.seats} Seats</p>
                        </td>
                        <td>{car.category}</td>
                        <td>
                          <div className="price-inline-editor">
                            <span>$</span>
                            <input 
                              type="number"
                              className="inline-price-input"
                              value={car.price}
                              onChange={(e) => handleUpdatePrice(car.id, e.target.value)}
                            />
                            <span>AUD</span>
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge status-${car.status === 'Maintenance' ? 'maintenance' : 'confirmed'}`}>
                            {car.status === 'Maintenance' ? 'Maintenance' : 'Active'}
                          </span>
                        </td>
                        <td>
                          <div className="actions-button-group">
                            <button 
                              onClick={() => handleToggleMaintenance(car.id)}
                              className={`btn-action-badge ${car.status === 'Maintenance' ? 'text-green' : 'text-gold'}`}
                            >
                              <ShieldAlert size={14} /> {car.status === 'Maintenance' ? 'Activate' : 'Service'}
                            </button>
                            <button 
                              onClick={() => handleDeleteCar(car.id)}
                              className="btn-action-badge text-red"
                            >
                              <Trash2 size={14} /> Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* INSPECTION DIALOG OVERLAY */}
      {activeInspectionBooking && (
        <div className="inspection-modal-overlay">
          <form onSubmit={submitInspection} className="inspection-form-panel glass-panel animate-slide-up text-left">
            <div className="inspection-header">
              <h2>
                {inspectionType === 'checkout' ? 'Outgoing Handover Inspection' : 'Incoming Return Inspection'}
              </h2>
              <span>Ref: {activeInspectionBooking.referenceNumber}</span>
            </div>

            <p className="font-small text-secondary mb-4">
              Inspect the <strong>{activeInspectionBooking.carName}</strong> to verify operational safety and document condition records before updating the status logs.
            </p>

            <div className="inspection-checklist-grid">
              <div className="inspection-checkbox-item">
                <input 
                  type="checkbox" 
                  required
                  id="chk-exterior" 
                  checked={inspectionChecks.exterior}
                  onChange={(e) => setInspectionChecks(prev => ({ ...prev, exterior: e.target.checked }))}
                />
                <label htmlFor="chk-exterior">
                  <strong>Exterior Panel Check:</strong> Free of new scratches, dents, chips, or bodywork damage.
                </label>
              </div>

              <div className="inspection-checkbox-item">
                <input 
                  type="checkbox" 
                  required
                  id="chk-interior" 
                  checked={inspectionChecks.interior}
                  onChange={(e) => setInspectionChecks(prev => ({ ...prev, interior: e.target.checked }))}
                />
                <label htmlFor="chk-interior">
                  <strong>Interior &amp; Cleanliness:</strong> Upholstery clean, high-touch controls sanitized, floor mats tidy.
                </label>
              </div>

              <div className="inspection-checkbox-item">
                <input 
                  type="checkbox" 
                  required
                  id="chk-fluids" 
                  checked={inspectionChecks.fluids}
                  onChange={(e) => setInspectionChecks(prev => ({ ...prev, fluids: e.target.checked }))}
                />
                <label htmlFor="chk-fluids">
                  <strong>Fluids &amp; Systems Check:</strong> Engine oil normal, washer fluid full, wiper blades operating, headlights running.
                </label>
              </div>

              <div className="inspection-checkbox-item">
                <input 
                  type="checkbox" 
                  required
                  id="chk-tires" 
                  checked={inspectionChecks.tires}
                  onChange={(e) => setInspectionChecks(prev => ({ ...prev, tires: e.target.checked }))}
                />
                <label htmlFor="chk-tires">
                  <strong>Tyres &amp; Pressures:</strong> Adequate tread depth across all wheels, tire pressures match specs, rims scratch-free.
                </label>
              </div>
            </div>

            <div className="form-row margin-top-small">
              <div className="form-group">
                <label className="form-label">Fuel Level (Tank / Battery)</label>
                <select 
                  className="form-select"
                  value={inspectionChecks.fuel}
                  onChange={(e) => setInspectionChecks(prev => ({ ...prev, fuel: e.target.value }))}
                >
                  <option value="Full">Full (100%)</option>
                  <option value="3/4">3/4 Tank (75%)</option>
                  <option value="1/2">1/2 Tank (50%)</option>
                  <option value="1/4">1/4 Tank (25%)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Inspector Signature (Type Name)</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Staff Representative"
                  className="form-input signature-input-font"
                  value={inspectorSig}
                  onChange={(e) => setInspectorSig(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group margin-top-small">
              <label className="form-label">Inspection Notes (Optional)</label>
              <textarea 
                rows="2" 
                placeholder="Note any cosmetic chips or fluid top-off notes..."
                className="form-input"
                value={inspectionChecks.notes}
                onChange={(e) => setInspectionChecks(prev => ({ ...prev, notes: e.target.value }))}
              ></textarea>
            </div>

            <div className="actions-button-group margin-top-small">
              <button 
                type="button" 
                onClick={() => setActiveInspectionBooking(null)} 
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Complete Handover &amp; Sync Status
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
