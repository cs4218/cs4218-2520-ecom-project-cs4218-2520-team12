// Wong An Wei, A0273528X

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

import Profile from "../../pages/user/Profile";
import { AuthProvider } from "../../context/auth";

jest.mock("axios");
jest.mock("react-hot-toast");

jest.mock("../../components/Layout", () => {
  const LayoutMock = ({ children, title }) => (
    <div data-testid="layout">
      <div data-testid="layout-title">{title}</div>
      {children}
    </div>
  );
  return {
    __esModule: true,
    default: LayoutMock,
  };
});

/**
 * Integration Strategy: Top-Down Incremental Integration Testing
 *
 * Top module under test: Profile page
 * Integrated modules: Profile -> AuthProvider/useAuth -> form state -> axios profile API -> localStorage persistence
 * Stubs used only for unintegrated external dependencies: backend API via axios and notification side effect via toast
 */

const renderProfileWithProviders = () => {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    </AuthProvider>
  );
};

describe("Profile Integration (Top-Down)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Wong An Wei, A0273528X
  test("Profile + AuthProvider: pre-populates form from auth localStorage and keeps email disabled", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: {
          name: "Jane User",
          email: "jane@example.com",
          phone: "999",
          address: "Singapore",
        },
        token: "valid-user-token",
      })
    );

    renderProfileWithProviders();

    expect(screen.getByTestId("layout-title")).toHaveTextContent("Your Profile");
    expect(screen.getByRole("heading", { name: /Dashboard/i })).toBeInTheDocument();

    expect(await screen.findByDisplayValue("Jane User")).toBeInTheDocument();
    const emailInput = screen.getByDisplayValue("jane@example.com");
    expect(emailInput).toBeDisabled();
    expect(screen.getByDisplayValue("999")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Singapore")).toBeInTheDocument();
  });

  // Wong An Wei, A0273528X
  test("Profile + AuthProvider + axios: successful update persists to localStorage and shows success toast", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: {
          name: "Jane User",
          email: "jane@example.com",
          phone: "999",
          address: "Singapore",
        },
        token: "valid-user-token",
      })
    );

    axios.put.mockResolvedValueOnce({
      data: {
        updatedUser: {
          name: "Jane Updated",
          email: "jane@example.com",
          phone: "888",
          address: "SG",
        },
      },
    });

    renderProfileWithProviders();

    fireEvent.change(await screen.findByPlaceholderText("Enter Your Name"), {
      target: { value: "Jane Updated" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "new-password" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Phone"), {
      target: { value: "888" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Address"), {
      target: { value: "SG" },
    });

    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledWith("/api/v1/auth/profile", {
        name: "Jane Updated",
        email: "jane@example.com",
        password: "new-password",
        phone: "888",
        address: "SG",
      });
    });

    const authAfterUpdate = JSON.parse(localStorage.getItem("auth"));
    expect(authAfterUpdate.user).toEqual({
      name: "Jane Updated",
      email: "jane@example.com",
      phone: "888",
      address: "SG",
    });
    expect(toast.success).toHaveBeenCalledWith("Profile Updated Successfully");
  });

  // Wong An Wei, A0273528X
  test("Profile + AuthProvider + axios: error response branch triggers error toast", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: {
          name: "Jane User",
          email: "jane@example.com",
          phone: "999",
          address: "Singapore",
        },
        token: "valid-user-token",
      })
    );

    axios.put.mockResolvedValueOnce({ data: { errro: true, error: "Bad Request" } });

    renderProfileWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledTimes(1);
    });

    expect(toast.error).toHaveBeenCalledWith("Bad Request");
  });

  // Wong An Wei, A0273528X
  test("Profile + AuthProvider + axios: thrown error branch shows generic error toast", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: {
          name: "Jane User",
          email: "jane@example.com",
          phone: "999",
          address: "Singapore",
        },
        token: "valid-user-token",
      })
    );

    axios.put.mockRejectedValueOnce(new Error("network"));

    renderProfileWithProviders();
    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    await waitFor(() => {
      expect(axios.put).toHaveBeenCalledTimes(1);
    });

    expect(toast.error).toHaveBeenCalledWith("Something went wrong");
  });
});
