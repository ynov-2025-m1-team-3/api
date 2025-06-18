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
    retryDelayOnFailover: 1000,
    enableReadyCheck: false, // Désactiver pour éviter les reconnexions infinies
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
    retryConnect: (times) => {
      if (times > 5) {
        SentryLogger.logWarning("Redis max retry attempts reached", {
          attempts: times,
          action: "stopping_retries"
        });
        return null; // Arrêter les tentatives de reconnexion
      }
      
      const delay = Math.min(times * 1000, 5000);
      SentryLogger.logInfo("Redis reconnecting", {
        attempt: times,
        delay_ms: delay
      });
      return delay;
    },
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
    };
    
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