import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FAQ_ITEMS = [
  {
    question: "How do I book a vehicle with LC Rentals?",
    answer: "Booking is simple. Select your vehicle from our fleet and submit a rental inquiry via our Booking Form. A VIP Concierge manager will contact you within 15 minutes to verify details, draft the electronic rental agreement, and set up your delivery schedule."
  },
  {
    question: "What are the driver license requirements in Australia?",
    answer: "You must hold a full, valid driver license (provisional licenses are not accepted). If your license is not in English, you must present a certified translation or an International Driving Permit (IDP) alongside your national license. Drivers must be 21 years of age or older."
  },
  {
    question: "Is a security deposit required?",
    answer: "Yes. A security deposit pre-authorization hold is placed on your credit card at the time of key handover. The hold amount varies by vehicle tier: $350 AUD for Luxury SUVs, $500 AUD for Electric Vehicles, and $750 AUD for Supercars. Deposits are released automatically within 3-5 business days upon returning the vehicle undamaged."
  },
  {
    question: "What is your fuel and battery policy?",
    answer: "Vehicles are handed over with a full tank of fuel (or 80%+ electric charge for EVs) and should be returned at the same level. A refueling charge of $3.50 AUD per litre plus a $25 AUD admin fee applies if returned under-filled."
  },
  {
    question: "Do you offer airport deliveries?",
    answer: "Absolutely. We offer complimentary airport terminal handovers at Sydney (SYD), Melbourne (MEL), Brisbane (BNE), and Gold Coast (OOL) airports. Your designated concierge will meet you directly at the VIP arrivals area or terminal valet parking."
  }
];

export default function FAQ() {
  const [activeIndex, setActiveIndex] = useState(null);

  const toggleAccordion = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <section id="faq" className="section faq-section">
      <div className="container">
        <div className="section-title-wrap animate-slide-up">
          <h2 className="section-title">Frequently Asked <span className="text-gradient">Questions</span></h2>
          <p className="section-subtitle">
            Find answers to common questions about our booking procedures, insurance policies, and concierge handover services.
          </p>
        </div>

        <div className="faq-list max-w-3xl mx-auto">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = activeIndex === index;
            return (
              <div 
                key={index} 
                className={`faq-item glass-card ${isOpen ? 'faq-item-open' : ''}`}
                onClick={() => toggleAccordion(index)}
              >
                <div className="faq-question-wrap">
                  <h3 className="faq-question">{item.question}</h3>
                  <span className="faq-icon-toggle">
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </span>
                </div>
                
                <div className={`faq-answer-wrap ${isOpen ? 'answer-open' : ''}`}>
                  <p className="faq-answer">{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
