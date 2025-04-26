import fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import prismaPlugin from "./plugins/prisma";
import authRoutes from "./routes/authRoutes";

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
app.register(authRoutes, { prefix: "/" });


const start = async () => {
  try {
    await app.listen({ port: 3000 });
    console.log("Server is running on port 3000");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();