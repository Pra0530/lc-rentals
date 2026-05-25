import React from 'react';
import { Key, ShieldAlert, Award } from 'lucide-react';

const SERVICES = [
  {
    icon: <Key size={28} />,
    title: 'Bespoke Concierge Delivery',
    desc: 'We deliver and collect your selected vehicle directly at your airport terminal, luxury hotel lobby, or private residence.'
  },
  {
    icon: <ShieldAlert size={28} />,
    title: 'VIP Chauffeur Services',
    desc: 'Sit back and enjoy the ride. Our professional, discreet chauffeurs are available for events, business trips, and tours.'
  },
  {
    icon: <Award size={28} />,
    title: 'Corporate Solutions',
    desc: 'Tailored monthly fleet subscriptions for companies, executives, and high-net-worth clients with priority switches.'
  }
];

export default function Experiences() {
  return (
    <section id="experiences" className="section experiences-section">
      <div className="container">
        
        <div className="section-title-wrap animate-slide-up">
          <h2 className="section-title">Luxury <span className="text-gradient">Experiences</span></h2>
          <p className="section-subtitle">
            Beyond standard rentals—we provide high-touch luxury mobility services designed around your schedule and comfort.
          </p>
        </div>

        <div className="services-grid">
          {SERVICES.map((srv, idx) => (
            <div key={idx} className="glass-card service-card animate-slide-up">
              <div className="service-icon-wrap">
                {srv.icon}
              </div>
              <h3 className="service-title">{srv.title}</h3>
              <p className="service-desc">{srv.desc}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
