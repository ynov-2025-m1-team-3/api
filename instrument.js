// Instrument.js - Conditionnellement charger Sentry
console.log("📊 Instrument.js - Environment check:", {
  NODE_ENV: process.env.NODE_ENV,
  SENTRY_DSN: process.env.SENTRY_DSN ? 'SET' : 'NOT_SET',
  ENABLE_SENTRY: process.env.ENABLE_SENTRY,
  isBun: typeof Bun !== "undefined"
});

// Complètement éviter d'importer Sentry en production
const isProduction = process.env.NODE_ENV === "production";
const sentryExplicitlyEnabled = process.env.ENABLE_SENTRY === "true";
const hasSentryDsn = !!process.env.SENTRY_DSN;

if (!isProduction || (sentryExplicitlyEnabled && hasSentryDsn)) {
  try {
    console.log("🔄 Loading Sentry...");
    const Sentry = await import("@sentry/bun");
    
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: 0.1,
      integrations: [
        Sentry.consoleIntegration(),
      ],
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
    
    console.log("✅ Sentry initialized successfully");
    export default Sentry;
  } catch (error) {
    console.warn("⚠️ Sentry initialization failed:", error.message);
    export default null;
  }
} else {
  console.log("⚠️ Sentry completely disabled in production environment");
  export default null;
}