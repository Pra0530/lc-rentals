/**
 * 📱 LC Rentals — SMS Concierge Notification Service
 * 
 * In production, to protect credentials and avoid browser CORS limitations,
 * this service should run on a secure backend (e.g., Firebase Cloud Functions).
 * 
 * For development/testing, it provides:
 * 1. Twilio API Direct Client (for local server environments)
 * 2. Premium on-screen visual toast notifications in the UI for mock tracking.
 */

// Save sent notifications in a local queue so the Admin Console can show a simulator log
const getLocalSMSQueue = () => {
  return JSON.parse(localStorage.getItem("lc_sms_logs") || "[]");
};

const saveToLocalSMSQueue = (smsLog) => {
  const queue = getLocalSMSQueue();
  localStorage.setItem("lc_sms_logs", JSON.stringify([...queue, smsLog]));
  
  // Custom event to trigger UI toasts instantly in active browser windows
  const event = new CustomEvent("lc_sms_received", { detail: smsLog });
  window.dispatchEvent(event);
};

export const sendSMS = async (to, body) => {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const smsLog = {
    id: 'SMS-' + Math.floor(1000 + Math.random() * 9000),
    to,
    body,
    timestamp,
    status: 'Sent'
  };

  try {
    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ to, body })
    });

    if (!response.ok) {
      throw new Error(`Serverless endpoint returned HTTP status: ${response.status}`);
    }

    const data = await response.json();
    smsLog.gateway = data.status === 'Sent' ? 'Twilio Serverless' : 'Simulator Serverless';
    smsLog.status = data.status;
    console.log(`[SMS Service] Serverless dispatch: ${data.status} | ${data.message}`);
  } catch (err) {
    console.warn(`[SMS Service Fallback] Serverless endpoint failed: ${err.message}. Defaulting to browser simulation.`);
    smsLog.gateway = 'Browser Simulator';
    smsLog.status = 'Simulated';
  }

  // Queue the log locally for the Admin/Client toast renders
  saveToLocalSMSQueue(smsLog);
  return smsLog;
};

export const getSMSLogs = () => getLocalSMSQueue();
export const clearSMSLogs = () => localStorage.removeItem("lc_sms_logs");
