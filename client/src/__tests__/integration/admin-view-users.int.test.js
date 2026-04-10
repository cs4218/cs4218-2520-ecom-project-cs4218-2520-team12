// Wong An Wei, A0273528X

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import axios from "axios";

import { AuthProvider } from "../../context/auth";
import AdminRoute from "../../components/Routes/AdminRoute";
import Users from "../../pages/admin/Users";

jest.mock("axios");

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
 * Top module under test: AdminRoute and nested admin users route
 * Integrated modules: AdminRoute -> AuthProvider/useAuth -> router Outlet nesting -> Users page -> AdminMenu
 * Stubbed external dependency: admin auth API via axios (unintegrated backend)
 */

const renderAdminUsersRoute = (initialPath = "/dashboard/admin/users") => {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/dashboard" element={<AdminRoute />}>
            <Route path="admin/users" element={<Users />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
};

describe("Admin View Users Integration (Top-Down)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  // Wong An Wei, A0273528X
  test("AdminRoute + Users: no token keeps fallback and skips admin auth API", async () => {
    renderAdminUsersRoute();

    expect(screen.getByText(/redirecting to you in/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /All Users/i })).not.toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
  });

  // Wong An Wei, A0273528X
  test("AdminRoute + Users: non-admin response (ok=false) denies users page rendering", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: { name: "Normal User", email: "user@example.com", role: 0 },
        token: "valid-non-admin-token",
      })
    );
    axios.get.mockResolvedValueOnce({ data: { ok: false } });

    renderAdminUsersRoute();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/admin-auth");
    });
    expect(screen.getByText(/redirecting to you in/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /All Users/i })).not.toBeInTheDocument();
  });

  // Wong An Wei, A0273528X
  test("AdminRoute + Users + AuthProvider: admin response (ok=true) renders users admin view", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: { name: "Admin User", email: "admin@example.com", role: 1 },
        token: "valid-admin-token",
      })
    );
    axios.get.mockResolvedValueOnce({ data: { ok: true } });

    renderAdminUsersRoute();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/admin-auth");
    });

    expect(await screen.findByRole("heading", { name: /All Users/i })).toBeInTheDocument();
    expect(screen.getByTestId("layout-title")).toHaveTextContent("Dashboard - All Users");
    expect(screen.getByRole("heading", { name: /Admin Panel/i })).toBeInTheDocument();
  });

  // Wong An Wei, A0273528X
  test("AdminRoute + Users: admin auth API error keeps fallback and blocks users page", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: { name: "Admin User", email: "admin@example.com", role: 1 },
        token: "valid-admin-token",
      })
    );
    axios.get.mockRejectedValueOnce(new Error("network"));

    renderAdminUsersRoute();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/admin-auth");
    });

    expect(screen.getByText(/redirecting to you in/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /All Users/i })).not.toBeInTheDocument();
  });

  // ADDED - MS3 upgrade
  test("AdminRoute + Users: token with missing role still follows admin-auth API decision", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: { name: "Role Missing", email: "rolemissing@example.com" },
        token: "valid-admin-token",
      })
    );
    axios.get.mockResolvedValueOnce({ data: { ok: true } });

    renderAdminUsersRoute();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/admin-auth");
    });

    expect(await screen.findByRole("heading", { name: /All Users/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Admin Panel/i })).toBeInTheDocument();
  });
});
