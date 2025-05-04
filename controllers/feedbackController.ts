import type { FastifyRequest, FastifyReply } from "fastify";
import * as ChannelController from "./channelController";
import type { Feedback } from "../interface/feedbackInterface";

export async function addFeedback(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    console.log("caca");
    // Récupérer l'ID de l'utilisateur à partir du middleware d'authentification
    const userId = request.user?.userId;
    console.log(request);
    if (!userId) {
      return reply.status(401).send({ 
        message: "Authentification requise pour ajouter un feedback"
      });
    }

    const feedbackItems = Array.isArray(request.body) ? request.body : [request.body];
    
    if (feedbackItems.length === 0) {
      return reply.status(400).send({ 
        message: "Aucune donnée de feedback fournie"
      });
    }

    const createdFeedbacks = [];
    
    for (const item of feedbackItems) {
      const { channel, text } = item;
      
      if (!channel || !text) {
        return reply.status(400).send({ 
          message: "Le canal et le texte sont requis pour chaque feedback"
        });
      }
      
      const channelRecord = await ChannelController.getOrCreateChannelByName(channel);

      const feedback = await request.server.prisma.feedback.create({
        data: {
          channelId: channelRecord.id,
          text,
          UserId: userId  // Utiliser l'ID utilisateur du token JWT
        }
      });

      createdFeedbacks.push({
        id: feedback.id,
        date: feedback.createdAt.toISOString(),
        channel: channelRecord.name,
        text: feedback.text,
        userId: userId
      });
    }

    const response = Array.isArray(request.body) 
      ? createdFeedbacks 
      : createdFeedbacks[0];
    
    return reply.status(201).send(response);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Erreur interne du serveur" });
  }
}

export async function findAllFeedbacks(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const feedbacks = await request.server.prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
      include: { Uploader: { select: { id: true, name: true } } }
    });

    const formattedFeedbacks = await Promise.all(
      feedbacks.map(async (feedback) => {
        const channel = await request.server.prisma.channel.findUnique({
          where: { id: feedback.channelId }
        });
        
        return {
          id: feedback.id,
          date: feedback.createdAt.toISOString(),
          channel: channel?.name || "unknown",
          text: feedback.text,
          user: feedback.Uploader?.name || "Anonyme", 
          userId: feedback.UserId 
        };
      })
    );
    
    return reply.status(200).send(formattedFeedbacks);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Erreur interne du serveur" });
  }
}

export async function findByText(
  request: FastifyRequest<{ Querystring: { text: string } }>,
  reply: FastifyReply
) {
  try {
    const { text } = request.query;
    
    if (!text) {
      return reply.status(400).send({ message: "Le paramètre de recherche est requis" });
    }
    
    const feedbacks = await request.server.prisma.feedback.findMany({
      where: {
        text: {
          contains: text,
          mode: "insensitive" 
        }
      },
      orderBy: { createdAt: "desc" }
    });
    
    const formattedFeedbacks = await Promise.all(
      feedbacks.map(async (feedback) => {
        const channel = await request.server.prisma.channel.findUnique({
          where: { id: feedback.channelId }
        });
        
        return {
          id: feedback.id,
          date: feedback.createdAt.toISOString(),
          channel: channel?.name || "unknown",
          text: feedback.text
        };
      })
    );
    
    return reply.status(200).send(formattedFeedbacks);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Erreur interne du serveur" });
  }
}

export async function findByChannel(
  request: FastifyRequest<{ Params: { channelName: string } }>,
  reply: FastifyReply
) {
  try {
    const { channelName } = request.params;
    
    if (!channelName) {
      return reply.status(400).send({ message: "Le nom du canal est requis" });
    }
    
    const channel = await request.server.prisma.channel.findFirst({
      where: { name: channelName }
    });
    
    if (!channel) {
      return reply.status(404).send({ message: "Canal non trouvé" });
    }
    
    const feedbacks = await request.server.prisma.feedback.findMany({
      where: { channelId: channel.id },
      orderBy: { createdAt: "desc" }
    });
    
    const formattedFeedbacks = feedbacks.map((feedback) => ({
      id: feedback.id,
      date: feedback.createdAt.toISOString(),
      channel: channelName,
      text: feedback.text
    }));
    
    return reply.status(200).send(formattedFeedbacks);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Erreur interne du serveur" });
  }
}