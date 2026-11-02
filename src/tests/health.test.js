
const request = require("supertest");
//const app = require("../src/server");
const app = require("../server");

describe("Health Check API", () => {
  test("should return server status successfully", async () => {
    const response = await request(app).get("/health");

    expect(response.statusCode).toBe(200);

    expect(response.body).toEqual({
      status: "ok",
      message: "chat backend is running"
    });
  });
});
