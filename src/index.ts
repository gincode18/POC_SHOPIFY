import express, { Request, Response } from "express";
import cors from "cors";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.raw({ type: "application/json" }));

// CORS middleware for serving JavaScript
app.use(cors());

// Pixel script endpoint - serves the JavaScript that will be imported by Shopify
app.get("/pixel-script", (req: Request, res: Response) => {
  const shopId = req.query.shop || "default";

  // Set proper headers for JavaScript content
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "no-cache");

  const pixelScript = `
// Shopify Pixel Script
console.log('Custom pixel script loaded for shop: ${shopId}');

// Initialize function that will be exported
function init(analytics) {
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
    fetch('https://poc-shopify-wheat.vercel.app/webhook/shopify-events', {
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
}

// Export the init function for Shopify to use
export { init };
`;

  res.send(pixelScript);
});

// Webhook endpoint to receive Shopify events
app.post("/webhook/shopify-events", (req: Request, res: Response) => {
  try {
    const eventData = req.body;

    // Log the received event
    console.log("=== SHOPIFY EVENT RECEIVED ===");
    console.log("Timestamp:", eventData.timestamp);
    console.log("Shop:", eventData.shop);
    console.log("Event Name:", eventData.eventName);
    console.log("Customer ID:", eventData.customerId);
    console.log("URL:", eventData.url);
    console.log("Full Event Data:", JSON.stringify(eventData, null, 2));
    console.log("==============================");

    // Here you can add your custom logic:
    // - Store in database
    // - Send to analytics platforms
    // - Process for business intelligence
    // - Forward to other services

    res.status(200).json({
      success: true,
      message: "Event received and logged",
      eventName: eventData.eventName,
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({
      success: false,
      message: "Error processing event",
    });
  }
});

// Shopify App Configuration
const SHOPIFY_APP_CONFIG = {
  clientId: process.env.SHOPIFY_CLIENT_ID || "181a611e074aaa1904c7ed0b88ce4952", // Your client ID from app.toml
  clientSecret: process.env.SHOPIFY_CLIENT_SECRET || "", // REQUIRED: Set this in environment variables
  scopes: "write_pixels,read_customer_events",
  redirectUri: "https://poc-shopify-wheat.vercel.app/shopify/auth/callback",
};

// Validate required environment variables
if (!SHOPIFY_APP_CONFIG.clientSecret) {
  console.error(
    "❌ SHOPIFY_CLIENT_SECRET environment variable is required for real token exchange"
  );
  console.log(
    '💡 Set it in Vercel dashboard or locally: export SHOPIFY_CLIENT_SECRET="your-secret"'
  );
}

// Install shopify using app store - simplified mock version
app.get("/shopify/install/direct", (req: Request, res: Response) => {
  const shop = (req.query.shop as string) || "nabiqtesting.myshopify.com"; // Mock shop

  console.log(`🔄 Starting Shopify OAuth flow for shop: ${shop}`);

  // Generate state for CSRF protection
  const state = crypto.randomBytes(16).toString("hex");

  // Build Shopify OAuth URL
  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.append("client_id", SHOPIFY_APP_CONFIG.clientId);
  authUrl.searchParams.append("scope", SHOPIFY_APP_CONFIG.scopes);
  authUrl.searchParams.append("redirect_uri", SHOPIFY_APP_CONFIG.redirectUri);
  authUrl.searchParams.append("state", state);

  console.log(`📝 OAuth URL generated: ${authUrl.toString()}`);

  // In a real app, you'd store the state in session/database
  // For this mock, we'll just log it
  console.log(`🔐 Generated state: ${state}`);

  // Redirect to Shopify OAuth
  res.redirect(302, authUrl.toString());
});

// Shopify app Callback validation and store installation - simplified mock
app.get("/shopify/auth/callback", async (req: Request, res: Response) => {
  try {
    const { code, shop, state } = req.query;

    console.log(`🔄 Processing OAuth callback for shop: ${shop}`);
    console.log(`📝 Received authorization code: ${code}`);
    console.log(`🔐 Received state: ${state}`);

    if (!code || !shop) {
      throw new Error("Missing required parameters: code or shop");
    }

    // Real token exchange with Shopify API
    const tokenResponse = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: SHOPIFY_APP_CONFIG.clientId,
          client_secret: SHOPIFY_APP_CONFIG.clientSecret,
          code: code,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(
        `Token exchange failed: ${tokenResponse.status} - ${errorText}`
      );
    }

    const tokenData = await tokenResponse.json();

    // Log the real access token from Shopify
    console.log("🎉 ===== SHOPIFY AUTHENTICATION SUCCESS =====");
    console.log(`🏪 Shop: ${shop}`);
    console.log(`🔑 Access Token: ${tokenData.access_token}`);
    console.log(`📊 Granted Scopes: ${tokenData.scope}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    if (tokenData.associated_user) {
      console.log(
        `👤 User: ${tokenData.associated_user.first_name} ${tokenData.associated_user.last_name} (${tokenData.associated_user.email})`
      );
    }
    console.log("===============================================");

    // In a real app, you'd:
    // 1. Store the access token in your database
    // 2. Associate it with the shop
    // 3. Set up any required webhooks

    // Mock successful installation
    const success = true;
    const redirectUri = `https://${shop}/admin/apps`; // Redirect to Shopify admin apps page

    if (success) {
      console.log(`✅ Installation successful, redirecting to: ${redirectUri}`);

      // Set a simple response header to indicate successful installation
      res.setHeader("X-Shopify-Installation", "success");

      // Redirect to Shopify dashboard/apps page
      return res.redirect(302, redirectUri);
    }

    throw new Error("Failed to verify installation");
  } catch (error) {
    console.error("❌ OAuth callback error:", error);
    res.status(500).json({
      error: "Authentication failed",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

// Health check endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    message: "Shopify Pixel Server POC with Authentication",
    endpoints: {
      pixelScript: "/pixel-script?shop=YOUR_SHOP_ID",
      webhook: "/webhook/shopify-events",
      install: "/shopify/install/direct?shop=YOUR_SHOP.myshopify.com",
      callback: "/shopify/auth/callback",
    },
    shopifyApp: {
      clientId: SHOPIFY_APP_CONFIG.clientId,
      scopes: SHOPIFY_APP_CONFIG.scopes,
      redirectUri: SHOPIFY_APP_CONFIG.redirectUri,
    },
  });
});

// Instructions endpoint
app.get("/instructions", (req: Request, res: Response) => {
  // Get the host for the script - use VERCEL_URL if available
  const host = process.env.VERCEL_URL || req.get("host");
  const protocol = process.env.VERCEL_URL ? "https" : req.protocol;
  const serverUrl = `${protocol}://${host}`;

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
      "6. Events will be logged to this server's console and sent to the webhook",
    ],
    webhookEndpoint: `${serverUrl}/webhook/shopify-events`,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Shopify Pixel Server running on http://localhost:${PORT}`);
  console.log(
    `📝 Pixel Script URL: http://localhost:${PORT}/pixel-script?shop=YOUR_SHOP_ID`
  );
  console.log(
    `🔗 Webhook URL: http://localhost:${PORT}/webhook/shopify-events`
  );
  console.log(`📋 Instructions: http://localhost:${PORT}/instructions`);
});
