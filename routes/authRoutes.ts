import * as AuthController from "../controllers/authController.js";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/authMiddleware.js";

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/register", AuthController.registerController);

  fastify.post("/login", AuthController.loginController);

  fastify.get("/me", { preHandler: authenticate }, AuthController.getCurrentUser);

  fastify.get("/health", async (request, reply) => {
    return reply.status(200).send({ status: "ok" });
  });
}