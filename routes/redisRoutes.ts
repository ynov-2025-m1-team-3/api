import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

interface MetricsPayload {
  timestamp?: string;
  metrics: Record<string, any>;
}

export default async function metricsRoutes(fastify: FastifyInstance) {
  // Route pour enregistrer les métriques de performance
  fastify.post("/metrics", async (request: FastifyRequest<{
    Body: MetricsPayload
  }>, reply: FastifyReply) => {
    try {
      const { metrics } = request.body;
      const timestamp = request.body.timestamp || new Date().toISOString();
      
      // Validation des données
      if (!metrics || typeof metrics !== "object") {
        return reply.status(400).send({ 
          error: "Le corps de la requête doit contenir un objet 'metrics'" 
        });
      }
      
      // Sauvegarder dans Redis
      await fastify.redis.hSet(
        "k6_performance",
        timestamp,
        JSON.stringify(metrics)
      );
      
      fastify.log.info(`Métriques enregistrées avec timestamp: ${timestamp}`);
      
      return reply.status(201).send({ 
        success: true, 
        message: "Métriques enregistrées avec succès",
        timestamp
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ 
        error: "Erreur lors de l'enregistrement des métriques",
        details: error.message
      });
    }
  });
  
  // Route pour récupérer les métriques
  fastify.get("/metrics", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const keys = await fastify.redis.hKeys("k6_performance");
      const results = {};
      
      for (const key of keys) {
        const value = await fastify.redis.hGet("k6_performance", key);
        results[key] = JSON.parse(value);
      }
      
      return reply.status(200).send(results);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ 
        error: "Erreur lors de la récupération des métriques",
        details: error.message 
      });
    }
  });
}