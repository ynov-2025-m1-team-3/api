import fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import prismaPlugin from "./plugins/prisma";
import redisPlugin from "./plugins/redis";
import authRoutes from "./routes/authRoutes";
import feedbackRoutes from "./routes/feedbackRoutes";
import userRoutes from "./routes/userRoutes";
import metricsRoutes from "./routes/redisRoutes";

// Import conditionnel de Sentry pour éviter les conflits sur Render
let Sentry: any = null;
let SentryLogger: any = null;

try {
  // Sentry activé seulement en développement ou si explicitement activé
  if (process.env.NODE_ENV !== "production" || process.env.ENABLE_SENTRY === "true") {
    require("./instrument");
    Sentry = require("@sentry/bun");
    SentryLogger = require("./lib/sentryLogger").SentryLogger;
    console.log("✅ Sentry loaded successfully");
  } else {
    console.log("⚠️ Sentry disabled in production to avoid shimmer conflicts");
  }
} catch (error) {
  console.warn("⚠️ Sentry initialization failed, continuing without it:", (error as Error).message);
}

dotenv.config();

const app = fastify({
  logger: true,
});

// Middleware Sentry pour Fastify (seulement si Sentry est disponible)
if (Sentry) {
  app.addHook("onRequest", async (request, reply) => {
    try {
      const span = Sentry.startSpan({
        op: "http.server",
        name: `${request.method} ${request.url}`,
      }, () => {});
      
      request.sentryTransaction = span;
      const scope = Sentry.getCurrentScope();
      scope.setTag("method", request.method);
      scope.setTag("url", request.url);
      scope.setContext("request", {
        method: request.method,
        url: request.url,
        headers: request.headers,
        query: request.query,
      });
    } catch (error) {
      // Ignore les erreurs Sentry pour ne pas casser l'app
      console.warn("Sentry onRequest hook failed:", error);
    }
  });

  app.addHook("onResponse", async (request, reply) => {
    try {
      if (request.sentryTransaction) {
        request.sentryTransaction.setStatus({ code: reply.statusCode >= 400 ? 2 : 1 });
        request.sentryTransaction.end();
      }
    } catch (error) {
      // Ignore les erreurs Sentry pour ne pas casser l'app
      console.warn("Sentry onResponse hook failed:", error);
    }
  });
}

// Global error handler avec Sentry (conditionnel)
app.setErrorHandler((error, request, reply) => {
  // Log avec Sentry si disponible
  if (SentryLogger) {
    try {
      SentryLogger.logApiError(request.url, error, {
        method: request.method,
        body: request.body,
        query: request.query,
        headers: request.headers,
        statusCode: reply.statusCode
      });
    } catch (sentryError) {
      console.warn("Sentry logging failed:", sentryError);
    }
  }
    // Log standard
  console.error(`API Error on ${request.method} ${request.url}:`, error);
  
  // Réponse d'erreur
  reply.status(500).send({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? error.message : "Something went wrong"
  });
});

app.register(cors, {
  origin: process.env.CORS_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
});

// Fonction async pour la configuration des routes
async function setupApp() {
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(authRoutes, { prefix: "/api/auth" });  await app.register(feedbackRoutes, { prefix: "/api" });
  await app.register(userRoutes, { prefix: "/api" });
  await app.register(metricsRoutes, { prefix: "/api" });
  
  // Démarrer le serveur
  await app.listen({
    port: parseInt(process.env.PORT || "3000"),
    host: "0.0.0.0",
  });
  
  console.log(`🚀 Server listening on port ${process.env.PORT || 3000}`);
}

// Fonction de démarrage
const start = async () => {
  try {
    if (SentryLogger) {
      SentryLogger.logInfo("Starting API server", {
        port: process.env.PORT || 3000,
        environment: process.env.NODE_ENV || "development"
      });
    }
    
    await setupApp();
    
    if (SentryLogger) {
      SentryLogger.logInfo("API server started successfully", {
        port: process.env.PORT || 3000
      });
    }
    
  } catch (err) {
    if (SentryLogger) {
      SentryLogger.logError(err as Error, {
        context: "server_startup",
        port: process.env.PORT || 3000
      });
    }
    
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

// Lancer le serveur
start();

// Declare module pour TypeScript
declare module "fastify" {
  interface FastifyRequest {
    sentryTransaction?: any;
  }
}