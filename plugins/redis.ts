import Redis from "ioredis";
import fp from "fastify-plugin";
import { SentryLogger } from "../lib/sentryLogger";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

export default fp(async (fastify) => {
  const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || "",
    enableReadyCheck: false,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
  });

  // Handle Redis connection events avec Sentry
  redis.on("connect", () => {
    SentryLogger.logInfo("Redis client connected successfully");
  });

  redis.on("ready", () => {
    SentryLogger.logInfo("Redis client ready");
  });

  redis.on("error", (err) => {
    SentryLogger.logError(err, {
      component: "redis",
      action: "connection_error"
    });
  });

  redis.on("close", () => {
    SentryLogger.logWarning("Redis client connection closed");
  });

  redis.on("end", () => {
    SentryLogger.logWarning("Redis client connection ended");
  });

  // Connect to Redis with better error handling
  try {
    await redis.connect();
    fastify.decorate("redis", redis);
    SentryLogger.logInfo("Redis client successfully connected and decorated");
  } catch (error) {
    SentryLogger.logError(error as Error, {
      component: "redis",
      action: "initial_connection_failed"
    });
      // Create a mock redis object for graceful degradation
    const mockRedis = {
      get: async () => null,
      set: async () => "OK",
      del: async () => 1,
      exists: async () => 0,
      keys: async () => [],
      quit: async () => "OK",
      disconnect: () => {},
    } as any; // Type assertion pour contourner le problème de type
    
    fastify.decorate("redis", mockRedis);
    SentryLogger.logWarning("Using mock Redis client due to connection failure");
  }

  fastify.addHook("onClose", async (instance) => {
    try {
      if (instance.redis && typeof instance.redis.quit === "function") {
        await instance.redis.quit();
        SentryLogger.logInfo("Redis connection closed gracefully");
      }
    } catch (error) {
      SentryLogger.logError(error as Error, {
        component: "redis",
        action: "graceful_shutdown_error"
      });
    }
  });
});