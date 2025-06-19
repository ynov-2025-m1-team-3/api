import "./instrument"; // Import Sentry en premier
import fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import prismaPlugin from "./plugins/prisma";
import redisPlugin from "./plugins/redis";
import authRoutes from "./routes/authRoutes";
import feedbackRoutes from "./routes/feedbackRoutes";
import userRoutes from "./routes/userRoutes";
import metricsRoutes from "./routes/redisRoutes";
import * as Sentry from "@sentry/bun";
import { SentryLogger } from "./lib/sentryLogger";

dotenv.config();

const app = fastify({
  logger: true,
});

// Middleware Sentry pour Fastify
app.addHook("onRequest", async (request, reply) => {
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
});

app.addHook("onResponse", async (request, reply) => {
  if (request.sentryTransaction) {
    request.sentryTransaction.setStatus({ code: reply.statusCode >= 400 ? 2 : 1 });
    request.sentryTransaction.end();
  }
});

// Global error handler avec Sentry
app.setErrorHandler((error, request, reply) => {
  SentryLogger.logApiError(request.url, error, {
    method: request.method,
    body: request.body,
    query: request.query,
    headers: request.headers,
    statusCode: reply.statusCode
  });
  
  app.log.error(error);
  
  reply.status(500).send({ 
    message: "Erreur interne du serveur",
    error: process.env.NODE_ENV === "development" ? error.message : undefined
  });
});

app.register(cors, {
  origin: process.env.CORS_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
});

app.register(prismaPlugin);
app.register(redisPlugin);
await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(feedbackRoutes, { prefix: "/api" });
await app.register(userRoutes, { prefix: "/api" });
await app.register(metricsRoutes, { prefix: "/api" });


const start = async () => {
  try {
    SentryLogger.logInfo("Starting API server", {
      port: process.env.PORT || 3000,
      environment: process.env.NODE_ENV || "development"
    });
    
    await app.listen({
      port: parseInt(process.env.PORT || "3000"),
      host: "0.0.0.0",
    });
    
    SentryLogger.logInfo("API server started successfully", {
      port: process.env.PORT || 3000
    });
    
  } catch (err) {
    SentryLogger.logError(err as Error, {
      context: "server_startup",
      port: process.env.PORT || 3000
    });
    
    app.log.error(err);
    process.exit(1);
  }
};

start();

// Declare module pour TypeScript
declare module "fastify" {
  interface FastifyRequest {
    sentryTransaction?: any;
  }
}