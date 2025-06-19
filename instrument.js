import * as Sentry from "@sentry/bun";

// Vérifier si nous sommes dans un environnement compatible avec Sentry
const isProductionBun = process.env.NODE_ENV === "production" && typeof Bun !== "undefined";
const shouldDisableSentry = isProductionBun || !process.env.SENTRY_DSN;

if (!shouldDisableSentry) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    
    // Performance Monitoring
    tracesSampleRate: 0.1, // Réduit en production
    
    // Intégrations minimales pour éviter les conflits shimmer
    integrations: [
      Sentry.consoleIntegration(),
    ],
    
    // Enhanced error context
    beforeSend(event, hint) {
      // Ajouter des informations contextuelles
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
  
  console.log("✅ Sentry initialized successfully");
} else {
  console.log("⚠️ Sentry disabled for production Bun environment");
}

export default Sentry;