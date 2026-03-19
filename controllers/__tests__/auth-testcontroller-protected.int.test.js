// Amos Chee Tian Ee, A0273476U

/**
 * ========================================================================
 * INTEGRATION TEST: Protected Route Middleware ↔ testController
 * ========================================================================
 *
 * Integration Testing Approach: BOTTOM-UP (Incremental)
 *
 * Modules Being Integrated:
 * 1. Protected auth route wiring (/api/v1/auth/test)
 * 2. requireSignIn/auth middleware chain
 * 3. testController execution
 *
 * Critical Path:
 * Request with token state (none/invalid/valid) → middleware decision → controller access
 *
 * Test Categories:
 * - Unauthorized Access Integration
 * - Authorized Access Integration
 */

const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const authRoutes = require("../../routes/authRoute").default;
const User = require("../../models/userModel").default;

describe("Protected Auth Middleware + Test Controller Integration", () => {
  let mongoServer;
  let app;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app = express();
    app.use(express.json());
    app.use("/api/v1/auth", authRoutes);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  const getValidToken = async () => {
    await request(app).post("/api/v1/auth/register").send({
      name: "Amos Protected",
      email: "protected@test.com",
      password: "Pass1234!",
      phone: "97776666",
      address: "NUS",
      answer: "blue",
    });

    await User.updateOne({ email: "protected@test.com" }, { role: 1 });

    const login = await request(app).post("/api/v1/auth/login").send({
      email: "protected@test.com",
      password: "Pass1234!",
    });

    return login.body.token;
  };

  // Amos Chee Tian Ee, A0273476U
  test("blocks protected route without token", async () => {
    // Arrange

    // Act
    const res = await request(app).get("/api/v1/auth/test");

    // Assert
    expect(res.status).toBeGreaterThanOrEqual(401);
  });

  // Amos Chee Tian Ee, A0273476U
  test("blocks protected route with invalid token", async () => {
    // Arrange
    const invalidToken = "invalid-token";

    // Act
    const res = await request(app)
      .get("/api/v1/auth/test")
      .set("Authorization", invalidToken);

    // Assert
    expect(res.status).toBe(401);
  });

  // Amos Chee Tian Ee, A0273476U
  test("allows protected route with valid token", async () => {
    // Arrange
    const token = await getValidToken();

    // Act
    const res = await request(app)
      .get("/api/v1/auth/test")
      .set("Authorization", token);

    // Assert
    expect(res.status).toBe(200);
    expect(res.text).toContain("Protected Routes");
  });
});