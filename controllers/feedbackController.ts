import type { FastifyRequest, FastifyReply } from "fastify";
import * as ChannelController from "./channelController";
import natural from "natural";

// Initialiser les outils d'analyse de texte
const tokenizer = new natural.WordTokenizer();
const analyzer = new natural.SentimentAnalyzer(
  "French",
  natural.PorterStemmer,
  "pattern",
);

// Dictionnaire de mots positifs et négatifs en français
const frenchLexicon = {
  positifs: [
    "excellent",
    "excellente",
    "parfait",
    "parfaite",
    "bon",
    "bonne",
    "super",
    "génial",
    "incroyable",
    "efficace",
    "réactif",
    "réactive",
    "agréable",
    "satisfait",
    "satisfaite",
    "rapide",
    "fiable",
    "utile",
    "pratique",
    "aime",
    "adore",
    "apprécie",
    "recommande",
    "facile",
    "clair",
    "claire",
    "performant",
  ],
  négatifs: [
    "mauvais",
    "mauvaise",
    "horrible",
    "terrible",
    "décevant",
    "décevante",
    "problème",
    "bug",
    "erreur",
    "lent",
    "lente",
    "cher",
    "chère",
    "coûteux",
    "difficile",
    "compliqué",
    "compliquée",
    "inutile",
    "manque",
    "défaut",
    "insuffisant",
    "insuffisante",
    "déçu",
    "déçue",
    "déteste",
    "pénible",
  ],
  négations: ["pas", "ne", "plus", "sans", "aucun", "aucune", "jamais", "ni"],
  intensificateurs: [
    "très",
    "trop",
    "extrêmement",
    "vraiment",
    "totalement",
    "complètement",
    "particulièrement",
  ],
};

// Fonction améliorée d'analyse de sentiment pour le français
function analyzeTextSentiment(text: string) {
  // Prétraitement du texte
  const cleanText = text.toLowerCase().trim();

  // Tokenisation appropriée
  const tokens = tokenizer.tokenize(cleanText) || [];

  // Si pas de tokens valides, retourner un score neutre
  if (tokens.length === 0) {
    return 0;
  }

  // Score de base avec l'analyseur de Natural
  const baseScore = analyzer.getSentiment(tokens);

  // Analyse lexicale personnalisée
  let customScore = 0;
  let negationActive = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Vérifier si c'est une négation
    if (frenchLexicon.négations.includes(token)) {
      negationActive = true;
      continue;
    }

    // Calculer l'impact des mots positifs/négatifs
    if (frenchLexicon.positifs.includes(token)) {
      customScore += negationActive ? -0.5 : 0.5;
    } else if (frenchLexicon.négatifs.includes(token)) {
      customScore += negationActive ? 0.3 : -0.5;
    }

    // Réinitialiser l'effet de négation après 3 tokens
    if (negationActive && i > 0 && i % 3 === 0) {
      negationActive = false;
    }

    // Vérifier si c'est un intensificateur (uniquement pour le mot suivant)
    if (
      frenchLexicon.intensificateurs.includes(token) &&
      i < tokens.length - 1
    ) {
      // Amplifier l'effet du mot suivant
      if (frenchLexicon.positifs.includes(tokens[i + 1])) {
        customScore += 0.3;
      } else if (frenchLexicon.négatifs.includes(tokens[i + 1])) {
        customScore -= 0.3;
      }
    }
  }

  // Combiner les scores (donner plus de poids à l'analyse personnalisée)
  const finalScore = baseScore * 0.3 + customScore * 0.7;

  // Normaliser entre -1 et 1
  return Math.max(-1, Math.min(1, finalScore));
}

export async function addFeedback(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    // Récupérer l'ID de l'utilisateur à partir du middleware d'authentification
    const userId = request.user?.userId;
    if (!userId) {
      return reply.status(401).send({
        message: "Authentification requise pour ajouter un feedback",
      });
    }

    const feedbackItems = Array.isArray(request.body)
      ? request.body
      : [request.body];

    if (feedbackItems.length === 0) {
      return reply.status(400).send({
        message: "Aucune donnée de feedback fournie",
      });
    }

    const createdFeedbacks = [];

    for (const item of feedbackItems) {
      const { channel, text } = item;

      if (!channel || !text) {
        return reply.status(400).send({
          message: "Le canal et le texte sont requis pour chaque feedback",
        });
      }

      // Utiliser la fonction améliorée d'analyse de sentiment
      const sentimentScore = analyzeTextSentiment(text);

      const channelRecord =
        await ChannelController.getOrCreateChannelByName(channel);

      const feedback = await request.server.prisma.feedback.create({
        data: {
          channelId: channelRecord.id,
          text,
          UserId: userId,
          sentiment: sentimentScore,
        },
      });

      createdFeedbacks.push({
        id: feedback.id,
        date: feedback.createdAt.toISOString(),
        channel: channelRecord.name,
        text: feedback.text,
        userId: userId,
        sentiment: sentimentScore,
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
  reply: FastifyReply,
) {
  try {
    const feedbacks = await request.server.prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
      include: { Uploader: { select: { id: true, name: true } } },
    });

    const formattedFeedbacks = await Promise.all(
      feedbacks.map(async (feedback) => {
        const channel = await request.server.prisma.channel.findUnique({
          where: { id: feedback.channelId },
        });

        return {
          id: feedback.id,
          date: feedback.createdAt.toISOString(),
          channel: channel?.name || "unknown",
          text: feedback.text,
          user: feedback.Uploader?.name || "Anonyme",
          userId: feedback.UserId,
          sentiment: feedback.sentiment,
        };
      }),
    );

    return reply.status(200).send(formattedFeedbacks);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Erreur interne du serveur" });
  }
}

export async function findByText(
  request: FastifyRequest<{ Querystring: { text: string } }>,
  reply: FastifyReply,
) {
  try {
    const { text } = request.query;

    if (!text) {
      return reply
        .status(400)
        .send({ message: "Le paramètre de recherche est requis" });
    }

    const feedbacks = await request.server.prisma.feedback.findMany({
      where: {
        text: {
          contains: text,
          mode: "insensitive",
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedFeedbacks = await Promise.all(
      feedbacks.map(async (feedback) => {
        const channel = await request.server.prisma.channel.findUnique({
          where: { id: feedback.channelId },
        });

        return {
          id: feedback.id,
          date: feedback.createdAt.toISOString(),
          channel: channel?.name || "unknown",
          text: feedback.text,
          feedback: feedback.sentiment,
        };
      }),
    );

    return reply.status(200).send(formattedFeedbacks);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Erreur interne du serveur" });
  }
}

export async function findByChannel(
  request: FastifyRequest<{ Params: { channelName: string } }>,
  reply: FastifyReply,
) {
  try {
    const { channelName } = request.params;

    if (!channelName) {
      return reply.status(400).send({ message: "Le nom du canal est requis" });
    }

    const channel = await request.server.prisma.channel.findFirst({
      where: { name: channelName },
    });

    if (!channel) {
      return reply.status(404).send({ message: "Canal non trouvé" });
    }

    const feedbacks = await request.server.prisma.feedback.findMany({
      where: { channelId: channel.id },
      orderBy: { createdAt: "desc" },
    });

    const formattedFeedbacks = feedbacks.map((feedback) => ({
      id: feedback.id,
      date: feedback.createdAt.toISOString(),
      channel: channelName,
      text: feedback.text,
      sentiment: feedback.sentiment,
    }));

    return reply.status(200).send(formattedFeedbacks);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Erreur interne du serveur" });
  }
}
export async function deleteFeedback(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  try {
    const { id } = request.params;

    const feedback = await request.server.prisma.feedback.findUnique({
      where: { id },
    });

    if (!feedback) {
      return reply.status(404).send({ message: "Feedback non trouvé" });
    }

    await request.server.prisma.feedback.delete({
      where: { id },
    });

    return reply.status(200).send({ message: "Feedback supprimé avec succès" });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Erreur interne du serveur" });
  }
}

export async function deleteAllFeedbacks(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const count = await request.server.prisma.feedback.count();

    await request.server.prisma.feedback.deleteMany({});

    return reply.status(200).send({
      message: `${count} feedbacks supprimés avec succès`,
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Erreur interne du serveur" });
  }
}
