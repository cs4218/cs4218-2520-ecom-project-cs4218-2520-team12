// Amos Chee Tian Ee, A0273476U

/**
 * ========================================================================
 * INTEGRATION TEST: Login Route ↔ loginController ↔ userModel
 * ========================================================================
 *
 * Integration Testing Approach: BOTTOM-UP (Incremental)
 *
 * Modules Being Integrated:
 * 1. Auth route wiring (/api/v1/auth/login)
 * 2. loginController
 * 3. userModel lookup
 * 4. Password compare + token generation path
 *
 * Critical Path:
 * Login request → user lookup → password verification → auth payload response
 *
 * Test Categories:
 * - Happy Path Integration
 * - Authentication Failure Integration
 */

const request = require("supertest");
const express = require("express");
const mongoose = require("mongoose");
const authRoutes = require("../../routes/authRoute").default;
const User = require("../../models/userModel").default;

const TEST_DB_NAME = `ms2-auth-login-${Date.now()}`;

jest.setTimeout(30000);

describe("Login Controller + User Model Integration", () => {
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

  const registerUser = async (email = "login@test.com", password = "Pass1234!") => {
    await request(app).post("/api/v1/auth/register").send({
      name: "Amos Login",
      email,
      password,
      phone: "90001111",
      address: "NUS",
      answer: "blue",
    });
  };

  // Amos Chee Tian Ee, A0273476U
  test("logs in with valid credentials and returns auth payload", async () => {
    // Arrange
    await registerUser("valid@login.com", "Pass1234!");

    // Act
    const res = await request(app).post("/api/v1/auth/login").send({
      email: "valid@login.com",
      password: "Pass1234!",
    });

    // Assert
    expect([200, 201]).toContain(res.status);
    expect(res.body).toBeTruthy();
    expect(res.body.user).toBeTruthy();
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.password).toBeFalsy();
  });

  // Amos Chee Tian Ee, A0273476U
  test("rejects login for wrong password", async () => {
    // Arrange
    await registerUser("wrong@login.com", "Pass1234!");

    // Act
    const res = await request(app).post("/api/v1/auth/login").send({
      email: "wrong@login.com",
      password: "WrongPass!",
    });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.token).toBeFalsy();
  });

  // Amos Chee Tian Ee, A0273476U
  test("rejects login for unknown email", async () => {
    // Arrange
    const payload = {
      email: "noone@login.com",
      password: "Pass1234!",
    };

    // Act
    const res = await request(app).post("/api/v1/auth/login").send({
      email: payload.email,
      password: payload.password,
    });

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.token).toBeFalsy();
  });
});