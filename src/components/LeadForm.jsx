import React, { useState, useEffect } from 'react';
import { Send, Check } from 'lucide-react';
import { FLEET_DATA } from './FleetGrid';
import { db, collection, addDoc } from '../firebase';
import { syncToGoogleSheets } from '../utils/googleSheetsSync';

export default function LeadForm({ selectedCar, setSelectedCar, pricingSettings = {} }) {
  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getTomorrowString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    startDate: getTodayString(),
    endDate: getTomorrowString(),
    carId: 'All',
    message: ''
  });

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [inquiryDetails, setInquiryDetails] = useState(null);

  // Leaflet Map Initialization for pickup location
  useEffect(() => {
    const L = window.L;
    if (!L) return;

    const mapContainer = document.getElementById("pickup-location-map");
    if (!mapContainer || mapContainer._leaflet_id) return;

    // Sydney Airport (SYD) coordinates: -33.9461, 151.1772
    const map = L.map("pickup-location-map", {
      center: [-33.9461, 151.1772],
      zoom: 14,
      scrollWheelZoom: false
    });

    // Dark styled OSM tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    const marker = L.marker([-33.9461, 151.1772]).addTo(map);
    marker.bindPopup(`
      <div style="font-family: inherit; color: #fff; text-align: left; padding: 4px;">
        <strong style="color: #3acbe8; font-size: 0.95rem;">LC Rentals SYD Concierge</strong><br/>
        Sydney Airport Terminal 1 & 2<br/>
        <span style="font-size: 0.75rem; color: #aaa;">24/7 Handover Suite</span>
      </div>
    `).openPopup();

    return () => {
      map.remove();
    };
  }, [isSubmitted]);

  // Sync selected car from fleet grid clicks
  useEffect(() => {
    if (selectedCar) {
      setFormData(prev => ({ ...prev, carId: selectedCar.id }));
    }
  }, [selectedCar]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const chosenCar = FLEET_DATA.find(car => car.id === formData.carId) || { name: 'Any Available Vehicle', price: 0 };
    
    // Calculate rental days
    let days = 1;
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) days = diffDays;
    }

    const totalEstimate = chosenCar.price * days;

    const details = {
      ...formData,
      carName: chosenCar.name,
      days,
      totalEstimate,
      status: 'Pending', // New inquiries start as Pending
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, "inquiries"), details);
      setInquiryDetails(details);
      setIsSubmitted(true);

      // Sync with Google Sheets webhook
      if (pricingSettings?.googleSheetsWebhookUrl) {
        syncToGoogleSheets(pricingSettings.googleSheetsWebhookUrl, 'inquiry', details);
      }
    } catch (err) {
      console.error("Error submitting inquiry to Firestore:", err);
      alert("Failed to submit your inquiry. Please try again.");
    }
  };

  const handleReset = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      startDate: '',
      endDate: '',
      carId: 'All',
      message: ''
    });
    setIsSubmitted(false);
    setInquiryDetails(null);
    if (setSelectedCar) setSelectedCar(null);
  };

  return (
    <section id="booking-form" className="section contact-section">
      <div className="container">
        <div className="booking-grid">
          
          <div className="contact-info-panel animate-slide-up">
            <h2 className="info-title">Begin Your <br /><span className="text-gradient">Journey</span></h2>
            <p className="info-description">
              Submit your details to request a booking. A concierge executive from our VIP relations team will contact you within 15 minutes to finalize your rental agreement and secure key handover.
            </p>

            <div className="luxury-benefits">
              <div className="benefit-item">
                <div className="benefit-bullet">✓</div>
                <div>
                  <h4>Complimentary Airport Delivery</h4>
                  <p>VIP terminal handovers in Sydney, Melbourne, Brisbane & Gold Coast.</p>
                </div>
              </div>
              <div className="benefit-item">
                <div className="benefit-bullet">✓</div>
                <div>
                  <h4>Zero-Excess Protection Available</h4>
                  <p>Complete peace of mind with our optional comprehensive excess reduction cover.</p>
                </div>
              </div>
              <div className="benefit-item">
                <div className="benefit-bullet">✓</div>
                <div>
                  <h4>24/7 Roadside Concierge</h4>
                  <p>Full roadside assistance and dedicated hotlines available at all times.</p>
                </div>
              </div>
            </div>
            <div id="pickup-location-map" className="pickup-map-container" style={{ marginTop: '2rem' }}></div>
          </div>

          <div className="form-card glass-panel animate-slide-up">
            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="booking-form-element">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="name" className="form-label">Full Name</label>
                    <input 
                      type="text" 
                      id="name" 
                      name="name"
                      required
                      placeholder="e.g. Harrison Ford"
                      className="form-input"
                      value={formData.name}
                      onChange={handleInputChange}
                      autoComplete="name"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="phone" className="form-label">Phone Number</label>
                    <input 
                      type="tel" 
                      id="phone" 
                      name="phone"
                      required
                      placeholder="e.g. +61 400 123 456"
                      className="form-input"
                      value={formData.phone}
                      onChange={handleInputChange}
                      autoComplete="tel"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="email" className="form-label">Email Address</label>
                  <input 
                    type="email" 
                    id="email" 
                    name="email"
                    required
                    placeholder="e.g. harrison@luxury.com"
                    className="form-input"
                    value={formData.email}
                    onChange={handleInputChange}
                    autoComplete="email"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="startDate" className="form-label">Pick-up Date</label>
                    <input 
                      type="date" 
                      id="startDate" 
                      name="startDate"
                      required
                      min={getTodayString()}
                      className="form-input"
                      value={formData.startDate}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="endDate" className="form-label">Return Date</label>
                    <input 
                      type="date" 
                      id="endDate" 
                      name="endDate"
                      required
                      min={formData.startDate || getTodayString()}
                      className="form-input"
                      value={formData.endDate}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="carId" className="form-label">Select Vehicle</label>
                  <select 
                    id="carId" 
                    name="carId"
                    className="form-select"
                    value={formData.carId}
                    onChange={handleInputChange}
                  >
                    <option value="All">Select a vehicle model</option>
                    {FLEET_DATA.map(car => (
                      <option key={car.id} value={car.id}>{car.name} — ${car.price} AUD/day</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="message" className="form-label">Special Requests (Optional)</label>
                  <textarea 
                    id="message" 
                    name="message"
                    rows="3"
                    placeholder="E.g. Airport terminal delivery request, GPS, Child Seats..."
                    className="form-input form-textarea"
                    value={formData.message}
                    onChange={handleInputChange}
                  ></textarea>
                </div>

                <button type="submit" className="btn btn-primary btn-submit-form">
                  <Send size={16} /> Submit Inquiry
                </button>
              </form>
            ) : (
              <div className="success-message-wrapper">
                <div className="success-icon-badge">
                  <Check size={32} />
                </div>
                <h3 className="success-title">Inquiry Submitted Successfully</h3>
                <p className="success-desc">
                  Thank you, <strong>{inquiryDetails.name}</strong>. Your rental request has been logged. Our concierge team will review the availability of the <strong>{inquiryDetails.carName}</strong> and contact you at <strong>{inquiryDetails.phone}</strong> shortly.
                </p>

                <div className="summary-card glass-panel">
                  <h4 className="summary-title">Rental Estimate Summary</h4>
                  <div className="summary-row">
                    <span>Vehicle:</span>
                    <strong>{inquiryDetails.carName}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Duration:</span>
                    <strong>{inquiryDetails.days} day{inquiryDetails.days > 1 ? 's' : ''}</strong>
                  </div>
                  <div className="summary-row border-top-glow">
                    <span>Estimated Total:</span>
                    <strong className="summary-accent">${inquiryDetails.totalEstimate.toLocaleString()} AUD</strong>
                  </div>
                </div>

                <button onClick={handleReset} className="btn btn-secondary w-full">
                  Submit Another Inquiry
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
