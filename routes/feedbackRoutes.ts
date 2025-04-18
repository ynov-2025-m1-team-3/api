import type { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/authMiddleware";
import * as FeedbackController from "../controllers/feedbackController";

export default async function feedbackRoutes(fastify: FastifyInstance) {

  fastify.post("/feedback", FeedbackController.addFeedback);
  fastify.get("/feedback",  FeedbackController.findAllFeedbacks);
  fastify.get("/feedback/search", FeedbackController.findByText);
  fastify.get("/feedback/channel/:channelName",  FeedbackController.findByChannel);
}