// Unit tests for channel controllers
const { describe, test, expect, beforeEach } = require("@jest/globals");

// Mock environment variables
process.env.JWT_SECRET = "test_jwt_secret_key";

// Mock Prisma Client
const mockPrisma = {
  channel: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Import the controllers after mocking
const {
  getAllChannels,
  createChannel,
  getChannelById,
  getOrCreateChannelByName,
} = require("../controllers/channelController");

describe("Channel Controllers Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockReply = () => {
    const mockReply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    return mockReply;
  };

  describe("getAllChannels", () => {
    test("should return all channels successfully", async () => {
      const mockChannels = [
        { id: "1", name: "general", createdAt: new Date(), updatedAt: new Date() },
        { id: "2", name: "support", createdAt: new Date(), updatedAt: new Date() },
      ];

      const mockReply = createMockReply();
      const mockRequest = {};

      mockPrisma.channel.findMany.mockResolvedValue(mockChannels);

      await getAllChannels(mockRequest, mockReply);

      expect(mockPrisma.channel.findMany).toHaveBeenCalledWith({
        orderBy: { name: "asc" },
      });
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({ channels: mockChannels });
    });

    test("should return 500 when database error occurs", async () => {
      const mockReply = createMockReply();
      const mockRequest = {};

      mockPrisma.channel.findMany.mockRejectedValue(new Error("Database error"));

      await getAllChannels(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Erreur interne du serveur",
      });
    });
  });

  describe("createChannel", () => {
    test("should create channel successfully", async () => {
      const mockChannel = {
        id: "1",
        name: "test-channel",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReply = createMockReply();
      const mockRequest = {
        body: { name: "test-channel" },
      };

      mockPrisma.channel.findFirst.mockResolvedValue(null);
      mockPrisma.channel.create.mockResolvedValue(mockChannel);

      await createChannel(mockRequest, mockReply);

      expect(mockPrisma.channel.findFirst).toHaveBeenCalledWith({
        where: { name: "test-channel" },
      });
      expect(mockPrisma.channel.create).toHaveBeenCalledWith({
        data: { name: "test-channel" },
      });
      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({ channel: mockChannel });
    });

    test("should return 400 when name is missing", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        body: {},
      };

      await createChannel(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Le nom du canal est requis",
      });
      expect(mockPrisma.channel.findFirst).not.toHaveBeenCalled();
    });

    test("should return 400 when channel already exists", async () => {
      const existingChannel = {
        id: "1",
        name: "existing-channel",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReply = createMockReply();
      const mockRequest = {
        body: { name: "existing-channel" },
      };

      mockPrisma.channel.findFirst.mockResolvedValue(existingChannel);

      await createChannel(mockRequest, mockReply);

      expect(mockPrisma.channel.findFirst).toHaveBeenCalledWith({
        where: { name: "existing-channel" },
      });
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Ce canal existe déjà",
      });
      expect(mockPrisma.channel.create).not.toHaveBeenCalled();
    });

    test("should return 500 when database error occurs during creation", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        body: { name: "test-channel" },
      };

      mockPrisma.channel.findFirst.mockResolvedValue(null);
      mockPrisma.channel.create.mockRejectedValue(new Error("Database error"));

      await createChannel(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Erreur interne du serveur",
      });
    });

    test("should return 500 when database error occurs during check", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        body: { name: "test-channel" },
      };

      mockPrisma.channel.findFirst.mockRejectedValue(new Error("Database error"));

      await createChannel(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Erreur interne du serveur",
      });
    });
  });

  describe("getChannelById", () => {
    test("should return channel successfully", async () => {
      const mockChannel = {
        id: "123",
        name: "test-channel",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockReply = createMockReply();
      const mockRequest = {
        params: { id: "123" },
      };

      mockPrisma.channel.findUnique.mockResolvedValue(mockChannel);

      await getChannelById(mockRequest, mockReply);

      expect(mockPrisma.channel.findUnique).toHaveBeenCalledWith({
        where: { id: "123" },
      });
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({ channel: mockChannel });
    });

    test("should return 404 when channel not found", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        params: { id: "nonexistent" },
      };

      mockPrisma.channel.findUnique.mockResolvedValue(null);

      await getChannelById(mockRequest, mockReply);

      expect(mockPrisma.channel.findUnique).toHaveBeenCalledWith({
        where: { id: "nonexistent" },
      });
      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Canal non trouvé",
      });
    });

    test("should return 500 when database error occurs", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        params: { id: "123" },
      };

      mockPrisma.channel.findUnique.mockRejectedValue(new Error("Database error"));

      await getChannelById(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Erreur interne du serveur",
      });
    });
  });

  describe("getOrCreateChannelByName", () => {
    test("should return existing channel", async () => {
      const existingChannel = {
        id: "1",
        name: "existing-channel",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.channel.findFirst.mockResolvedValue(existingChannel);

      const result = await getOrCreateChannelByName("existing-channel");

      expect(mockPrisma.channel.findFirst).toHaveBeenCalledWith({
        where: { name: "existing-channel" },
      });
      expect(mockPrisma.channel.create).not.toHaveBeenCalled();
      expect(result).toEqual(existingChannel);
    });

    test("should create new channel when it doesn't exist", async () => {
      const newChannel = {
        id: "2",
        name: "new-channel",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.channel.findFirst.mockResolvedValue(null);
      mockPrisma.channel.create.mockResolvedValue(newChannel);

      const result = await getOrCreateChannelByName("new-channel");

      expect(mockPrisma.channel.findFirst).toHaveBeenCalledWith({
        where: { name: "new-channel" },
      });
      expect(mockPrisma.channel.create).toHaveBeenCalledWith({
        data: { name: "new-channel" },
      });
      expect(result).toEqual(newChannel);
    });

    test("should throw error when database operation fails", async () => {
      mockPrisma.channel.findFirst.mockRejectedValue(new Error("Database error"));

      await expect(getOrCreateChannelByName("test-channel")).rejects.toThrow(
        "Database error",
      );
    });

    test("should throw error when create operation fails", async () => {
      mockPrisma.channel.findFirst.mockResolvedValue(null);
      mockPrisma.channel.create.mockRejectedValue(new Error("Create error"));

      await expect(getOrCreateChannelByName("test-channel")).rejects.toThrow(
        "Create error",
      );
    });
  });
});
