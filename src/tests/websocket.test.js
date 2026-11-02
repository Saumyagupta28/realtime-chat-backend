let wss;
let chatSocket;
const http = require("http");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const app = require("../server");
const initChatSocket = require("../websocket/chat.socket");
const User = require("../models/User");

let server;
let wsUrl;
let testUser;
let token;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_TEST_URI);

  testUser = await User.create({
    name: "WebSocket Test User",
    email: `websocket-${Date.now()}@example.com`,
    passwordHash: "test-password-hash"
  });

  token = jwt.sign(
    { sub: testUser._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  server = http.createServer(app);
 chatSocket = initChatSocket(server);
wss = chatSocket.wss;

  await new Promise((resolve) => {
    server.listen(0, resolve);
  });

  wsUrl = `ws://127.0.0.1:${server.address().port}/ws`;
});


afterAll(async () => {
  if (wss) {
    await new Promise((resolve) => {
      wss.close(resolve);
    });
  }

  if (server) {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }

  if (chatSocket) {
  await chatSocket.waitForPresenceNotifications();
}

  if (testUser) {
    await User.deleteOne({ _id: testUser._id });
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});


test("authenticated user should connect successfully", async () => {
  const ws = new WebSocket(wsUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const response = await new Promise((resolve, reject) => {
    ws.on("message", (data) => {
      resolve(JSON.parse(data.toString()));
    });

    ws.on("error", reject);
  });

  expect(response.type).toBe("connection:success");

  await new Promise((resolve) => {
  ws.once("close", resolve);
  ws.close();
});
});




test("should reject a connection with an invalid JWT", async () => {
  const ws = new WebSocket(wsUrl, {
    headers: {
      Authorization: "Bearer invalid-token"
    }
  });

  const connectionRejected = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error("Server did not reject invalid JWT"));
    }, 5000);

    ws.on("open", () => {
      clearTimeout(timeout);
      ws.close();
      reject(new Error("Invalid JWT was accepted"));
    });

    ws.on("unexpected-response", () => {
      clearTimeout(timeout);
      resolve(true);
    });

    ws.on("error", () => {
      clearTimeout(timeout);
      resolve(true);
    });

    ws.on("close", () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });

  expect(connectionRejected).toBe(true);
});

