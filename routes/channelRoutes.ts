import type { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/authMiddleware";
import * as ChannelController from "../controllers/channelController";

export default async function channelRoutes(fastify: FastifyInstance) {
  // Routes pour la gestion des channels
  fastify.get("/channels", ChannelController.getAllChannels);
  fastify.post("/channels", ChannelController.createChannel);
  fastify.get("/channels/:id", ChannelController.getChannelById);
}