import type { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/authMiddleware";
import * as FeedbackController from "../controllers/feedbackController";

export default async function feedbackRoutes(fastify: FastifyInstance) {
  
  fastify.post("/feedback", {preHandler: authenticate}, FeedbackController.addFeedback);
  
  fastify.get("/feedback",  {preHandler: authenticate}, FeedbackController.findAllFeedbacksByUserId);
  fastify.get<{
    Querystring: { text: string };
  }>("/feedback/search", { preHandler: authenticate }, FeedbackController.findByText);
  fastify.get<{
    Params: { channelName: string };
  }>("/feedback/channel/:channelName", { preHandler: authenticate }, FeedbackController.findByChannel);

  fastify.post<{
    Params: { id: string };
  }>("/feedback/delete/:id", { preHandler: authenticate }, FeedbackController.deleteFeedbacksByUserId);

  fastify.delete("/feedback/:id", FeedbackController.deleteFeedback);
  fastify.delete("/feedback", FeedbackController.deleteAllFeedbacks);
}