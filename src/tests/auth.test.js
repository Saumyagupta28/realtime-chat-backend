
const request = require("supertest");
const mongoose = require("mongoose");

const app = require("../server");
const User = require("../models/User");

const testEmail = `test_${Date.now()}@example.com`;
const testPassword = "TestPassword123!";

beforeAll(async () => {
  if (!process.env.MONGODB_TEST_URI) {
    throw new Error("MONGODB_TEST_URI is missing");
  }

  await mongoose.connect(process.env.MONGODB_TEST_URI);
});

afterAll(async () => {
  await User.deleteMany({ email: testEmail });
  await mongoose.connection.close();
});

describe("Authentication API", () => {
  test("should register a new user", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test User",
        email: testEmail,
        password: testPassword
      });

    expect(response.statusCode).toBe(201);
  });

  test("should reject duplicate registration", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test User",
        email: testEmail,
        password: testPassword
      });

    expect(response.statusCode).toBe(409);
  });

  test("should log in with valid credentials", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testEmail,
        password: testPassword
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.token).toBeDefined();
  });

  test("should reject an incorrect password", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testEmail,
        password: "WrongPassword123!"
      });

    expect(response.statusCode).toBe(401);
  });
});
