import fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import prismaPlugin from "./plugins/prisma";
import authRoutes from "./routes/authRoutes";
import feedbackRoutes from "./routes/feedbackRoutes";
import userRoutes from "./routes/userRoutes";

dotenv.config();

const app = fastify({
  logger: true,
});

app.register(cors, {
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
});

app.register(prismaPlugin);
await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(feedbackRoutes, { prefix: "/api" });
await app.register(userRoutes, { prefix: "/api" });


const start = async () => {
  try {
    await app.listen({ port: 3000, host: process.env.HOST || "0.0.0.0" });
    console.log("Server is running on port 3000");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();