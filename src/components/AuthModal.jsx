import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, Mail, User, Phone } from 'lucide-react';
import { auth, db, googleProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, updateProfile, doc, setDoc } from '../firebase';

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

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Save profile to Firestore (merge options ensures we don't erase existing phone numbers)
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        phone: user.phoneNumber || '',
        role: 'user',
        createdAt: new Date().toISOString()
      }, { merge: true });

      onAuthSuccess({ name: user.displayName || user.email.split('@')[0], email: user.email });
      onClose();
    } catch (err) {
      console.error(err);
      setError('Google Sign-In failed or was closed.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (isSignUp) {
        // Sign Up flow
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;
        await updateProfile(user, { displayName: formData.name });

        // Save profile to Firestore
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: 'user',
          createdAt: new Date().toISOString()
        });

        onAuthSuccess({ name: formData.name, email: formData.email });
      } else {
        // Sign In flow
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;
        onAuthSuccess({ name: user.displayName || user.email.split('@')[0], email: user.email });
      }
      
      onClose();
      // Reset form
      setFormData({ name: '', email: '', phone: '', password: '' });
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Invalid email or password.');
      } else {
        setError(err.message || 'An error occurred during authentication.');
      }
    }
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

        <div className="auth-social-divider">
          <span>OR</span>
        </div>

        <button 
          type="button" 
          onClick={handleGoogleSignIn} 
          className="btn btn-secondary google-signin-btn"
        >
          <svg className="google-icon-svg" viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '10px' }}>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
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
