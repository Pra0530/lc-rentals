import Stripe from 'stripe';

function calculateDynamicPriceServer(baseDailyRate, startDateStr, endDateStr, activeBookingCount, totalFleetCount, settings = {}) {
  const enabled = settings.dynamicPricingEnabled !== false;

  // Compute duration in days
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');
  const diffTime = end - start;
  const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  if (!enabled) {
    return baseDailyRate * totalDays;
  }

  let weekendDays = 0;
  const weekendMultiplier = settings.weekendMultiplier || 1.15;
  const rateDetails = [];

  for (let i = 0; i < totalDays; i++) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    let dayRate = baseDailyRate;
    if (isWeekend) {
      weekendDays++;
      dayRate = Math.round(baseDailyRate * weekendMultiplier);
    }

    rateDetails.push(dayRate);
  }

  // Calculate base sum after weekend surges
  const baseSum = rateDetails.reduce((sum, rate) => sum + rate, 0);

  // Utilization Surcharge
  let utilizationRate = 0;
  let utilizationSurchargeMultiplier = 0;
  if (totalFleetCount > 0) {
    utilizationRate = activeBookingCount / totalFleetCount;
  }

  const threshold2 = settings.utilizationThreshold2 || 0.75;
  const surcharge2 = settings.utilizationSurcharge2 || 0.25;
  const threshold1 = settings.utilizationThreshold1 || 0.50;
  const surcharge1 = settings.utilizationSurcharge1 || 0.10;

  if (utilizationRate >= threshold2) {
    utilizationSurchargeMultiplier = surcharge2;
  } else if (utilizationRate >= threshold1) {
    utilizationSurchargeMultiplier = surcharge1;
  }

  const utilizationSurcharge = Math.round(baseSum * utilizationSurchargeMultiplier);
  return baseSum + utilizationSurcharge;
}

export default async function handler(req, res) {
  // CORS configuration for local development support
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { carId, days, startDate, endDate, useInsurance, renterName } = req.body;

    if (!carId || !days) {
      res.status(400).json({ error: 'Missing required parameters: carId and days.' });
      return;
    }

    // Determine the base daily price of the vehicle
    let dailyPrice = null;
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID;

    // Check if Firebase project ID is configured to fetch the price from live Firestore
    if (projectId && projectId !== 'your-project-id' && projectId.trim() !== '') {
      try {
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/fleet/${carId}`;
        const response = await fetch(firestoreUrl);
        if (response.ok) {
          const docData = await response.json();
          if (docData.fields && docData.fields.price) {
            const priceVal = docData.fields.price.integerValue || docData.fields.price.doubleValue;
            if (priceVal) {
              dailyPrice = parseInt(priceVal, 10);
              console.log(`Fetched price for ${carId} from Firestore: $${dailyPrice}`);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch car price from Firestore REST API, falling back to local list:', err);
      }
    }

    // Fallback static rates if Firestore fetch fails, is offline, or is not configured
    if (!dailyPrice) {
      const fallbackFleet = {
        'mclaren-720s': 1490,
        'porsche-911': 890,
        'range-rover': 590,
        'tesla-s': 510
      };
      dailyPrice = fallbackFleet[carId];
    }

    if (!dailyPrice) {
      res.status(400).json({ error: `Invalid vehicle reference: ${carId}` });
      return;
    }

    // Fetch settings and occupancy count from Firestore REST API
    let activeBookingCount = 0;
    let totalFleetCount = 0;
    let pricingSettings = {
      dynamicPricingEnabled: true,
      weekendMultiplier: 1.15,
      utilizationThreshold1: 0.50,
      utilizationSurcharge1: 0.10,
      utilizationThreshold2: 0.75,
      utilizationSurcharge2: 0.25
    };

    if (projectId && projectId !== 'your-project-id' && projectId.trim() !== '') {
      try {
        // 1. Fetch pricing settings
        const settingsResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/settings/pricing`);
        if (settingsResponse.ok) {
          const docData = await settingsResponse.json();
          if (docData.fields) {
            pricingSettings = {
              dynamicPricingEnabled: docData.fields.dynamicPricingEnabled?.booleanValue !== false,
              weekendMultiplier: parseFloat(docData.fields.weekendMultiplier?.doubleValue || docData.fields.weekendMultiplier?.integerValue || 1.15),
              utilizationThreshold1: parseFloat(docData.fields.utilizationThreshold1?.doubleValue || docData.fields.utilizationThreshold1?.integerValue || 0.50),
              utilizationSurcharge1: parseFloat(docData.fields.utilizationSurcharge1?.doubleValue || docData.fields.utilizationSurcharge1?.integerValue || 0.10),
              utilizationThreshold2: parseFloat(docData.fields.utilizationThreshold2?.doubleValue || docData.fields.utilizationThreshold2?.integerValue || 0.75),
              utilizationSurcharge2: parseFloat(docData.fields.utilizationSurcharge2?.doubleValue || docData.fields.utilizationSurcharge2?.integerValue || 0.25)
            };
          }
        }

        // 2. Fetch active bookings count
        const bookingsResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/bookings?pageSize=100`);
        if (bookingsResponse.ok) {
          const data = await bookingsResponse.json();
          if (data.documents) {
            activeBookingCount = data.documents.filter(doc => {
              const fields = doc.fields || {};
              const statusVal = fields.status && fields.status.stringValue;
              return statusVal === 'Active';
            }).length;
          }
        }

        // 3. Fetch total fleet size
        const fleetResponse = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/fleet?pageSize=100`);
        if (fleetResponse.ok) {
          const data = await fleetResponse.json();
          if (data.documents) {
            totalFleetCount = data.documents.filter(doc => {
              const fields = doc.fields || {};
              const statusVal = fields.status && fields.status.stringValue;
              return statusVal !== 'Maintenance';
            }).length;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch pricing rules or state from Firestore REST API, using local fallbacks:', err);
      }
    }

    const startStr = startDate || new Date().toISOString().split('T')[0];
    const endStr = endDate || (() => {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(days, 10));
      return d.toISOString().split('T')[0];
    })();

    // Calculate dynamic base price
    const basePrice = calculateDynamicPriceServer(
      dailyPrice,
      startStr,
      endStr,
      activeBookingCount,
      totalFleetCount,
      pricingSettings
    );

    const numDays = Math.max(1, parseInt(days, 10));
    const insurancePrice = useInsurance ? 50 * numDays : 0;
    const subtotal = basePrice + insurancePrice;
    const gst = Math.round(subtotal * 0.1);
    const total = subtotal + gst;
    const totalInCents = total * 100; // Stripe expects amount in cents

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      res.status(500).json({
        error: 'Stripe Secret Key is not configured on the server. Please add STRIPE_SECRET_KEY to your environment variables.'
      });
      return;
    }

    const stripe = new Stripe(secretKey);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalInCents,
      currency: 'aud',
      metadata: {
        carId,
        days: String(numDays),
        useInsurance: String(useInsurance),
        renterName: renterName || 'Valued Renter',
        total: String(total)
      },
      automatic_payment_methods: {
        enabled: true
      }
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      amount: total
    });
  } catch (error) {
    console.error('Payment intent generation error:', error);
    res.status(500).json({ error: error.message });
  }
}
