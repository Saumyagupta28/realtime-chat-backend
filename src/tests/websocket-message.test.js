

let charlie;
let charlieToken;
const http = require("http");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const app = require("../server");
const initChatSocket = require("../websocket/chat.socket");

const User = require("../models/User");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

let server;
let wsUrl;
let alice;
let bob;
let aliceToken;
let bobToken;
let conversation;
const clients = [];

function connectWebSocket(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    clients.push(ws);

    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

function waitForMessage(ws, expectedType) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off("message", handleMessage);
      reject(new Error(`Timed out waiting for ${expectedType}`));
    }, 5000);

    function handleMessage(data) {
      const event = JSON.parse(data.toString());

      if (event.type === expectedType) {
        clearTimeout(timeout);
        ws.off("message", handleMessage);
        resolve(event);
      }
    }

    ws.on("message", handleMessage);
  });
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_TEST_URI);

  alice = await User.create({
    name: "Alice",
    email: `alice-ws-${Date.now()}@example.com`,
    passwordHash: "test-password-hash"
  });

  bob = await User.create({
    name: "Bob",
    email: `bob-ws-${Date.now()}@example.com`,
    passwordHash: "test-password-hash"
  });

  charlie = await User.create({
  name: "Charlie",
  email: `charlie-ws-${Date.now()}@example.com`,
  passwordHash: "test-password-hash"
});

charlieToken = jwt.sign(
  { sub: charlie._id.toString() },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);

  aliceToken = jwt.sign(
    { sub: alice._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  bobToken = jwt.sign(
    { sub: bob._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  conversation = await Conversation.create({
    participants: [alice._id, bob._id]
  });

  server = http.createServer(app);
  initChatSocket(server);

  await new Promise((resolve) => {
    server.listen(0, resolve);
  });

  wsUrl = `ws://127.0.0.1:${server.address().port}/ws`;
});

afterAll(async () => {
  await Promise.all(
    clients.map((ws) =>
      new Promise((resolve) => {
        if (ws.readyState === WebSocket.CLOSED) {
          return resolve();
        }

        ws.once("close", resolve);
        ws.close();
      })
    )
  );

  // Allow asynchronous disconnect/presence handlers to finish.
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  if (conversation) {
    await Message.deleteMany({ conversation: conversation._id });
    await Conversation.deleteOne({ _id: conversation._id });
  }

  if (alice && bob) {
    await User.deleteMany({
      _id: { $in: [alice._id, bob._id] }
    });
  }

  if (charlie) {
  await User.deleteOne({ _id: charlie._id });
}

  await mongoose.connection.close();
});

test("Alice should send a real-time message to Bob", async () => {
  const aliceSocket = await connectWebSocket(aliceToken);
  const bobSocket = await connectWebSocket(bobToken);

  // Wait for Bob's incoming message before Alice sends it.
  const bobMessagePromise = waitForMessage(
    bobSocket,
    "message:new"
  );

  aliceSocket.send(
    JSON.stringify({
      type: "message:send",
      payload: {
        conversationId: conversation._id.toString(),
        content: "Hello Bob! This is a real-time test."
      }
    })
  );

  const receivedEvent = await bobMessagePromise;

  expect(receivedEvent.type).toBe("message:new");
  expect(JSON.stringify(receivedEvent)).toContain(
    "Hello Bob! This is a real-time test."
  );

  const savedMessage = await Message.findOne({
    conversation: conversation._id,
    sender: alice._id,
    content: "Hello Bob! This is a real-time test."
  });

  expect(savedMessage).not.toBeNull();
});



test("unauthorized user should not send messages to a conversation", async () => {
  const charlieSocket = await connectWebSocket(charlieToken);

  const errorPromise = waitForMessage(
    charlieSocket,
    "message:error"
  );

  charlieSocket.send(
    JSON.stringify({
      type: "message:send",
      payload: {
        conversationId: conversation._id.toString(),
        content: "I should not be able to send this."
      }
    })
  );

  const errorEvent = await errorPromise;

  expect(errorEvent.type).toBe("message:error");
});

