import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowLeft, CreditCard, Sparkles, Download, CheckCircle2 } from 'lucide-react';
import { db, collection, addDoc } from '../firebase';
import { jsPDF } from 'jspdf';
import { syncToGoogleSheets } from '../utils/googleSheetsSync';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { calculateDynamicPrice } from '../utils/pricingCalculator';

// Initialize Stripe promise only if publishable key is present and configured
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const isStripeConfigured = !!(
  stripePublishableKey &&
  stripePublishableKey !== 'your-publishable-key-here' &&
  stripePublishableKey.trim() !== ''
);

const stripePromise = isStripeConfigured ? loadStripe(stripePublishableKey) : null;

const stripeElementOptions = {
  style: {
    base: {
      color: '#F1F1F4',
      fontFamily: 'Outfit, Inter, sans-serif',
      fontSize: '15px',
      '::placeholder': {
        color: '#8c8c93'
      },
      iconColor: '#3acbe8'
    },
    invalid: {
      color: '#ff4d4d',
      iconColor: '#ff4d4d'
    }
  }
};

function CheckoutPortalInner({ car, user, isOpen, onClose, onBookingSuccess, fleet = [], bookings = [], pricingSettings = {} }) {
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

  const [useInsurance, setUseInsurance] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signature, setSignature] = useState('');
  
  const [startDate, setStartDate] = useState(getTodayString());
  const [endDate, setEndDate] = useState(getTomorrowString());

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

  const stripe = isStripeConfigured ? useStripe() : null;
  const elements = isStripeConfigured ? useElements() : null;

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

  const activeRentalsCount = bookings.filter(b => b.status === 'Active').length;
  const totalFleetCount = fleet.filter(c => c.status !== 'Maintenance').length;

  const dynamicPricing = calculateDynamicPrice(
    car.price,
    startDate,
    endDate,
    activeRentalsCount,
    totalFleetCount,
    pricingSettings
  );

  const basePrice = dynamicPricing.basePrice;
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

  const handlePay = async (e) => {
    e.preventDefault();
    if (!agreedToTerms || !signature) {
      alert('Please read and sign the rental agreement before payment.');
      return;
    }

    setIsProcessing(true);

    if (isStripeConfigured) {
      if (!stripe || !elements) {
        alert('Stripe payment elements are loading. Please try again in a moment.');
        setIsProcessing(false);
        return;
      }

      try {
        // 1. Request a PaymentIntent Client Secret from the serverless API
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            carId: car.id,
            days,
            startDate,
            endDate,
            useInsurance,
            renterName: paymentData.cardName || (user ? user.name : 'Valued Renter')
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to initialize payment gateway.');
        }

        const { clientSecret } = await response.json();

        // 2. Complete payment directly with Stripe SDK
        const result = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: elements.getElement(CardNumberElement),
            billing_details: {
              name: paymentData.cardName || (user ? user.name : 'Valued Renter'),
              address: {
                postal_code: paymentData.postcode
              }
            }
          }
        });

        if (result.error) {
          throw new Error(result.error.message);
        }

        if (result.paymentIntent.status === 'succeeded') {
          // 3. Save booking details to Firestore on success
          const referenceNumber = 'LC-' + Math.floor(100000 + Math.random() * 900000);
          const details = {
            referenceNumber,
            carId: car.id,
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
            signature,
            userId: user ? user.uid : 'anonymous',
            userEmail: user ? user.email : 'anonymous',
            status: 'Pending', // New bookings start as Pending for admin review
            cardBrand: 'Visa',
            cardLast4: '4242',
            stripePaymentIntentId: result.paymentIntent.id,
            createdAt: new Date().toISOString()
          };

          await addDoc(collection(db, "bookings"), details);
          setBookingDetails(details);
          setIsProcessing(false);
          setIsDone(true);
          
          // Sync with Google Sheets webhook
          if (pricingSettings?.googleSheetsWebhookUrl) {
            syncToGoogleSheets(pricingSettings.googleSheetsWebhookUrl, 'booking', details);
          }

          if (onBookingSuccess) {
            onBookingSuccess(details);
          }
        } else {
          throw new Error('Authorized charge failed. Payment status: ' + result.paymentIntent.status);
        }
      } catch (err) {
        console.error("Stripe payment processing failed:", err);
        alert(err.message || "Failed to process card payment. Please double-check details.");
        setIsProcessing(false);
      }
    } else {
      // Legacy Mock Simulation Mode
      setTimeout(async () => {
        const referenceNumber = 'LC-' + Math.floor(100000 + Math.random() * 900000);
        const rawCard = paymentData.cardNumber.replace(/\s+/g, '');
        const cardLast4 = rawCard.length >= 4 ? rawCard.slice(-4) : '4242';
        const cardBrand = rawCard.startsWith('5') ? 'Mastercard' : rawCard.startsWith('3') ? 'Amex' : 'Visa';

        const details = {
          referenceNumber,
          carId: car.id,
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
          signature,
          userId: user ? user.uid : 'anonymous',
          userEmail: user ? user.email : 'anonymous',
          status: 'Pending',
          cardBrand,
          cardLast4,
          createdAt: new Date().toISOString()
        };
        
        try {
          await addDoc(collection(db, "bookings"), details);
          setBookingDetails(details);
          setIsProcessing(false);
          setIsDone(true);
          
          // Sync with Google Sheets webhook
          if (pricingSettings?.googleSheetsWebhookUrl) {
            syncToGoogleSheets(pricingSettings.googleSheetsWebhookUrl, 'booking', details);
          }

          if (onBookingSuccess) {
            onBookingSuccess(details);
          }
        } catch (err) {
          console.error("Error creating booking in Firestore:", err);
          setIsProcessing(false);
          alert("Failed to secure your booking. Please try again.");
        }
      }, 2500);
    }
  };

  const downloadInvoicePDF = () => {
    if (!bookingDetails) return;
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Dark charcoal background header
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, 210, 50, 'F');

    // LC Rentals Logo / Branding in Cyan
    doc.setTextColor(58, 203, 232); // Cyan color
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text("L C   R E N T A L S", 20, 30);
    
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(10);
    doc.text("L U X U R Y  &  E X O T I C  C A R S", 20, 38);

    // Secure Invoice Badge
    doc.setFillColor(58, 203, 232);
    doc.rect(140, 20, 50, 10, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.text("SECURE INVOICE", 146, 26);

    // Bill To details
    doc.setTextColor(40, 40, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("BILL TO:", 20, 70);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Renter: ${bookingDetails.renterName}`, 20, 78);
    doc.text(`Email: ${bookingDetails.userEmail || 'Valued Customer'}`, 20, 84);
    doc.text(`Sign-off Name: ${bookingDetails.signature}`, 20, 90);

    // Invoice Meta details
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE DETAILS:", 120, 70);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Ref Number: ${bookingDetails.referenceNumber}`, 120, 78);
    doc.text(`Date Issued: ${new Date().toLocaleDateString()}`, 120, 84);
    doc.text(`Billing Currency: AUD ($)`, 120, 90);

    // Itemized table header
    doc.setFillColor(240, 240, 240);
    doc.rect(20, 105, 170, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("Description", 25, 110);
    doc.text("Duration", 105, 110);
    doc.text("Total Price", 155, 110);

    // Itemized lines
    doc.setFont("helvetica", "normal");
    doc.text(`${bookingDetails.carName} (${bookingDetails.carCategory})`, 25, 122);
    doc.text(`${bookingDetails.days} day(s)`, 105, 122);
    doc.text(`$${bookingDetails.basePrice.toLocaleString()} AUD`, 155, 122);

    let yPos = 130;
    if (bookingDetails.insurancePrice > 0) {
      doc.text("Excess Reduction Cover ($50/day)", 25, yPos);
      doc.text(`${bookingDetails.days} day(s)`, 105, yPos);
      doc.text(`$${bookingDetails.insurancePrice.toLocaleString()} AUD`, 155, yPos);
      yPos += 8;
    }

    doc.text("GST (10%)", 25, yPos);
    doc.text("-", 105, yPos);
    doc.text(`$${bookingDetails.gst.toLocaleString()} AUD`, 155, yPos);
    yPos += 12;

    // Grand Total
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPos - 6, 190, yPos - 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Grand Total (Paid):", 95, yPos);
    doc.setTextColor(58, 203, 232);
    doc.text(`$${bookingDetails.total.toLocaleString()} AUD`, 150, yPos);

    // Security deposit hold details
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`* Refundable Security Deposit hold: $${bookingDetails.depositHold} AUD is authorized on card.`, 20, yPos + 12);

    // Digital signature block
    doc.setDrawColor(58, 203, 232);
    doc.line(20, 220, 90, 220);
    doc.text("Renter Digital Signature", 20, 225);
    doc.setFont("courier", "italic");
    doc.setFontSize(12);
    doc.text(`// ${bookingDetails.signature} //`, 25, 215);

    // Terms footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Thank you for choosing LC Rentals. Live elite, drive exotics.", 20, 260);
    doc.text("For customer roadside support or billing inquiries: concierge@lcrentals.com.au", 20, 265);

    // Save PDF file
    doc.save(`LC-Rentals-Invoice-${bookingDetails.referenceNumber}.pdf`);
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
                      min={getTodayString()}
                      className="form-input widget-date-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label font-small">End Date</label>
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate || getTodayString()}
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

                {dynamicPricing.weekendDays > 0 && (
                  <div className="ledger-row dynamic-pricing-info font-tiny text-muted">
                    <span>Weekend Days ({dynamicPricing.weekendDays}d)</span>
                    <span className="text-cyan">+{Math.round(((pricingSettings.weekendMultiplier || 1.15) - 1) * 100)}% surge applied</span>
                  </div>
                )}

                {dynamicPricing.utilizationSurchargeMultiplier > 0 && (
                  <div className="ledger-row dynamic-pricing-info font-tiny text-muted animate-pulse">
                    <span>🔥 High Demand Surcharge</span>
                    <span className="text-cyan">+{Math.round(dynamicPricing.utilizationSurchargeMultiplier * 100)}% ({activeRentalsCount}/{totalFleetCount} active)</span>
                  </div>
                )}

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
                      {isStripeConfigured ? (
                        <>
                          <div className="card-input-wrapper">
                            <CreditCard size={18} className="card-input-icon" />
                            <div className="card-field-input-stripe">
                              <CardNumberElement options={stripeElementOptions} />
                            </div>
                          </div>
                          
                          <div className="card-input-subfields">
                            <div className="card-subfield-input-stripe">
                              <CardExpiryElement options={stripeElementOptions} />
                            </div>
                            <div className="card-subfield-input-stripe border-left-thin">
                              <CardCvcElement options={stripeElementOptions} />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
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
                    🔒 Payments are processed using 256-bit encryption. {isStripeConfigured ? 'Transaction secured by Stripe.' : 'Local secure transaction powered by simulated Stripe engine.'}
                  </p>
                  
                  {!isStripeConfigured && (
                    <p className="demo-mode-notice">
                      ⚡ Demo Mode: Using local payment simulator (Stripe keys not configured)
                    </p>
                  )}
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
              onClick={downloadInvoicePDF} 
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

export default function CheckoutPortal(props) {
  if (!props.isOpen || !props.car) return null;

  if (isStripeConfigured) {
    return (
      <Elements stripe={stripePromise}>
        <CheckoutPortalInner {...props} />
      </Elements>
    );
  }
  return <CheckoutPortalInner {...props} />;
}
