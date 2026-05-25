import React, { useState, useEffect } from 'react';
import { DollarSign, Car, Calendar, TrendingUp, Plus, Trash2, ShieldAlert, Check, X, FileText } from 'lucide-react';
import { FLEET_DATA } from './FleetGrid';

export default function AdminPanel({ fleet, setFleet, onClose }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [bookings, setBookings] = useState([]);
  
  // Fleet form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCar, setNewCar] = useState({
    name: '',
    category: 'Supercar',
    price: 300,
    image: '/mclaren.png',
    engine: '',
    acceleration: '',
    topSpeed: '',
    seats: 2,
    transmission: 'Automatic',
    features: '',
    description: ''
  });

  // Inspection states
  const [activeInspectionBooking, setActiveInspectionBooking] = useState(null);
  const [inspectionType, setInspectionType] = useState('checkout'); // checkout or checkin
  const [inspectionChecks, setInspectionChecks] = useState({
    exterior: false,
    interior: false,
    fluids: false,
    tires: false,
    fuel: 'Full',
    notes: ''
  });
  const [inspectorSig, setInspectorSig] = useState('');

  // Fetch bookings and fleet on mount/sync
  useEffect(() => {
    // Collect bookings from all registered users
    const users = JSON.parse(localStorage.getItem('registered_users') || '[]');
    let allBookings = [];
    users.forEach(u => {
      if (u.bookings && u.bookings.length > 0) {
        u.bookings.forEach(b => {
          allBookings.push({ ...b, userEmail: u.email, userName: u.name });
        });
      }
    });
    setBookings(allBookings);
  }, []);

  const syncBookingsToStorage = (updatedBookingsList) => {
    setBookings(updatedBookingsList);
    
    // Save back to corresponding users in registered_users
    const users = JSON.parse(localStorage.getItem('registered_users') || '[]');
    const updatedUsers = users.map(u => {
      const userBookings = updatedBookingsList.filter(b => b.userEmail.toLowerCase() === u.email.toLowerCase());
      return {
        ...u,
        bookings: userBookings
      };
    });
    localStorage.setItem('registered_users', JSON.stringify(updatedUsers));
  };

  // Helper to change booking status
  const handleUpdateBookingStatus = (refNum, newStatus, inspectionData = null) => {
    const updated = bookings.map(b => {
      if (b.referenceNumber === refNum) {
        return { 
          ...b, 
          status: newStatus,
          inspection: inspectionData ? { ...b.inspection, [inspectionType]: inspectionData } : b.inspection
        };
      }
      return b;
    });
    syncBookingsToStorage(updated);
  };

  // Fleet management actions
  const handleAddCar = (e) => {
    e.preventDefault();
    
    const formattedCar = {
      id: newCar.name.toLowerCase().replace(/\s+/g, '-'),
      name: newCar.name,
      category: newCar.category,
      price: Number(newCar.price),
      image: newCar.image,
      engine: newCar.engine || 'V8 Engine',
      acceleration: newCar.acceleration || '3.5s',
      topSpeed: newCar.topSpeed || '300 km/h',
      seats: Number(newCar.seats),
      transmission: newCar.transmission,
      features: newCar.features ? newCar.features.split(',').map(f => f.trim()) : ['Premium Audio', 'GPS Navigator'],
      description: newCar.description || 'A premium vehicle addition to the elite LC Rentals fleet.',
      status: 'Active' // Active or Maintenance
    };

    const updatedFleet = [...fleet, formattedCar];
    setFleet(updatedFleet);
    localStorage.setItem('lc_fleet', JSON.stringify(updatedFleet));

    // Reset Form
    setNewCar({
      name: '',
      category: 'Supercar',
      price: 300,
      image: '/mclaren.png',
      engine: '',
      acceleration: '',
      topSpeed: '',
      seats: 2,
      transmission: 'Automatic',
      features: '',
      description: ''
    });
    setShowAddForm(false);
  };

  const handleToggleMaintenance = (carId) => {
    const updated = fleet.map(car => {
      if (car.id === carId) {
        return { ...car, status: car.status === 'Maintenance' ? 'Active' : 'Maintenance' };
      }
      return car;
    });
    setFleet(updated);
    localStorage.setItem('lc_fleet', JSON.stringify(updated));
  };

  const handleDeleteCar = (carId) => {
    if (confirm('Are you sure you want to remove this vehicle from the fleet?')) {
      const updated = fleet.filter(car => car.id !== carId);
      setFleet(updated);
      localStorage.setItem('lc_fleet', JSON.stringify(updated));
    }
  };

  const handleUpdatePrice = (carId, newPrice) => {
    const updated = fleet.map(car => {
      if (car.id === carId) {
        return { ...car, price: Number(newPrice) };
      }
      return car;
    });
    setFleet(updated);
    localStorage.setItem('lc_fleet', JSON.stringify(updated));
  };

  // Metrics Calculations
  const totalRevenue = bookings.reduce((sum, b) => b.status !== 'Cancelled' ? sum + b.total : sum, 0);
  const activeRentalsCount = bookings.filter(b => b.status === 'Active').length;
  const maintenanceCount = fleet.filter(car => car.status === 'Maintenance').length;
  const occupancyRate = fleet.length > 0 ? Math.round((activeRentalsCount / fleet.length) * 100) : 0;

  // Open Inspection
  const triggerInspection = (booking, type) => {
    setActiveInspectionBooking(booking);
    setInspectionType(type);
    setInspectionChecks({
      exterior: false,
      interior: false,
      fluids: false,
      tires: false,
      fuel: 'Full',
      notes: ''
    });
    setInspectorSig('');
  };

  const submitInspection = (e) => {
    e.preventDefault();
    if (!inspectorSig) {
      alert('Please sign off as the inspector.');
      return;
    }

    const inspectionData = {
      timestamp: new Date().toLocaleString(),
      inspectorSignature: inspectorSig,
      checks: { ...inspectionChecks }
    };

    const nextStatus = inspectionType === 'checkout' ? 'Active' : 'Completed';
    handleUpdateBookingStatus(activeInspectionBooking.referenceNumber, nextStatus, inspectionData);
    setActiveInspectionBooking(null);
  };

  return (
    <div className="admin-portal-overlay">
      <div className="admin-portal-container">
        
        {/* Sidebar Nav */}
        <aside className="admin-sidebar glass-panel">
          <div className="admin-brand">
            <span className="brand-l">L</span>
            <span className="brand-c">C</span>
            <span className="brand-text">ADMIN</span>
          </div>

          <nav className="admin-nav">
            <button 
              className={`admin-nav-btn ${activeTab === 'dashboard' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <TrendingUp size={16} /> Dashboard
            </button>
            <button 
              className={`admin-nav-btn ${activeTab === 'bookings' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('bookings')}
            >
              <Calendar size={16} /> Bookings ({bookings.length})
            </button>
            <button 
              className={`admin-nav-btn ${activeTab === 'fleet' ? 'nav-active' : ''}`}
              onClick={() => setActiveTab('fleet')}
            >
              <Car size={16} /> Fleet Manager ({fleet.length})
            </button>
          </nav>

          <button onClick={onClose} className="btn btn-secondary admin-close-portal-btn">
            Exit Console
          </button>
        </aside>

        {/* Content area */}
        <main className="admin-main-content">
          
          {/* TAB 1: DASHBOARD SUMMARY */}
          {activeTab === 'dashboard' && (
            <div className="admin-tab-content animate-slide-up">
              <h2 className="admin-content-title">Dashboard Overview</h2>
              
              <div className="metrics-grid">
                <div className="glass-card metric-card">
                  <div className="metric-header">
                    <span className="metric-label">Total Revenue</span>
                    <DollarSign size={20} className="metric-icon-gold" />
                  </div>
                  <span className="metric-value">${totalRevenue.toLocaleString()} AUD</span>
                  <span className="metric-trend text-green">✦ Live sales hold</span>
                </div>

                <div className="glass-card metric-card">
                  <div className="metric-header">
                    <span className="metric-label">Active Rentals</span>
                    <Calendar size={20} className="metric-icon-gold" />
                  </div>
                  <span className="metric-value">{activeRentalsCount} Vehicles</span>
                  <span className="metric-trend text-blue">Occupancy Rate: {occupancyRate}%</span>
                </div>

                <div className="glass-card metric-card">
                  <div className="metric-header">
                    <span className="metric-label">Fleet Size</span>
                    <Car size={20} className="metric-icon-gold" />
                  </div>
                  <span className="metric-value">{fleet.length} Listings</span>
                  <span className="metric-trend text-muted">{maintenanceCount} under maintenance</span>
                </div>
              </div>

              {/* Recent booking widgets */}
              <div className="dashboard-grid-widgets">
                <div className="glass-card recent-bookings-widget text-left">
                  <h3 className="widget-title">Recent Inquiries &amp; Bookings</h3>
                  <div className="widget-list">
                    {bookings.slice(-5).reverse().map((b) => (
                      <div key={b.referenceNumber} className="widget-row-item">
                        <div>
                          <strong>{b.userName}</strong>
                          <p className="font-tiny text-muted">{b.carName} — {b.days} Days</p>
                        </div>
                        <span className={`status-badge status-${b.status ? b.status.toLowerCase() : 'pending'}`}>
                          {b.status || 'Pending'}
                        </span>
                      </div>
                    ))}
                    {bookings.length === 0 && <p className="text-muted text-center py-4">No active booking records yet.</p>}
                  </div>
                </div>

                <div className="glass-card recent-bookings-widget text-left">
                  <h3 className="widget-title">Fleet Utilization</h3>
                  <div className="widget-list">
                    {fleet.map((car) => {
                      const count = bookings.filter(b => b.carName === car.name && b.status !== 'Cancelled').length;
                      return (
                        <div key={car.id} className="widget-row-item">
                          <span>{car.name}</span>
                          <strong>{count} booking{count !== 1 ? 's' : ''}</strong>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MANAGE BOOKINGS */}
          {activeTab === 'bookings' && (
            <div className="admin-tab-content animate-slide-up text-left">
              <h2 className="admin-content-title">Customer Bookings &amp; Logs</h2>

              <div className="table-responsive">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Ref Code</th>
                      <th>Renter</th>
                      <th>Vehicle</th>
                      <th>Duration</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b.referenceNumber}>
                        <td><code>{b.referenceNumber}</code></td>
                        <td>
                          <div>
                            <strong>{b.renterName || b.userName}</strong>
                            <p className="font-tiny text-muted">{b.userEmail}</p>
                          </div>
                        </td>
                        <td>{b.carName}</td>
                        <td>{b.startDate} to {b.endDate} ({b.days}d)</td>
                        <td>${b.total.toLocaleString()} AUD</td>
                        <td>
                          <span className={`status-badge status-${b.status ? b.status.toLowerCase() : 'pending'}`}>
                            {b.status || 'Pending'}
                          </span>
                        </td>
                        <td>
                          <div className="actions-button-group">
                            {(b.status === 'Pending' || !b.status) && (
                              <button 
                                onClick={() => handleUpdateBookingStatus(b.referenceNumber, 'Confirmed')}
                                className="btn-action-badge text-green"
                                title="Approve booking"
                              >
                                <Check size={16} /> Approve
                              </button>
                            )}
                            {b.status === 'Confirmed' && (
                              <button 
                                onClick={() => triggerInspection(b, 'checkout')}
                                className="btn-action-badge text-gold"
                                title="Checkout Inspection"
                              >
                                <FileText size={16} /> Handover Checks
                              </button>
                            )}
                            {b.status === 'Active' && (
                              <button 
                                onClick={() => triggerInspection(b, 'checkin')}
                                className="btn-action-badge text-blue"
                                title="Checkin Inspection"
                              >
                                <FileText size={16} /> Return Checks
                              </button>
                            )}
                            {b.status !== 'Completed' && b.status !== 'Cancelled' && (
                              <button 
                                onClick={() => handleUpdateBookingStatus(b.referenceNumber, 'Cancelled')}
                                className="btn-action-badge text-red"
                                title="Cancel booking"
                              >
                                <X size={16} /> Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {bookings.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center text-muted py-4">No reservations logged in database.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: FLEET MANAGER */}
          {activeTab === 'fleet' && (
            <div className="admin-tab-content animate-slide-up text-left">
              <div className="admin-title-row">
                <h2 className="admin-content-title">Manage Fleet Inventory</h2>
                <button 
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="btn btn-primary"
                >
                  <Plus size={16} /> Add Vehicle
                </button>
              </div>

              {/* Add form slider */}
              {showAddForm && (
                <form onSubmit={handleAddCar} className="glass-panel add-car-form animate-slide-up">
                  <h3>Register New Fleet Vehicle</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Vehicle Name</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. Aston Martin Vantage"
                        className="form-input"
                        value={newCar.name}
                        onChange={(e) => setNewCar(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category Tier</label>
                      <select 
                        className="form-select"
                        value={newCar.category}
                        onChange={(e) => setNewCar(prev => ({ ...prev, category: e.target.value }))}
                      >
                        <option value="Supercar">Supercar</option>
                        <option value="Sports">Sports / Performance</option>
                        <option value="SUV">Luxury SUV</option>
                        <option value="EV">Electric (EV)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Daily Price (AUD)</label>
                      <input 
                        type="number" 
                        required 
                        className="form-input"
                        value={newCar.price}
                        onChange={(e) => setNewCar(prev => ({ ...prev, price: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Static Visual Asset</label>
                      <select 
                        className="form-select"
                        value={newCar.image}
                        onChange={(e) => setNewCar(prev => ({ ...prev, image: e.target.value }))}
                      >
                        <option value="/mclaren.png">McLaren Showroom Asset</option>
                        <option value="/porsche.png">Porsche Coastal Road Asset</option>
                        <option value="/range_rover.png">Range Rover Mansion Asset</option>
                        <option value="/tesla.png">Tesla Charging Station Asset</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Engine Specs</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 5.2L V12 Twin-Turbo"
                        className="form-input"
                        value={newCar.engine}
                        onChange={(e) => setNewCar(prev => ({ ...prev, engine: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Seats</label>
                      <input 
                        type="number" 
                        className="form-input"
                        value={newCar.seats}
                        onChange={(e) => setNewCar(prev => ({ ...prev, seats: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">0-100 Acceleration</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 3.2s"
                        className="form-input"
                        value={newCar.acceleration}
                        onChange={(e) => setNewCar(prev => ({ ...prev, acceleration: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Top Speed</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 314 km/h"
                        className="form-input"
                        value={newCar.topSpeed}
                        onChange={(e) => setNewCar(prev => ({ ...prev, topSpeed: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Key Highlights (Comma separated)</label>
                    <input 
                      type="text" 
                      placeholder="Leather dashboard, Active wing, Launch control"
                      className="form-input"
                      value={newCar.features}
                      onChange={(e) => setNewCar(prev => ({ ...prev, features: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea 
                      rows="2"
                      placeholder="Enter premium vehicle marketing descriptions..."
                      className="form-input"
                      value={newCar.description}
                      onChange={(e) => setNewCar(prev => ({ ...prev, description: e.target.value }))}
                    ></textarea>
                  </div>

                  <div className="actions-button-group margin-top-small">
                    <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Add to Grid
                    </button>
                  </div>
                </form>
              )}

              <div className="table-responsive">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price/Day</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fleet.map((car) => (
                      <tr key={car.id}>
                        <td>
                          <img src={car.image} alt={car.name} className="admin-table-thumbnail" />
                        </td>
                        <td>
                          <strong>{car.name}</strong>
                          <p className="font-tiny text-muted">{car.engine} | {car.seats} Seats</p>
                        </td>
                        <td>{car.category}</td>
                        <td>
                          <div className="price-inline-editor">
                            <span>$</span>
                            <input 
                              type="number"
                              className="inline-price-input"
                              value={car.price}
                              onChange={(e) => handleUpdatePrice(car.id, e.target.value)}
                            />
                            <span>AUD</span>
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge status-${car.status === 'Maintenance' ? 'maintenance' : 'confirmed'}`}>
                            {car.status === 'Maintenance' ? 'Maintenance' : 'Active'}
                          </span>
                        </td>
                        <td>
                          <div className="actions-button-group">
                            <button 
                              onClick={() => handleToggleMaintenance(car.id)}
                              className={`btn-action-badge ${car.status === 'Maintenance' ? 'text-green' : 'text-gold'}`}
                            >
                              <ShieldAlert size={14} /> {car.status === 'Maintenance' ? 'Activate' : 'Service'}
                            </button>
                            <button 
                              onClick={() => handleDeleteCar(car.id)}
                              className="btn-action-badge text-red"
                            >
                              <Trash2 size={14} /> Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* INSPECTION DIALOG OVERLAY */}
      {activeInspectionBooking && (
        <div className="inspection-modal-overlay">
          <form onSubmit={submitInspection} className="inspection-form-panel glass-panel animate-slide-up text-left">
            <div className="inspection-header">
              <h2>
                {inspectionType === 'checkout' ? 'Outgoing Handover Inspection' : 'Incoming Return Inspection'}
              </h2>
              <span>Ref: {activeInspectionBooking.referenceNumber}</span>
            </div>

            <p className="font-small text-secondary mb-4">
              Inspect the <strong>{activeInspectionBooking.carName}</strong> to verify operational safety and document condition records before updating the status logs.
            </p>

            <div className="inspection-checklist-grid">
              <div className="inspection-checkbox-item">
                <input 
                  type="checkbox" 
                  required
                  id="chk-exterior" 
                  checked={inspectionChecks.exterior}
                  onChange={(e) => setInspectionChecks(prev => ({ ...prev, exterior: e.target.checked }))}
                />
                <label htmlFor="chk-exterior">
                  <strong>Exterior Panel Check:</strong> Free of new scratches, dents, chips, or bodywork damage.
                </label>
              </div>

              <div className="inspection-checkbox-item">
                <input 
                  type="checkbox" 
                  required
                  id="chk-interior" 
                  checked={inspectionChecks.interior}
                  onChange={(e) => setInspectionChecks(prev => ({ ...prev, interior: e.target.checked }))}
                />
                <label htmlFor="chk-interior">
                  <strong>Interior &amp; Cleanliness:</strong> Upholstery clean, high-touch controls sanitized, floor mats tidy.
                </label>
              </div>

              <div className="inspection-checkbox-item">
                <input 
                  type="checkbox" 
                  required
                  id="chk-fluids" 
                  checked={inspectionChecks.fluids}
                  onChange={(e) => setInspectionChecks(prev => ({ ...prev, fluids: e.target.checked }))}
                />
                <label htmlFor="chk-fluids">
                  <strong>Fluids &amp; Systems Check:</strong> Engine oil normal, washer fluid full, wiper blades operating, headlights running.
                </label>
              </div>

              <div className="inspection-checkbox-item">
                <input 
                  type="checkbox" 
                  required
                  id="chk-tires" 
                  checked={inspectionChecks.tires}
                  onChange={(e) => setInspectionChecks(prev => ({ ...prev, tires: e.target.checked }))}
                />
                <label htmlFor="chk-tires">
                  <strong>Tyres &amp; Pressures:</strong> Adequate tread depth across all wheels, tire pressures match specs, rims scratch-free.
                </label>
              </div>
            </div>

            <div className="form-row margin-top-small">
              <div className="form-group">
                <label className="form-label">Fuel Level (Tank / Battery)</label>
                <select 
                  className="form-select"
                  value={inspectionChecks.fuel}
                  onChange={(e) => setInspectionChecks(prev => ({ ...prev, fuel: e.target.value }))}
                >
                  <option value="Full">Full (100%)</option>
                  <option value="3/4">3/4 Tank (75%)</option>
                  <option value="1/2">1/2 Tank (50%)</option>
                  <option value="1/4">1/4 Tank (25%)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Inspector Signature (Type Name)</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Staff Representative"
                  className="form-input signature-input-font"
                  value={inspectorSig}
                  onChange={(e) => setInspectorSig(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group margin-top-small">
              <label className="form-label">Inspection Notes (Optional)</label>
              <textarea 
                rows="2" 
                placeholder="Note any cosmetic chips or fluid top-off notes..."
                className="form-input"
                value={inspectionChecks.notes}
                onChange={(e) => setInspectionChecks(prev => ({ ...prev, notes: e.target.value }))}
              ></textarea>
            </div>

            <div className="actions-button-group margin-top-small">
              <button 
                type="button" 
                onClick={() => setActiveInspectionBooking(null)} 
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Complete Handover &amp; Sync Status
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
