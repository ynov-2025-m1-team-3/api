import fastify from "fastify";
import prismaPlugin from "./plugins/prisma";
import authRoutes from "./routes/authRoutes";
import feedbackRoutes from "./routes/feedbackRoutes";

const app = fastify({
  logger: true,
});

app.get("/", async (request, reply) => {
  return { message: "Hello, Fastify!" };
});

app.register(prismaPlugin);
app.register(authRoutes, { prefix: "/" });
app.register(feedbackRoutes, { prefix: "/" });


const start = async () => {
  try {
    await app.listen({ port: 3000, host: "0.0.0.0" });
    console.log("Server is running on port 3000");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();