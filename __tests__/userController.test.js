// Unit tests for user controllers
const { describe, test, expect, beforeEach } = require("@jest/globals");

// Mock environment variables
process.env.JWT_SECRET = "test_jwt_secret_key";

// Mock Prisma Client
const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Import the controllers after mocking
const {
  getUsersController,
  getUserByIdController,
  deleteUserController,
} = require("../controllers/userController");

describe("User Controllers Tests", () => {
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

  describe("getUsersController", () => {
    test("should return all users successfully", async () => {
      const mockUsers = [
        {
          id: "1",
          name: "John Doe",
          email: "john@example.com",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
        {
          id: "2",
          name: "Jane Smith",
          email: "jane@example.com",
          createdAt: new Date("2024-01-02"),
          updatedAt: new Date("2024-01-02"),
        },
      ];

      const mockReply = createMockReply();
      const mockRequest = {};

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      await getUsersController(mockRequest, mockReply);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(mockUsers);
    });

    test("should return empty array when no users exist", async () => {
      const mockReply = createMockReply();
      const mockRequest = {};

      mockPrisma.user.findMany.mockResolvedValue([]);

      await getUsersController(mockRequest, mockReply);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith([]);
    });

    test("should return 500 when database error occurs", async () => {
      const mockReply = createMockReply();
      const mockRequest = {};

      mockPrisma.user.findMany.mockRejectedValue(new Error("Database error"));

      await getUsersController(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("getUserByIdController", () => {
    test("should return user successfully", async () => {
      const mockUser = {
        id: "123",
        name: "John Doe",
        email: "john@example.com",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      const mockReply = createMockReply();
      const mockRequest = {
        params: { id: "123" },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await getUserByIdController(mockRequest, mockReply);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "123" },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(mockUser);
    });

    test("should return 404 when user not found", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        params: { id: "nonexistent" },
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await getUserByIdController(mockRequest, mockReply);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "nonexistent" },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "User not found",
      });
    });

    test("should return 500 when database error occurs", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        params: { id: "123" },
      };

      mockPrisma.user.findUnique.mockRejectedValue(new Error("Database error"));

      await getUserByIdController(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("deleteUserController", () => {
    test("should delete user successfully", async () => {
      const mockUser = {
        id: "123",
        name: "John Doe",
        email: "john@example.com",
        password: "hashedPassword",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      const mockReply = createMockReply();
      const mockRequest = {
        params: { id: "123" },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.delete.mockResolvedValue(mockUser);

      await deleteUserController(mockRequest, mockReply);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "123" },
      });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: "123" },
      });
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "User deleted successfully",
      });
    });

    test("should return 404 when user not found for deletion", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        params: { id: "nonexistent" },
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await deleteUserController(mockRequest, mockReply);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "nonexistent" },
      });
      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "User not found",
      });
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    test("should return 500 when database error occurs during find", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        params: { id: "123" },
      };

      mockPrisma.user.findUnique.mockRejectedValue(new Error("Database error"));

      await deleteUserController(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Internal server error",
      });
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });

    test("should return 500 when database error occurs during deletion", async () => {
      const mockUser = {
        id: "123",
        name: "John Doe",
        email: "john@example.com",
        password: "hashedPassword",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      const mockReply = createMockReply();
      const mockRequest = {
        params: { id: "123" },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.delete.mockRejectedValue(new Error("Delete error"));

      await deleteUserController(mockRequest, mockReply);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "123" },
      });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: "123" },
      });
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });

    test("should handle empty user ID parameter", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        params: { id: "" },
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await deleteUserController(mockRequest, mockReply);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "" },
      });
      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "User not found",
      });
    });
  });
});
