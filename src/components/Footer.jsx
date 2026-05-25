import React from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="footer-container">
      <div className="container footer-content">
        
        <div className="footer-brand-section">
          <div className="navbar-brand footer-brand" onClick={() => scrollToSection('hero')}>
            <span className="brand-l">L</span>
            <span className="brand-c">C</span>
            <span className="brand-text">RENTALS</span>
          </div>
          <p className="footer-brand-desc">
            Australia's leading provider of premium luxury, supercar, and performance car rentals. Drive the extraordinary today.
          </p>
          <div className="footer-socials">
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="social-icon-btn" aria-label="Instagram">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
            </a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="social-icon-btn" aria-label="Facebook">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="social-icon-btn" aria-label="Twitter">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>
            </a>
          </div>
        </div>

        <div className="footer-links-column">
          <h4 className="footer-column-title">Quick Links</h4>
          <ul className="footer-links-list">
            <li onClick={() => scrollToSection('fleet')}>Fleet</li>
            <li onClick={() => scrollToSection('experiences')}>Experiences</li>
            <li onClick={() => scrollToSection('faq')}>FAQ</li>
            <li onClick={() => scrollToSection('booking-form')}>Book Now</li>
          </ul>
        </div>

        <div className="footer-links-column">
          <h4 className="footer-column-title">Locations</h4>
          <ul className="footer-locations-list">
            <li>
              <MapPin size={14} className="location-icon" />
              <span>Sydney Mascot Terminal</span>
            </li>
            <li>
              <MapPin size={14} className="location-icon" />
              <span>Melbourne Tullamarine</span>
            </li>
            <li>
              <MapPin size={14} className="location-icon" />
              <span>Brisbane Airport Valet</span>
            </li>
            <li>
              <MapPin size={14} className="location-icon" />
              <span>Gold Coast Airport</span>
            </li>
          </ul>
        </div>

        <div className="footer-links-column">
          <h4 className="footer-column-title">Contact Concierge</h4>
          <ul className="footer-contact-list">
            <li>
              <Phone size={14} className="contact-icon" />
              <a href="tel:+61290001234">+61 (2) 9000 1234</a>
            </li>
            <li>
              <Mail size={14} className="contact-icon" />
              <a href="mailto:concierge@lcrentals.com.au">concierge@lcrentals.com.au</a>
            </li>
          </ul>
        </div>

      </div>

      <div className="footer-copyright-bar">
        <div className="container copyright-bar-content">
          <span>&copy; {currentYear} LC Rentals Pty Ltd. All rights reserved.</span>
          <span className="designed-notice">Designed with Luxury &amp; Performance</span>
        </div>
      </div>
    </footer>
  );
}
