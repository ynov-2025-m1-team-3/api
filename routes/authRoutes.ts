import * as AuthController from '../controllers/authController';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authMiddleware';

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/register', AuthController.registerController);

  fastify.post('/auth/login', AuthController.loginController);

  fastify.get('/auth/me', { preHandler: authenticate }, AuthController.getCurrentUser);
}