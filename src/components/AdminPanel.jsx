import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, Car, Calendar, TrendingUp, Plus, Trash2, ShieldAlert, Check, X, FileText } from 'lucide-react';
import { FLEET_DATA } from './FleetGrid';
import { db, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from '../firebase';
import { sendSMS } from '../services/smsService';

export default function AdminPanel({ fleet, setFleet, bookings = [], pricingSettings = {}, onClose }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  
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

  // Analytics Helper: Revenue Trend Chart (SVG Area)
  const renderRevenueTrendChart = () => {
    const today = new Date();
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      last7Days.push({
        label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        dateStr: dateString,
        revenue: 0
      });
    }

    // Populate data
    bookings.forEach(b => {
      if (b.status !== 'Cancelled' && b.createdAt) {
        const bDateStr = b.createdAt.split('T')[0];
        const match = last7Days.find(day => day.dateStr === bDateStr);
        if (match) {
          match.revenue += b.total;
        }
      }
    });

    const maxVal = Math.max(...last7Days.map(d => d.revenue), 500);
    const height = 120;
    const width = 450;
    const padding = 20;

    // Generate SVG points
    const points = last7Days.map((d, index) => {
      const x = padding + (index / (last7Days.length - 1)) * (width - padding * 2);
      const y = height - padding - (d.revenue / maxVal) * (height - padding * 2);
      return { x, y, val: d.revenue, label: d.label };
    });

    let pathD = '';
    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    }

    const areaD = pathD ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z` : '';

    return (
      <div className="svg-chart-container" style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="chart-area-glow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3acbe8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3acbe8" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#2a2a30" strokeWidth="1" />
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#2a2a30" strokeWidth="1" strokeDasharray="4 4" />

          {/* Area Path */}
          {areaD && <path d={areaD} fill="url(#chart-area-glow)" />}
          
          {/* Stroke Path */}
          {pathD && <path d={pathD} fill="none" stroke="#3acbe8" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 3px rgba(58,203,232,0.5))' }} />}

          {/* Dots */}
          {points.map((p, idx) => (
            <g key={idx} className="chart-dot-group">
              <circle 
                cx={p.x} 
                cy={p.y} 
                r="4" 
                fill="#000" 
                stroke="#3acbe8" 
                strokeWidth="2" 
                style={{ cursor: 'pointer' }}
              />
              <title>{p.label}: ${p.val.toLocaleString()} AUD</title>
            </g>
          ))}

          {/* Labels */}
          {points.map((p, idx) => {
            if (idx === 0 || idx === points.length - 1 || idx === Math.floor(points.length / 2)) {
              return (
                <text 
                  key={idx} 
                  x={p.x} 
                  y={height - 4} 
                  fill="#8c8c93" 
                  fontSize="9" 
                  textAnchor="middle"
                >
                  {p.label}
                </text>
              );
            }
            return null;
          })}
        </svg>
      </div>
    );
  };

  // Analytics Helper: Fleet Status Split Chart (Horizontal Stacked Bar)
  const renderFleetStatusSplitChart = () => {
    const total = fleet.length || 1;
    const maintenanceCount = fleet.filter(car => car.status === 'Maintenance').length;
    const activeRentalsCount = bookings.filter(b => b.status === 'Active').length;
    const availableCount = Math.max(0, fleet.length - activeRentalsCount - maintenanceCount);

    const activePct = (activeRentalsCount / total) * 100;
    const maintPct = (maintenanceCount / total) * 100;
    const availPct = (availableCount / total) * 100;

    return (
      <div className="status-split-widget" style={{ padding: '0.5rem 0' }}>
        <div style={{ display: 'flex', height: '24px', borderRadius: '4px', overflow: 'hidden', background: '#222', marginBottom: '1.25rem' }}>
          {activeRentalsCount > 0 && (
            <div 
              style={{ width: `${activePct}%`, background: '#4caf50', transition: 'width 0.3s ease' }} 
              title={`Active: ${activeRentalsCount} (${Math.round(activePct)}%)`}
            />
          )}
          {availableCount > 0 && (
            <div 
              style={{ width: `${availPct}%`, background: '#3acbe8', transition: 'width 0.3s ease' }} 
              title={`Available: ${availableCount} (${Math.round(availPct)}%)`}
            />
          )}
          {maintenanceCount > 0 && (
            <div 
              style={{ width: `${maintPct}%`, background: '#ff4d4d', transition: 'width 0.3s ease' }} 
              title={`Maintenance: ${maintenanceCount} (${Math.round(maintPct)}%)`}
            />
          )}
        </div>

        <div className="legend-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4caf50' }}></span>
            <span>Active: <strong>{activeRentalsCount}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3acbe8' }}></span>
            <span>Available: <strong>{availableCount}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff4d4d' }}></span>
            <span>Maintenance: <strong>{maintenanceCount}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#8c8c93' }}></span>
            <span>Total Fleet: <strong>{fleet.length}</strong></span>
          </div>
        </div>
      </div>
    );
  };

  // Analytics Helper: Car Revenue Performance (Horizontal Bars)
  const renderCarPerformanceChart = () => {
    const carRevMap = {};
    fleet.forEach(car => {
      carRevMap[car.name] = 0;
    });

    bookings.forEach(b => {
      if (b.status !== 'Cancelled' && carRevMap[b.carName] !== undefined) {
        carRevMap[b.carName] += b.total;
      }
    });

    const sortedCars = Object.keys(carRevMap).map(name => ({
      name,
      revenue: carRevMap[name]
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 4);

    const highestRev = Math.max(...sortedCars.map(c => c.revenue), 1);

    return (
      <div className="car-performance-widget" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sortedCars.map((car, idx) => {
          const percentage = (car.revenue / highestRev) * 100;
          return (
            <div key={idx} className="performance-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#fff', fontWeight: '500' }}>{car.name}</span>
                <span style={{ color: '#3acbe8', fontWeight: 'bold' }}>${car.revenue.toLocaleString()} AUD</span>
              </div>
              <div style={{ height: '8px', background: '#222', borderRadius: '4px', overflow: 'hidden' }}>
                <div 
                  style={{ 
                    height: '100%', 
                    width: `${percentage}%`, 
                    background: 'linear-gradient(90deg, #104f55 0%, #3acbe8 100%)',
                    borderRadius: '4px',
                    transition: 'width 0.5s ease-out'
                  }}
                />
              </div>
            </div>
          );
        })}
        {sortedCars.length === 0 && (
          <p className="text-muted text-center font-small py-4">No vehicle performance data logged.</p>
        )}
      </div>
    );
  };

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
            <button 
              className={`admin-nav-btn ${activeTab === 'pricing' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('pricing')}
            >
              <DollarSign size={16} /> Pricing Rules
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

              {/* Visual Analytics Charts Section */}
              <div className="dashboard-charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
                {/* Chart 1: Revenue Trend (SVG Area Chart) */}
                <div className="glass-panel chart-card" style={{ padding: '1.5rem', textAlign: 'left' }}>
                  <h3 className="widget-title" style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#fff', borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>7-Day Revenue Trend</h3>
                  {renderRevenueTrendChart()}
                </div>

                {/* Chart 2: Fleet Occupancy (Stacked Bar Gauge) */}
                <div className="glass-panel chart-card" style={{ padding: '1.5rem', textAlign: 'left' }}>
                  <h3 className="widget-title" style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#fff', borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>Fleet Status Split</h3>
                  {renderFleetStatusSplitChart()}
                </div>

                {/* Chart 3: Car Performance (Horizontal Bar Chart) */}
                <div className="glass-panel chart-card" style={{ padding: '1.5rem', textAlign: 'left' }}>
                  <h3 className="widget-title" style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#fff', borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>Vehicle Revenue Performance</h3>
                  {renderCarPerformanceChart()}
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

          {/* TAB 4: PRICING RULES CONFIGURATION */}
          {activeTab === 'pricing' && (
            <div className="admin-tab-content animate-slide-up text-left">
              <h2 className="admin-content-title">Dynamic Pricing Configuration</h2>
              
              <div className="glass-panel pricing-config-card" style={{ padding: '2rem', maxWidth: '650px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <p className="font-small text-muted" style={{ margin: 0 }}>
                  Manage the rules and parameters for automatic demand pricing calculations. Changes save to Firestore and update checkout ledgers instantly.
                </p>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem', marginBottom: '1rem' }}>
                  <input 
                    type="checkbox" 
                    id="dynamic-pricing-toggle" 
                    checked={pricingSettings.dynamicPricingEnabled !== false}
                    onChange={async (e) => {
                      try {
                        await updateDoc(doc(db, "settings", "pricing"), {
                          dynamicPricingEnabled: e.target.checked
                        });
                      } catch (err) {
                        console.error("Error saving dynamic pricing state:", err);
                      }
                    }}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <label htmlFor="dynamic-pricing-toggle" style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fff', cursor: 'pointer', margin: 0 }}>
                    Enable Dynamic Pricing Engine
                  </label>
                </div>

                <div className="pricing-sliders-stack" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', opacity: pricingSettings.dynamicPricingEnabled !== false ? 1 : 0.4, pointerEvents: pricingSettings.dynamicPricingEnabled !== false ? 'auto' : 'none', transition: 'all 0.3s ease' }}>
                  
                  {/* Slider 1: Weekend Surge multiplier */}
                  <div className="config-slider-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label className="form-label font-bold" style={{ margin: 0 }}>Weekend Surcharge Multiplier</label>
                      <strong className="text-cyan">{Math.round(((pricingSettings.weekendMultiplier || 1.15) - 1) * 100)}% Surge</strong>
                    </div>
                    <input 
                      type="range" 
                      min="1.00" 
                      max="1.50" 
                      step="0.05"
                      value={pricingSettings.weekendMultiplier || 1.15} 
                      onChange={async (e) => {
                        try {
                          await updateDoc(doc(db, "settings", "pricing"), {
                            weekendMultiplier: parseFloat(e.target.value)
                          });
                        } catch (err) {
                          console.error("Error saving weekend surge:", err);
                        }
                      }}
                      className="form-slider w-full"
                      style={{ cursor: 'pointer' }}
                    />
                    <p className="font-tiny text-muted" style={{ margin: 0 }}>Applied to daily base rates for Saturday and Sunday booking dates.</p>
                  </div>

                  {/* Slider 2: Utilization Surcharge threshold 1 */}
                  <div className="config-slider-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label className="form-label font-bold" style={{ margin: 0 }}>High Demand Surcharge (Tier 1)</label>
                      <strong className="text-cyan">+{Math.round((pricingSettings.utilizationSurcharge1 || 0.10) * 100)}% Fee</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span className="font-tiny text-muted" style={{ minWidth: '105px' }}>Active Occupancy ≥</span>
                      <input 
                        type="range" 
                        min="0.30" 
                        max="0.65" 
                        step="0.05"
                        value={pricingSettings.utilizationThreshold1 || 0.50} 
                        onChange={async (e) => {
                          try {
                            await updateDoc(doc(db, "settings", "pricing"), {
                              utilizationThreshold1: parseFloat(e.target.value)
                            });
                          } catch (err) {
                            console.error("Error saving tier 1 threshold:", err);
                          }
                        }}
                        className="form-slider"
                        style={{ flex: 1, cursor: 'pointer' }}
                      />
                      <strong style={{ minWidth: '45px', textAlign: 'right' }}>{Math.round((pricingSettings.utilizationThreshold1 || 0.50) * 100)}%</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span className="font-tiny text-muted" style={{ minWidth: '105px' }}>Surcharge Rate:</span>
                      <input 
                        type="range" 
                        min="0.05" 
                        max="0.20" 
                        step="0.01"
                        value={pricingSettings.utilizationSurcharge1 || 0.10} 
                        onChange={async (e) => {
                          try {
                            await updateDoc(doc(db, "settings", "pricing"), {
                              utilizationSurcharge1: parseFloat(e.target.value)
                            });
                          } catch (err) {
                            console.error("Error saving tier 1 surcharge:", err);
                          }
                        }}
                        className="form-slider"
                        style={{ flex: 1, cursor: 'pointer' }}
                      />
                      <strong style={{ minWidth: '45px', textAlign: 'right' }}>+{Math.round((pricingSettings.utilizationSurcharge1 || 0.10) * 100)}%</strong>
                    </div>
                    <p className="font-tiny text-muted" style={{ margin: 0 }}>Triggers when total active rentals reach this threshold percentage of the active fleet.</p>
                  </div>

                  {/* Slider 3: Utilization Surcharge threshold 2 */}
                  <div className="config-slider-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <label className="form-label font-bold" style={{ margin: 0 }}>Peak Demand Surcharge (Tier 2)</label>
                      <strong className="text-cyan">+{Math.round((pricingSettings.utilizationSurcharge2 || 0.25) * 100)}% Fee</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span className="font-tiny text-muted" style={{ minWidth: '105px' }}>Active Occupancy ≥</span>
                      <input 
                        type="range" 
                        min="0.70" 
                        max="0.95" 
                        step="0.05"
                        value={pricingSettings.utilizationThreshold2 || 0.75} 
                        onChange={async (e) => {
                          try {
                            await updateDoc(doc(db, "settings", "pricing"), {
                              utilizationThreshold2: parseFloat(e.target.value)
                            });
                          } catch (err) {
                            console.error("Error saving tier 2 threshold:", err);
                          }
                        }}
                        className="form-slider"
                        style={{ flex: 1, cursor: 'pointer' }}
                      />
                      <strong style={{ minWidth: '45px', textAlign: 'right' }}>{Math.round((pricingSettings.utilizationThreshold2 || 0.75) * 100)}%</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span className="font-tiny text-muted" style={{ minWidth: '105px' }}>Surcharge Rate:</span>
                      <input 
                        type="range" 
                        min="0.20" 
                        max="0.50" 
                        step="0.05"
                        value={pricingSettings.utilizationSurcharge2 || 0.25} 
                        onChange={async (e) => {
                          try {
                            await updateDoc(doc(db, "settings", "pricing"), {
                              utilizationSurcharge2: parseFloat(e.target.value)
                            });
                          } catch (err) {
                            console.error("Error saving tier 2 surcharge:", err);
                          }
                        }}
                        className="form-slider"
                        style={{ flex: 1, cursor: 'pointer' }}
                      />
                      <strong style={{ minWidth: '45px', textAlign: 'right' }}>+{Math.round((pricingSettings.utilizationSurcharge2 || 0.25) * 100)}%</strong>
                    </div>
                    <p className="font-tiny text-muted" style={{ margin: 0 }}>Triggers when total active rentals reach this maximum peak threshold percentage of the active fleet.</p>
                  </div>

                </div>

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
