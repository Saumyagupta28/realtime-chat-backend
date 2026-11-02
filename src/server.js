
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const errorHandler = require("./middleware/error.middleware");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
require("dotenv").config();
const validateEnv = require("./config/env");

const http = require("http");
const express = require("express");
const connectDB = require("./config/db");
const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./routes/auth.routes");
const conversationRoutes = require("./routes/conversation.routes");
const messageRoutes = require("./routes/message.routes");


const initChatSocket = require("./websocket/chat.socket");

const app = express();


// Add common security headers
app.use(helmet());


// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  }
});

// Stricter limit for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later."
  }
});

// Apply rate limits before registering routes
app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);


app.use(express.json({ limit: "10kb" }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use(errorHandler);



async function startServer() {
  try {

    validateEnv();
    const PORT = Number(process.env.PORT);
    await connectDB();

    
const server = http.createServer(app);

// Keep a reference to the WebSocket server
const { wss } = initChatSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("WebSocket server ready at /ws");
});

// Graceful shutdown
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.log(`${signal} received. Shutting down gracefully...`);

  // Stop accepting new WebSocket connections
  

  // Close all active WebSocket connections
  for (const client of wss.clients) {
    client.close(1001, "Server shutting down");
  }
  wss.close();

  // Close HTTP server and MongoDB connection
  server.close(async (error) => {
    try {
      await mongoose.connection.close();
      console.log("MongoDB connection closed");

      if (error) {
        console.error("HTTP server shutdown error:", error);
        process.exitCode = 1;
      } else {
        console.log("Server shut down successfully");
      }
    } catch (dbError) {
      console.error("MongoDB shutdown error:", dbError);
      process.exitCode = 1;
    }
  });

  // Force exit if connections don't close in time
  setTimeout(() => {
    console.error("Shutdown timed out. Forcing exit.");
    process.exit(1);
  }, 10000).unref();
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));


  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;