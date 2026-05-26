/**
 * 📊 LC Rentals — Google Sheets Integration Sync Utility
 * 
 * Hits a user-configured Webhook URL (Zapier, Make, or Google Apps Script Web App)
 * to sync real-time bookings, lead inquiries, or return inspections directly into Google Sheets.
 */
export const syncToGoogleSheets = async (webhookUrl, type, data) => {
  if (!webhookUrl) {
    console.log("[Google Sheets Sync] Webhook URL not configured. Skipping sync.");
    return false;
  }

  try {
    let payload = {};

    if (type === 'checkout' || type === 'checkin') {
      const { booking, inspection } = data;
      
      // Compile checkboxes into a human-readable summary
      const checks = [];
      if (inspection.checks?.exterior) checks.push("Exterior Panel OK");
      else checks.push("Exterior Damage Noted");
      
      if (inspection.checks?.interior) checks.push("Interior Clean");
      else checks.push("Interior Dirty/Checked");
      
      if (inspection.checks?.fluids) checks.push("Fluids OK");
      else checks.push("Fluids Low");
      
      if (inspection.checks?.tires) checks.push("Tires/Tyres OK");
      else checks.push("Tires Checked");

      const checksStr = checks.join(", ");
      const notes = inspection.checks?.notes ? ` | Notes: ${inspection.checks.notes}` : "";

      payload = {
        syncType: type === 'checkout' ? 'Checkout Inspection' : 'Return Inspection',
        referenceCode: booking.referenceNumber || 'N/A',
        createdAt: inspection.timestamp || new Date().toISOString(),
        renterName: booking.renterName || booking.name || 'N/A',
        renterEmail: booking.userEmail || booking.email || 'N/A',
        renterPhone: booking.phone || booking.renterPhone || 'N/A',
        vehicleName: booking.carName || 'N/A',
        durationDays: Number(booking.days || 1),
        startDate: booking.startDate || 'N/A',
        endDate: booking.endDate || 'N/A',
        totalCostAud: Number(booking.total || booking.totalEstimate || 0),
        status: type === 'checkout' ? 'Active' : 'Completed',
        message: `Inspector: ${inspection.inspectorSignature} | Fuel: ${inspection.checks?.fuel || 'Full'} | ${checksStr}${notes}`,
        excessInsurance: booking.insurancePrice ? 'Yes (+$50/day)' : 'No'
      };
    } else {
      // Standard booking or lead inquiry
      payload = {
        syncType: type === 'booking' ? 'Stripe Booking' : 'Lead Inquiry',
        referenceCode: data.referenceNumber || 'N/A',
        createdAt: data.createdAt || new Date().toISOString(),
        renterName: data.renterName || data.name || 'N/A',
        renterEmail: data.userEmail || data.email || 'N/A',
        renterPhone: data.phone || data.renterPhone || 'N/A',
        vehicleName: data.carName || 'N/A',
        durationDays: Number(data.days || 1),
        startDate: data.startDate || 'N/A',
        endDate: data.endDate || 'N/A',
        totalCostAud: Number(data.total || data.totalEstimate || 0),
        status: data.status || 'Pending',
        message: data.message || 'N/A',
        excessInsurance: data.insurancePrice ? 'Yes (+$50/day)' : 'No'
      };
    }

    console.log(`[Google Sheets Sync] Syncing ${type} details to webhook:`, webhookUrl);

    // Send HTTP POST request. We use 'no-cors' mode so simple webhooks 
    // receive the POST even if they do not support CORS pre-flight responses.
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      mode: 'no-cors'
    });

    console.log("[Google Sheets Sync] Event dispatched successfully.");
    return true;
  } catch (err) {
    console.error("[Google Sheets Sync] Failed to dispatch event:", err);
    return false;
  }
};
