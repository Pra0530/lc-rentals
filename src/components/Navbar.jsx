import React, { useState, useEffect } from 'react';
import { Menu, X, User, LogOut, FileText, ShieldAlert } from 'lucide-react';

export default function Navbar({ user, onAuthTrigger, onLogout, onAdminTrigger }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    setIsMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <nav className={`navbar-container ${isScrolled ? 'navbar-scrolled' : ''}`}>
      <div className="container navbar-content">
        <div className="navbar-brand" onClick={() => scrollToSection('hero')}>
          <span className="brand-l">L</span>
          <span className="brand-c">C</span>
          <span className="brand-text">RENTALS</span>
        </div>

        <ul className="navbar-links">
          <li onClick={() => scrollToSection('fleet')}>Fleet</li>
          <li onClick={() => scrollToSection('experiences')}>Experiences</li>
          <li onClick={() => scrollToSection('faq')}>FAQ</li>
          <li onClick={() => scrollToSection('booking-form')}>Contact</li>
        </ul>

        <div className="navbar-cta">
          {user ? (
            <div className="user-profile-menu-container">
              <button 
                className="user-profile-badge"
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                aria-label="User Profile Dropdown"
              >
                {getUserInitials(user.name)}
              </button>

              {showProfileDropdown && (
                <div className="profile-dropdown glass-panel">
                  <div className="dropdown-user-info">
                    <span className="dropdown-username">{user.name}</span>
                    <span className="dropdown-email">{user.email}</span>
                  </div>
                  
                  <button 
                    className="dropdown-item" 
                    onClick={() => {
                      setShowProfileDropdown(false);
                      scrollToSection('booking-form');
                    }}
                  >
                    <FileText size={14} /> My Inquiries
                  </button>

                  <button 
                    className="dropdown-item" 
                    onClick={() => {
                      setShowProfileDropdown(false);
                      onAdminTrigger();
                    }}
                  >
                    <ShieldAlert size={14} className="text-gold" /> Admin Console
                  </button>
                  
                  <button 
                    className="dropdown-item dropdown-logout-btn" 
                    onClick={() => {
                      setShowProfileDropdown(false);
                      onLogout();
                    }}
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={onAuthTrigger}>
              Sign In
            </button>
          )}
          <button className="btn btn-primary" onClick={() => scrollToSection('booking-form')}>
            Book Now
          </button>
        </div>

        <div className="navbar-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={`mobile-drawer ${isMobileMenuOpen ? 'drawer-open' : ''}`}>
        <ul className="mobile-links">
          <li onClick={() => scrollToSection('fleet')}>Fleet</li>
          <li onClick={() => scrollToSection('experiences')}>Experiences</li>
          <li onClick={() => scrollToSection('faq')}>FAQ</li>
          <li onClick={() => scrollToSection('booking-form')}>Contact</li>
          
          {user ? (
            <>
              <li className="mobile-user-profile-label">Logged in as {user.name}</li>
              <li onClick={() => { setIsMobileMenuOpen(false); onAdminTrigger(); }}>
                <span className="flex-align-icon text-gold"><ShieldAlert size={18} /> Admin Console</span>
              </li>
              <li onClick={() => { setIsMobileMenuOpen(false); onLogout(); }}>
                <span className="flex-align-icon"><LogOut size={18} /> Sign Out</span>
              </li>
            </>
          ) : (
            <li onClick={() => { setIsMobileMenuOpen(false); onAuthTrigger(); }}>
              <span className="flex-align-icon"><User size={18} /> Sign In</span>
            </li>
          )}
          <li>
            <button className="btn btn-primary w-full" onClick={() => scrollToSection('booking-form')}>
              Book Now
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}
