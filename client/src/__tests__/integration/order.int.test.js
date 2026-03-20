// Wong An Wei, A0273528X

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";

import Orders from "../../pages/user/Orders";
import { AuthProvider } from "../../context/auth";

jest.mock("axios");

jest.mock("moment", () => {
  const actualMoment = jest.requireActual("moment");
  return (date) => {
    const momentInstance = actualMoment(date);
    momentInstance.fromNow = jest.fn(() => "2 days ago");
    return momentInstance;
  };
});

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
 * Top module under test: Orders page
 * Integrated modules: Orders -> AuthProvider -> useAuth state -> axios order API -> UserMenu/router rendering
 * Stubs used only for unintegrated external dependency: backend API via axios mock
 */

const renderOrdersWithProviders = () => {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <Orders />
      </MemoryRouter>
    </AuthProvider>
  );
};

describe("Order Integration (Top-Down)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Wong An Wei, A0273528X
  test("Orders + AuthProvider: no token does not call order API and renders base order UI", async () => {
    renderOrdersWithProviders();

    expect(screen.getByTestId("layout-title")).toHaveTextContent("Your Orders");
    expect(screen.getByRole("heading", { name: /All Orders/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Dashboard/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  // Wong An Wei, A0273528X
  test("Orders + AuthProvider + axios: with token fetches orders and renders table + product details", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: { name: "Alice", email: "alice@example.com" },
        token: "valid-user-token",
      })
    );

    axios.get.mockResolvedValueOnce({
      data: [
        {
          _id: "order-1",
          status: "Processing",
          buyer: { name: "Alice" },
          createAt: "2026-03-15T10:00:00.000Z",
          payment: { success: true },
          products: [
            {
              _id: "product-1",
              name: "Gaming Mouse",
              description: "Ultra-lightweight gaming mouse with RGB and extra buttons",
              price: 89,
            },
          ],
        },
      ],
    });

    renderOrdersWithProviders();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/orders");
    });

    expect(await screen.findByText("Processing")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("2 days ago")).toBeInTheDocument();
    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getByText("Gaming Mouse")).toBeInTheDocument();
    expect(screen.getByText("Ultra-lightweight gaming mouse")).toBeInTheDocument();
    expect(screen.getByText("Price : 89")).toBeInTheDocument();
  });

  // Wong An Wei, A0273528X
  test("Orders + AuthProvider + axios: payment failure branch renders Failed", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: { name: "Bob", email: "bob@example.com" },
        token: "valid-user-token",
      })
    );

    axios.get.mockResolvedValueOnce({
      data: [
        {
          _id: "order-2",
          status: "Delivered",
          buyer: { name: "Bob" },
          createAt: "2026-03-15T10:00:00.000Z",
          payment: { success: false },
          products: [
            {
              _id: "product-2",
              name: "Keyboard",
              description: "Mechanical keyboard with blue switches and white backlight",
              price: 120,
            },
          ],
        },
      ],
    });

    renderOrdersWithProviders();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/orders");
    });

    expect(await screen.findByText("Failed")).toBeInTheDocument();
    expect(screen.queryByText("Success")).not.toBeInTheDocument();
  });

  // Wong An Wei, A0273528X
  test("Orders + AuthProvider + axios: API error path logs error and keeps page stable", async () => {
    localStorage.setItem(
      "auth",
      JSON.stringify({
        user: { name: "Cara", email: "cara@example.com" },
        token: "valid-user-token",
      })
    );
    const networkError = new Error("network");
    axios.get.mockRejectedValueOnce(networkError);

    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    renderOrdersWithProviders();

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/orders");
    });

    expect(consoleSpy).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /All Orders/i })).toBeInTheDocument();
  });
});
