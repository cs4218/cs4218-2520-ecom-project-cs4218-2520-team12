// Wong An Wei, A0273528X

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";

import Orders from "../../pages/user/Orders";
import { useAuth } from "../../context/auth";
import { useCart } from "../../context/cart";

jest.mock("axios");

jest.mock("moment", () => {
  const actualMoment = jest.requireActual("moment");
  return (date) => {
    const momentInstance = actualMoment(date);
    momentInstance.fromNow = jest.fn(() => "2 days ago");
    return momentInstance;
  };
});

jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../../context/cart", () => ({
  useCart: jest.fn(),
}));

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => jest.fn(),
  Link: ({ children }) => <div data-testid="link">{children}</div>,
}));

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

jest.mock("../../components/UserMenu", () => {
  const UserMenuMock = () => <div data-testid="user-menu">User Menu</div>;
  return {
    __esModule: true,
    default: UserMenuMock,
  };
});

describe("Orders (User) Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    useCart.mockReturnValue([[], jest.fn()]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("noToken_doesNotFetchOrders_rendersHeaderOnly", async () => {
    // Strategy: EP + Basis Path - Invalid EC (no token) => getOrders not executed.

    // Arrange
    useAuth.mockReturnValue([{ user: null, token: "" }, jest.fn()]);

    // Act
    render(<Orders />);

    // Assert
    expect(screen.getByTestId("layout")).toBeInTheDocument();
    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /All Orders/i })).toBeInTheDocument();
    await waitFor(() => expect(axios.get).not.toHaveBeenCalled());
  });

  it("tokenPresent_fetchesAndRendersOrderHistoryAndStatus", async () => {
    // Strategy: EP + Basis Path - Valid EC (token present) => fetch orders and render table + products.

    // Arrange
    useAuth.mockReturnValue([
      { user: { name: "User", role: 0 }, token: "user-token" },
      jest.fn(),
    ]);

    const mockOrders = [
      {
        _id: "order1",
        status: "Processing",
        buyer: { name: "John Doe" },
        createAt: "2026-02-05T10:00:00Z",
        payment: { success: true },
        products: [
          {
            _id: "prod1",
            name: "Laptop",
            description: "High performance laptop for developers",
            price: 1200,
          },
        ],
      },
    ];

    axios.get.mockResolvedValueOnce({ data: mockOrders });

    // Act
    render(<Orders />);

    // Assert
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/orders"));

    expect(await screen.findByText("Processing")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("2 days ago")).toBeInTheDocument();
    expect(screen.getByText("Success")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);

    expect(screen.getByText("Laptop")).toBeInTheDocument();
    expect(screen.getByText("High performance laptop for de")).toBeInTheDocument();
    expect(screen.getByText("Price : 1200")).toBeInTheDocument();

    const img = screen.getByRole("img", { name: "Laptop" });
    expect(img).toHaveAttribute("src", "/api/v1/product/product-photo/prod1");
  });

  it("paymentFailed_branch_displaysFailed", async () => {
    // Strategy: BVA (boolean boundary) - payment.success=false => display "Failed".

    // Arrange
    useAuth.mockReturnValue([
      { user: { name: "User", role: 0 }, token: "user-token" },
      jest.fn(),
    ]);

    const mockOrders = [
      {
        _id: "order2",
        status: "Processing",
        buyer: { name: "Jane Doe" },
        createAt: "2026-02-05T10:00:00Z",
        payment: { success: false },
        products: [
          {
            _id: "prod2",
            name: "Mouse",
            description: "Wireless mouse for daily use",
            price: 50,
          },
        ],
      },
    ];

    axios.get.mockResolvedValueOnce({ data: mockOrders });

    // Act
    render(<Orders />);

    // Assert
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/orders"));
    expect(await screen.findByText("Failed")).toBeInTheDocument();
    expect(screen.queryByText("Success")).not.toBeInTheDocument();
  });

  it("emptyOrders_boundaryValue_rendersNoOrderTables", async () => {
    // Strategy: BVA - Boundary at 0 orders returned => no mapped tables/products.

    // Arrange
    useAuth.mockReturnValue([
      { user: { name: "User", role: 0 }, token: "user-token" },
      jest.fn(),
    ]);
    axios.get.mockResolvedValueOnce({ data: [] });

    // Act
    render(<Orders />);

    // Assert
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/orders"));
    expect(screen.queryByText("Success")).not.toBeInTheDocument();
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
  });

  it("fetchOrders_apiError_logsError_andKeepsEmptyUI", async () => {
    // Strategy: Basis Path - try/catch error path: axios throws => orders not set.

    // Arrange
    useAuth.mockReturnValue([
      { user: { name: "User", role: 0 }, token: "user-token" },
      jest.fn(),
    ]);

    const err = new Error("network");
    axios.get.mockRejectedValueOnce(err);
    const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    // Act
    render(<Orders />);

    // Assert
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/orders"));
    expect(consoleSpy).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /All Orders/i })).toBeInTheDocument();
  });
});
