import * as userController from "../controllers/userController.js";
import type { FastifyInstance } from "fastify";

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get("/users", userController.getUsersController);
  fastify.get("/users/:id", userController.getUserByIdController);
  fastify.delete("/users/:id", userController.deleteUserController);
}