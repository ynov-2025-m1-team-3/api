// Unit tests for feedback controllers
const { describe, test, expect, beforeEach } = require("@jest/globals");

// Mock environment variables
process.env.JWT_SECRET = "test_jwt_secret_key";

// Mock natural sentiment analysis
const mockTokenizer = {
  tokenize: jest.fn(),
};

const mockAnalyzer = {
  getSentiment: jest.fn(),
};

const mockNatural = {
  WordTokenizer: jest.fn().mockImplementation(() => mockTokenizer),
  SentimentAnalyzer: jest.fn().mockImplementation(() => mockAnalyzer),
  PorterStemmer: {},
};

jest.mock("natural", () => mockNatural);

// Mock channel controller
const mockChannelController = {
  getOrCreateChannelByName: jest.fn(),
};
jest.mock("../controllers/channelController", () => mockChannelController);

// Mock Prisma Client
const mockPrisma = {
  feedback: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  channel: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
};

// Import the controllers after mocking
const {
  addFeedback,
  findAllFeedbacks,
  findByText,
  findByChannel,
  deleteFeedback,
  deleteAllFeedbacks,
} = require("../controllers/feedbackController");

describe("Feedback Controllers Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockTokenizer.tokenize.mockReturnValue(["test", "message"]);
    mockAnalyzer.getSentiment.mockReturnValue(0.5);
  });

  const createMockReply = () => {
    const mockReply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    return mockReply;
  };

  const createMockRequest = (body, user, query, params, server) => {
    return {
      body,
      user,
      query: query || {},
      params: params || {},
      server: {
        prisma: {
          feedback: mockPrisma.feedback,
          channel: mockPrisma.channel,
        },
        ...server,
      },
    };
  };

  describe("addFeedback", () => {
    test("should add single feedback successfully", async () => {
      const mockChannel = { id: "channel-1", name: "general" };
      const mockFeedback = {
        id: "feedback-1",
        text: "Great service!",
        sentiment: 0.8,
        createdAt: new Date("2024-01-01"),
        channelId: "channel-1",
        UserId: "user-1",
      };

      const mockReply = createMockReply();
      const mockRequest = createMockRequest(
        { channel: "general", text: "Great service!" },
        { userId: "user-1" },
      );
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      mockChannelController.getOrCreateChannelByName.mockResolvedValue(
        mockChannel,
      );
      mockPrisma.feedback.create.mockResolvedValue(mockFeedback);

      await addFeedback(mockRequest, mockReply);

      expect(
        mockChannelController.getOrCreateChannelByName,
      ).toHaveBeenCalledWith("general");
      expect(mockPrisma.feedback.create).toHaveBeenCalledWith({
        data: {
          channelId: "channel-1",
          text: "Great service!",
          UserId: "user-1",
          sentiment: expect.any(Number),
        },
      });
      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        id: "feedback-1",
        date: "2024-01-01T00:00:00.000Z",
        channel: "general",
        text: "Great service!",
        userId: "user-1",
        sentiment: expect.any(Number),
      });
    });

    test("should add multiple feedbacks successfully", async () => {
      const mockChannel = { id: "channel-1", name: "general" };
      const mockFeedbacks = [
        {
          id: "feedback-1",
          text: "Great service!",
          sentiment: 0.8,
          createdAt: new Date("2024-01-01"),
          channelId: "channel-1",
          UserId: "user-1",
        },
        {
          id: "feedback-2",
          text: "Could be better",
          sentiment: -0.2,
          createdAt: new Date("2024-01-01"),
          channelId: "channel-1",
          UserId: "user-1",
        },
      ];

      const mockReply = createMockReply();
      const mockRequest = createMockRequest(
        [
          { channel: "general", text: "Great service!" },
          { channel: "general", text: "Could be better" },
        ],
        { userId: "user-1" },
      );
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      mockChannelController.getOrCreateChannelByName.mockResolvedValue(
        mockChannel,
      );
      mockPrisma.feedback.create
        .mockResolvedValueOnce(mockFeedbacks[0])
        .mockResolvedValueOnce(mockFeedbacks[1]);

      await addFeedback(mockRequest, mockReply);

      expect(
        mockChannelController.getOrCreateChannelByName,
      ).toHaveBeenCalledTimes(2);
      expect(mockPrisma.feedback.create).toHaveBeenCalledTimes(2);
      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: "feedback-1",
            text: "Great service!",
          }),
          expect.objectContaining({
            id: "feedback-2",
            text: "Could be better",
          }),
        ]),
      );
    });

    test("should return 401 when user is not authenticated", async () => {
      const mockReply = createMockReply();
      const mockRequest = createMockRequest(
        { channel: "general", text: "Great service!" },
        null,
      );
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      await addFeedback(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Authentification requise pour ajouter un feedback",
      });
    });

    test("should return 400 when no feedback data provided", async () => {
      const mockReply = createMockReply();
      const mockRequest = createMockRequest([], { userId: "user-1" });
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      await addFeedback(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Aucune donnée de feedback fournie",
      });
    });

    test("should return 400 when channel is missing", async () => {
      const mockReply = createMockReply();
      const mockRequest = createMockRequest(
        { text: "Great service!" },
        { userId: "user-1" },
      );
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      await addFeedback(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Le canal et le texte sont requis pour chaque feedback",
      });
    });

    test("should return 400 when text is missing", async () => {
      const mockReply = createMockReply();
      const mockRequest = createMockRequest(
        { channel: "general" },
        { userId: "user-1" },
      );
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      await addFeedback(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Le canal et le texte sont requis pour chaque feedback",
      });
    });

    test("should return 500 when database error occurs", async () => {
      const mockReply = createMockReply();
      const mockRequest = createMockRequest(
        { channel: "general", text: "Great service!" },
        { userId: "user-1" },
      );
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      mockChannelController.getOrCreateChannelByName.mockRejectedValue(
        new Error("Database error"),
      );

      await addFeedback(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Erreur interne du serveur",
      });
    });
  });

  describe("findAllFeedbacks", () => {
    test("should return all feedbacks successfully", async () => {
      const mockFeedbacks = [
        {
          id: "feedback-1",
          text: "Great service!",
          sentiment: 0.8,
          createdAt: new Date("2024-01-01"),
          channelId: "channel-1",
          UserId: "user-1",
          Uploader: { id: "user-1", name: "John Doe" },
        },
      ];

      const mockChannel = { id: "channel-1", name: "general" };

      const mockReply = createMockReply();
      const mockRequest = createMockRequest();
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      mockPrisma.feedback.findMany.mockResolvedValue(mockFeedbacks);
      mockPrisma.channel.findUnique.mockResolvedValue(mockChannel);

      await findAllFeedbacks(mockRequest, mockReply);

      expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
        include: { Uploader: { select: { id: true, name: true } } },
      });
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith([
        {
          id: "feedback-1",
          date: "2024-01-01T00:00:00.000Z",
          channel: "general",
          text: "Great service!",
          user: "John Doe",
          userId: "user-1",
          sentiment: 0.8,
        },
      ]);
    });

    test("should handle feedback with unknown channel", async () => {
      const mockFeedbacks = [
        {
          id: "feedback-1",
          text: "Great service!",
          sentiment: 0.8,
          createdAt: new Date("2024-01-01"),
          channelId: "channel-1",
          UserId: "user-1",
          Uploader: { id: "user-1", name: "John Doe" },
        },
      ];

      const mockReply = createMockReply();
      const mockRequest = createMockRequest();
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      mockPrisma.feedback.findMany.mockResolvedValue(mockFeedbacks);
      mockPrisma.channel.findUnique.mockResolvedValue(null);

      await findAllFeedbacks(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith([
        expect.objectContaining({
          channel: "unknown",
        }),
      ]);
    });

    test("should return 500 when database error occurs", async () => {
      const mockReply = createMockReply();
      const mockRequest = createMockRequest();
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      mockPrisma.feedback.findMany.mockRejectedValue(
        new Error("Database error"),
      );

      await findAllFeedbacks(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Erreur interne du serveur",
      });
    });
  });

  describe("findByText", () => {
    test("should find feedbacks by text successfully", async () => {
      const mockFeedbacks = [
        {
          id: "feedback-1",
          text: "Great service!",
          sentiment: 0.8,
          createdAt: new Date("2024-01-01"),
          channelId: "channel-1",
        },
      ];

      const mockChannel = { id: "channel-1", name: "general" };

      const mockReply = createMockReply();
      const mockRequest = createMockRequest(null, null, { text: "service" });
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      mockPrisma.feedback.findMany.mockResolvedValue(mockFeedbacks);
      mockPrisma.channel.findUnique.mockResolvedValue(mockChannel);

      await findByText(mockRequest, mockReply);

      expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith({
        where: {
          text: {
            contains: "service",
            mode: "insensitive",
          },
        },
        orderBy: { createdAt: "desc" },
      });
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith([
        {
          id: "feedback-1",
          date: "2024-01-01T00:00:00.000Z",
          channel: "general",
          text: "Great service!",
          feedback: 0.8,
        },
      ]);
    });

    test("should return 400 when text parameter is missing", async () => {
      const mockReply = createMockReply();
      const mockRequest = createMockRequest(null, null, {});
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      await findByText(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Le paramètre de recherche est requis",
      });
    });

    test("should return 500 when database error occurs", async () => {
      const mockReply = createMockReply();
      const mockRequest = createMockRequest(null, null, { text: "service" });
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      mockPrisma.feedback.findMany.mockRejectedValue(
        new Error("Database error"),
      );

      await findByText(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Erreur interne du serveur",
      });
    });
  });

  describe("findByChannel", () => {
    test("should find feedbacks by channel successfully", async () => {
      const mockChannel = { id: "channel-1", name: "general" };
      const mockFeedbacks = [
        {
          id: "feedback-1",
          text: "Great service!",
          sentiment: 0.8,
          createdAt: new Date("2024-01-01"),
          channelId: "channel-1",
        },
      ];

      const mockReply = createMockReply();
      const mockRequest = createMockRequest(null, null, null, {
        channelName: "general",
      });
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      mockPrisma.channel.findFirst.mockResolvedValue(mockChannel);
      mockPrisma.feedback.findMany.mockResolvedValue(mockFeedbacks);

      await findByChannel(mockRequest, mockReply);

      expect(mockPrisma.channel.findFirst).toHaveBeenCalledWith({
        where: { name: "general" },
      });
      expect(mockPrisma.feedback.findMany).toHaveBeenCalledWith({
        where: { channelId: "channel-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith([
        {
          id: "feedback-1",
          date: "2024-01-01T00:00:00.000Z",
          channel: "general",
          text: "Great service!",
          sentiment: 0.8,
        },
      ]);
    });

    test("should return 400 when channel name is missing", async () => {
      const mockReply = createMockReply();
      const mockRequest = createMockRequest(null, null, null, {});
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      await findByChannel(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Le nom du canal est requis",
      });
    });

    test("should return 404 when channel not found", async () => {
      const mockReply = createMockReply();
      const mockRequest = createMockRequest(null, null, null, {
        channelName: "nonexistent",
      });
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      mockPrisma.channel.findFirst.mockResolvedValue(null);

      await findByChannel(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Canal non trouvé",
      });
    });

    test("should return 500 when database error occurs", async () => {
      const mockReply = createMockReply();
      const mockRequest = createMockRequest(null, null, null, {
        channelName: "general",
      });
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      mockPrisma.channel.findFirst.mockRejectedValue(
        new Error("Database error"),
      );

      await findByChannel(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Erreur interne du serveur",
      });
    });
  });

  describe("deleteFeedback", () => {
    test("should delete feedback successfully", async () => {
      const mockFeedback = {
        id: "feedback-1",
        text: "Great service!",
        sentiment: 0.8,
        createdAt: new Date("2024-01-01"),
        channelId: "channel-1",
      };

      const mockReply = createMockReply();
      const mockRequest = createMockRequest(null, null, null, {
        id: "feedback-1",
      });
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      mockPrisma.feedback.findUnique.mockResolvedValue(mockFeedback);
      mockPrisma.feedback.delete.mockResolvedValue(mockFeedback);

      await deleteFeedback(mockRequest, mockReply);

      expect(mockPrisma.feedback.findUnique).toHaveBeenCalledWith({
        where: { id: "feedback-1" },
      });
      expect(mockPrisma.feedback.delete).toHaveBeenCalledWith({
        where: { id: "feedback-1" },
      });
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Feedback supprimé avec succès",
      });
    });

    test("should return 404 when feedback not found", async () => {
      const mockReply = createMockReply();
      const mockRequest = createMockRequest(null, null, null, {
        id: "nonexistent",
      });
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      mockPrisma.feedback.findUnique.mockResolvedValue(null);

      await deleteFeedback(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Feedback non trouvé",
      });
      expect(mockPrisma.feedback.delete).not.toHaveBeenCalled();
    });

    test("should return 500 when database error occurs", async () => {
      const mockReply = createMockReply();
      const mockRequest = createMockRequest(null, null, null, {
        id: "feedback-1",
      });

      mockPrisma.feedback.findUnique.mockRejectedValue(
        new Error("Database error"),
      );

      await deleteFeedback(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Erreur interne du serveur",
      });
    });
  });

  describe("deleteAllFeedbacks", () => {
    test("should delete all feedbacks successfully", async () => {
      const mockReply = createMockReply();
      const mockRequest = createMockRequest();
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      mockPrisma.feedback.count.mockResolvedValue(5);
      mockPrisma.feedback.deleteMany.mockResolvedValue({ count: 5 });

      await deleteAllFeedbacks(mockRequest, mockReply);

      expect(mockPrisma.feedback.count).toHaveBeenCalled();
      expect(mockPrisma.feedback.deleteMany).toHaveBeenCalledWith({});
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "5 feedbacks supprimés avec succès",
      });
    });

    test("should handle deletion when no feedbacks exist", async () => {
      const mockReply = createMockReply();
      const mockRequest = createMockRequest();
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      mockPrisma.feedback.count.mockResolvedValue(0);
      mockPrisma.feedback.deleteMany.mockResolvedValue({ count: 0 });

      await deleteAllFeedbacks(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "0 feedbacks supprimés avec succès",
      });
    });

    test("should return 500 when database error occurs", async () => {
      const mockReply = createMockReply();
      const mockRequest = createMockRequest();
      mockRequest.server.prisma = {
        feedback: mockPrisma.feedback,
        channel: mockPrisma.channel,
      };

      mockPrisma.feedback.count.mockRejectedValue(new Error("Database error"));

      await deleteAllFeedbacks(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Erreur interne du serveur",
      });
    });
  });
});
