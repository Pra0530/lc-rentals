import React, { useState, useEffect, useRef } from 'react';
import { 
  DollarSign, Car, Calendar, TrendingUp, Plus, Trash2, 
  ShieldAlert, Check, X, FileText, Search, Play, Square, 
  Volume2, Shield, AlertTriangle, Send, RefreshCw, Database, Download 
} from 'lucide-react';
import { db, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from '../firebase';
import { sendSMS } from '../services/smsService';
import { syncToGoogleSheets } from '../utils/googleSheetsSync';

// Sydney routes for telemetry simulation (static constants at top level)
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

export default function AdminPanel({ fleet, setFleet, bookings = [], inquiries = [], pricingSettings = {}, onClose }) {
  const [activeTab, setActiveTab] = useState('operations');
  const [bookingsSubTab, setBookingsSubTab] = useState('stripe'); // 'stripe' or 'leads'
  
  // Real-time Fleet Telemetry & IoT Simulation States
  const [fleetTelemetry, setFleetTelemetry] = useState({});
  const [selectedCarId, setSelectedCarId] = useState(null); // Reference number (bookings) or carId (available/maintenance)
  
  // HUD UI controls
  const [sidebarFilter, setSidebarFilter] = useState('all'); // all, active, pending, confirmed, available, maintenance
  const [searchQuery, setSearchQuery] = useState('');
  const [warningMsg, setWarningMsg] = useState('');
  const [hornFlash, setHornFlash] = useState(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [expandedBookingRefs, setExpandedBookingRefs] = useState({});

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

  // Synthesize Key Fob Sound Effects Natively (Web Audio API)
  const playAudioTone = (type) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      if (type === 'honk') {
        const playHonk = (time) => {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          osc1.type = 'sawtooth';
          osc1.frequency.setValueAtTime(425, time); // Dual frequency V8 sound horn
          osc2.type = 'sawtooth';
          osc2.frequency.setValueAtTime(475, time);
          
          gainNode.gain.setValueAtTime(0, time);
          gainNode.gain.linearRampToValueAtTime(0.2, time + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.25);
          
          osc1.connect(gainNode);
          osc2.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          osc1.start(time);
          osc2.start(time);
          osc1.stop(time + 0.25);
          osc2.stop(time + 0.25);
        };
        playHonk(ctx.currentTime);
        playHonk(ctx.currentTime + 0.35); // Double beep horn
      } else if (type === 'lock') {
        // High-pitched lock double beep
        const playChirp = (time) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1850, time);
          osc.frequency.exponentialRampToValueAtTime(2200, time + 0.04);
          
          gainNode.gain.setValueAtTime(0, time);
          gainNode.gain.linearRampToValueAtTime(0.12, time + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
          
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start(time);
          osc.stop(time + 0.04);
        };
        playChirp(ctx.currentTime);
        playChirp(ctx.currentTime + 0.08);
      } else if (type === 'unlock') {
        // Single lower pitch click chirp
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(980, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.07);
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.07);
      }
    } catch (err) {
      console.warn("Web Audio API blocked by browser permissions:", err);
    }
  };

  // Sync Telemetry State for ALL fleet cars (Active, Confirmed, Pending, Available, Maintenance)
  useEffect(() => {
    // Circle offset calculations for Airport Hub
    const getParkedOffset = (idx) => {
      const angle = (idx * 40) * Math.PI / 180;
      const radius = 0.0008; // 60-70 meters spread
      return [radius * Math.sin(angle), radius * Math.cos(angle)];
    };

    const baseHubCoord = [-33.9461, 151.1772];
    const maintenanceBayCoord = [-33.9481, 151.1752];

    setFleetTelemetry(prev => {
      const nextTelemetry = { ...prev };
      let updated = false;

      fleet.forEach((car, index) => {
        // Check for active or pending/confirmed bookings for this car
        const activeBooking = bookings.find(b => b.carId === car.id && b.status === 'Active');
        const pendingOrConfirmedBooking = bookings.find(b => b.carId === car.id && (b.status === 'Pending' || b.status === 'Confirmed'));
        
        // Also check if there's a pending lead inquiry for this car
        const pendingLeadInquiry = inquiries.find(inq => inq.carId === car.id && inq.status === 'Pending');
        
        let telemetryKey = car.id; // Default telemetry identifier is the car ID
        let status = "Available";
        let coord = [...baseHubCoord];
        let routePath = [];
        let routeIndex = 0;
        let streetName = "HQ Logistics Handover Plaza";
        let isEv = car.category === "EV" || car.name.toLowerCase().includes("tesla");

        // Parked Available default coordinates
        const offset = getParkedOffset(index);
        coord[0] += offset[0];
        coord[1] += offset[1];

        if (car.status === 'Maintenance') {
          status = "Maintenance";
          coord = [maintenanceBayCoord[0] + offset[0], maintenanceBayCoord[1] + offset[1]];
          streetName = "HQ Maintenance Suite Room 3";
        } else if (activeBooking) {
          telemetryKey = activeBooking.referenceNumber; // Sync tracking by reference code
          status = "Active";
          
          const existing = prev[telemetryKey];
          if (existing && existing.path && existing.path.length > 0) {
            routePath = existing.path;
            routeIndex = existing.currentIndex;
            coord = existing.currentCoord;
            streetName = existing.streetName;
          } else {
            const routeIdx = index % routesList.length;
            const rawRoute = routesList[routeIdx];
            // Simple helper for routing paths
            const rawRouteInterpolate = (route, steps = 150) => {
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
            const pingPongRoute = makePingPongRoute(rawRoute);
            routePath = rawRouteInterpolate(pingPongRoute, 180);
            routeIndex = Math.floor(Math.random() * routePath.length);
            coord = routePath[routeIndex];
            streetName = streetsList[routeIdx];
          }
        } else if (pendingOrConfirmedBooking) {
          telemetryKey = pendingOrConfirmedBooking.referenceNumber;
          status = pendingOrConfirmedBooking.status;
          streetName = "Airport HQ Handover Plaza";
        } else if (pendingLeadInquiry) {
          telemetryKey = pendingLeadInquiry.docId; // Use docId as key
          status = "Pending Inquiry";
          streetName = "Airport HQ (Booking Request)";
        }

        const prevEntry = prev[telemetryKey] || {};
        
        // Purely resolve lock/engine/hazards directly within state updater (no side-effects)
        const locked = prevEntry.locked !== undefined ? prevEntry.locked : (status !== 'Active');
        const engineOn = prevEntry.engineOn !== undefined ? prevEntry.engineOn : (status === 'Active');
        const hazardsOn = prevEntry.hazardsOn !== undefined ? prevEntry.hazardsOn : false;

        const speed = (status === 'Active' && engineOn)
          ? (prevEntry.speed || (55 + Math.random() * 25))
          : 0;
        const fuel = prevEntry.fuel !== undefined ? prevEntry.fuel : (80 + Math.random() * 20);
        const tirePressure = prevEntry.tirePressure || [34.2, 34.0, 34.5, 34.1].map(p => p + (Math.random() * 1.5 - 0.75));

        nextTelemetry[telemetryKey] = {
          carId: car.id,
          carName: car.name,
          carImage: car.image,
          carCategory: car.category,
          dailyRate: car.price,
          status: status,
          coord: coord,
          path: routePath,
          currentIndex: routeIndex,
          currentCoord: coord,
          speed: speed,
          fuel: fuel,
          tirePressure: tirePressure,
          streetName: streetName,
          isEv: isEv,
          booking: activeBooking || pendingOrConfirmedBooking || pendingLeadInquiry || null,
          index: index,
          locked: locked,
          engineOn: engineOn,
          hazardsOn: hazardsOn
        };
        
        updated = true;
      });

      // Cleanup removed fleet vehicles
      Object.keys(nextTelemetry).forEach(key => {
        const carId = nextTelemetry[key].carId;
        if (!fleet.some(c => c.id === carId)) {
          delete nextTelemetry[key];
          updated = true;
        }
      });

      return updated ? nextTelemetry : prev;
    });

  }, [fleet, bookings, inquiries]);

  // Periodic Telemetry Simulator timer (moves active coordinates, depletes fuel)
  useEffect(() => {
    if (activeTab !== 'operations') return;

    const intervalId = setInterval(() => {
      setFleetTelemetry(prev => {
        const nextTelemetry = {};
        let changed = false;

        Object.keys(prev).forEach(key => {
          const car = prev[key];
          
          if (car.status === 'Active' && car.engineOn === true) {
            const nextIndex = (car.currentIndex + 1) % car.path.length;
            const nextCoord = car.path[nextIndex];
            
            const speedVar = Math.random() * 8 - 4;
            let nextSpeed = Math.max(15, Math.min(105, car.speed + speedVar));
            if (car.streetName.includes("Scenic")) {
              nextSpeed = Math.max(10, Math.min(45, nextSpeed));
            }

            const nextFuel = Math.max(3, car.fuel - 0.02); // slowly deplete battery/fuel

            const nextTire = car.tirePressure.map(p => {
              const pressureVar = Math.random() * 0.08 - 0.04;
              return Math.max(28, Math.min(40, p + pressureVar));
            });

            nextTelemetry[key] = {
              ...car,
              currentIndex: nextIndex,
              currentCoord: nextCoord,
              coord: nextCoord,
              speed: nextSpeed,
              fuel: nextFuel,
              tirePressure: nextTire
            };
            changed = true;
          } else {
            nextTelemetry[key] = car;
          }
        });

        return changed ? nextTelemetry : prev;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [activeTab]);

  // Initialize Leaflet Map
  useEffect(() => {
    const L = window.L;
    if (!L || activeTab !== 'operations') return;

    const mapContainer = document.getElementById("gps-tracker-map");
    if (!mapContainer) return;

    if (mapContainer._leaflet_id) {
      mapContainer._leaflet_id = null;
      mapContainer.innerHTML = '';
    }

    const map = L.map("gps-tracker-map", {
      center: [-33.8950, 151.1900], // Sydney CBD / Airport overview
      zoom: 12,
      scrollWheelZoom: true
    });
    mapRef.current = map;

    // OpenStreetMap default layers
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(map);

    // Sydney Airport HQ Hub marker
    const hubMarker = L.circleMarker([-33.9461, 151.1772], {
      color: '#3acbe8',
      fillColor: '#3acbe8',
      fillOpacity: 0.8,
      radius: 9
    }).addTo(map);
    hubMarker.bindPopup(`
      <div style="font-family: inherit; color: #fff; text-align: left; padding: 4px;">
        <strong style="color: #3acbe8; font-size: 0.95rem;">LC Handover HQ</strong><br/>
        Sydney Airport Terminal Gateway<br/>
        <span style="font-size: 0.75rem; color: #aaa;">Logistic Handover Suites & Maintenance Bays</span>
      </div>
    `);

    markersRef.current = {};

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, [activeTab]);

  // Marker Sync & Updates
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map) return;

    // 1. Remove deleted markers
    Object.keys(markersRef.current).forEach(ref => {
      if (!fleetTelemetry[ref]) {
        markersRef.current[ref].remove();
        delete markersRef.current[ref];
      }
    });

    // 2. Synchronize active locations & HTML SVG indicators
    Object.keys(fleetTelemetry).forEach(ref => {
      const car = fleetTelemetry[ref];
      const coord = car.coord;
      
      let carIconHtml = "";
      if (car.status === "Active") {
        const prevIndex = (car.currentIndex - 1 + car.path.length) % car.path.length;
        const prevCoord = car.path[prevIndex];
        const getAngle = (p1, p2) => {
          if (!p1 || !p2) return 0;
          const dy = p2[0] - p1[0];
          const dx = p2[1] - p1[1];
          return Math.atan2(dx, dy) * 180 / Math.PI;
        };
        const angle = getAngle(prevCoord, coord);

        const isHornFlashing = hornFlash === ref;
        const isHazardsOn = car.hazardsOn === true;
        const isEngineKilled = car.engineOn === false;

        let glowColor = isHornFlashing ? "#ffeb3b" : (isHazardsOn ? "#ff9800" : (isEngineKilled ? "#f44336" : "#3acbe8"));
        let carColor = isEngineKilled ? "#555" : "#3acbe8";

        carIconHtml = `
          <div class="gps-car-wrapper" style="transform: rotate(${angle}deg); transform-origin: center; display: flex; justify-content: center; align-items: center; width: 28px; height: 28px; filter: drop-shadow(0 0 6px ${glowColor}); ${isHazardsOn ? 'animation: blink-hazard 0.5s infinite;' : ''}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 20C7 20.6 7.4 21 8 21H16C16.6 21 17 20.6 17 20V4C17 3.4 16.6 3 16 3H8C7.4 3 7 3.4 7 4V20Z" fill="${carColor}" stroke="#000" stroke-width="1.5"/>
              <path d="M9 8h6M9 15h6" stroke="#000" stroke-width="1.5"/>
              <rect x="5" y="5" width="2" height="4" rx="0.5" fill="#000"/>
              <rect x="17" y="5" width="2" height="4" rx="0.5" fill="#000"/>
              <rect x="5" y="15" width="2" height="4" rx="0.5" fill="#000"/>
              <rect x="17" y="15" width="2" height="4" rx="0.5" fill="#000"/>
            </svg>
          </div>
        `;
      } else if (car.status === "Maintenance") {
        carIconHtml = `
          <div class="maintenance-car-wrapper" style="display: flex; justify-content: center; align-items: center; width: 24px; height: 24px; filter: drop-shadow(0 0 4px #ff9800);">
            <div style="background: rgba(255, 152, 0, 0.25); border: 1px solid #ff9800; border-radius: 50%; padding: 4px; display: flex; justify-content: center; align-items: center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff9800" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
            </div>
          </div>
        `;
      } else {
        // Available / Confirmed / Pending / Pending Inquiry
        let dotColorClass = "bg-blue";
        let glowColor = "rgba(33,150,243,0.3)";
        if (car.status === "Pending" || car.status === "Pending Inquiry") {
          dotColorClass = "bg-yellow";
          glowColor = "rgba(255,193,7,0.3)";
        } else if (car.status === "Confirmed") {
          dotColorClass = "bg-green";
          glowColor = "rgba(76,175,80,0.3)";
        } else if (car.status === "Available") {
          dotColorClass = "bg-cyan";
          glowColor = "rgba(58,203,232,0.3)";
        }

        carIconHtml = `
          <div class="parked-car-wrapper" style="display: flex; justify-content: center; align-items: center; width: 22px; height: 22px;">
            <div class="parked-pulse-ring" style="box-shadow: 0 0 0 4px ${glowColor}; animation: pulse-parked 2.2s infinite;"></div>
            <div class="parked-dot ${dotColorClass}"></div>
          </div>
        `;
      }

      const customIcon = L.divIcon({
        html: carIconHtml,
        className: 'custom-gps-icon',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      if (!markersRef.current[ref]) {
        const marker = L.marker(coord, { icon: customIcon }).addTo(map);
        marker.on('click', () => {
          setSelectedCarId(ref);
        });
        marker.bindPopup(() => {
          return `
            <div style="font-family: inherit; color: #fff; text-align: left; padding: 4px; min-width: 175px;">
              <strong style="color: #3acbe8; font-size: 0.95rem;">${car.carName}</strong><br/>
              Status: <span style="font-weight: 700; text-transform: uppercase; color:${car.status === 'Active' ? '#4caf50' : (car.status === 'Maintenance' ? '#ff9800' : '#2196f3')}">${car.status}</span><br/>
              ${car.status === 'Active' ? `Renter: ${car.booking?.renterName || 'Renter'}<br/>Speed: ${Math.round(car.speed)} km/h` : ''}
              ${car.status === 'Maintenance' ? `Service Check Scheduled` : `Location: Terminal Garage`}
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

  }, [fleetTelemetry, hornFlash]);

  // Sync selected map marker position
  const panToCarOnMap = (refKey) => {
    const carData = fleetTelemetry[refKey];
    if (carData && mapRef.current) {
      mapRef.current.setView(carData.coord, 14, { animate: true });
      if (markersRef.current[refKey]) {
        markersRef.current[refKey].openPopup();
      }
    }
  };

  // Handler to update status in Firestore
  const handleUpdateBookingStatus = async (refNum, newStatus, inspectionData = null) => {
    const targetBooking = bookings.find(b => b.referenceNumber === refNum);
    if (!targetBooking) return;
    
    try {
      const bookingDocRef = doc(db, "bookings", targetBooking.docId);
      const updatePayload = { status: newStatus };
      if (inspectionData) {
        updatePayload[`inspection.${inspectionType}`] = inspectionData;
      }
      await updateDoc(bookingDocRef, updatePayload);

      // Sync inspection details with Google Sheets Webhook
      if (inspectionData && pricingSettings?.googleSheetsWebhookUrl) {
        syncToGoogleSheets(pricingSettings.googleSheetsWebhookUrl, inspectionType, {
          booking: targetBooking,
          inspection: inspectionData
        });
      }

      // Trigger SMS notifications
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

  // Inline Actions for Inquiries
  const handleUpdateInquiryStatus = async (inqId, nextStatus) => {
    try {
      await updateDoc(doc(db, "inquiries", inqId), { status: nextStatus });
    } catch (err) {
      console.error("Error updating inquiry status:", err);
    }
  };

  const handleDeleteInquiry = async (inqId) => {
    if (confirm("Are you sure you want to permanently delete this lead inquiry?")) {
      try {
        await deleteDoc(doc(db, "inquiries", inqId));
        if (selectedCarId === inqId) {
          setSelectedCarId(null);
        }
      } catch (err) {
        console.error("Error deleting inquiry:", err);
      }
    }
  };

  // Convert Lead Inquiry into a Confirmed Stripe Booking in Firestore
  const handleConvertLeadToBooking = async (lead) => {
    try {
      const referenceNumber = 'LC-' + Math.floor(100000 + Math.random() * 900000);
      const chosenCar = fleet.find(c => c.name === lead.carName || c.id === lead.carId) || { price: 300, category: 'Supercar', id: 'porsche-911', name: lead.carName };
      
      const days = Number(lead.days || 1);
      const basePrice = chosenCar.price * days;
      const gst = basePrice * 0.1;
      const total = basePrice + gst;

      const bookingDetails = {
        referenceNumber,
        carId: chosenCar.id,
        carName: chosenCar.name,
        carCategory: chosenCar.category || 'Supercar',
        days,
        startDate: lead.startDate,
        endDate: lead.endDate,
        basePrice,
        insurancePrice: 0,
        gst,
        total,
        depositHold: chosenCar.category === 'Supercar' ? 750 : 500,
        renterName: lead.name,
        signature: lead.name + ' (Auth Lead)',
        userId: lead.userId || 'anonymous-lead',
        userEmail: lead.email,
        phone: lead.phone || '+61400123456',
        status: 'Confirmed', // Direct confirmed status
        cardBrand: 'Visa',
        cardLast4: '4242',
        createdAt: new Date().toISOString()
      };

      // 1. Write the new booking directly to Firebase bookings collection
      await setDoc(doc(db, "bookings", referenceNumber), bookingDetails);

      // 2. Mark the inquiry in Firestore as Converted/Approved
      await updateDoc(doc(db, "inquiries", lead.docId), { status: 'Approved' });

      // 3. Dispatch Google Sheets Webhook Sync if active
      if (pricingSettings?.googleSheetsWebhookUrl) {
        syncToGoogleSheets(pricingSettings.googleSheetsWebhookUrl, 'booking', bookingDetails);
      }

      // 4. Send Confirmation text message
      const smsBody = `LC Concierge: Welcome! Your Lead Inquiry request for ${chosenCar.name} has been approved and converted to booking Ref: ${referenceNumber}. Handover instructions dispatched!`;
      await sendSMS(lead.phone || '+61400123456', smsBody);

      alert(`Lead inquiry for ${lead.name} successfully converted to Confirmed Booking: ${referenceNumber}`);
      
      // Select the new booking code to track it
      setSelectedCarId(referenceNumber);
      panToCarOnMap(referenceNumber);
    } catch (err) {
      console.error("Failed to convert lead to booking:", err);
      alert("Conversion Error: " + err.message);
    }
  };

  // Bulk Sync all bookings and inquiries to the Google Sheets Webhook URL
  const handleBulkSyncToSheets = async () => {
    if (!pricingSettings?.googleSheetsWebhookUrl) {
      alert("Please configure a Google Sheets Webhook URL in the settings tab first.");
      return;
    }

    setIsBulkSyncing(true);
    let successCount = 0;

    try {
      // Sync Bookings
      for (const booking of bookings) {
        const synced = await syncToGoogleSheets(pricingSettings.googleSheetsWebhookUrl, 'booking', booking);
        if (synced) successCount++;
      }

      // Sync Inquiries
      for (const inquiry of inquiries) {
        const synced = await syncToGoogleSheets(pricingSettings.googleSheetsWebhookUrl, 'inquiry', inquiry);
        if (synced) successCount++;
      }

      alert(`Bulk database sync complete! Sent ${successCount} entries to Google Sheets.`);
    } catch (err) {
      console.error("Bulk sync error:", err);
      alert("Bulk sync failed: " + err.message);
    } finally {
      setIsBulkSyncing(false);
    }
  };

  // Generate and download a formatted CSV file of all logs for drag-and-drop Google Sheets imports
  const handleDownloadCSV = () => {
    try {
      const headers = ["Sync Type", "Created Date", "Ref Code", "Customer Name", "Email", "Phone", "Car Model", "Days", "Start Date", "End Date", "Total Cost (AUD)", "Status", "Message"];
      const rows = [];

      bookings.forEach(b => {
        rows.push([
          "Stripe Booking",
          b.createdAt || '',
          b.referenceNumber || '',
          b.renterName || '',
          b.userEmail || '',
          b.phone || '',
          b.carName || '',
          b.days || 1,
          b.startDate || '',
          b.endDate || '',
          b.total || 0,
          b.status || 'Pending',
          ''
        ]);
      });

      inquiries.forEach(inq => {
        rows.push([
          "Lead Inquiry",
          inq.createdAt || '',
          inq.docId || '',
          inq.name || '',
          inq.email || '',
          inq.phone || '',
          inq.carName || '',
          inq.days || 1,
          inq.startDate || '',
          inq.endDate || '',
          inq.totalEstimate || 0,
          inq.status || 'Pending',
          inq.message || ''
        ]);
      });

      // Combine csv structure
      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `lc_rentals_database_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("CSV compilation failed: " + err.message);
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
      status: 'Active'
    };

    const carDocId = newCar.name.toLowerCase().replace(/\s+/g, '-');
    try {
      await setDoc(doc(db, "fleet", carDocId), formattedCar);
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

  // Seeding Active simulation rentals
  const handleSeedDemoRentals = async () => {
    try {
      const demoBookings = [
        {
          referenceNumber: 'LC-DEMO911',
          carId: 'porsche-911',
          carName: 'Porsche 911 GT3',
          carCategory: 'Supercar',
          days: 5,
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 5*24*60*60*1000).toISOString().split('T')[0],
          basePrice: 4450,
          insurancePrice: 250,
          gst: 470,
          total: 5170,
          depositHold: 750,
          renterName: 'Harrison Ford',
          signature: 'Harrison Ford',
          userId: 'demo-user-123',
          userEmail: 'harrison.ford@starwars.com',
          status: 'Active',
          cardBrand: 'Amex',
          cardLast4: '1007',
          createdAt: new Date().toISOString()
        },
        {
          referenceNumber: 'LC-DEMO720',
          carId: 'mclaren-720s',
          carName: 'McLaren 720S',
          carCategory: 'Supercar',
          days: 3,
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 3*24*60*60*1000).toISOString().split('T')[0],
          basePrice: 4470,
          insurancePrice: 150,
          gst: 462,
          total: 5082,
          depositHold: 750,
          renterName: 'Tony Stark',
          signature: 'Tony Stark',
          userId: 'demo-user-456',
          userEmail: 'tony@starkindustries.com',
          status: 'Active',
          cardBrand: 'Visa',
          cardLast4: '4242',
          createdAt: new Date().toISOString()
        },
        {
          referenceNumber: 'LC-DEMOTSLA',
          carId: 'tesla-s',
          carName: 'Tesla Model S Plaid',
          carCategory: 'EV',
          days: 4,
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 4*24*60*60*1000).toISOString().split('T')[0],
          basePrice: 2040,
          insurancePrice: 200,
          gst: 224,
          total: 2464,
          depositHold: 500,
          renterName: 'Elon Musk',
          signature: 'Elon Musk',
          userId: 'demo-user-789',
          userEmail: 'elon@spacex.com',
          status: 'Active',
          cardBrand: 'Mastercard',
          cardLast4: '8888',
          createdAt: new Date().toISOString()
        }
      ];

      for (const booking of demoBookings) {
        await setDoc(doc(db, "bookings", booking.referenceNumber), booking);
      }
      alert("Simulated active rentals successfully seeded in Firestore! Telemetry tracking is now live.");
    } catch (err) {
      console.error("Failed to seed demo rentals:", err);
      alert("Error seeding simulation: " + err.message);
    }
  };

  // Open Inspection modal
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

  // Remote key fob triggers
  const handleFobLockToggle = (refKey) => {
    setFleetTelemetry(prev => {
      const carData = prev[refKey];
      if (!carData) return prev;
      const nextLocked = !carData.locked;
      
      playAudioTone(nextLocked ? 'lock' : 'unlock');

      if (carData.booking) {
        const renterPhone = carData.booking.phone || carData.booking.renterPhone || '+61400123456';
        const actionText = nextLocked ? "LOCKED 🔒" : "UNLOCKED 🔓";
        sendSMS(renterPhone, `LC Security Alert: Your rented ${carData.carName} has been ${actionText} remotely by the fleet operator concierge.`);
      }

      return {
        ...prev,
        [refKey]: { ...carData, locked: nextLocked }
      };
    });
  };

  const handleFobEngineToggle = (refKey) => {
    setFleetTelemetry(prev => {
      const carData = prev[refKey];
      if (!carData) return prev;
      const nextEngine = !carData.engineOn;
      
      playAudioTone('unlock'); // audio feedback beep

      if (carData.booking) {
        const renterPhone = carData.booking.phone || carData.booking.renterPhone || '+61400123456';
        const actionText = nextEngine ? "IGNITION STARTED 🔑" : "ENGINE SHUT DOWN (REMOTE KILL) 🛑";
        sendSMS(renterPhone, `LC Security Notice: The ignition engine for your rented ${carData.carName} has been ${actionText} remotely.`);
      }

      return {
        ...prev,
        [refKey]: { ...carData, engineOn: nextEngine, speed: nextEngine ? 50 : 0 }
      };
    });
  };

  const handleFobHazardsToggle = (refKey) => {
    setFleetTelemetry(prev => {
      const carData = prev[refKey];
      if (!carData) return prev;
      return {
        ...prev,
        [refKey]: { ...carData, hazardsOn: !carData.hazardsOn }
      };
    });
  };

  const handleFobHonk = (refKey) => {
    setHornFlash(refKey);
    playAudioTone('honk');
    setTimeout(() => {
      setHornFlash(null);
    }, 2000);
  };

  const handleSendCustomSMS = async (e, refKey) => {
    e.preventDefault();
    if (!warningMsg.trim()) return;

    const carData = fleetTelemetry[refKey];
    if (carData && carData.booking) {
      const renterPhone = carData.booking.phone || carData.booking.renterPhone || '+61400123456';
      await sendSMS(renterPhone, `LC Renter Alert: ${warningMsg.trim()}`);
      setWarningMsg('');
      alert("Concierge alert message sent successfully to " + carData.booking.renterName);
    }
  };

  // Search and filter sidebar data
  const filteredTelemetryKeys = Object.keys(fleetTelemetry).filter(key => {
    const entry = fleetTelemetry[key];
    
    // Status Filter match
    if (sidebarFilter === 'active' && entry.status !== 'Active') return false;
    if (sidebarFilter === 'pending' && entry.status !== 'Pending' && entry.status !== 'Pending Inquiry') return false;
    if (sidebarFilter === 'confirmed' && entry.status !== 'Confirmed') return false;
    if (sidebarFilter === 'available' && entry.status !== 'Available') return false;
    if (sidebarFilter === 'maintenance' && entry.status !== 'Maintenance') return false;

    // Search Query match (car name, renter name, booking ref)
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const matchCar = entry.carName.toLowerCase().includes(query);
      const matchRenter = entry.booking?.renterName?.toLowerCase().includes(query) || entry.booking?.userName?.toLowerCase().includes(query) || entry.booking?.name?.toLowerCase().includes(query);
      const matchRef = key.toLowerCase().includes(query);
      return matchCar || matchRenter || matchRef;
    }

    return true;
  });

  // Selected telemetry details helper
  const selectedTelemetryData = selectedCarId ? fleetTelemetry[selectedCarId] : null;

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
              className={`admin-nav-btn ${activeTab === 'operations' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('operations')}
            >
              <RefreshCw size={16} className="text-cyan" /> Live Operations
            </button>
            <button 
              className={`admin-nav-btn ${activeTab === 'bookings' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('bookings')}
            >
              <Calendar size={16} /> Bookings ({bookings.length + inquiries.length})
            </button>
            <button 
              className={`admin-nav-btn ${activeTab === 'fleet' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('fleet')}
            >
              <Car size={16} /> Fleet Manager ({fleet.length})
            </button>
            <button 
              className={`admin-nav-btn ${activeTab === 'analytics' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <TrendingUp size={16} /> Analytics
            </button>
            <button 
              className={`admin-nav-btn ${activeTab === 'pricing' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('pricing')}
            >
              <DollarSign size={16} /> Pricing &amp; Settings
            </button>
          </nav>

          <button onClick={onClose} className="btn btn-secondary admin-close-portal-btn">
            Exit Console
          </button>
        </aside>

        {/* Content area */}
        <main className="admin-main-content">
          
          {/* TAB 1: IMMERSIVE LIVE OPERATIONS */}
          {activeTab === 'operations' && (
            <div className="admin-tab-content operations-view animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="admin-content-title" style={{ margin: 0 }}>Fleet Operations &amp; Live Tracking</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={handleSeedDemoRentals} 
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                  >
                    ⚡ Seed Live Demo Data
                  </button>
                </div>
              </div>

              {/* Operations main grid (large map & interactive sidebar) */}
              <div className="gps-console-widget glass-panel" style={{ padding: '1rem', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: 0 }}>
                
                <div className="gps-widget-split" style={{ display: 'grid', gridTemplateColumns: '1.7fr 1.3fr', gap: '1.25rem', height: '620px' }}>
                  
                  {/* Map Panel */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', height: '100%' }}>
                    <div id="gps-tracker-map" className="gps-map-container" style={{ flexGrow: 1, borderRadius: '8px', border: '1px solid hsla(var(--glass-border))' }}></div>
                    
                    {/* Map Legend */}
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#aaa', background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.8rem', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3acbe8', display: 'inline-block', boxShadow: '0 0 4px #3acbe8' }}></span>
                        <span>Active Rental (Moving)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4caf50', display: 'inline-block' }}></span>
                        <span>Confirmed (Parked at HQ)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffeb3b', display: 'inline-block' }}></span>
                        <span>Pending Approval / Lead</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2196f3', display: 'inline-block' }}></span>
                        <span>Available (Ready)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff9800', display: 'inline-block' }}></span>
                        <span>In Maintenance</span>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar Panel */}
                  <div className="telemetry-hud-sidebar glass-panel" style={{ height: '100%', border: '1px solid hsla(var(--glass-border))', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
                    
                    {/* Default state: Vehicle list */}
                    {!selectedCarId ? (
                      <>
                        <div className="telemetry-sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Fleet Operations HUD</span>
                          <span className="font-tiny text-muted">{filteredTelemetryKeys.length} items found</span>
                        </div>

                        {/* Search and Filters */}
                        <div style={{ padding: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.1)' }}>
                          <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                            <Search size={14} style={{ position: 'absolute', left: '8px', top: '9px', color: '#777' }} />
                            <input 
                              type="text" 
                              placeholder="Search car, renter, ref..."
                              className="form-input"
                              style={{ paddingLeft: '28px', fontSize: '0.8rem', height: '32px' }}
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                            />
                          </div>

                          <div className="sub-tab-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {['all', 'active', 'pending', 'confirmed', 'available', 'maintenance'].map(filter => (
                              <button
                                key={filter}
                                onClick={() => setSidebarFilter(filter)}
                                className={`btn-action-badge ${sidebarFilter === filter ? 'text-cyan bg-cyan-alpha' : 'text-secondary'}`}
                                style={{ 
                                  fontSize: '0.65rem', 
                                  padding: '0.15rem 0.4rem', 
                                  background: sidebarFilter === filter ? 'rgba(58,203,232,0.15)' : 'transparent',
                                  border: sidebarFilter === filter ? '1px solid rgba(58,203,232,0.3)' : '1px solid rgba(255,255,255,0.08)'
                                }}
                              >
                                {filter.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* List */}
                        <div className="telemetry-list-container">
                          {filteredTelemetryKeys.map(key => {
                            const car = fleetTelemetry[key];
                            return (
                              <div 
                                key={key}
                                className="telemetry-row-card"
                                onClick={() => {
                                  setSelectedCarId(key);
                                  panToCarOnMap(key);
                                }}
                                style={{ position: 'relative', padding: '0.75rem' }}
                              >
                                <div className="telemetry-card-top">
                                  <span className="telemetry-car-name">{car.carName}</span>
                                  <span className={`telemetry-status-pill status-${car.status.replace(/ /g, '-').toLowerCase()}`} style={{ fontSize: '0.65rem' }}>
                                    {car.status}
                                  </span>
                                </div>

                                {car.booking ? (
                                  <div className="telemetry-card-renter" style={{ margin: '0.2rem 0', fontSize: '0.75rem' }}>
                                    {car.status === 'Pending Inquiry' ? 'Lead: ' : 'Renter: '} 
                                    <strong>{car.booking.renterName || car.booking.name}</strong> 
                                    {car.status !== 'Pending Inquiry' && ` (${key})`}
                                  </div>
                                ) : (
                                  <div className="telemetry-card-renter" style={{ margin: '0.2rem 0', fontSize: '0.75rem', color: '#777' }}>
                                    No active booking
                                  </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#aaa', marginTop: '0.2rem' }}>
                                  <span>{car.streetName}</span>
                                  {car.status === 'Active' && (
                                    <strong>{Math.round(car.speed)} km/h</strong>
                                  )}
                                </div>

                                {/* Progress bar representing fuel/battery level */}
                                <div className="telemetry-progress-wrap" style={{ marginTop: '0.4rem' }}>
                                  <div 
                                    className={`telemetry-progress-bar ${car.isEv ? 'bg-ev' : 'bg-gas'} ${car.fuel < 20 ? 'bg-low' : ''}`}
                                    style={{ width: `${car.fuel}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                          {filteredTelemetryKeys.length === 0 && (
                            <div className="telemetry-empty-state" style={{ padding: '2rem 1rem' }}>
                              <p className="text-secondary">No vehicles found matching filters.</p>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      /* Selected state: Detailed Diagnostics & Key Fob */
                      <div className="telemetry-expanded-console" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
                        
                        {/* Header bar */}
                        <div className="telemetry-sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.2)' }}>
                          <button 
                            onClick={() => setSelectedCarId(null)}
                            className="btn btn-secondary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', height: '24px', display: 'inline-flex', alignItems: 'center' }}
                          >
                            ← Back to List
                          </button>
                          <span style={{ fontSize: '0.8rem', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                            {selectedTelemetryData?.carName}
                          </span>
                        </div>

                        {/* Vehicle details & Diagnostics HUD */}
                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', flexGrow: 1 }}>
                          
                          {/* Image and quick details */}
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
                            <img 
                              src={selectedTelemetryData?.carImage || '/mclaren.png'} 
                              alt={selectedTelemetryData?.carName}
                              style={{ width: '70px', height: '42px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }} 
                            />
                            <div style={{ textAlign: 'left' }}>
                              <span className={`status-badge status-${selectedTelemetryData?.status.toLowerCase().replace(/ /g, '-')}`} style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem' }}>
                                {selectedTelemetryData?.status}
                              </span>
                              <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '0.2rem' }}>
                                Tier: {selectedTelemetryData?.carCategory} | Rate: ${selectedTelemetryData?.dailyRate}/day
                              </div>
                            </div>
                          </div>

                          {/* Renter info and state actions if booked or inquiry */}
                          {selectedTelemetryData?.booking && (
                            <div className="glass-panel" style={{ padding: '0.75rem', textAlign: 'left', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.04)' }}>
                              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'hsl(var(--accent))', textTransform: 'uppercase' }}>
                                {selectedTelemetryData.status === 'Pending Inquiry' ? 'Pending Lead Details' : 'Active Booking Logs'}
                              </h4>
                              <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                <div>Name: <strong>{selectedTelemetryData.booking.renterName || selectedTelemetryData.booking.name}</strong></div>
                                <div style={{ color: '#aaa' }}>Email: {selectedTelemetryData.booking.userEmail || selectedTelemetryData.booking.email}</div>
                                {selectedTelemetryData.status !== 'Pending Inquiry' && (
                                  <div style={{ color: '#aaa' }}>Reference: <code>{selectedCarId}</code></div>
                                )}
                                <div>Phone: {selectedTelemetryData.booking.phone || selectedTelemetryData.booking.renterPhone}</div>
                                <div>Rental: {selectedTelemetryData.booking.startDate} to {selectedTelemetryData.booking.endDate} ({selectedTelemetryData.booking.days} days)</div>
                                <div>Est. Cost: <strong>${(selectedTelemetryData.booking.total || selectedTelemetryData.booking.totalEstimate || 0).toLocaleString()} AUD</strong></div>
                                
                                {selectedTelemetryData.booking.message && (
                                  <div style={{ fontSize: '0.75rem', color: '#ff9800', fontStyle: 'italic', marginTop: '0.2rem' }}>
                                    Message: "{selectedTelemetryData.booking.message}"
                                  </div>
                                )}
                              </div>

                              {/* Operations Workflow Action buttons */}
                              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                                {selectedTelemetryData.status === 'Pending Inquiry' && (
                                  <>
                                    <button 
                                      onClick={() => handleConvertLeadToBooking(selectedTelemetryData.booking)}
                                      className="btn btn-primary"
                                      style={{ flex: 1.5, fontSize: '0.75rem', padding: '0.35rem' }}
                                    >
                                      Approve &amp; Book
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteInquiry(selectedTelemetryData.booking.docId)}
                                      className="btn btn-secondary"
                                      style={{ flex: 0.8, fontSize: '0.75rem', padding: '0.35rem' }}
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                                {selectedTelemetryData.status === 'Pending' && (
                                  <button 
                                    onClick={() => handleUpdateBookingStatus(selectedCarId, 'Confirmed')}
                                    className="btn btn-primary"
                                    style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem' }}
                                  >
                                    Approve Booking
                                  </button>
                                )}
                                {selectedTelemetryData.status === 'Confirmed' && (
                                  <button 
                                    onClick={() => triggerInspection(selectedTelemetryData.booking, 'checkout')}
                                    className="btn btn-primary"
                                    style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem', background: 'hsl(var(--warning))', color: '#000' }}
                                  >
                                    Dispatch Handover Checks
                                  </button>
                                )}
                                {selectedTelemetryData.status === 'Active' && (
                                  <button 
                                    onClick={() => triggerInspection(selectedTelemetryData.booking, 'checkin')}
                                    className="btn btn-primary"
                                    style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem', background: 'hsl(var(--accent))' }}
                                  >
                                    Run Return Checks
                                  </button>
                                )}
                                {selectedTelemetryData.booking.status !== 'Completed' && selectedTelemetryData.booking.status !== 'Cancelled' && selectedTelemetryData.status !== 'Pending Inquiry' && (
                                  <button 
                                    onClick={() => handleUpdateBookingStatus(selectedCarId, 'Cancelled')}
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.75rem', padding: '0.35rem' }}
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Maintenance diagnostics panel */}
                          {selectedTelemetryData?.status === 'Maintenance' && (
                            <div className="glass-panel text-left" style={{ padding: '0.75rem', background: 'rgba(255,152,0,0.05)', border: '1px solid rgba(255,152,0,0.2)' }}>
                              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: '#ff9800', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <AlertTriangle size={14} /> Diagnostic Servicing HUD
                              </h4>
                              <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', color: '#ccc' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Service Status:</span>
                                  <strong className="text-gold">Tuning Engine ECU</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>O2 Sensor Flow:</span>
                                  <span style={{ color: '#f44336' }}>Warning Alert (Low)</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Brake Pads Life:</span>
                                  <span>Front: 12% | Rear: 84%</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Next Scheduled Service:</span>
                                  <span>29/05/2026</span>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleToggleMaintenance(selectedTelemetryData.carId)}
                                className="btn btn-primary"
                                style={{ width: '100%', fontSize: '0.75rem', padding: '0.4rem', marginTop: '0.8rem', background: '#ff9800', color: '#000' }}
                              >
                                Complete Servicing &amp; Unlock
                              </button>
                            </div>
                          )}

                          {/* Available details */}
                          {selectedTelemetryData?.status === 'Available' && (
                            <div className="glass-panel text-left" style={{ padding: '0.75rem', background: 'rgba(58,203,232,0.03)', border: '1px solid rgba(58,203,232,0.1)' }}>
                              <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.8rem', color: '#3acbe8' }}>Ready in Showroom</h4>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#aaa' }}>
                                Vehicle is clean, fully prepared, and parked at Airport Terminal Logistical suites awaiting incoming checkouts.
                              </p>
                              <button 
                                onClick={() => handleToggleMaintenance(selectedTelemetryData.carId)}
                                className="btn btn-secondary"
                                style={{ width: '100%', fontSize: '0.75rem', padding: '0.4rem', marginTop: '0.8rem' }}
                              >
                                Transfer to Maintenance Bay
                              </button>
                            </div>
                          )}

                          {/* OBD Telematics Readings */}
                          {selectedTelemetryData?.status !== 'Maintenance' && selectedTelemetryData?.status !== 'Pending Inquiry' && (
                            <div className="glass-panel text-left" style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.04)' }}>
                              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'hsl(var(--accent))', textTransform: 'uppercase' }}>OBD Telemetry Readings</h4>
                              
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                                  <div style={{ fontSize: '0.65rem', color: '#777' }}>SPEED</div>
                                  <strong style={{ fontSize: '1.1rem', color: selectedTelemetryData.speed > 95 ? '#ff9800' : '#fff' }}>
                                    {Math.round(selectedTelemetryData.speed)} km/h
                                  </strong>
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                                  <div style={{ fontSize: '0.65rem', color: '#777' }}>
                                    {selectedTelemetryData.isEv ? 'BATTERY CHARGE' : 'FUEL TANK'}
                                  </div>
                                  <strong style={{ fontSize: '1.1rem', color: selectedTelemetryData.fuel < 20 ? '#f44336' : '#fff' }}>
                                    {Math.round(selectedTelemetryData.fuel)}%
                                  </strong>
                                </div>
                              </div>

                              {/* Tire pressures graphic */}
                              <div className="diagnostics-header" style={{ fontSize: '0.7rem', color: '#777', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                                Tyre Pressure HUD (PSI)
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                                <div>FL: <strong style={{ color: '#4caf50' }}>{selectedTelemetryData.tirePressure[0].toFixed(1)}</strong></div>
                                <div>FR: <strong style={{ color: '#4caf50' }}>{selectedTelemetryData.tirePressure[1].toFixed(1)}</strong></div>
                                <div>RL: <strong style={{ color: '#4caf50' }}>{selectedTelemetryData.tirePressure[2].toFixed(1)}</strong></div>
                                <div>RR: <strong style={{ color: '#4caf50' }}>{selectedTelemetryData.tirePressure[3].toFixed(1)}</strong></div>
                              </div>

                              <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '0.5rem' }}>
                                Current Location: <strong>{selectedTelemetryData.streetName}</strong>
                              </div>
                            </div>
                          )}

                          {/* Key Fob Panel (active/booked cars) */}
                          {selectedTelemetryData?.status === 'Active' && (
                            <div className="glass-panel" style={{ padding: '0.75rem', textAlign: 'left', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.04)' }}>
                              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'hsl(var(--accent))', textTransform: 'uppercase' }}>Remote Key Fob Commands</h4>
                              
                              <div className="fob-controls-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                
                                {/* Lock/Unlock */}
                                <button 
                                  onClick={() => handleFobLockToggle(selectedCarId)}
                                  className={`btn ${selectedTelemetryData.locked ? 'btn-secondary' : 'btn-primary'}`}
                                  style={{ padding: '0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                                >
                                  <Shield size={14} />
                                  {selectedTelemetryData.locked ? 'Unlock Doors' : 'Lock Doors'}
                                </button>

                                {/* Honk */}
                                <button 
                                  onClick={() => handleFobHonk(selectedCarId)}
                                  className="btn btn-secondary"
                                  style={{ padding: '0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                                >
                                  <Volume2 size={14} />
                                  Honk Horn
                                </button>

                                {/* Ignition */}
                                <button 
                                  onClick={() => handleFobEngineToggle(selectedCarId)}
                                  className={`btn ${selectedTelemetryData.engineOn ? 'btn-secondary' : 'btn-primary'}`}
                                  style={{ 
                                    padding: '0.5rem', 
                                    fontSize: '0.75rem', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justify: 'center', 
                                    gap: '0.3rem',
                                    background: selectedTelemetryData.engineOn ? '#f44336' : '#4caf50',
                                    color: '#fff'
                                  }}
                                >
                                  {selectedTelemetryData.engineOn ? (
                                    <>
                                      <Square size={14} fill="#fff" />
                                      Kill Ignition
                                    </>
                                  ) : (
                                    <>
                                      <Play size={14} fill="#fff" />
                                      Start Engine
                                    </>
                                  )}
                                </button>

                                {/* Hazards */}
                                <button 
                                  onClick={() => handleFobHazardsToggle(selectedCarId)}
                                  className={`btn ${selectedTelemetryData.hazardsOn ? 'btn-primary' : 'btn-secondary'}`}
                                  style={{ 
                                    padding: '0.5rem', 
                                    fontSize: '0.75rem', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justify: 'center', 
                                    gap: '0.3rem',
                                    background: selectedTelemetryData.hazardsOn ? '#ff9800' : '',
                                    borderColor: selectedTelemetryData.hazardsOn ? '#ff9800' : ''
                                  }}
                                >
                                  <AlertTriangle size={14} />
                                  {selectedTelemetryData.hazardsOn ? 'Hazards Off' : 'Hazards On'}
                                </button>

                              </div>

                              {/* Custom Warning SMS Box */}
                              <form onSubmit={(e) => handleSendCustomSMS(e, selectedCarId)} style={{ display: 'flex', gap: '0.3rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
                                <input 
                                  type="text" 
                                  placeholder="Send safety alert text to user..."
                                  className="form-input"
                                  style={{ flexGrow: 1, fontSize: '0.75rem', height: '32px' }}
                                  value={warningMsg}
                                  onChange={(e) => setWarningMsg(e.target.value)}
                                />
                                <button 
                                  type="submit" 
                                  className="btn btn-primary"
                                  style={{ padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  title="Send SMS notification warning"
                                >
                                  <Send size={14} />
                                </button>
                              </form>

                            </div>
                          )}

                        </div>

                      </div>
                    )}

                  </div>

                </div>

              </div>

            </div>
          )}

          {/* TAB 2: MANAGE BOOKINGS LOGS TABLE */}
          {activeTab === 'bookings' && (
            <div className="admin-tab-content animate-slide-up text-left">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="admin-content-title" style={{ margin: 0 }}>Customer Logs &amp; Ledgers</h2>
                
                {/* Export & Sync Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={handleDownloadCSV}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    title="Download CSV for Google Sheets"
                  >
                    <Download size={15} /> Export CSV
                  </button>
                  <button 
                    onClick={handleBulkSyncToSheets}
                    disabled={isBulkSyncing}
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    title="Push all database records to Google Sheets Webhook"
                  >
                    <Database size={15} /> 
                    {isBulkSyncing ? 'Syncing...' : 'Sync Google Sheets'}
                  </button>
                </div>
              </div>

              {/* Sub tabs for bookings/inquiries toggle */}
              <div className="bookings-subtabs" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                <button
                  onClick={() => setBookingsSubTab('stripe')}
                  className={`btn-action-badge ${bookingsSubTab === 'stripe' ? 'text-cyan bg-cyan-alpha' : 'text-secondary'}`}
                  style={{ 
                    fontSize: '0.8rem', 
                    padding: '0.35rem 0.8rem',
                    background: bookingsSubTab === 'stripe' ? 'rgba(58,203,232,0.12)' : 'transparent',
                    border: bookingsSubTab === 'stripe' ? '1px solid rgba(58,203,232,0.3)' : '1px solid transparent'
                  }}
                >
                  Stripe Bookings ({bookings.length})
                </button>
                <button
                  onClick={() => setBookingsSubTab('leads')}
                  className={`btn-action-badge ${bookingsSubTab === 'leads' ? 'text-cyan bg-cyan-alpha' : 'text-secondary'}`}
                  style={{ 
                    fontSize: '0.8rem', 
                    padding: '0.35rem 0.8rem',
                    background: bookingsSubTab === 'leads' ? 'rgba(58,203,232,0.12)' : 'transparent',
                    border: bookingsSubTab === 'leads' ? '1px solid rgba(58,203,232,0.3)' : '1px solid transparent'
                  }}
                >
                  Lead Inquiries ({inquiries.length})
                </button>
              </div>

              {/* Stripe Bookings Table */}
              {bookingsSubTab === 'stripe' ? (
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
                        <React.Fragment key={b.referenceNumber}>
                          <tr style={{ borderBottom: expandedBookingRefs[b.referenceNumber] ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
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
                              {b.inspection && (b.inspection.checkout || b.inspection.checkin) && (
                                <button 
                                  onClick={() => {
                                    setExpandedBookingRefs(prev => ({
                                      ...prev,
                                      [b.referenceNumber]: !prev[b.referenceNumber]
                                    }));
                                  }}
                                  className="btn-action-badge text-cyan"
                                  style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.65rem', padding: '0.1rem 0.3rem', width: '100%', textAlign: 'center', border: '1px solid rgba(58,203,232,0.3)', background: 'rgba(58,203,232,0.08)', cursor: 'pointer' }}
                                >
                                  {expandedBookingRefs[b.referenceNumber] ? 'Hide Checks' : 'View Checks'}
                                </button>
                              )}
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
                                    title="Return Checks"
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
                          {expandedBookingRefs[b.referenceNumber] && (
                            <tr style={{ background: 'rgba(58, 203, 232, 0.015)' }}>
                              <td colSpan="7" style={{ padding: '1.25rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.06)', borderTop: 'none' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', width: '100%' }}>
                                  
                                  {/* Checkout Column */}
                                  {b.inspection?.checkout ? (
                                    <div className="glass-panel" style={{ padding: '1rem', border: '1px solid rgba(58,203,232,0.15)', background: 'rgba(0,0,0,0.2)' }}>
                                      <h4 className="text-cyan" style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        🔑 Checkout Handover Details
                                      </h4>
                                      <p className="font-tiny text-muted" style={{ margin: '0 0 0.75rem 0' }}>Date: {b.inspection.checkout.timestamp}</p>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem', color: '#ccc' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span>Exterior Body Panels:</span>
                                          <strong>{b.inspection.checkout.checks?.exterior ? '✅ Normal' : '⚠️ Issue Logged'}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span>Interior Cleanliness:</span>
                                          <strong>{b.inspection.checkout.checks?.interior ? '✅ Cleaned' : '⚠️ Issue Logged'}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span>Fluids & Systems:</span>
                                          <strong>{b.inspection.checkout.checks?.fluids ? '✅ Level Normal' : '⚠️ Low/Logged'}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span>Tyres & Pressures:</span>
                                          <strong>{b.inspection.checkout.checks?.tires ? '✅ Specs Match' : '⚠️ Checked'}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span>Fuel Level:</span>
                                          <strong>⛽ {b.inspection.checkout.checks?.fuel || 'Full (100%)'}</strong>
                                        </div>
                                        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                          <strong style={{ color: '#aaa' }}>Staff Notes:</strong>
                                          <p style={{ margin: '0.2rem 0 0 0', fontStyle: 'italic', color: '#eee' }}>
                                            "{b.inspection.checkout.checks?.notes || 'No notes taken.'}"
                                          </p>
                                        </div>
                                        <div style={{ marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <span>Inspector Signoff:</span>
                                          <span className="signature-input-font text-cyan" style={{ fontSize: '0.95rem' }}>{b.inspection.checkout.inspectorSignature}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="glass-panel" style={{ padding: '1rem', border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.1)', opacity: 0.5, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '150px' }}>
                                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#777' }}>🔑 Checkout Handover Details</h4>
                                      <p className="font-small text-muted" style={{ margin: 0 }}>No checkout inspection recorded.</p>
                                    </div>
                                  )}

                                  {/* Return Column */}
                                  {b.inspection?.checkin ? (
                                    <div className="glass-panel" style={{ padding: '1rem', border: '1px solid rgba(58,203,232,0.15)', background: 'rgba(0,0,0,0.2)' }}>
                                      <h4 className="text-cyan" style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                        🛑 Return Inspection Details
                                      </h4>
                                      <p className="font-tiny text-muted" style={{ margin: '0 0 0.75rem 0' }}>Date: {b.inspection.checkin.timestamp}</p>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem', color: '#ccc' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span>Exterior Body Panels:</span>
                                          <strong>{b.inspection.checkin.checks?.exterior ? '✅ Normal' : '⚠️ Issue Logged'}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span>Interior Cleanliness:</span>
                                          <strong>{b.inspection.checkin.checks?.interior ? '✅ Cleaned' : '⚠️ Issue Logged'}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span>Fluids & Systems:</span>
                                          <strong>{b.inspection.checkin.checks?.fluids ? '✅ Level Normal' : '⚠️ Low/Logged'}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span>Tyres & Pressures:</span>
                                          <strong>{b.inspection.checkin.checks?.tires ? '✅ Specs Match' : '⚠️ Checked'}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span>Fuel Level:</span>
                                          <strong>⛽ {b.inspection.checkin.checks?.fuel || 'Full (100%)'}</strong>
                                        </div>
                                        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                          <strong style={{ color: '#aaa' }}>Staff Notes:</strong>
                                          <p style={{ margin: '0.2rem 0 0 0', fontStyle: 'italic', color: '#eee' }}>
                                            "{b.inspection.checkin.checks?.notes || 'No notes taken.'}"
                                          </p>
                                        </div>
                                        <div style={{ marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <span>Inspector Signoff:</span>
                                          <span className="signature-input-font text-cyan" style={{ fontSize: '0.95rem' }}>{b.inspection.checkin.inspectorSignature}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="glass-panel" style={{ padding: '1rem', border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.1)', opacity: 0.5, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '150px' }}>
                                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#777' }}>🛑 Return Inspection Details</h4>
                                      <p className="font-small text-muted" style={{ margin: 0 }}>No return inspection recorded.</p>
                                    </div>
                                  )}

                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                      {bookings.length === 0 && (
                        <tr>
                          <td colSpan="7" className="text-center text-muted py-4">No reservations logged in database.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Lead Inquiries Table */
                <div className="table-responsive">
                  <table className="admin-data-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Vehicle Request</th>
                        <th>Dates &amp; Duration</th>
                        <th>Est. Quote</th>
                        <th>Message Notes</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inquiries.map((inq) => (
                        <tr key={inq.docId}>
                          <td>
                            <div>
                              <strong>{inq.name}</strong>
                              <p className="font-tiny text-muted">{inq.email}</p>
                              <p className="font-tiny text-muted">{inq.phone}</p>
                            </div>
                          </td>
                          <td>{inq.carName}</td>
                          <td>{inq.startDate} to {inq.endDate} ({inq.days}d)</td>
                          <td>${(inq.totalEstimate || 0).toLocaleString()} AUD</td>
                          <td style={{ maxWidth: '180px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            <span className="text-muted font-small" title={inq.message}>{inq.message || 'N/A'}</span>
                          </td>
                          <td>
                            <span className={`status-badge status-${inq.status?.toLowerCase() || 'pending'}`}>
                              {inq.status || 'Pending'}
                            </span>
                          </td>
                          <td>
                            <div className="actions-button-group">
                              {inq.status === 'Pending' && (
                                <>
                                  <button 
                                    onClick={() => handleConvertLeadToBooking(inq)}
                                    className="btn-action-badge text-green"
                                    title="Approve and register booking log"
                                  >
                                    <Check size={16} /> Convert to Booking
                                  </button>
                                  <button 
                                    onClick={() => handleUpdateInquiryStatus(inq.docId, 'Contacted')}
                                    className="btn-action-badge text-gold"
                                    title="Mark contacted"
                                  >
                                    Contacted
                                  </button>
                                </>
                              )}
                              {inq.status === 'Contacted' && (
                                <button 
                                  onClick={() => handleConvertLeadToBooking(inq)}
                                  className="btn-action-badge text-green"
                                  title="Approve and register booking log"
                                >
                                  <Check size={16} /> Convert
                                </button>
                              )}
                              <button 
                                onClick={() => handleDeleteInquiry(inq.docId)}
                                className="btn-action-badge text-red"
                                title="Delete inquiry"
                              >
                                <Trash2 size={15} /> Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {inquiries.length === 0 && (
                        <tr>
                          <td colSpan="7" className="text-center text-muted py-4">No lead inquiries logged in database.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
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
                        <option value="EV">EV</option>
                        <option value="Luxury SUV">Luxury SUV</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Daily Base Rate (AUD)</label>
                      <input 
                        type="number" 
                        required 
                        min="1"
                        className="form-input"
                        value={newCar.price}
                        onChange={(e) => setNewCar(prev => ({ ...prev, price: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Visual Asset File</label>
                      <select 
                        className="form-select"
                        value={newCar.image}
                        onChange={(e) => setNewCar(prev => ({ ...prev, image: e.target.value }))}
                      >
                        <option value="/porsche.png">Porsche 911 GT3 (Dark Grey)</option>
                        <option value="/rangerover.png">Range Rover Autobiography (Silver)</option>
                        <option value="/teslas.png">Tesla Model S Plaid (Navy Blue)</option>
                        <option value="/mclaren.png">McLaren 720S (Neon Yellow)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Engine / Drivetrain</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 4.0L Twin-Turbo H6"
                        className="form-input"
                        value={newCar.engine}
                        onChange={(e) => setNewCar(prev => ({ ...prev, engine: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Acceleration (0-100 km/h)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 3.2s"
                        className="form-input"
                        value={newCar.acceleration}
                        onChange={(e) => setNewCar(prev => ({ ...prev, acceleration: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Top Speed</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 318 km/h"
                        className="form-input"
                        value={newCar.topSpeed}
                        onChange={(e) => setNewCar(prev => ({ ...prev, topSpeed: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Seat Count</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="8"
                        className="form-input"
                        value={newCar.seats}
                        onChange={(e) => setNewCar(prev => ({ ...prev, seats: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Key Features (Comma separated)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Carbon Ceramic Brakes, Front Lift Kit, Sports Exhaust"
                      className="form-input"
                      value={newCar.features}
                      onChange={(e) => setNewCar(prev => ({ ...prev, features: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Vehicle Description</label>
                    <textarea 
                      rows="2"
                      placeholder="Enter a brief, premium summary of the car for checkout portals..."
                      className="form-input"
                      value={newCar.description}
                      onChange={(e) => setNewCar(prev => ({ ...prev, description: e.target.value }))}
                    ></textarea>
                  </div>

                  <div className="actions-button-group">
                    <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Register Fleet Vehicle
                    </button>
                  </div>
                </form>
              )}

              {/* Inventory Table */}
              <div className="table-responsive">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Model Name</th>
                      <th>Category</th>
                      <th>Base Rate</th>
                      <th>Spec Overview</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fleet.map((car) => (
                      <tr key={car.id}>
                        <td>
                          <img 
                            src={car.image} 
                            alt={car.name} 
                            className="admin-table-thumbnail"
                          />
                        </td>
                        <td>
                          <strong>{car.name}</strong>
                          <p className="font-tiny text-muted">ID: {car.id}</p>
                        </td>
                        <td>
                          <span className={`category-badge badge-${car.category.toLowerCase().replace(/\s+/g, '-')}`}>
                            {car.category}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span className="text-muted font-small">$</span>
                            <input 
                              type="number" 
                              value={car.price} 
                              onChange={(e) => handleUpdatePrice(car.id, e.target.value)}
                              className="inline-rate-input"
                              style={{ width: '65px', background: 'transparent', border: '1px dashed #333', color: '#fff', borderRadius: '4px', padding: '0.1rem 0.3rem', fontSize: '0.85rem' }}
                            />
                            <span className="font-tiny text-muted">AUD</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.75rem' }}>
                            <div>Engine: {car.engine} | {car.transmission}</div>
                            <div>Accel: {car.acceleration} | Max: {car.topSpeed}</div>
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge status-${car.status === 'Maintenance' ? 'maintenance' : 'active'}`}>
                            {car.status === 'Maintenance' ? '🔧 Maintenance' : '✓ Active'}
                          </span>
                        </td>
                        <td>
                          <div className="actions-button-group">
                            <button 
                              onClick={() => handleToggleMaintenance(car.id)}
                              className={`btn-action-badge ${car.status === 'Maintenance' ? 'text-green' : 'text-gold'}`}
                              title={car.status === 'Maintenance' ? "Put back in active fleet" : "Put in maintenance"}
                            >
                              {car.status === 'Maintenance' ? 'Activate' : 'Maintenance'}
                            </button>
                            <button 
                              onClick={() => handleDeleteCar(car.id)}
                              className="btn-action-badge text-red"
                              title="Delete vehicle"
                            >
                              <Trash2 size={15} /> Remove
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

          {/* TAB 4: ANALYTICS INSIGHTS */}
          {activeTab === 'analytics' && (
            <div className="admin-tab-content analytics-tab-content animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ textAlign: 'left' }}>
                <h2 className="admin-content-title" style={{ margin: 0 }}>Executive Analytics Console</h2>
                <p className="font-small text-muted" style={{ margin: '0.2rem 0 0 0' }}>Real-time business performance indexes and vehicle utilization metrics.</p>
              </div>

              {/* Metrics Summary grid */}
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

              {/* Charts grid */}
              <div className="dashboard-charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                
                {/* Chart 1: Revenue Trend */}
                <div className="glass-panel chart-card" style={{ padding: '1.5rem', textAlign: 'left' }}>
                  <h3 className="widget-title" style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#fff', borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>7-Day Revenue Trend</h3>
                  {renderRevenueTrendChart()}
                </div>

                {/* Chart 2: Fleet Status Split */}
                <div className="glass-panel chart-card" style={{ padding: '1.5rem', textAlign: 'left' }}>
                  <h3 className="widget-title" style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#fff', borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>Fleet Status Split</h3>
                  {renderFleetStatusSplitChart()}
                </div>

                {/* Chart 3: Car Performance */}
                <div className="glass-panel chart-card" style={{ padding: '1.5rem', textAlign: 'left' }}>
                  <h3 className="widget-title" style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#fff', borderBottom: '1px solid #222', paddingBottom: '0.5rem' }}>Vehicle Revenue Performance</h3>
                  {renderCarPerformanceChart()}
                </div>

              </div>

              {/* Summary table lists */}
              <div className="dashboard-grid-widgets" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                
                <div className="glass-card recent-bookings-widget text-left" style={{ margin: 0 }}>
                  <h3 className="widget-title">Recent Inquiries &amp; Bookings</h3>
                  <div className="widget-list">
                    {bookings.slice(-3).reverse().map((b) => (
                      <div key={b.referenceNumber} className="widget-row-item">
                        <div>
                          <strong>{b.renterName}</strong>
                          <p className="font-tiny text-muted">{b.carName} — stripe</p>
                        </div>
                        <span className={`status-badge status-${b.status ? b.status.toLowerCase() : 'pending'}`}>
                          {b.status || 'Pending'}
                        </span>
                      </div>
                    ))}
                    {inquiries.slice(-2).reverse().map((inq) => (
                      <div key={inq.docId} className="widget-row-item">
                        <div>
                          <strong>{inq.name}</strong>
                          <p className="font-tiny text-muted">{inq.carName} — lead inquiry</p>
                        </div>
                        <span className={`status-badge status-${inq.status ? inq.status.toLowerCase() : 'pending'}`}>
                          {inq.status || 'Pending'}
                        </span>
                      </div>
                    ))}
                    {bookings.length === 0 && inquiries.length === 0 && <p className="text-muted text-center py-4">No active records yet.</p>}
                  </div>
                </div>

                <div className="glass-card recent-bookings-widget text-left" style={{ margin: 0 }}>
                  <h3 className="widget-title">Fleet Rental Frequency</h3>
                  <div className="widget-list">
                    {fleet.map((car) => {
                      const count = bookings.filter(b => b.carName === car.name && b.status !== 'Cancelled').length + inquiries.filter(inq => inq.carName === car.name).length;
                      return (
                        <div key={car.id} className="widget-row-item">
                          <span>{car.name}</span>
                          <strong>{count} interest{count !== 1 ? 's' : ' '}</strong>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 5: SURGE PRICING RULES & SETTINGS */}
          {activeTab === 'pricing' && (
            <div className="admin-tab-content animate-slide-up text-left">
              <h2 className="admin-content-title">System Settings &amp; Surge Pricing</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
                
                {/* Left side: Pricing controls */}
                <div className="glass-panel pricing-config-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>Surge Multipliers</h3>
                      <p className="font-tiny text-muted" style={{ margin: '0.2rem 0 0 0' }}>Configure automated multiplier surcharges.</p>
                    </div>
                    
                    <label className="switch-toggle" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <span className="font-tiny font-bold" style={{ color: pricingSettings.dynamicPricingEnabled ? 'hsl(var(--accent))' : '#777' }}>
                        {pricingSettings.dynamicPricingEnabled ? 'Active' : 'Disabled'}
                      </span>
                      <input 
                        type="checkbox" 
                        style={{ cursor: 'pointer' }}
                        checked={pricingSettings.dynamicPricingEnabled || false} 
                        onChange={async (e) => {
                          try {
                            await updateDoc(doc(db, "settings", "pricing"), {
                              dynamicPricingEnabled: e.target.checked
                            });
                          } catch (err) {
                            console.error("Error toggling dynamic pricing:", err);
                          }
                        }}
                      />
                    </label>
                  </div>

                  <div className="config-group-sliders" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Slider 1 */}
                    <div className="config-slider-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <label className="form-label font-bold" style={{ margin: 0, fontSize: '0.85rem' }}>Weekend Surge</label>
                        <strong className="text-cyan" style={{ fontSize: '0.85rem' }}>+{Math.round(((pricingSettings.weekendMultiplier || 1.15) - 1) * 100)}%</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <input 
                          type="range" 
                          min="1.00" 
                          max="1.40" 
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
                          className="form-slider"
                          style={{ flex: 1, cursor: 'pointer' }}
                        />
                        <strong style={{ minWidth: '45px', textAlign: 'right', fontSize: '0.85rem' }}>{pricingSettings.weekendMultiplier?.toFixed(2)}x</strong>
                      </div>
                    </div>

                    {/* Slider 2 */}
                    <div className="config-slider-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <label className="form-label font-bold" style={{ margin: 0, fontSize: '0.85rem' }}>High Demand Surge (Tier 1)</label>
                        <strong className="text-cyan" style={{ fontSize: '0.85rem' }}>+{Math.round((pricingSettings.utilizationSurcharge1 || 0.10) * 100)}% Fee</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span className="font-tiny text-muted" style={{ minWidth: '100px' }}>Occupancy ≥</span>
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
                        <strong style={{ minWidth: '45px', textAlign: 'right', fontSize: '0.85rem' }}>{Math.round((pricingSettings.utilizationThreshold1 || 0.50) * 100)}%</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span className="font-tiny text-muted" style={{ minWidth: '100px' }}>Surcharge:</span>
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
                        <strong style={{ minWidth: '45px', textAlign: 'right', fontSize: '0.85rem' }}>+{Math.round((pricingSettings.utilizationSurcharge1 || 0.10) * 100)}%</strong>
                      </div>
                    </div>

                    {/* Slider 3 */}
                    <div className="config-slider-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <label className="form-label font-bold" style={{ margin: 0, fontSize: '0.85rem' }}>Peak Demand Surge (Tier 2)</label>
                        <strong className="text-cyan" style={{ fontSize: '0.85rem' }}>+{Math.round((pricingSettings.utilizationSurcharge2 || 0.25) * 100)}% Fee</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span className="font-tiny text-muted" style={{ minWidth: '100px' }}>Occupancy ≥</span>
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
                        <strong style={{ minWidth: '45px', textAlign: 'right', fontSize: '0.85rem' }}>{Math.round((pricingSettings.utilizationThreshold2 || 0.75) * 100)}%</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span className="font-tiny text-muted" style={{ minWidth: '100px' }}>Surcharge:</span>
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
                        <strong style={{ minWidth: '45px', textAlign: 'right', fontSize: '0.85rem' }}>+{Math.round((pricingSettings.utilizationSurcharge2 || 0.25) * 100)}%</strong>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Right side: Integrations */}
                <div className="glass-panel pricing-config-panel" style={{ padding: '1.5rem' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Database size={18} className="text-cyan" /> Google Sheets Sync
                  </h3>
                  <p className="font-tiny text-muted" style={{ margin: '0 0 1.25rem 0' }}>
                    Integrate your database with Google Sheets. Paste your automation Webhook URL (Zapier, Make, or Apps Script endpoint) to automatically sync transactions.
                  </p>

                  <div className="form-group" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Google Sheets Webhook Endpoint URL</label>
                    <input 
                      type="url"
                      placeholder="https://hooks.zapier.com/hooks/catch/..."
                      className="form-input"
                      value={pricingSettings.googleSheetsWebhookUrl || ''}
                      onChange={async (e) => {
                        try {
                          await updateDoc(doc(db, "settings", "pricing"), {
                            googleSheetsWebhookUrl: e.target.value
                          });
                        } catch (err) {
                          console.error("Error updating webhook URL:", err);
                        }
                      }}
                      style={{ fontSize: '0.8rem', height: '36px', marginTop: '0.3rem' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button 
                      onClick={handleBulkSyncToSheets}
                      disabled={isBulkSyncing}
                      className="btn btn-primary"
                      style={{ flex: 1.2, fontSize: '0.8rem', padding: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                    >
                      <Database size={14} /> {isBulkSyncing ? 'Syncing...' : 'Bulk Sync Webhook'}
                    </button>
                    <button 
                      onClick={handleDownloadCSV}
                      className="btn btn-secondary"
                      style={{ flex: 0.8, fontSize: '0.8rem', padding: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                    >
                      <Download size={14} /> Download CSV
                    </button>
                  </div>
                  <p className="font-tiny text-muted" style={{ marginTop: '0.75rem', fontSize: '0.65rem' }}>
                    * Bulk Sync pushes all Firestore records. CSV file can be dragged directly into Google Sheets.
                  </p>
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
