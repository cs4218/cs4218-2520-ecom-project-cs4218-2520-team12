// Wong An Wei, A0273528X

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";

import Profile from "../../pages/user/Profile";
import { useAuth } from "../../context/auth";

jest.mock("axios");
jest.mock("react-hot-toast");

jest.mock("../../context/auth", () => ({
  useAuth: jest.fn(),
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

describe("Profile (User) Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});

    localStorage.clear();
    localStorage.setItem(
      "auth",
      JSON.stringify({ token: "t", user: { name: "Old" } }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("prepopulatesInputs_fromAuthUser_andEmailIsDisabled", async () => {
    // Strategy: Basis Path - useEffect reads auth.user and sets form state.

    // Arrange
    const mockSetAuth = jest.fn();
    useAuth.mockReturnValue([
      {
        user: {
          name: "Jane User",
          email: "jane@test.com",
          phone: "999",
          address: "SG",
        },
        token: "t",
      },
      mockSetAuth,
    ]);

    // Act
    render(<Profile />);

    // Assert
    expect(screen.getByTestId("layout-title")).toHaveTextContent("Your Profile");
    expect(screen.getByTestId("user-menu")).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText("Enter Your Name");
    const emailInput = screen.getByPlaceholderText(/Enter Your Email/i);
    const phoneInput = screen.getByPlaceholderText("Enter Your Phone");
    const addressInput = screen.getByPlaceholderText("Enter Your Address");

    expect(nameInput).toHaveValue("Jane User");
    expect(emailInput).toHaveValue("jane@test.com");
    expect(emailInput).toBeDisabled();
    expect(phoneInput).toHaveValue("999");
    expect(addressInput).toHaveValue("SG");

    expect(mockSetAuth).not.toHaveBeenCalled();
  });

  it("submit_success_updatesAuth_localStorage_andShowsSuccessToast", async () => {
    // Strategy: EP + Basis Path - Valid EC: API returns updatedUser => updates auth + localStorage.

    // Arrange
    const mockSetAuth = jest.fn();
    const auth = {
      user: {
        name: "Jane User",
        email: "jane@test.com",
        phone: "999",
        address: "SG",
      },
      token: "t",
    };

    useAuth.mockReturnValue([auth, mockSetAuth]);

    axios.put.mockResolvedValueOnce({
      data: {
        updatedUser: {
          name: "Jane Updated",
          email: "jane@test.com",
          phone: "888",
          address: "SGP",
        },
      },
    });

    // Act
    render(<Profile />);

    fireEvent.change(screen.getByPlaceholderText("Enter Your Name"), {
      target: { value: "Jane Updated" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Phone"), {
      target: { value: "888" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter Your Address"), {
      target: { value: "SGP" },
    });

    // EP: non-empty password value to execute onChange path
    fireEvent.change(screen.getByPlaceholderText("Enter Your Password"), {
      target: { value: "abcdef" },
    });

    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    // Assert
    await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(1));
    expect(axios.put).toHaveBeenCalledWith("/api/v1/auth/profile", {
      name: "Jane Updated",
      email: "jane@test.com",
      password: "abcdef",
      phone: "888",
      address: "SGP",
    });

    expect(mockSetAuth).toHaveBeenCalledWith({
      ...auth,
      user: {
        name: "Jane Updated",
        email: "jane@test.com",
        phone: "888",
        address: "SGP",
      },
    });

    const ls = JSON.parse(localStorage.getItem("auth"));
    expect(ls.user).toEqual({
      name: "Jane Updated",
      email: "jane@test.com",
      phone: "888",
      address: "SGP",
    });

    expect(toast.success).toHaveBeenCalledWith("Profile Updated Successfully");
  });

  it("submit_errorFlag_branch_showsErrorToast_andDoesNotUpdateAuth", async () => {
    // Strategy: Basis Path - Response indicates error (data.errro truthy) => toast.error.

    // Arrange
    const mockSetAuth = jest.fn();
    useAuth.mockReturnValue([
      {
        user: {
          name: "Jane User",
          email: "jane@test.com",
          phone: "999",
          address: "SG",
        },
        token: "t",
      },
      mockSetAuth,
    ]);

    axios.put.mockResolvedValueOnce({ data: { errro: true, error: "Bad" } });

    // Act
    render(<Profile />);
    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    // Assert
    await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("Bad");
    expect(mockSetAuth).not.toHaveBeenCalled();
  });

  it("submit_requestThrows_showsGenericErrorToast", async () => {
    // Strategy: Basis Path - try/catch error path: axios throws => toast.error("Something went wrong").

    // Arrange
    const mockSetAuth = jest.fn();
    useAuth.mockReturnValue([
      {
        user: {
          name: "Jane User",
          email: "jane@test.com",
          phone: "999",
          address: "SG",
        },
        token: "t",
      },
      mockSetAuth,
    ]);

    axios.put.mockRejectedValueOnce(new Error("network"));

    // Act
    render(<Profile />);
    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    // Assert
    await waitFor(() => expect(axios.put).toHaveBeenCalledTimes(1));
    expect(toast.error).toHaveBeenCalledWith("Something went wrong");
    expect(mockSetAuth).not.toHaveBeenCalled();
  });
});
