// Wong An Wei, A0273528X

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import axios from "axios";

import PrivateRoute from "../../components/Routes/Private";
import AdminRoute from "../../components/Routes/AdminRoute";
import { AuthProvider } from "../../context/auth";

jest.mock("axios");

/**
 * Integration Strategy: Top-Down Incremental Integration Testing
 *
 * Why Top-Down here:
 * 1) Start from the route-guard entry components (PrivateRoute/AdminRoute),
 *    then integrate downward with AuthProvider and nested routed content.
 * 2) Keep only the unintegrated external dependency (backend auth API) stubbed
 *    via axios mock, while testing real interactions among frontend components.
 * 3) Incrementally add coverage path-by-path:
 *    - Private route without token
 *    - Private route with valid token/auth response
 *    - Admin route denied
 *    - Admin route allowed
 */

const renderWithAuthAndRouter = ({
  initialPath,
  protectedRouteElement,
  nestedPath,
  nestedContent,
}) => {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/dashboard" element={protectedRouteElement}>
            <Route path={nestedPath} element={nestedContent} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
};

describe("Protected Routes Integration (Top-Down)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  // Wong An Wei, A0273528X
  test("PrivateRoute + AuthProvider: without token, stays on spinner and skips auth API", async () => {
    renderWithAuthAndRouter({
      initialPath: "/dashboard/user",
      protectedRouteElement: <PrivateRoute />,
      nestedPath: "user",
      nestedContent: <div data-testid="private-outlet">Private Outlet Content</div>,
    });

    expect(screen.getByText(/redirecting to you in/i)).toBeInTheDocument();
    expect(screen.queryByTestId("private-outlet")).not.toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
  });

  // Wong An Wei, A0273528X
  test("PrivateRoute + AuthProvider + nested route: with token and ok=true, renders protected outlet", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: { name: "Alice", email: "alice@example.com" },
        token: "valid-user-token",
      })
    );
    axios.get.mockResolvedValueOnce({ data: { ok: true } });

    renderWithAuthAndRouter({
      initialPath: "/dashboard/user",
      protectedRouteElement: <PrivateRoute />,
      nestedPath: "user",
      nestedContent: <div data-testid="private-outlet">Private Outlet Content</div>,
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/user-auth");
    });
    expect(await screen.findByTestId("private-outlet")).toBeInTheDocument();
  });

  // Wong An Wei, A0273528X
  test("AdminRoute + AuthProvider + nested route: with token but ok=false, denies admin outlet", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: { name: "Bob", email: "bob@example.com", role: 0 },
        token: "valid-non-admin-token",
      })
    );
    axios.get.mockResolvedValueOnce({ data: { ok: false } });

    renderWithAuthAndRouter({
      initialPath: "/dashboard/admin",
      protectedRouteElement: <AdminRoute />,
      nestedPath: "admin",
      nestedContent: <div data-testid="admin-outlet">Admin Outlet Content</div>,
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/admin-auth");
    });
    expect(screen.getByText(/redirecting to you in/i)).toBeInTheDocument();
    expect(screen.queryByTestId("admin-outlet")).not.toBeInTheDocument();
  });

  // Wong An Wei, A0273528X
  test("AdminRoute + AuthProvider + nested route: with token and ok=true, renders admin outlet", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: { name: "Cara", email: "cara@example.com", role: 1 },
        token: "valid-admin-token",
      })
    );
    axios.get.mockResolvedValueOnce({ data: { ok: true } });

    renderWithAuthAndRouter({
      initialPath: "/dashboard/admin",
      protectedRouteElement: <AdminRoute />,
      nestedPath: "admin",
      nestedContent: <div data-testid="admin-outlet">Admin Outlet Content</div>,
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/admin-auth");
    });
    expect(await screen.findByTestId("admin-outlet")).toBeInTheDocument();
  });

  // ADDED - MS3 upgrade
  test("PrivateRoute + AuthProvider + nested route: token present but auth API error blocks outlet", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: { name: "Duke", email: "duke@example.com" },
        token: "valid-user-token",
      })
    );
    axios.get.mockRejectedValueOnce(new Error("network"));

    renderWithAuthAndRouter({
      initialPath: "/dashboard/user",
      protectedRouteElement: <PrivateRoute />,
      nestedPath: "user",
      nestedContent: <div data-testid="private-outlet">Private Outlet Content</div>,
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/user-auth");
    });
    expect(screen.getByText(/redirecting to you in/i)).toBeInTheDocument();
    expect(screen.queryByTestId("private-outlet")).not.toBeInTheDocument();
  });
});
