import type { FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import type { ChannelInterface } from "../interface/channelInterface";

const prisma = new PrismaClient();

// Récupérer tous les channels
export async function getAllChannels(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const channels = await prisma.channel.findMany({
      orderBy: { name: "asc" }
    });
    
    return reply.status(200).send({ channels });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Erreur interne du serveur" });
  }
}

// Créer un nouveau channel
export async function createChannel(
  request: FastifyRequest<{ Body: ChannelInterface }>,
  reply: FastifyReply
) {
  try {
    const { name } = request.body;
    
    if (!name) {
      return reply.status(400).send({ message: "Le nom du canal est requis" });
    }
    
    // Vérifier si le channel existe déjà
    const existingChannel = await prisma.channel.findFirst({
      where: { name }
    });
    
    if (existingChannel) {
      return reply.status(400).send({ message: "Ce canal existe déjà" });
    }
    
    const channel = await prisma.channel.create({
      data: { name }
    });
    
    return reply.status(201).send({ channel });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Erreur interne du serveur" });
  }
}

// Récupérer un channel par son ID
export async function getChannelById(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    
    const channel = await prisma.channel.findUnique({
      where: { id }
    });
    
    if (!channel) {
      return reply.status(404).send({ message: "Canal non trouvé" });
    }
    
    return reply.status(200).send({ channel });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Erreur interne du serveur" });
  }
}

// Récupérer un channel par son nom ou le créer s"il n"existe pas
export async function getOrCreateChannelByName(name: string) {
  let channel = await prisma.channel.findFirst({
    where: { name }
  });
  
  if (!channel) {
    channel = await prisma.channel.create({
      data: { name }
    });
  }
  
  return channel;
}