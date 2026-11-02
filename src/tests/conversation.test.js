
const request = require("supertest");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = require("../server");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

let aliceToken;
let bobToken;
let charlieToken;

let aliceId;
let bobId;
let charlieId;
let conversationId;

const uniqueId = Date.now();

const users = [
  {
    name: "Alice Test",
    email: `alice_${uniqueId}@example.com`
  },
  {
    name: "Bob Test",
    email: `bob_${uniqueId}@example.com`
  },
  {
    name: "Charlie Test",
    email: `charlie_${uniqueId}@example.com`
  }
];

beforeAll(async () => {
  if (!process.env.MONGODB_TEST_URI) {
    throw new Error("MONGODB_TEST_URI is missing");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_TEST_URI);
  }

  const passwordHash = await bcrypt.hash("TestPassword123!", 10);

  const createdUsers = await User.create(
    users.map((user) => ({
      ...user,
      passwordHash
    }))
  );

  [aliceId, bobId, charlieId] = createdUsers.map(
    (user) => user._id.toString()
  );

  aliceToken = jwt.sign(
    { sub: aliceId },
    process.env.JWT_SECRET
  );

  bobToken = jwt.sign(
    { sub: bobId },
    process.env.JWT_SECRET
  );

  charlieToken = jwt.sign(
    { sub: charlieId },
    process.env.JWT_SECRET
  );
});

afterAll(async () => {
  if (conversationId) {
    await Message.deleteMany({
      conversation: conversationId
    });

    await Conversation.deleteOne({
      _id: conversationId
    });
  }

  await User.deleteMany({
    _id: {
      $in: [aliceId, bobId, charlieId].filter(Boolean)
    }
  });

  await mongoose.connection.close();
});

describe("Conversation and Messaging APIs", () => {
  test("Alice should create a conversation with Bob", async () => {
    const response = await request(app)
      .post("/api/conversations")
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({
        participantId: bobId
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);

    conversationId = response.body.conversation._id;
  });

  test("Alice should retrieve her conversations", async () => {
    const response = await request(app)
      .get("/api/conversations")
      .set("Authorization", `Bearer ${aliceToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.count).toBeGreaterThanOrEqual(1);
  });

  test("Alice should send a message", async () => {
    const response = await request(app)
      .post(`/api/messages/${conversationId}`)
      .set("Authorization", `Bearer ${aliceToken}`)
      .send({
        content: "Hello Bob! This is an automated test."
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.success).toBe(true);
  });

  test("Bob should retrieve the conversation messages", async () => {
    const response = await request(app)
      .get(`/api/messages/${conversationId}`)
      .set("Authorization", `Bearer ${bobToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.count).toBeGreaterThanOrEqual(1);

    expect(
      response.body.messages.some(
        (message) =>
          message.content ===
          "Hello Bob! This is an automated test."
      )
    ).toBe(true);
  });

  test("Charlie should not access Alice and Bob's conversation", async () => {
    const response = await request(app)
      .get(`/api/messages/${conversationId}`)
      .set("Authorization", `Bearer ${charlieToken}`);

    expect(response.statusCode).toBe(403);
  });

  test("Unauthenticated users should not create conversations", async () => {
    const response = await request(app)
      .post("/api/conversations")
      .send({
        participantId: bobId
      });

    expect(response.statusCode).toBe(401);
  });
});
