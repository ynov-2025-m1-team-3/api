// Instrument.js - Sentry pour Node.js
import * as Sentry from "@sentry/node";

console.log("📊 Initializing Sentry for Node.js:", {
  NODE_ENV: process.env.NODE_ENV,
  SENTRY_DSN: process.env.SENTRY_DSN ? 'SET' : 'NOT_SET'
});

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  
  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Intégrations Node.js
  integrations: [
    Sentry.httpIntegration(),
    Sentry.consoleIntegration(),
  ],
  
  // Enhanced error context
  beforeSend(event, hint) {
    if (event.request) {
      event.tags = {
        ...event.tags,
        api_endpoint: event.request.url,
        method: event.request.method,
      };
    }
    return event;
  },
});

console.log("✅ Sentry initialized successfully for Node.js");

export default Sentry;