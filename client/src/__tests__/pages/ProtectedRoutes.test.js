// Wong An Wei, A0273528X

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import axios from "axios";

import PrivateRoute from "../../components/Routes/Private";
import AdminRoute from "../../components/Routes/AdminRoute";
import { useAuth } from "../../context/auth";

jest.mock("axios");

jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("react-router-dom", () => ({
  Outlet: () => <div data-testid="outlet" />,
}));

jest.mock("../../components/Spinner", () => {
  return function SpinnerMock(props) {
    const path = props?.path;
    return <div data-testid="spinner" data-path={path ?? "(default)"} />;
  };
});

describe("Protected Routes (PrivateRoute / AdminRoute)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("PrivateRoute", () => {
    it("renders Spinner and does not call auth API when token is null", async () => {
      // Strategy: EP + Basis Path - Invalid EC (no token) => authCheck not executed.

      // Arrange
      useAuth.mockReturnValue([{ user: null, token: null }, jest.fn()]);
      axios.get.mockResolvedValue({ data: { ok: true } });

      // Act
      render(<PrivateRoute />);

      // Assert
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("renders Spinner and does not call auth API when token is empty string (length 0)", async () => {
      // Strategy: BVA - Token length boundary at 0 (invalid) => authCheck not executed.

      // Arrange
      useAuth.mockReturnValue([{ user: null, token: "" }, jest.fn()]);

      // Act
      render(<PrivateRoute />);

      // Assert
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("renders Spinner initially when token is present but auth API has not resolved yet", async () => {
      // Strategy: Basis Path - Async pending path: ok defaults false until authCheck resolves.

      // Arrange
      useAuth.mockReturnValue([{ user: { role: 0 }, token: "t" }, jest.fn()]);

      let resolveRequest;
      const pending = new Promise((resolve) => {
        resolveRequest = resolve;
      });
      axios.get.mockReturnValue(pending);

      // Act
      render(<PrivateRoute />);

      // Assert (pending)
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/user-auth");

      // Assert (after resolve)
      resolveRequest({ data: { ok: true } });
      expect(await screen.findByTestId("outlet")).toBeInTheDocument();
    });

    it("renders Outlet when token is present and API returns ok=true", async () => {
      // Strategy: EP + Basis Path - Valid EC (token present) and ok=true branch.

      // Arrange
      useAuth.mockReturnValue([{ user: { role: 0 }, token: "t" }, jest.fn()]);
      axios.get.mockResolvedValue({ data: { ok: true } });

      // Act
      render(<PrivateRoute />);

      // Assert
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/user-auth");
      expect(await screen.findByTestId("outlet")).toBeInTheDocument();
      expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
    });

    it("renders Spinner when token is present and API returns ok=false", async () => {
      // Strategy: EP + Basis Path - Valid EC (token present) but ok=false branch.

      // Arrange
      useAuth.mockReturnValue([{ user: { role: 0 }, token: "t" }, jest.fn()]);
      axios.get.mockResolvedValue({ data: { ok: false } });

      // Act
      render(<PrivateRoute />);

      // Assert
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/user-auth");
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
    });

    it("renders Spinner when token is present but API request throws", async () => {
      // Strategy: EP (Invalid EC) + Basis Path - Network/exception path => fallback to Spinner.

      // Arrange
      useAuth.mockReturnValue([{ user: { role: 0 }, token: "t" }, jest.fn()]);
      axios.get.mockRejectedValue(new Error("network"));

      // Act
      render(<PrivateRoute />);

      // Assert
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
    });
  });

  describe("AdminRoute", () => {
    it("renders Spinner and does not call admin auth API when token is missing", async () => {
      // Strategy: EP + Basis Path - Invalid EC (no token) => authCheck not executed.

      // Arrange
      useAuth.mockReturnValue([{ user: null, token: undefined }, jest.fn()]);

      // Act
      render(<AdminRoute />);

      // Assert
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("renders Outlet when token is present and admin auth API returns ok=true", async () => {
      // Strategy: EP + Basis Path - Valid EC (token present) and ok=true branch.

      // Arrange
      useAuth.mockReturnValue([{ user: { role: 1 }, token: "t" }, jest.fn()]);
      axios.get.mockResolvedValue({ data: { ok: true } });

      // Act
      render(<AdminRoute />);

      // Assert
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/admin-auth");
      expect(await screen.findByTestId("outlet")).toBeInTheDocument();
    });

    it("renders Spinner when token is present and admin auth API returns ok=false", async () => {
      // Strategy: EP + BVA (boolean boundary) - ok=false edge => deny access.

      // Arrange
      useAuth.mockReturnValue([{ user: { role: 1 }, token: "t" }, jest.fn()]);
      axios.get.mockResolvedValue({ data: { ok: false } });

      // Act
      render(<AdminRoute />);

      // Assert
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/admin-auth");
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
    });

    it("renders Spinner when token is present but admin auth API request throws", async () => {
      // Strategy: EP (Invalid EC) + Basis Path - Exception path => fallback to Spinner.

      // Arrange
      useAuth.mockReturnValue([{ user: { role: 1 }, token: "t" }, jest.fn()]);
      axios.get.mockRejectedValue(new Error("network"));

      // Act
      render(<AdminRoute />);

      // Assert
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
      expect(screen.getByTestId("spinner")).toBeInTheDocument();
      expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
    });
  });
});
