import express, { Request, Response } from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.raw({ type: 'application/json' }));

// CORS middleware for serving JavaScript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Pixel script endpoint - serves the JavaScript that will be imported by Shopify
app.get("/pixel-script", (req: Request, res: Response) => {
  const shopId = req.query.shop || 'default';
  
  // Set proper headers for JavaScript content
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  
  const pixelScript = `
// Shopify Pixel Script
console.log('Custom pixel script loaded for shop: ${shopId}');

console.log('Initializing custom pixel analytics');

// Subscribe to all Shopify events
analytics.subscribe('all_events', (event) => {
    console.log('Shopify event captured:', event.name, event);
    
    // Prepare payload for webhook
    const payload = {
      timestamp: new Date().toISOString(),
      shop: '${shopId}',
      eventName: event.name,
      eventData: event,
      customerId: event.customerId || null,
      clientId: event.clientId || null,
      url: event.context?.document?.url || null,
      userAgent: event.context?.navigator?.userAgent || null
    };
    
    // Send to webhook endpoint
    fetch('https://${req.get('host')}/webhook/shopify-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(error => {
      console.error('Failed to send event to webhook:', error);
    });
  });
  
console.log('Custom pixel initialized successfully');
`;

  res.send(pixelScript);
});

// Webhook endpoint to receive Shopify events
app.post("/webhook/shopify-events", (req: Request, res: Response) => {
  try {
    const eventData = req.body;
    
    // Log the received event
    console.log('=== SHOPIFY EVENT RECEIVED ===');
    console.log('Timestamp:', eventData.timestamp);
    console.log('Shop:', eventData.shop);
    console.log('Event Name:', eventData.eventName);
    console.log('Customer ID:', eventData.customerId);
    console.log('URL:', eventData.url);
    console.log('Full Event Data:', JSON.stringify(eventData, null, 2));
    console.log('==============================');
    
    // Here you can add your custom logic:
    // - Store in database
    // - Send to analytics platforms
    // - Process for business intelligence
    // - Forward to other services
    
    res.status(200).json({ 
      success: true, 
      message: 'Event received and logged',
      eventName: eventData.eventName 
    });
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing event' 
    });
  }
});

// Health check endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    message: "Shopify Pixel Server POC",
    endpoints: {
      pixelScript: "/pixel-script?shop=YOUR_SHOP_ID",
      webhook: "/webhook/shopify-events"
    }
  });
});

// Instructions endpoint
app.get("/instructions", (req: Request, res: Response) => {
  const serverUrl = `${req.protocol}://${req.get('host')}`;
  
  res.json({
    title: "How to use this Shopify Pixel Server",
    steps: [
      "1. In your Shopify admin, go to Settings > Customer events > Web pixels",
      "2. Click 'Add custom pixel'",
      "3. Use this code in your pixel:",
      `async function loadAndInit() {
  try {
    const { init } = await import("${serverUrl}/pixel-script?shop=YOUR_SHOP_ID");
    init(analytics);
  } catch (error) {
    console.error("Error loading custom pixel:", error);
  }
}
loadAndInit();`,
      "4. Replace YOUR_SHOP_ID with your actual shop identifier",
      "5. Save and activate the pixel",
      "6. Events will be logged to this server's console and sent to the webhook"
    ],
    webhookEndpoint: `${serverUrl}/webhook/shopify-events`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Shopify Pixel Server running on http://localhost:${PORT}`);
  console.log(`📝 Pixel Script URL: http://localhost:${PORT}/pixel-script?shop=YOUR_SHOP_ID`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook/shopify-events`);
  console.log(`📋 Instructions: http://localhost:${PORT}/instructions`);
});
