import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Calendar, Car } from 'lucide-react';

export default function Hero({ onSearch }) {
  const [location, setLocation] = useState('Sydney Airport');
  const [dates, setDates] = useState('');
  const [vehicleType, setVehicleType] = useState('All');

  const mapRef = useRef(null);
  const animationFrameRef = useRef(null);

  const handleSearch = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(vehicleType);
    }
    const element = document.getElementById('fleet');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const L = window.L;
    if (!L) return;

    const mapContainer = document.getElementById('hero-live-map');
    if (!mapContainer) return;

    // Center map on Sydney CBD (shifted slightly South to show more southern routes)
    const map = L.map('hero-live-map', {
      center: [-33.8730, 151.2100],
      zoom: 14,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
      attributionControl: false
    });

    mapRef.current = map;

    // Use standard OSM tiles (the global CSS filter in index.css automatically styles it dark-cyan)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(map);

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

    // Initialize routes around Sydney CBD (staying strictly on land streets and the Sydney Harbour Bridge)
    const routesData = [
      // Route 1: George St (North-South central artery, completely on land)
      [
        [-33.8845, 151.2010], // Broadway / George St
        [-33.8825, 151.2065],
        [-33.8780, 151.2068],
        [-33.8725, 151.2061],
        [-33.8670, 151.2070],
        [-33.8615, 151.2085],
        [-33.8585, 151.2095]
      ],
      // Route 2: Elizabeth St (North-South parallel, completely on land)
      [
        [-33.8590, 151.2115],
        [-33.8640, 151.2110],
        [-33.8690, 151.2105],
        [-33.8740, 151.2098],
        [-33.8790, 151.2093],
        [-33.8810, 151.2090],
        [-33.8880, 151.2075] // Redfern/Waterloo
      ],
      // Route 3: Park St / William St / Bayswater Rd / New South Head Rd (East-West crossway on land)
      [
        [-33.8725, 151.2061], // George St / Park St (Town Hall)
        [-33.8730, 151.2098],
        [-33.8735, 151.2128],
        [-33.8745, 151.2175],
        [-33.8755, 151.2220],
        [-33.8765, 151.2270],
        [-33.8785, 151.2330]  // Edgecliff
      ],
      // Route 4: Sydney Harbour Bridge Crossing (Iconic crossing from Circular Quay to Milsons Point)
      [
        [-33.8615, 151.2085], // Circular Quay
        [-33.8585, 151.2095], // York St / Cumberland St ramp
        [-33.8550, 151.2100], // Harbour Bridge South Pylon
        [-33.8510, 151.2108], // Harbour Bridge Center
        [-33.8465, 151.2115], // Harbour Bridge North Pylon
        [-33.8435, 151.2118]  // Milsons Point / Alfred St Loop
      ]
    ];

    const getAngle = (p1, p2) => {
      if (!p1 || !p2) return 0;
      const dy = p2[0] - p1[0];
      const dx = p2[1] - p1[1];
      return Math.atan2(dx, dy) * 180 / Math.PI;
    };

    // Top-down sports car outline styled in solid cyan #3ACBE8 and black tires/windshields for maximum visibility
    const carIconHtml = `
      <div class="car-icon-wrapper" style="transform: rotate(0deg); transform-origin: center; display: flex; justify-content: center; align-items: center; width: 38px; height: 38px; filter: drop-shadow(0 0 10px #3ACBE8);">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 20C7 20.6 7.4 21 8 21H16C16.6 21 17 20.6 17 20V4C17 3.4 16.6 3 16 3H8C7.4 3 7 3.4 7 4V20Z" fill="#3ACBE8" stroke="#3ACBE8" stroke-width="1"/>
          <path d="M9 8C9 7.4 9.4 7 10 7H14C14.6 7 15 7.4 15 8V9H9V8Z" fill="#000000" stroke="#000000" stroke-width="0.5"/>
          <path d="M9 16C9 15.4 9.4 15 10 15H14C14.6 15 15 15.4 15 16V17H9V16Z" fill="#000000" stroke="#000000" stroke-width="0.5"/>
          <rect x="4.8" y="5" width="2.2" height="4.5" rx="0.5" fill="#000000"/>
          <rect x="17" y="5" width="2.2" height="4.5" rx="0.5" fill="#000000"/>
          <rect x="4.8" y="14.5" width="2.2" height="4.5" rx="0.5" fill="#000000"/>
          <rect x="17" y="14.5" width="2.2" height="4.5" rx="0.5" fill="#000000"/>
          <line x1="12" y1="9" x2="12" y2="15" stroke="#000000" stroke-width="1.5" stroke-dasharray="1 2"/>
        </svg>
      </div>
    `;

    // Create markers for each route
    const cars = routesData.map((rawRoute, idx) => {
      const pingPongRaw = makePingPongRoute(rawRoute);
      const fullPath = interpolateRoute(pingPongRaw, 150);
      
      // Stagger start index
      const startIndex = Math.floor((idx / routesData.length) * fullPath.length);
      
      const customIcon = L.divIcon({
        html: carIconHtml,
        className: 'custom-car-icon',
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });

      const marker = L.marker(fullPath[startIndex], { icon: customIcon }).addTo(map);

      return {
        path: fullPath,
        currentIndex: startIndex,
        marker,
        speed: 0.8 + Math.random() * 0.4
      };
    });

    const animate = () => {
      cars.forEach(car => {
        car.currentIndex = (car.currentIndex + car.speed) % car.path.length;
        const idx = Math.floor(car.currentIndex);
        const nextIdx = (idx + 1) % car.path.length;
        
        const p1 = car.path[idx];
        const p2 = car.path[nextIdx];
        
        car.marker.setLatLng(p1);
        
        const angle = getAngle(p1, p2);
        const el = car.marker.getElement();
        if (el) {
          const innerDiv = el.querySelector('.car-icon-wrapper');
          if (innerDiv) {
            innerDiv.style.transform = `rotate(${angle}deg)`;
          }
        }
      });
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Small delay to allow the map to bind to the container element fully
    const timeoutId = setTimeout(() => {
      animate();
    }, 500);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timeoutId);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
      map.remove();
    };
  }, []);

  return (
    <section id="hero" className="hero-section">
      {/* Live Leaflet Cyberpunk Road Map Background */}
      <div 
        id="hero-live-map" 
        style={{
          position: 'absolute',
          top: 0,
          left: '-5%',
          width: '110%',
          height: '108%',
          zIndex: 0,
          opacity: 0.65,
          pointerEvents: 'none'
        }}
      />
      <div className="hero-overlay"></div>
      
      <div className="container hero-content animate-slide-up">
        <h1 className="hero-title">
          DRIVE THE <br />
          <span className="text-gradient">EXTRAORDINARY</span>
        </h1>
        <p className="hero-subtitle">
          Experience premium luxury, performance, and comfort. Exquisite car rentals tailored for your ultimate journey in Australia.
        </p>

        {/* Glassmorphic Widget */}
        <form onSubmit={handleSearch} className="search-widget glass-panel">
          <div className="widget-item">
            <div className="widget-label-icon">
              <MapPin size={16} className="widget-icon" />
              <span className="form-label">Pick-up Location</span>
            </div>
            <select 
              value={location} 
              onChange={(e) => setLocation(e.target.value)}
              className="form-select widget-select"
            >
              <option value="Sydney Airport">Sydney Airport (SYD)</option>
              <option value="Melbourne Airport">Melbourne Airport (MEL)</option>
              <option value="Brisbane Airport">Brisbane Airport (BNE)</option>
              <option value="Gold Coast Airport">Gold Coast Airport (OOL)</option>
            </select>
          </div>

          <div className="widget-item border-left">
            <div className="widget-label-icon">
              <Calendar size={16} className="widget-icon" />
              <span className="form-label">Rental Dates</span>
            </div>
            <input 
              type="text" 
              placeholder="Select dates" 
              className="form-input widget-input" 
              onFocus={(e) => e.target.type = 'date'}
              onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
              value={dates}
              onChange={(e) => setDates(e.target.value)}
            />
          </div>

          <div className="widget-item border-left">
            <div className="widget-label-icon">
              <Car size={16} className="widget-icon" />
              <span className="form-label">Vehicle Type</span>
            </div>
            <select 
              value={vehicleType} 
              onChange={(e) => setVehicleType(e.target.value)}
              className="form-select widget-select"
            >
              <option value="All">All Tiers</option>
              <option value="Supercar">Supercar</option>
              <option value="Sports">Sports / Performance</option>
              <option value="SUV">Luxury SUV</option>
              <option value="EV">Electric (EV)</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary widget-button">
            Browse Fleet
          </button>
        </form>
      </div>
      
      <div className="hero-scroll-indicator">
        <div className="mouse-wheel"></div>
      </div>
    </section>
  );
}
