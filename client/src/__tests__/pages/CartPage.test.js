import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";
import CartPage from "../../pages/CartPage";
import { useCart } from "../../context/cart";
import { useAuth } from "../../context/auth";

// Mock dependencies
jest.mock("axios");
jest.mock("react-hot-toast");
jest.mock("braintree-web-drop-in-react", () => {
    const React = require("react");
    return function DropIn({ onInstance }) {
        const instanceRef = React.useRef(null);

        React.useEffect(() => {
            if (onInstance && !instanceRef.current) {
                const mockInstance = {
                    requestPaymentMethod: jest
                        .fn()
                        .mockResolvedValue({ nonce: "fake-nonce" }),
                };
                instanceRef.current = mockInstance;
                onInstance(mockInstance);
            }
        }, []); // Empty dependency array to run only once

        return React.createElement(
            "div",
            { "data-testid": "braintree-dropin" },
            "Braintree DropIn",
        );
    };
});

jest.mock("../../context/cart", () => ({
    useCart: jest.fn(),
}));

jest.mock("../../context/auth", () => ({
    useAuth: jest.fn(),
}));

jest.mock("../../context/search", () => ({
    useSearch: jest.fn(() => [{ keyword: "" }, jest.fn()]),
}));

jest.mock("../../hooks/useCategory", () => ({
    __esModule: true,
    default: jest.fn(() => []),
}));

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
    ...jest.requireActual("react-router-dom"),
    useNavigate: () => mockNavigate,
}));

window.matchMedia =
    window.matchMedia ||
    function () {
        return {
            matches: false,
            addListener: function () {},
            removeListener: function () {},
        };
    };

Object.defineProperty(window, "localStorage", {
    value: {
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn(),
    },
    writable: true,
});

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "renders_cartPage_displaysCartItems" -> Equivalence class: cart with multiple items (standard render)
 * - "calculateTotal_withItems_displaysCorrectTotal" -> Boundary analysis: price calculation accuracy
 * - "removeItem_clickRemove_removesFromCart" -> Equivalence class: cart modification operations
 * - "emptyCart_noItems_displaysEmptyMessage" -> Edge case: empty cart state
 * - "payment_notLoggedIn_showsLoginPrompt" -> Authentication partition: guest user flow
 * - "payment_loggedIn_showsBraintreeDropIn" -> Authentication partition: authenticated user payment
 * - "userAddress_displayed_showsCurrentAddress" -> Equivalence class: user data display
 * - "updateAddress_clickButton_navigatesToProfile" -> Navigation partition: address update flow
 * - "productDescription_displayed_truncatesTo30Chars" -> Boundary analysis: text truncation at 30 chars
 * - "getToken_apiError_handlesGracefully" -> Error handling partition: Braintree token failure
 * - "removeCartItem_error_handlesGracefully" -> Error handling partition: cart operation failure
 * - "loginButton_click_navigatesToLoginWithState" -> Navigation partition: login redirect with state
 * - "updateAddressButton_noAddress_navigatesToProfile" -> Edge case: missing address data
 * - "totalPrice_withInvalidPrice_handlesError" -> Error handling partition: price formatting error
 * - "handlePayment_success_clearsCartAndNavigates" -> Equivalence class: successful payment flow
 * - "handlePayment_error_setsLoadingFalse" -> Error handling partition: payment processing failure
 */

describe("CartPage Component", () => {
    let mockCart;
    let mockSetCart;
    let mockAuth;
    let mockSetAuth;

    beforeEach(() => {
        jest.clearAllMocks();
        mockCart = [];
        mockSetCart = jest.fn();
        mockAuth = { user: null, token: "" };
        mockSetAuth = jest.fn();

        useCart.mockReturnValue([mockCart, mockSetCart]);
        useAuth.mockReturnValue([mockAuth, mockSetAuth]);

        jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    test("renders_cartPage_displaysCartItems", () => {
        // Arrange
        const mockCartItems = [
            {
                _id: "1",
                name: "Laptop",
                price: 999,
                description: "High performance laptop",
            },
            {
                _id: "2",
                name: "Mouse",
                price: 25,
                description: "Wireless mouse",
            },
        ];
        useCart.mockReturnValue([mockCartItems, mockSetCart]);

        // Act
        render(
            <MemoryRouter>
                <CartPage />
            </MemoryRouter>,
        );

        // Assert
        expect(screen.getByText("Laptop")).toBeInTheDocument();
        expect(screen.getByText("Mouse")).toBeInTheDocument();
        expect(
            screen.getByText(/You Have 2 items in your cart/),
        ).toBeInTheDocument();
    });

    test("calculateTotal_withItems_displaysCorrectTotal", () => {
        // Arrange
        const mockCartItems = [
            {
                _id: "1",
                name: "Laptop",
                price: 999,
                description: "High performance laptop",
            },
            {
                _id: "2",
                name: "Mouse",
                price: 25,
                description: "Wireless mouse",
            },
        ];
        useCart.mockReturnValue([mockCartItems, mockSetCart]);

        // Act
        render(
            <MemoryRouter>
                <CartPage />
            </MemoryRouter>,
        );

        // Assert
        expect(screen.getByText("Total : $1,024.00")).toBeInTheDocument();
    });

    test("removeItem_clickRemove_removesFromCart", () => {
        // Arrange
        const mockCartItems = [
            {
                _id: "1",
                name: "Laptop",
                price: 999,
                description: "High performance laptop",
            },
            {
                _id: "2",
                name: "Mouse",
                price: 25,
                description: "Wireless mouse",
            },
            {
                _id: "3",
                name: "Keyboard",
                price: 75,
                description: "Mechanical keyboard",
            },
        ];
        useCart.mockReturnValue([mockCartItems, mockSetCart]);

        // Act
        render(
            <MemoryRouter>
                <CartPage />
            </MemoryRouter>,
        );

        const removeButtons = screen.getAllByText("Remove");
        fireEvent.click(removeButtons[1]); // Remove Mouse

        // Assert
        expect(mockSetCart).toHaveBeenCalledWith([
            {
                _id: "1",
                name: "Laptop",
                price: 999,
                description: "High performance laptop",
            },
            {
                _id: "3",
                name: "Keyboard",
                price: 75,
                description: "Mechanical keyboard",
            },
        ]);
        expect(window.localStorage.setItem).toHaveBeenCalled();
    });

    test("emptyCart_noItems_displaysEmptyMessage", () => {
        // Arrange
        useCart.mockReturnValue([[], mockSetCart]);

        // Act
        render(
            <MemoryRouter>
                <CartPage />
            </MemoryRouter>,
        );

        // Assert
        expect(screen.getByText("Your Cart Is Empty")).toBeInTheDocument();
    });

    test("payment_notLoggedIn_showsLoginPrompt", () => {
        // Arrange
        const mockCartItems = [
            {
                _id: "1",
                name: "Laptop",
                price: 999,
                description: "High performance laptop",
            },
        ];
        useCart.mockReturnValue([mockCartItems, mockSetCart]);
        useAuth.mockReturnValue([{ user: null, token: "" }, mockSetAuth]);

        // Act
        render(
            <MemoryRouter>
                <CartPage />
            </MemoryRouter>,
        );

        // Assert
        expect(screen.getByText("Hello Guest")).toBeInTheDocument();
        expect(
            screen.getByText(/please login to checkout/),
        ).toBeInTheDocument();
        expect(screen.getByText("Plase Login to checkout")).toBeInTheDocument();
    });

    test("payment_loggedIn_showsBraintreeDropIn", async () => {
        // Arrange
        const mockCartItems = [
            {
                _id: "1",
                name: "Laptop",
                price: 999,
                description: "High performance laptop",
            },
        ];
        const mockUser = {
            _id: "user1",
            name: "John Doe",
            email: "john@example.com",
            address: "123 Main St",
        };
        useCart.mockReturnValue([mockCartItems, mockSetCart]);
        useAuth.mockReturnValue([
            { user: mockUser, token: "fake-token" },
            mockSetAuth,
        ]);

        axios.get.mockResolvedValueOnce({
            data: { clientToken: "fake-braintree-token" },
        });

        // Act
        render(
            <MemoryRouter>
                <CartPage />
            </MemoryRouter>,
        );

        // Assert
        expect(
            await screen.findByText(`Hello ${mockUser.name}`),
        ).toBeInTheDocument();
        expect(
            await screen.findByTestId("braintree-dropin"),
        ).toBeInTheDocument();
    });

    test("userAddress_displayed_showsCurrentAddress", () => {
        // Arrange
        const mockCartItems = [
            {
                _id: "1",
                name: "Laptop",
                price: 999,
                description: "High performance laptop",
            },
        ];
        const mockUser = {
            _id: "user1",
            name: "John Doe",
            email: "john@example.com",
            address: "123 Main St, New York, NY 10001",
        };
        useCart.mockReturnValue([mockCartItems, mockSetCart]);
        useAuth.mockReturnValue([
            { user: mockUser, token: "fake-token" },
            mockSetAuth,
        ]);

        // Act
        render(
            <MemoryRouter>
                <CartPage />
            </MemoryRouter>,
        );

        // Assert
        expect(screen.getByText("Current Address")).toBeInTheDocument();
        expect(
            screen.getByText("123 Main St, New York, NY 10001"),
        ).toBeInTheDocument();
    });

    test("updateAddress_clickButton_navigatesToProfile", () => {
        // Arrange
        const mockCartItems = [
            {
                _id: "1",
                name: "Laptop",
                price: 999,
                description: "High performance laptop",
            },
        ];
        const mockUser = {
            _id: "user1",
            name: "John Doe",
            email: "john@example.com",
            address: "123 Main St",
        };
        useCart.mockReturnValue([mockCartItems, mockSetCart]);
        useAuth.mockReturnValue([
            { user: mockUser, token: "fake-token" },
            mockSetAuth,
        ]);

        // Act
        render(
            <MemoryRouter>
                <CartPage />
            </MemoryRouter>,
        );

        const updateButton = screen.getByText("Update Address");
        fireEvent.click(updateButton);

        // Assert
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard/user/profile");
    });

    test("productDescription_displayed_truncatesTo30Chars", () => {
        // Arrange
        const longDescription =
            "This is a very long product description that should be truncated";
        const mockCartItems = [
            {
                _id: "1",
                name: "Laptop",
                price: 999,
                description: longDescription,
            },
        ];
        useCart.mockReturnValue([mockCartItems, mockSetCart]);

        // Act
        render(
            <MemoryRouter>
                <CartPage />
            </MemoryRouter>,
        );

        // Assert
        const description = screen.getByText(/This is a very long product de/);
        expect(description.textContent.length).toBeLessThanOrEqual(30);
    });

    test("getToken_apiError_handlesGracefully", async () => {
        // Arrange
        const consoleLogSpy = jest
            .spyOn(console, "log")
            .mockImplementation(() => {});
        const mockCartItems = [
            {
                _id: "1",
                name: "Laptop",
                price: 999,
                description: "High performance laptop",
            },
        ];
        const mockUser = {
            _id: "user1",
            name: "John Doe",
            email: "john@example.com",
            address: "123 Main St",
        };
        useCart.mockReturnValue([mockCartItems, mockSetCart]);
        useAuth.mockReturnValue([
            { user: mockUser, token: "fake-token" },
            mockSetAuth,
        ]);
        axios.get.mockRejectedValueOnce(new Error("Network error"));

        // Act
        render(
            <MemoryRouter>
                <CartPage />
            </MemoryRouter>,
        );

        // Assert
        await waitFor(
            () => {
                expect(consoleLogSpy).toHaveBeenCalled();
            },
            { timeout: 500 },
        );

        consoleLogSpy.mockRestore();
    });

    test("removeCartItem_error_handlesGracefully", () => {
        // Arrange
        const consoleLogSpy = jest
            .spyOn(console, "log")
            .mockImplementation(() => {});
        const mockCartItems = [
            {
                _id: "1",
                name: "Laptop",
                price: 999,
                description: "High performance laptop",
            },
        ];
        useCart.mockReturnValue([mockCartItems, mockSetCart]);
        mockSetCart.mockImplementationOnce(() => {
            throw new Error("Set cart error");
        });

        // Act
        render(
            <MemoryRouter>
                <CartPage />
            </MemoryRouter>,
        );

        const removeButton = screen.getByText("Remove");
        fireEvent.click(removeButton);

        // Assert
        expect(consoleLogSpy).toHaveBeenCalled();
        consoleLogSpy.mockRestore();
    });

    test("loginButton_click_navigatesToLoginWithState", () => {
        // Arrange
        const mockCartItems = [
            {
                _id: "1",
                name: "Laptop",
                price: 999,
                description: "High performance laptop",
            },
        ];
        useCart.mockReturnValue([mockCartItems, mockSetCart]);
        useAuth.mockReturnValue([{ user: null, token: "" }, mockSetAuth]);

        // Act
        render(
            <MemoryRouter>
                <CartPage />
            </MemoryRouter>,
        );

        const loginButton = screen.getByText("Plase Login to checkout");
        fireEvent.click(loginButton);

        // Assert
        expect(mockNavigate).toHaveBeenCalledWith("/login", {
            state: "/cart",
        });
    });

    test("updateAddressButton_noAddress_navigatesToProfile", () => {
        // Arrange
        const mockCartItems = [
            {
                _id: "1",
                name: "Laptop",
                price: 999,
                description: "High performance laptop",
            },
        ];
        const mockUser = {
            _id: "user1",
            name: "John Doe",
            email: "john@example.com",
        };
        useCart.mockReturnValue([mockCartItems, mockSetCart]);
        useAuth.mockReturnValue([
            { user: mockUser, token: "fake-token" },
            mockSetAuth,
        ]);

        // Act
        render(
            <MemoryRouter>
                <CartPage />
            </MemoryRouter>,
        );

        const updateButton = screen.getByText("Update Address");
        fireEvent.click(updateButton);

        // Assert
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard/user/profile");
    });

    test("totalPrice_withInvalidPrice_handlesError", () => {
        // Arrange
        const consoleLogSpy = jest
            .spyOn(console, "log")
            .mockImplementation(() => {});

        // Mock toLocaleString to throw an error
        const originalToLocaleString = Number.prototype.toLocaleString;
        Number.prototype.toLocaleString = jest.fn(() => {
            throw new Error("toLocaleString error");
        });

        const mockCartItems = [
            {
                _id: "1",
                name: "Laptop",
                price: 999,
                description: "High performance laptop",
            },
        ];

        useCart.mockReturnValue([mockCartItems, mockSetCart]);
        useAuth.mockReturnValue([{ user: null, token: "" }, mockSetAuth]);

        // Act
        const { container } = render(
            <MemoryRouter>
                <CartPage />
            </MemoryRouter>,
        );

        // The error should be caught and logged
        expect(consoleLogSpy).toHaveBeenCalled();
        expect(container).toBeTruthy();

        // Restore
        Number.prototype.toLocaleString = originalToLocaleString;
        consoleLogSpy.mockRestore();
    });

    test("handlePayment_success_clearsCartAndNavigates", async () => {
        // Arrange
        const mockCartItems = [
            {
                _id: "1",
                name: "Laptop",
                price: 999,
                description: "High performance laptop",
            },
        ];
        const mockUser = {
            _id: "user1",
            name: "John Doe",
            email: "john@example.com",
            address: "123 Main St",
        };
        useCart.mockReturnValue([mockCartItems, mockSetCart]);
        useAuth.mockReturnValue([
            { user: mockUser, token: "fake-token" },
            mockSetAuth,
        ]);

        axios.get.mockResolvedValueOnce({
            data: { clientToken: "fake-braintree-token" },
        });
        axios.post.mockResolvedValueOnce({
            data: { success: true },
        });

        // Act
        render(
            <MemoryRouter>
                <CartPage />
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByTestId("braintree-dropin")).toBeInTheDocument();
        });

        // Act
        const payButton = screen.getByText("Make Payment");
        await waitFor(() => {
            expect(payButton).not.toBeDisabled();
        });
        fireEvent.click(payButton);

        // Assert
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalled();
        });
        expect(window.localStorage.removeItem).toHaveBeenCalledWith("cart");
        expect(mockSetCart).toHaveBeenCalledWith([]);
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard/user/orders");
        expect(toast.success).toHaveBeenCalledWith(
            "Payment Completed Successfully ",
        );
    });

    test("handlePayment_error_setsLoadingFalse", async () => {
        // Arrange
        const consoleLogSpy = jest
            .spyOn(console, "log")
            .mockImplementation(() => {});
        const mockCartItems = [
            {
                _id: "1",
                name: "Laptop",
                price: 999,
                description: "High performance laptop",
            },
        ];
        const mockUser = {
            _id: "user1",
            name: "John Doe",
            email: "john@example.com",
            address: "123 Main St",
        };
        useCart.mockReturnValue([mockCartItems, mockSetCart]);
        useAuth.mockReturnValue([
            { user: mockUser, token: "fake-token" },
            mockSetAuth,
        ]);

        axios.get.mockResolvedValueOnce({
            data: { clientToken: "fake-braintree-token" },
        });
        axios.post.mockRejectedValueOnce(new Error("Payment failed"));

        // Act
        render(
            <MemoryRouter>
                <CartPage />
            </MemoryRouter>,
        );

        await waitFor(
            () => {
                expect(
                    screen.getByTestId("braintree-dropin"),
                ).toBeInTheDocument();
            },
            { timeout: 5000 },
        );

        const payButton = screen.getByText("Make Payment");
        await waitFor(() => {
            expect(payButton).not.toBeDisabled();
        });
        fireEvent.click(payButton);

        // Assert
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalled();
        });
        await waitFor(() => {
            expect(payButton).not.toBeDisabled();
        });

        expect(window.localStorage.removeItem).not.toHaveBeenCalled();
        expect(mockSetCart).not.toHaveBeenCalledWith([]);
        expect(mockNavigate).not.toHaveBeenCalledWith("/dashboard/user/orders");
        expect(toast.success).not.toHaveBeenCalled();

        consoleLogSpy.mockRestore();
    });
});
