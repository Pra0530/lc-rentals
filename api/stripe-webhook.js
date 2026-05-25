import Stripe from 'stripe';

// Stripe requires the raw body to verify webhook signatures.
export const config = {
  api: {
    bodyParser: false
  }
};

async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Stripe-Signature, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!webhookSecret || !secretKey) {
    res.status(500).json({ error: 'Stripe keys are not configured on the server.' });
    return;
  }

  const stripe = new Stripe(secretKey);

  try {
    const rawBody = await getRawBody(req);
    const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

    console.log(`[Webhook Event Received] Type: ${event.type}`);

    // Handle incoming transaction events
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        console.log(`PaymentIntent for ${paymentIntent.amount} succeeded. Metadata:`, paymentIntent.metadata);
        
        // This acts as a background fail-safe hook. In production, you would update
        // Firestore using firebase-admin to confirm active bookings.
        break;
      }
      case 'charge.succeeded': {
        const charge = event.data.object;
        console.log(`Charge succeeded for amount: ${charge.amount}`);
        break;
      }
      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook signature validation failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}
