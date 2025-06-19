import * as Sentry from "@sentry/bun";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  
  // Performance Monitoring
  tracesSampleRate: 1.0,
    // Capture Console
  integrations: [
    // Désactivé temporairement pour Bun ESM compatibility
    // Sentry.httpIntegration({
    //   tracing: {
    //     instrumentIncomingRequests: true,
    //     instrumentOutgoingRequests: true,
    //   },
    // }),
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
  
  // Configuration des traces
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/yourserver\.io\/api\//,
    /^http:\/\/localhost:3000\//
  ],
});

export default Sentry;