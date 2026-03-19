// Amos Chee Tian Ee, A0273476U

/**
 * ========================================================================
 * INTEGRATION TEST: Login Page ↔ Auth Context ↔ Axios ↔ Persistence
 * ========================================================================
 *
 * Integration Testing Approach: TOP-DOWN (Incremental)
 *
 * Rationale:
 * - Validate login as a real user flow from UI down to auth-state persistence
 *
 * Modules Being Integrated:
 * 1. pages/Auth/Login.js
 * 2. auth context/provider
 * 3. localStorage/session persistence
 * 4. Axios HTTP layer (API boundary stubbed)
 * 5. Router context
 *
 * Critical Path:
 * User enters credentials → login API call → auth state update → persistence update → navigation
 *
 * Integration Points Tested:
 * - Credential submit flow
 * - Success/error response handling
 * - Auth state + persistence synchronization
 *
 * Test Categories:
 * - Happy Path Integration
 * - Failure Path Integration
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import Login from "../../pages/Auth/Login";
import { AuthProvider } from "../../context/auth";

jest.mock("axios");
jest.mock("react-hot-toast");
jest.mock("../../components/Layout", () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>,
}));

const setInputByLabel = (label, value) => {
  const input = screen.getByLabelText(new RegExp(`^${label}$`, "i"));
  if (input) {
    fireEvent.change(input, { target: { value } });
  }
};

describe("Login Page Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(window.localStorage.__proto__, "setItem");
  });

  afterEach(() => {
    window.localStorage.setItem.mockRestore();
  });

  // Amos Chee Tian Ee, A0273476U
  test("submits valid credentials and persists auth payload", async () => {
    // Arrange
    const email = "amos@test.com";
    const password = "Pass1234!";
    axios.post.mockResolvedValue({
      data: {
        success: true,
        message: "login successfully",
        user: { _id: "u1", name: "Amos", email: "amos@test.com" },
        token: "valid-token",
      },
    });

    const { container } = render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<div>Home Route</div>} />
            <Route path="/dashboard/user" element={<div>User Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Act
    setInputByLabel("Email", email);
    setInputByLabel("Password", password);

    const submit = container.querySelector('button[type="submit"]');
    fireEvent.click(submit);

    // Assert
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith("/api/v1/auth/login", {
        email,
        password,
      });
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        "auth",
        expect.any(String),
      );
      expect(toast.success).toHaveBeenCalled();
    });

    const authPersistCall = window.localStorage.setItem.mock.calls.find(
      ([key]) => key === "auth",
    );
    const persistedAuth = JSON.parse(authPersistCall[1]);
    expect(persistedAuth).toMatchObject({
      success: true,
      token: "valid-token",
      user: {
        _id: "u1",
        email,
      },
    });
  });

  // Amos Chee Tian Ee, A0273476U
  test("shows error feedback on invalid credentials", async () => {
    // Arrange
    axios.post.mockRejectedValue(new Error("invalid credentials"));

    const { container } = render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<Login />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Act
    setInputByLabel("Email", "wrong@test.com");
    setInputByLabel("Password", "wrong");

    const submit = container.querySelector('button[type="submit"]');
    fireEvent.click(submit);

    // Assert
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });
  });
});