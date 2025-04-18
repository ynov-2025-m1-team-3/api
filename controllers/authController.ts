import type { LoginInterface } from "../interface/loginInterface";
import type { RegisterInterface } from "../interface/registerInterface";
import jwt from "jsonwebtoken";
import bcrypt from 'bcryptjs';
import { PrismaClient } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";

const prisma = new PrismaClient();

export async function loginController(
  request: FastifyRequest<{ Body: LoginInterface }>,
  reply: FastifyReply
) {
  try {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ message: "All fields are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return reply.status(401).send({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "1d",
    });

    return reply.status(200).send({ user, token });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Internal server error" });
  }
}

export async function registerController(
  request: FastifyRequest<{ Body: RegisterInterface }>,
  reply: FastifyReply
) {
  try {
    const {name , email , password } = request.body;
    console.log(request.body);
    const userExisting = await prisma.user.findUnique({
      where: { email },
    });
    if (!name || !email || !password) {
      return reply.status(400).send({ message: "All fields are required" });
    }
    if (userExisting) {
      return reply.status(400).send({ message: "User already exists" });  
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data:{
        name,
        email,
        password: hashedPassword,
      }
    });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "1d",
    });
    return reply.status(201).send({ user, token });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Internal server error" });
  }
}

export async function getCurrentUser(
  request: FastifyRequest,
  reply: FastifyReply
){
  try {
    const userId = request.user.userId;
    const user = await prisma.user.findUnique({
      where:  {id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
    if (!user) {
      return reply.status(404).send({ message: "User not found" });
    }
    return reply.status(200).send({ user });
  }
  catch (error) {
    console.error(error);
    return reply.status(500).send({ message: "Internal server error" });
  }
}