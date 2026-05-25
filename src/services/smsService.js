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
  const sid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
  const token = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
  const from = import.meta.env.VITE_TWILIO_PHONE_NUMBER;

  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const smsLog = {
    id: 'SMS-' + Math.floor(1000 + Math.random() * 9000),
    to,
    body,
    timestamp,
    status: 'Sent'
  };

  // 1. Direct Twilio Integration (if keys are supplied)
  if (sid && token && from) {
    try {
      const basicAuth = btoa(`${sid}:${token}`);
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            To: to,
            From: from,
            Body: body
          })
        }
      );
      
      if (!response.ok) {
        throw new Error(`Twilio returned error status: ${response.status}`);
      }
      
      console.log(`[Twilio] SMS successfully sent to ${to}`);
      smsLog.gateway = 'Twilio';
    } catch (err) {
      console.warn(`[Twilio CORS/Auth Bypass] Direct browser-to-Twilio call failed: ${err.message}. Defaulting to simulator.`);
      smsLog.status = 'Simulated (Twilio API Error)';
    }
  } else {
    // 2. Mock Fallback Log
    console.log(`[Mock SMS Log] Sent to: ${to} | Body: "${body}"`);
    smsLog.gateway = 'Simulator';
  }

  // Queue the log locally for the Admin/Client toast renders
  saveToLocalSMSQueue(smsLog);
  return smsLog;
};

export const getSMSLogs = () => getLocalSMSQueue();
export const clearSMSLogs = () => localStorage.removeItem("lc_sms_logs");
