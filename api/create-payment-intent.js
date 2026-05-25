import Stripe from 'stripe';

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
    const { carId, days, useInsurance, renterName } = req.body;

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

    // Calculate total price matching frontend ledger formula
    const numDays = Math.max(1, parseInt(days, 10));
    const basePrice = dailyPrice * numDays;
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
