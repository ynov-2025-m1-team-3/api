// Simple unit tests for authentication controllers in JavaScript
const { describe, test, expect, beforeEach } = require("@jest/globals");

// Mock environment variables
process.env.JWT_SECRET = "test_jwt_secret_key";

// Mock bcryptjs
const mockBcrypt = {
  compare: jest.fn(),
  hash: jest.fn(),
};
jest.mock("bcryptjs", () => mockBcrypt);

// Mock jsonwebtoken
const mockJwt = {
  sign: jest.fn(),
  verify: jest.fn(),
};
jest.mock("jsonwebtoken", () => mockJwt);

// Mock Prisma Client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Import the controllers after mocking
const {
  loginController,
  registerController,
  getCurrentUser,
} = require("../controllers/authController");

describe("Auth Controllers - JavaScript Tests", () => {
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

  describe("loginController", () => {
    test("should return 400 when email is missing", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        body: { password: "password123" },
      };

      await loginController(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "All fields are required",
      });
    });

    test("should return 400 when password is missing", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        body: { email: "test@example.com" },
      };

      await loginController(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "All fields are required",
      });
    });

    test("should return 401 when user does not exist", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        body: { email: "test@example.com", password: "password123" },
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await loginController(mockRequest, mockReply);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Invalid credentials",
      });
    });

    test("should return 401 when password is invalid", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "test@example.com",
        password: "hashedPassword",
      };

      const mockReply = createMockReply();
      const mockRequest = {
        body: { email: "test@example.com", password: "wrongPassword" },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);

      await loginController(mockRequest, mockReply);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        "wrongPassword",
        "hashedPassword",
      );
      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Invalid credentials",
      });
    });

    test("should login successfully with valid credentials", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "test@example.com",
        password: "hashedPassword",
      };

      const mockReply = createMockReply();
      const mockRequest = {
        body: { email: "test@example.com", password: "password123" },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue("mock.token");

      await loginController(mockRequest, mockReply);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        "password123",
        "hashedPassword",
      );
      expect(mockJwt.sign).toHaveBeenCalledWith(
        { id: 1 },
        "test_jwt_secret_key",
        { expiresIn: "1d" },
      );
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        user: mockUser,
        token: "mock.token",
      });
    });

    test("should return 500 when database error occurs", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        body: { email: "test@example.com", password: "password123" },
      };

      mockPrisma.user.findUnique.mockRejectedValue(new Error("Database error"));

      await loginController(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });

  describe("registerController", () => {
    test("should return 400 when name is missing", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        body: { email: "test@example.com", password: "password123" },
      };

      await registerController(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Tous les champs sont requis",
      });
    });

    test("should return 400 when email is missing", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        body: { name: "John Doe", password: "password123" },
      };

      await registerController(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Tous les champs sont requis",
      });
    });

    test("should return 400 when password is missing", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        body: { name: "John Doe", email: "test@example.com" },
      };

      await registerController(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Tous les champs sont requis",
      });
    });

    test("should return 400 when user already exists", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "test@example.com",
      };

      const mockReply = createMockReply();
      const mockRequest = {
        body: {
          name: "John Doe",
          email: "test@example.com",
          password: "password123",
        },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await registerController(mockRequest, mockReply);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Cet email est déjà utilisé",
      });
    });

    test("should register successfully with valid data", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "test@example.com",
        password: "hashedPassword",
      };

      const mockReply = createMockReply();
      const mockRequest = {
        body: {
          name: "John Doe",
          email: "test@example.com",
          password: "password123",
        },
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue("hashedPassword");
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockJwt.sign.mockReturnValue("mock.token");

      await registerController(mockRequest, mockReply);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
      expect(mockBcrypt.hash).toHaveBeenCalledWith("password123", 10);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          name: "John Doe",
          email: "test@example.com",
          password: "hashedPassword",
        },
      });
      expect(mockJwt.sign).toHaveBeenCalledWith(
        { userId: 1 },
        "test_jwt_secret_key",
        { expiresIn: "1d" },
      );
      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        user: {
          id: 1,
          name: "John Doe",
          email: "test@example.com",
        },
        token: "mock.token",
      });
    });

    test("should return 500 when database error occurs", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        body: {
          name: "John Doe",
          email: "test@example.com",
          password: "password123",
        },
      };

      mockPrisma.user.findUnique.mockRejectedValue(new Error("Database error"));

      await registerController(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Erreur interne du serveur",
      });
    });
  });

  describe("getCurrentUser", () => {
    test("should return 404 when user is not found", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        user: { userId: 1 },
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await getCurrentUser(mockRequest, mockReply);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "User not found",
      });
    });

    test("should return current user successfully", async () => {
      const mockUser = {
        id: 1,
        name: "John Doe",
        email: "test@example.com",
      };

      const mockReply = createMockReply();
      const mockRequest = {
        user: { userId: 1 },
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await getCurrentUser(mockRequest, mockReply);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({ user: mockUser });
    });

    test("should return 500 when database error occurs", async () => {
      const mockReply = createMockReply();
      const mockRequest = {
        user: { userId: 1 },
      };

      mockPrisma.user.findUnique.mockRejectedValue(new Error("Database error"));

      await getCurrentUser(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: "Internal server error",
      });
    });
  });
});
