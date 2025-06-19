import * as Sentry from "@sentry/node";

export const SentryLogger = {
  // Log d'erreur avec contexte
  logError(error: Error, context: Record<string, any> = {}) {
    Sentry.withScope((scope) => {
      // Ajouter des données contextuelles
      Object.keys(context).forEach(key => {
        scope.setExtra(key, context[key]);
      });
      
      scope.setTag("log_type", "error");
      scope.setTag("service", "api");
      Sentry.captureException(error);
    });
  },

  // Log d'information
  logInfo(message: string, data: Record<string, any> = {}) {
    Sentry.withScope((scope) => {
      Object.keys(data).forEach(key => {
        scope.setExtra(key, data[key]);
      });
      
      scope.setTag("log_type", "info");
      scope.setTag("service", "api");
      scope.setLevel("info");
      Sentry.captureMessage(message, "info");
    });
  },

  // Log d'avertissement
  logWarning(message: string, data: Record<string, any> = {}) {
    Sentry.withScope((scope) => {
      Object.keys(data).forEach(key => {
        scope.setExtra(key, data[key]);
      });
      
      scope.setTag("log_type", "warning");
      scope.setTag("service", "api");
      scope.setLevel("warning");
      Sentry.captureMessage(message, "warning");
    });
  },

  // Log d'erreur API
  logApiError(endpoint: string, error: Error, requestData: Record<string, any> = {}) {
    Sentry.withScope((scope) => {
      scope.setTag("log_type", "api_error");
      scope.setTag("service", "api");
      scope.setTag("endpoint", endpoint);
      scope.setExtra("request_data", requestData);
      scope.setExtra("error_details", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      Sentry.captureException(error);
    });
  },

  // Log de performance
  logPerformance(operation: string, duration: number, data: Record<string, any> = {}) {
    Sentry.withScope((scope) => {
      scope.setTag("log_type", "performance");
      scope.setTag("service", "api");
      scope.setTag("operation", operation);
      scope.setExtra("duration_ms", duration);
      
      Object.keys(data).forEach(key => {
        scope.setExtra(key, data[key]);
      });
      
      const level = duration > 1000 ? "warning" : "info";
      Sentry.captureMessage(`${operation} took ${duration}ms`, level);
    });
  }
};