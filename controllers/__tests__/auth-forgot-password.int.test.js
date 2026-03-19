// Amos Chee Tian Ee, A0273476U

/**
 * ========================================================================
 * INTEGRATION TEST: Forgot Password Route ↔ forgotPasswordController ↔ userModel
 * ========================================================================
 *
 * Integration Testing Approach: BOTTOM-UP (Incremental)
 *
 * Modules Being Integrated:
 * 1. Auth route wiring (/api/v1/auth/forgot-password)
 * 2. forgotPasswordController
 * 3. userModel credential update persistence
 * 4. Subsequent login verification flow
 *
 * Critical Path:
 * Reset request → identity verification → password update → re-login with new password
 *
 * Test Categories:
 * - Happy Path Integration
 * - Invalid Identity/Reset Failure Integration
 */

const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const authRoutes = require("../../routes/authRoute").default;
const User = require("../../models/userModel").default;

describe("Forgot Password Controller Integration", () => {
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

  const seedUser = async () => {
    await request(app).post("/api/v1/auth/register").send({
      name: "Amos Forgot",
      email: "forgot@test.com",
      password: "OldPass123!",
      phone: "98887777",
      address: "NUS",
      answer: "blue",
    });
  };

  // Amos Chee Tian Ee, A0273476U
  test("resets password and allows login with new password", async () => {
    // Arrange
    await seedUser();

    // Act
    const reset = await request(app).post("/api/v1/auth/forgot-password").send({
      email: "forgot@test.com",
      answer: "blue",
      newPassword: "NewPass123!",
    });

    // Assert
    expect([200, 201]).toContain(reset.status);

    const oldLogin = await request(app).post("/api/v1/auth/login").send({
      email: "forgot@test.com",
      password: "OldPass123!",
    });
    expect(oldLogin.status).toBe(200);
    expect(oldLogin.body.success).toBe(false);

    const newLogin = await request(app).post("/api/v1/auth/login").send({
      email: "forgot@test.com",
      password: "NewPass123!",
    });
    expect([200, 201]).toContain(newLogin.status);
    expect(newLogin.body.token).toBeTruthy();
  });

  // Amos Chee Tian Ee, A0273476U
  test("rejects reset when answer is invalid", async () => {
    // Arrange
    await seedUser();

    const before = await User.findOne({ email: "forgot@test.com" });

    // Act
    const reset = await request(app).post("/api/v1/auth/forgot-password").send({
      email: "forgot@test.com",
      answer: "wrong-answer",
      newPassword: "AnotherPass123!",
    });

    // Assert
    expect(reset.status).toBe(404);
    expect(reset.body.success).toBe(false);

    const after = await User.findOne({ email: "forgot@test.com" });
    expect(after.password).toBe(before.password);
  });

  // Amos Chee Tian Ee, A0273476U
  test("rejects reset when required fields are missing and does not mutate credentials", async () => {
    // Arrange
    await seedUser();
    const before = await User.findOne({ email: "forgot@test.com" });

    const invalidPayloads = [
      { answer: "blue", newPassword: "AnotherPass123!" },
      { email: "forgot@test.com", answer: "blue" },
    ];

    // Act
    for (const payload of invalidPayloads) {
      const reset = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send(payload);

      // Assert
      expect(reset.status).toBeGreaterThanOrEqual(400);
    }

    const after = await User.findOne({ email: "forgot@test.com" });
    expect(after.password).toBe(before.password);
  });
});