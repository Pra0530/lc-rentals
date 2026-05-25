import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, Mail, User, Phone } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const dialogRef = useRef(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
      setError('');
    } else {
      dialog.close();
    }
  }, [isOpen]);

  // Back-drop click to close modal
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // Fetch existing users from localStorage
    const users = JSON.parse(localStorage.getItem('registered_users') || '[]');

    if (isSignUp) {
      // Sign Up flow
      const userExists = users.some(u => u.email.toLowerCase() === formData.email.toLowerCase());
      if (userExists) {
        setError('An account with this email already exists.');
        return;
      }

      const newUser = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        bookings: []
      };

      users.push(newUser);
      localStorage.setItem('registered_users', JSON.stringify(users));
      
      // Store session
      localStorage.setItem('active_user', JSON.stringify({ name: newUser.name, email: newUser.email, phone: newUser.phone }));
      
      onAuthSuccess({ name: newUser.name, email: newUser.email });
      onClose();
    } else {
      // Sign In flow
      const matchedUser = users.find(
        u => u.email.toLowerCase() === formData.email.toLowerCase() && u.password === formData.password
      );

      if (!matchedUser) {
        setError('Invalid email or password.');
        return;
      }

      // Store session
      localStorage.setItem('active_user', JSON.stringify({ name: matchedUser.name, email: matchedUser.email, phone: matchedUser.phone }));
      
      onAuthSuccess({ name: matchedUser.name, email: matchedUser.email });
      onClose();
    }

    // Reset form
    setFormData({ name: '', email: '', phone: '', password: '' });
  };

  return (
    <dialog 
      ref={dialogRef} 
      onClose={onClose}
      aria-labelledby="auth-modal-title"
      className="auth-dialog-modal glass-panel"
    >
      <div className="auth-modal-header">
        <h2 id="auth-modal-title" className="auth-title-gradient">
          {isSignUp ? 'Create Elite Profile' : 'Sign In to Access'}
        </h2>
        <button 
          onClick={onClose} 
          className="btn-close-modal" 
          aria-label="Close authentication modal"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="auth-form-element">
        {error && <div className="auth-error-alert">{error}</div>}

        {isSignUp && (
          <div className="form-group">
            <label className="form-label" htmlFor="auth-name">Full Name</label>
            <div className="auth-input-wrapper">
              <User size={16} className="auth-input-icon" />
              <input 
                type="text" 
                id="auth-name" 
                name="name" 
                required 
                placeholder=" Harrison Ford"
                className="form-input auth-input"
                value={formData.name}
                onChange={handleInputChange}
                autoComplete="name"
              />
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="auth-email">Email Address</label>
          <div className="auth-input-wrapper">
            <Mail size={16} className="auth-input-icon" />
            <input 
              type="email" 
              id="auth-email" 
              name="email" 
              required 
              placeholder=" harrison@luxury.com"
              className="form-input auth-input"
              value={formData.email}
              onChange={handleInputChange}
              autoComplete="email"
            />
          </div>
        </div>

        {isSignUp && (
          <div className="form-group">
            <label className="form-label" htmlFor="auth-phone">Phone Number</label>
            <div className="auth-input-wrapper">
              <Phone size={16} className="auth-input-icon" />
              <input 
                type="tel" 
                id="auth-phone" 
                name="phone" 
                required 
                placeholder=" +61 400 123 456"
                className="form-input auth-input"
                value={formData.phone}
                onChange={handleInputChange}
                autoComplete="tel"
              />
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="auth-password">Password</label>
          <div className="auth-input-wrapper">
            <Lock size={16} className="auth-input-icon" />
            <input 
              type="password" 
              id="auth-password" 
              name="password" 
              required 
              placeholder=" ••••••••"
              className="form-input auth-input"
              value={formData.password}
              onChange={handleInputChange}
              autoComplete={isSignUp ? "new-password" : "current-password"}
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary auth-submit-btn">
          {isSignUp ? 'Create Profile' : 'Sign In'}
        </button>

        <div className="auth-toggle-footer">
          <span>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          </span>
          <button 
            type="button" 
            className="auth-toggle-link-btn"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
          >
            {isSignUp ? 'Sign In Now' : 'Create One Here'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
