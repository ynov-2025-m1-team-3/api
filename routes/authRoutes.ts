import * as AuthController from "../controllers/authController";
import type { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/authMiddleware";

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/register", AuthController.registerController);

  fastify.post("/login", AuthController.loginController);

  fastify.get("/me", { preHandler: authenticate }, AuthController.getCurrentUser);
}