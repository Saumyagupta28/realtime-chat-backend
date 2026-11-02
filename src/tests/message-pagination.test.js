
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const app = require("../server");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

let alice;
let bob;
let conversation;
let token;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_TEST_URI);

  alice = await User.create({
    name: "Alice",
    email: `alice-pagination-${Date.now()}@example.com`,
    passwordHash: "test-password-hash"
  });

  bob = await User.create({
    name: "Bob",
    email: `bob-pagination-${Date.now()}@example.com`,
    passwordHash: "test-password-hash"
  });

  token = jwt.sign(
    { sub: alice._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  conversation = await Conversation.create({
    participants: [alice._id, bob._id]
  });

  const messages = Array.from({ length: 60 }, (_, index) => ({
    conversation: conversation._id,
    sender: alice._id,
    content: `Test message ${index + 1}`
  }));

  await Message.insertMany(messages);
});

afterAll(async () => {
  if (conversation) {
    await Message.deleteMany({ conversation: conversation._id });
    await Conversation.deleteOne({ _id: conversation._id });
  }

  if (alice && bob) {
    await User.deleteMany({
      _id: { $in: [alice._id, bob._id] }
    });
  }

  await mongoose.connection.close();
});

test("should return only the latest 50 messages", async () => {
  const response = await request(app)
    .get(`/api/messages/${conversation._id}`)
    .set("Authorization", `Bearer ${token}`);

  expect(response.statusCode).toBe(200);
  expect(response.body.count).toBe(50);
  expect(response.body.messages).toHaveLength(50);
  expect(response.body.messages[0].content).toBe("Test message 11");
  expect(response.body.messages[49].content).toBe("Test message 60");
  expect(response.body.hasMore).toBe(true);
});

test("should return older messages using the cursor", async () => {
  const firstPage = await request(app)
    .get(`/api/messages/${conversation._id}`)
    .set("Authorization", `Bearer ${token}`);

  const cursor = firstPage.body.nextCursor;

  const secondPage = await request(app)
    .get(`/api/messages/${conversation._id}?cursor=${cursor}`)
    .set("Authorization", `Bearer ${token}`);

  expect(secondPage.statusCode).toBe(200);
  expect(secondPage.body.count).toBe(10);
  expect(secondPage.body.messages[0].content).toBe("Test message 1");
  expect(secondPage.body.messages[9].content).toBe("Test message 10");
  expect(secondPage.body.hasMore).toBe(false);
});




test("should sync messages created after the supplied cursor", async () => {
  const existingMessages = await Message.find({
    conversation: conversation._id
  }).sort({ createdAt: 1, _id: 1 });

  const lastKnownMessage = existingMessages[49];

  await Message.create({
    conversation: conversation._id,
    sender: alice._id,
    content: "Offline message 1"
  });

  await Message.create({
    conversation: conversation._id,
    sender: alice._id,
    content: "Offline message 2"
  });

  const response = await request(app)
    .get(
      `/api/messages/${conversation._id}/sync?after=${lastKnownMessage._id}`
    )
    .set("Authorization", `Bearer ${token}`);

  expect(response.statusCode).toBe(200);
  expect(response.body.count).toBe(12);
  expect(response.body.messages).toHaveLength(12);
  expect(response.body.messages[10].content).toBe("Offline message 1");
  expect(response.body.messages[11].content).toBe("Offline message 2");
});

