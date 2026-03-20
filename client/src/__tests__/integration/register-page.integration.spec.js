// Amos Chee Tian Ee, A0273476U

/**
 * ========================================================================
 * INTEGRATION TEST: Register Page ↔ Form State ↔ Axios ↔ Router
 * ========================================================================
 *
 * Integration Testing Approach: TOP-DOWN (Incremental)
 *
 * Rationale:
 * - Start from user-facing Register page behavior
 * - Integrate downward into form state, API calls, and navigation side-effects
 *
 * Modules Being Integrated:
 * 1. pages/Auth/Register.js
 * 2. React form state and validation behavior
 * 3. Axios HTTP layer (API boundary stubbed)
 * 4. Router navigation context
 *
 * Critical Path:
 * User fills form → submit → register API call → success/failure feedback → navigation outcome
 *
 * Integration Points Tested:
 * - Input-to-payload mapping
 * - API response handling across success/error branches
 * - UI feedback + navigation behavior
 *
 * Test Categories:
 * - Happy Path Integration
 * - Error Handling Integration
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import Register from "../../pages/Auth/Register";

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

describe("Register Page Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Amos Chee Tian Ee, A0273476U
  test("submits valid register form and calls register API", async () => {
    // Arrange
    const formData = {
      name: "Amos Test",
      email: "amos@test.com",
      password: "Pass1234!",
      phone: "91234567",
      address: "NUS",
      DOB: "2000-01-01",
      answer: "blue",
    };

    axios.post.mockResolvedValue({
      data: { success: true, message: "Registered Successfully" },
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<div>Login Route</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Act
    setInputByLabel("Name", formData.name);
    setInputByLabel("Email", formData.email);
    setInputByLabel("Password", formData.password);
    setInputByLabel("Phone", formData.phone);
    setInputByLabel("Address", formData.address);
    setInputByLabel("Date of Birth", formData.DOB);
    setInputByLabel("Security Answer", formData.answer);

    const submit =
      container.querySelector('button[type="submit"]') ||
      screen.getByRole("button");
    fireEvent.click(submit);

    // Assert
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        "/api/v1/auth/register",
        formData,
      );
      expect(toast.success).toHaveBeenCalled();
    });

    expect(await screen.findByText("Login Route")).toBeInTheDocument();
  });

  // Amos Chee Tian Ee, A0273476U
  test("shows error feedback when register API fails", async () => {
    // Arrange
    axios.post.mockRejectedValue(new Error("register failed"));

    const { container } = render(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<Register />} />
        </Routes>
      </MemoryRouter>
    );

    // Act
    setInputByLabel("Name", "Amos Test");
    setInputByLabel("Email", "amos@test.com");
    setInputByLabel("Password", "Pass1234!");
    setInputByLabel("Phone", "91234567");
    setInputByLabel("Address", "NUS");
    setInputByLabel("Date of Birth", "2000-01-01");
    setInputByLabel("Security Answer", "blue");

    const submit =
      container.querySelector('button[type="submit"]') ||
      screen.getByRole("button");
    fireEvent.click(submit);

    // Assert
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });
  });
});