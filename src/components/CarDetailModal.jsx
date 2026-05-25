import React, { useEffect, useRef } from 'react';
import { X, Calendar, CheckCircle } from 'lucide-react';

export default function CarDetailModal({ car, isOpen, onClose, onSelectCar }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  // Fallback backdrop click detection for browsers (like Safari) without native closedby support
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleBackdropClick = (event) => {
      if (event.target !== dialog) return;

      const rect = dialog.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );

      if (!isDialogContent) {
        onClose();
      }
    };

    dialog.addEventListener('click', handleBackdropClick);
    return () => {
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose]);

  if (!car) return null;

  const handleBookNow = () => {
    onSelectCar(car);
    onClose();
    const element = document.getElementById('booking-form');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <dialog 
      ref={dialogRef} 
      onClose={onClose}
      aria-labelledby="modal-car-name"
      className="car-detail-modal"
    >
      <div className="modal-header">
        <h2 id="modal-car-name" className="modal-title">
          {car.name} <span className="modal-badge">{car.category}</span>
        </h2>
        <button 
          onClick={onClose} 
          className="btn-close-modal"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>
      </div>

      <div className="modal-content-grid">
        <div className="modal-visuals">
          <img src={car.image} alt={car.name} className="modal-image" />
          <div className="modal-price-card glass-panel">
            <span className="modal-price-amount">${car.price}</span>
            <span className="modal-price-label">AUD / day</span>
          </div>
        </div>

        <div className="modal-details">
          <p className="modal-description">{car.description}</p>
          
          <div className="modal-specifications-table">
            <div className="modal-spec-row">
              <span className="spec-label">Engine:</span>
              <span className="spec-value">{car.engine}</span>
            </div>
            <div className="modal-spec-row">
              <span className="spec-label">Acceleration:</span>
              <span className="spec-value">{car.acceleration} (0-100 km/h)</span>
            </div>
            <div className="modal-spec-row">
              <span className="spec-label">Top Speed:</span>
              <span className="spec-value">{car.topSpeed}</span>
            </div>
            <div className="modal-spec-row">
              <span className="spec-label">Transmission:</span>
              <span className="spec-value">{car.transmission}</span>
            </div>
            <div className="modal-spec-row">
              <span className="spec-label">Seats:</span>
              <span className="spec-value">{car.seats} Passengers</span>
            </div>
          </div>

          <div className="modal-features-section">
            <h3 className="features-title">Highlights & Features</h3>
            <div className="features-list">
              {car.features.map((feature, i) => (
                <div key={i} className="feature-bullet">
                  <CheckCircle size={16} className="feature-icon" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions-footer">
            <button onClick={onClose} className="btn btn-secondary">
              Back to Fleet
            </button>
            <button onClick={handleBookNow} className="btn btn-primary btn-book-cta">
              <Calendar size={18} /> Book This Vehicle
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
