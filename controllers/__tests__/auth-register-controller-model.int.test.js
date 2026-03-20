// Amos Chee Tian Ee, A0273476U

/**
 * ========================================================================
 * INTEGRATION TEST: Register Route ↔ registerController ↔ userModel
 * ========================================================================
 *
 * Integration Testing Approach: BOTTOM-UP (Incremental)
 *
 * Rationale:
 * - Validate backend registration pipeline with real DB persistence behavior
 *
 * Modules Being Integrated:
 * 1. Auth route wiring (/api/v1/auth/register)
 * 2. registerController
 * 3. userModel (Mongo persistence)
 * 4. Password hashing helper path
 *
 * Critical Path:
 * Request payload → route → controller validation → hashing → DB write → API response
 *
 * Integration Points Tested:
 * - Route-to-controller contract
 * - Controller-to-model persistence
 * - Secure password storage
 *
 * Test Categories:
 * - Happy Path Integration
 * - Validation/Conflict Integration
 */

const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const authRoutes = require("../../routes/authRoute").default;
const User = require("../../models/userModel").default;

const TEST_DB_NAME = `ms2-auth-register-${Date.now()}`;

jest.setTimeout(30000);

describe("Register Controller + User Model Integration", () => {
  let app;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
    if (!process.env.MONGO_URL) {
      throw new Error("MONGO_URL must be defined for integration tests.");
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    await mongoose.connect(process.env.MONGO_URL, {
      dbName: TEST_DB_NAME,
      serverSelectionTimeoutMS: 20000,
    });

    app = express();
    app.use(express.json());
    app.use("/api/v1/auth", authRoutes);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  afterEach(async () => {
    if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({});
    }
  });

  // Amos Chee Tian Ee, A0273476U
  test("creates user successfully and stores hashed password", async () => {
    // Arrange
    const payload = {
      name: "Amos Register",
      email: "register@test.com",
      password: "Pass1234!",
      phone: "91234567",
      address: "NUS",
      answer: "blue",
    };

    // Act
    const res = await request(app).post("/api/v1/auth/register").send(payload);

    // Assert
    expect([200, 201]).toContain(res.status);

    const user = await User.findOne({ email: payload.email });
    expect(user).toBeTruthy();
    expect(user.password).toBeTruthy();
    expect(user.password).not.toBe(payload.password);
  });

  // Amos Chee Tian Ee, A0273476U
  test("rejects duplicate email registration", async () => {
    // Arrange
    const payload = {
      name: "Amos Register",
      email: "duplicate@test.com",
      password: "Pass1234!",
      phone: "91234567",
      address: "NUS",
      answer: "blue",
    };

    // Act
    await request(app).post("/api/v1/auth/register").send(payload);
    const second = await request(app).post("/api/v1/auth/register").send(payload);

    // Assert
    expect(second.status).toBe(200);
    expect(second.body.success).toBe(false);
    const users = await User.find({ email: payload.email });
    expect(users.length).toBe(1);
  });

  // Amos Chee Tian Ee, A0273476U
  test("rejects registration when required fields are missing", async () => {
    // Arrange
    const payload = {
      email: "invalid-register@test.com",
      password: "Pass1234!",
      phone: "91234567",
      address: "NUS",
      answer: "blue",
    };

    // Act
    const res = await request(app).post("/api/v1/auth/register").send(payload);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.error || res.body.message).toBeTruthy();

    const user = await User.findOne({ email: payload.email });
    expect(user).toBeNull();
  });
});