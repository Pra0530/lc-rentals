import React, { useEffect } from 'react';
import { Gauge, Zap, Users, Info } from 'lucide-react';

export const FLEET_DATA = [
  {
    id: 'mclaren-720s',
    name: 'McLaren 720S',
    category: 'Supercar',
    price: 1490,
    image: '/mclaren.png',
    engine: '4.0L Twin-Turbo V8',
    acceleration: '2.9s',
    topSpeed: '341 km/h',
    seats: 2,
    transmission: '7-Speed Dual-Clutch',
    features: ['Carbon Fiber Chassis', 'Active Aerodynamics', 'Proactive Chassis Control II', 'Variable Drift Control', 'Carbon Ceramic Brakes'],
    description: 'The McLaren 720S is a masterpiece of supercar design. With a stunning twin-turbo V8 producing 710 horsepower, it delivers blistering acceleration and razor-sharp handling that redefines what a supercar can be.'
  },
  {
    id: 'porsche-911',
    name: 'Porsche 911 GT3',
    category: 'Sports',
    price: 890,
    image: '/porsche.png',
    engine: '4.0L Naturally Aspirated Flat-6',
    acceleration: '3.4s',
    topSpeed: '318 km/h',
    seats: 2,
    transmission: '7-Speed PDK',
    features: ['Rear-Wheel Steering', 'Carbon Fiber Rear Wing', 'Sport Exhaust System', 'Chrono Package', 'Bose Surround Sound'],
    description: 'Engineered for the track but built for the road, the Porsche 911 GT3 offers pure, unadulterated sports driving feedback. The screaming flat-6 engine revs up to 9,000 RPM, creating an unmatched auditory experience.'
  },
  {
    id: 'range-rover',
    name: 'Range Rover Autobiography',
    category: 'SUV',
    price: 590,
    image: '/range_rover.png',
    engine: '4.4L Twin-Turbo V8',
    acceleration: '4.6s',
    topSpeed: '250 km/h',
    seats: 5,
    transmission: '8-Speed Automatic',
    features: ['Executive Class Seating', 'Meridian Signature Audio', 'Panoramic Sunroof', 'All-Wheel Steering', 'Air Suspension'],
    description: 'The pinnacle of luxury SUVs, the Range Rover Autobiography combines peerless luxury, silent cabin refinement, and effortlessly powerful performance. Perfect for executive travel and long-distance comfort.'
  },
  {
    id: 'tesla-s',
    name: 'Tesla Model S Plaid',
    category: 'EV',
    price: 510,
    image: '/tesla.png',
    engine: 'Tri-Motor AWD (1020 hp)',
    acceleration: '2.1s',
    topSpeed: '322 km/h',
    seats: 5,
    transmission: 'Single-Speed Direct',
    features: ['Yoke Steering Option', '17-inch Cinematic Screen', 'Autopilot Capabilities', 'Tri-Zone Climate Control', 'Ludicrous Acceleration Mode'],
    description: 'Experience electric performance taken to the extreme. The Tesla Model S Plaid accelerates from 0 to 100 km/h in an astonishing 2.1 seconds. Combined with a luxurious, futuristic cabin, it represents the future of executive driving.'
  }
];

export default function FleetGrid({ activeFilter, setActiveFilter, onViewDetails, onInquire, fleetOverride }) {
  const currentFleet = fleetOverride || FLEET_DATA;
  
  const filteredFleet = activeFilter === 'All' 
    ? currentFleet 
    : currentFleet.filter(car => car.category === activeFilter);

  return (
    <section id="fleet" className="section fleet-section">
      <div className="container">
        <div className="section-title-wrap animate-slide-up">
          <h2 className="section-title">Explore Our <span className="text-gradient">Elite Fleet</span></h2>
          <p className="section-subtitle">
            Choose from our highly curated list of supercars, high-performance sports cars, luxury SUVs, and cutting-edge electric vehicles.
          </p>
        </div>

        {/* Filter Categories */}
        <div className="filter-container">
          {['All', 'Supercar', 'Sports', 'SUV', 'EV'].map((cat) => (
            <button 
              key={cat} 
              className={`filter-btn ${activeFilter === cat ? 'filter-active' : ''}`}
              onClick={() => setActiveFilter(cat)}
            >
              {cat === 'All' ? 'All Tiers' : cat === 'Sports' ? 'Sports / Performance' : cat === 'SUV' ? 'Luxury SUV' : cat === 'EV' ? 'Electric (EV)' : cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="fleet-grid">
          {filteredFleet.map((car) => (
            <div key={car.id} className="glass-card car-card">
              <div className="car-image-container">
                <img src={car.image} alt={car.name} className="car-image" />
                <span className="car-badge">{car.category}</span>
              </div>

              <div className="car-info">
                <h3 className="car-name">{car.name}</h3>
                
                <div className="car-specs-brief">
                  <div className="spec-item">
                    <Gauge size={16} className="spec-icon" />
                    <span>{car.topSpeed}</span>
                  </div>
                  <div className="spec-item">
                    <Zap size={16} className="spec-icon" />
                    <span>{car.acceleration} (0-100)</span>
                  </div>
                  <div className="spec-item">
                    <Users size={16} className="spec-icon" />
                    <span>{car.seats} Seats</span>
                  </div>
                </div>

                <div className="car-footer">
                  <div className="car-price-wrap">
                    <span className="car-price">${car.price}</span>
                    <span className="car-price-label">AUD / day</span>
                  </div>
                  <div className="car-actions">
                    <button 
                      className="btn btn-secondary btn-icon-only" 
                      onClick={() => onViewDetails(car)}
                      title="View Details"
                      aria-label={`View details for ${car.name}`}
                    >
                      <Info size={18} />
                    </button>
                    <button 
                      className="btn btn-primary" 
                      onClick={() => onInquire(car)}
                    >
                      Rent Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
