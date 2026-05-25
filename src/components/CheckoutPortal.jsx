import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowLeft, CreditCard, Sparkles, Download, CheckCircle2 } from 'lucide-react';

export default function CheckoutPortal({ car, user, isOpen, onClose, onBookingSuccess }) {
  const [useInsurance, setUseInsurance] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signature, setSignature] = useState('');
  
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    return today.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() + 4);
    return today.toISOString().split('T')[0];
  });

  const [paymentData, setPaymentData] = useState({
    cardNumber: '',
    cardExpiry: '',
    cardCvc: '',
    cardName: user ? user.name : '',
    postcode: ''
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [bookingDetails, setBookingDetails] = useState(null);

  // Price calculations
  const [days, setDays] = useState(3);
  
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDays(diffDays > 0 ? diffDays : 1);
    }
  }, [startDate, endDate]);

  if (!isOpen || !car) return null;

  const basePrice = car.price * days;
  const insurancePrice = useInsurance ? 50 * days : 0;
  const subtotal = basePrice + insurancePrice;
  const gst = Math.round(subtotal * 0.1); // GST in Australia is 10%
  const total = subtotal + gst;
  const depositHold = car.category === 'Supercar' ? 750 : car.category === 'EV' ? 500 : 350;

  const handleCardInputChange = (e) => {
    let { name, value } = e.target;
    
    // Format card number with spaces
    if (name === 'cardNumber') {
      value = value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim();
      if (value.length > 19) value = value.substring(0, 19);
    }
    // Format expiry Date MM/YY
    if (name === 'cardExpiry') {
      value = value.replace(/\//g, '');
      if (value.length > 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
      }
      if (value.length > 5) value = value.substring(0, 5);
    }
    // Format CVC
    if (name === 'cardCvc') {
      value = value.replace(/\D/g, '');
      if (value.length > 3) value = value.substring(0, 3);
    }

    setPaymentData(prev => ({ ...prev, [name]: value }));
  };

  const handlePay = (e) => {
    e.preventDefault();
    if (!agreedToTerms || !signature) {
      alert('Please read and sign the rental agreement before payment.');
      return;
    }

    setIsProcessing(true);

    // Simulate payment transaction
    setTimeout(() => {
      setIsProcessing(false);
      setIsDone(true);
      
      const referenceNumber = 'LC-' + Math.floor(100000 + Math.random() * 900000);
      const details = {
        referenceNumber,
        carName: car.name,
        carCategory: car.category,
        days,
        startDate,
        endDate,
        basePrice,
        insurancePrice,
        gst,
        total,
        depositHold,
        renterName: paymentData.cardName || (user ? user.name : 'Valued Renter'),
        signature
      };
      
      setBookingDetails(details);

      // Save booking in registered user history in localStorage
      const users = JSON.parse(localStorage.getItem('registered_users') || '[]');
      const activeUser = JSON.parse(localStorage.getItem('active_user'));
      
      if (activeUser) {
        const updatedUsers = users.map(u => {
          if (u.email.toLowerCase() === activeUser.email.toLowerCase()) {
            return {
              ...u,
              bookings: [...(u.bookings || []), details]
            };
          }
          return u;
        });
        localStorage.setItem('registered_users', JSON.stringify(updatedUsers));
      }
      
      if (onBookingSuccess) {
        onBookingSuccess(details);
      }
    }, 2500);
  };

  return (
    <div className="checkout-portal-overlay">
      
      {!isDone ? (
        <div className="checkout-portal-container">
          {/* Back button */}
          <button onClick={onClose} className="checkout-back-btn">
            <ArrowLeft size={16} /> Back to LC Rentals
          </button>

          <div className="checkout-split-layout">
            
            {/* Left Panel: Invoice & Branding */}
            <div className="checkout-invoice-panel">
              <div className="checkout-brand">
                <span className="brand-l">L</span>
                <span className="brand-c">C</span>
                <span className="brand-text">RENTALS</span>
                <span className="checkout-badge-secure"><ShieldCheck size={14} /> SECURE CHECKOUT</span>
              </div>

              <div className="checkout-selected-car">
                <img src={car.image} alt={car.name} className="checkout-car-image" />
                <div>
                  <h3 className="checkout-car-title">{car.name}</h3>
                  <span className="checkout-car-cat">{car.category} Tier</span>
                </div>
              </div>

              <div className="checkout-dates-adjustment">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label font-small">Start Date</label>
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)}
                      className="form-input widget-date-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label font-small">End Date</label>
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)}
                      className="form-input widget-date-input"
                    />
                  </div>
                </div>
              </div>

              <div className="checkout-pricing-ledger">
                <div className="ledger-row">
                  <span>Daily Base Rate</span>
                  <span>${car.price} AUD</span>
                </div>
                <div className="ledger-row">
                  <span>Duration</span>
                  <span>{days} day{days > 1 ? 's' : ''}</span>
                </div>
                <div className="ledger-row border-top-thin">
                  <span>Base Booking Cost</span>
                  <span>${basePrice.toLocaleString()} AUD</span>
                </div>

                <div className="ledger-insurance-toggle glass-panel">
                  <div className="toggle-info">
                    <ShieldCheck size={18} className="toggle-icon-gold" />
                    <div>
                      <h4 className="font-small font-bold">Excess Reduction Cover</h4>
                      <p className="font-tiny">Reduce collision liability limit to $0. +$50 AUD/day.</p>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={useInsurance} 
                    onChange={(e) => setUseInsurance(e.target.checked)} 
                    className="toggle-checkbox"
                    id="insurance-checkbox"
                  />
                </div>

                {useInsurance && (
                  <div className="ledger-row">
                    <span>Excess Protection ({days} days)</span>
                    <span>${insurancePrice.toLocaleString()} AUD</span>
                  </div>
                )}

                <div className="ledger-row">
                  <span>GST (10%)</span>
                  <span>${gst.toLocaleString()} AUD</span>
                </div>

                <div className="ledger-row total-row">
                  <span>Total Amount</span>
                  <span className="total-gold">${total.toLocaleString()} AUD</span>
                </div>

                <div className="ledger-row deposit-row font-tiny">
                  <span>Refundable Security Deposit hold</span>
                  <span>${depositHold} AUD</span>
                </div>
              </div>
            </div>

            {/* Right Panel: Agreement & Payment details */}
            <div className="checkout-payment-panel">
              
              {isProcessing ? (
                <div className="checkout-loading-screen">
                  <div className="stripe-spinner"></div>
                  <h3>Processing Secure Payment</h3>
                  <p className="font-small">Contacting bank gateway in Sydney. Do not refresh...</p>
                </div>
              ) : (
                <form onSubmit={handlePay} className="checkout-form">
                  
                  {/* Section 1: Agreement signing */}
                  <div className="checkout-section-block">
                    <h3 className="section-block-title">1. Rental Agreement Sign-off</h3>
                    <div className="scrollable-agreement-terms">
                      <h4>LC RENTALS STANDARD LEASE CLAUSES</h4>
                      <p>1. <strong>Driver Qualification:</strong> The Renter certifies that they are 21+ years of age, hold a valid driver license, and have provided accurate identity documents.</p>
                      <p>2. <strong>Insurance Excess:</strong> Under standard rates, excess damage liability is capped. If Excess Reduction is selected, liability is reduced to $0 AUD, excluding vehicle misuse or off-road driving.</p>
                      <p>3. <strong>Prohibited Conduct:</strong> No smoking, vaping, track racing, animal transit, or crossing state boundaries without company prior written consent. Violations incur a $250 AUD detailing fee.</p>
                      <p>4. <strong>Late Return Policy:</strong> A late fee of $50.00 AUD per hour applies for vehicle returns delayed by more than 29 minutes past the scheduled return time.</p>
                    </div>
                    
                    <div className="form-group margin-top-small">
                      <label className="form-label" htmlFor="signature-input">Digital Signature (Type Full Name)</label>
                      <input 
                        type="text" 
                        required
                        id="signature-input"
                        placeholder="e.g. Harrison Ford"
                        className="form-input signature-input-font"
                        value={signature}
                        onChange={(e) => setSignature(e.target.value)}
                      />
                    </div>

                    <div className="terms-checkbox-wrap">
                      <input 
                        type="checkbox" 
                        required
                        id="agree-checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                      />
                      <label htmlFor="agree-checkbox" className="font-small cursor-pointer">
                        I accept the terms and conditions outlined in the rental agreement.
                      </label>
                    </div>
                  </div>

                  {/* Section 2: Credit Card Payment */}
                  <div className="checkout-section-block">
                    <h3 className="section-block-title">2. Card Information</h3>
                    <div className="stripe-card-group">
                      <div className="card-input-wrapper">
                        <CreditCard size={18} className="card-input-icon" />
                        <input 
                          type="text"
                          name="cardNumber"
                          required
                          placeholder="Card Number"
                          className="card-field-input"
                          value={paymentData.cardNumber}
                          onChange={handleCardInputChange}
                        />
                      </div>
                      
                      <div className="card-input-subfields">
                        <input 
                          type="text"
                          name="cardExpiry"
                          required
                          placeholder="MM/YY"
                          className="card-subfield-input"
                          value={paymentData.cardExpiry}
                          onChange={handleCardInputChange}
                        />
                        <input 
                          type="text"
                          name="cardCvc"
                          required
                          placeholder="CVC"
                          className="card-subfield-input border-left-thin"
                          value={paymentData.cardCvc}
                          onChange={handleCardInputChange}
                        />
                      </div>
                    </div>

                    <div className="form-row margin-top-small">
                      <div className="form-group">
                        <label className="form-label font-small">Cardholder Name</label>
                        <input 
                          type="text"
                          name="cardName"
                          required
                          placeholder="e.g. Harrison Ford"
                          className="form-input"
                          value={paymentData.cardName}
                          onChange={(e) => setPaymentData(prev => ({ ...prev, cardName: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label font-small">Billing Postcode</label>
                        <input 
                          type="text"
                          name="postcode"
                          required
                          placeholder="e.g. 2000"
                          className="form-input"
                          value={paymentData.postcode}
                          onChange={(e) => setPaymentData(prev => ({ ...prev, postcode: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary btn-checkout-submit">
                    <Sparkles size={16} /> Pay &amp; Reserve (${total.toLocaleString()} AUD)
                  </button>

                  <p className="payment-security-notice">
                    🔒 Payments are processed using 256-bit encryption. Local secure transaction powered by simulated Stripe engine.
                  </p>
                </form>
              )}
            </div>

          </div>
        </div>
      ) : (
        /* Success Overlay Screen */
        <div className="checkout-success-container glass-panel animate-slide-up">
          <div className="success-icon-badge">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="success-title">Booking Secured</h2>
          <p className="success-desc">
            Your payment of <strong>${bookingDetails.total.toLocaleString()} AUD</strong> has been processed successfully. Your reference code is <strong>{bookingDetails.referenceNumber}</strong>. A receipt has been saved under your profile.
          </p>

          <div className="receipt-invoice-bill glass-panel">
            <div className="bill-header">
              <h3>LC RENTALS INVOICE</h3>
              <span>Reference: {bookingDetails.referenceNumber}</span>
            </div>
            
            <div className="bill-details">
              <div className="bill-row">
                <span>Renter Name:</span>
                <strong>{bookingDetails.renterName}</strong>
              </div>
              <div className="bill-row">
                <span>Vehicle Model:</span>
                <strong>{bookingDetails.carName}</strong>
              </div>
              <div className="bill-row">
                <span>Duration:</span>
                <strong>{bookingDetails.days} day{bookingDetails.days > 1 ? 's' : ''} ({bookingDetails.startDate} to {bookingDetails.endDate})</strong>
              </div>
              <div className="bill-row border-top-thin">
                <span>Base Cost:</span>
                <span>${bookingDetails.basePrice.toLocaleString()} AUD</span>
              </div>
              {bookingDetails.insurancePrice > 0 && (
                <div className="bill-row">
                  <span>Excess Protection Cover:</span>
                  <span>${bookingDetails.insurancePrice.toLocaleString()} AUD</span>
                </div>
              )}
              <div className="bill-row">
                <span>GST:</span>
                <span>${bookingDetails.gst.toLocaleString()} AUD</span>
              </div>
              <div className="bill-row bill-grand-total border-top-glow">
                <span>Total Paid:</span>
                <span className="total-gold">${bookingDetails.total.toLocaleString()} AUD</span>
              </div>
              <div className="bill-row deposit-row font-tiny">
                <span>Security Deposit Held (Hold Status):</span>
                <span>${bookingDetails.depositHold} AUD</span>
              </div>
            </div>
          </div>

          <div className="success-actions">
            <button 
              onClick={() => {
                alert("Simulating Invoice PDF download. Invoice file generated successfully.");
              }} 
              className="btn btn-secondary"
            >
              <Download size={16} /> Download Invoice
            </button>
            <button onClick={onClose} className="btn btn-primary">
              Return to Website
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
