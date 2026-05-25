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
    const { to, body } = req.body;

    if (!to || !body) {
      res.status(400).json({ error: 'Missing required parameters: to and body.' });
      return;
    }

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (!sid || !token || !from || sid === 'your-twilio-sid-here') {
      // Run in local simulation mode if keys are missing
      console.log(`[Twilio Serverless Simulator] Sent to: ${to} | Body: "${body}"`);
      res.status(200).json({
        status: 'Simulated',
        message: 'Twilio keys are not configured on the server. Run in local simulation mode.',
        details: { to, body }
      });
      return;
    }

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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Twilio REST API error: ${response.status}`);
    }

    res.status(200).json({
      status: 'Sent',
      message: 'SMS dispatched successfully via Twilio.',
      sid: data.sid
    });
  } catch (error) {
    console.error('Serverless SMS dispatch error:', error);
    // If Twilio fails (e.g. unverified phone number in trial account), return a soft success with simulation info
    // to prevent blocking checkout or admin operations.
    res.status(200).json({
      status: 'Simulated (Twilio API Error)',
      message: `Twilio API error occurred: ${error.message}. Defaulting to local simulator.`,
      error: error.message
    });
  }
}
