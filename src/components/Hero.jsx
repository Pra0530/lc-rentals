import React, { useState } from 'react';
import { MapPin, Calendar, Car } from 'lucide-react';

export default function Hero({ onSearch }) {
  const [location, setLocation] = useState('Sydney Airport');
  const [dates, setDates] = useState('');
  const [vehicleType, setVehicleType] = useState('All');

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

  return (
    <section id="hero" className="hero-section">
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
