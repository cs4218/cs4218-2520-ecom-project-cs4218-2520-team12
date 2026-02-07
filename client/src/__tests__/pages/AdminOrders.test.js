import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";
import AdminOrders from "../../pages/admin/AdminOrders";
import { useAuth } from "../../context/auth";

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "getOrders_withAuth_fetchesAndRendersOrders" -> Equivalence class: authenticated admin fetches orders successfully
 * - "getOrders_withoutAuth_doesNotFetch" -> Edge case: no auth token present, API not called
 * - "orderTable_rendered_showsOrderDetails" -> Structural completeness: order metadata displayed correctly
 * - "orderProducts_rendered_showsProductInfo" -> Equivalence class: products within orders displayed
 * - "productImage_rendered_hasCorrectSrc" -> Regression/contract: product image src format
 * - "handleChange_selectNewStatus_updatesOrderStatus" -> Equivalence class: status change triggers API call
 * - "handleChange_apiError_logsError" -> Error handling partition: API failure on status update
 * - "emptyOrders_apiReturnsEmpty_rendersEmptyState" -> Edge case: no orders to display
 * - "getOrders_apiError_logsError" -> Error handling partition: API failure on fetch
 * - "orderDate_displayed_formattedWithMoment" -> Equivalence class: date formatting
 * - "paymentStatus_success_displaysSuccess" -> Equivalence class: payment success display
 * - "paymentStatus_failed_displaysFailed" -> Equivalence class: payment failure display
 */

jest.mock("axios");
jest.mock("react-hot-toast");
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

jest.mock("../../components/AdminMenu", () => {
    const AdminMenuMock = () => <div data-testid="admin-menu">Admin Menu</div>;
    return {
        __esModule: true,
        default: AdminMenuMock,
    };
});

window.matchMedia =
    window.matchMedia ||
    function matchMedia() {
        return {
            matches: false,
            addListener: function () {},
            removeListener: function () {},
        };
    };

const renderWithRouter = (initialEntry = "/dashboard/admin/orders") => {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                <Route path="/dashboard/admin/orders" element={<AdminOrders />} />
            </Routes>
        </MemoryRouter>
    );
};

describe("AdminOrders Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("getOrders_withAuth_fetchesAndRendersOrders", async () => {
        // Arrange
        const mockAuth = {
            user: { name: "Admin", email: "admin@test.com", role: 1 },
            token: "admin-token",
        };
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

        useAuth.mockReturnValue([mockAuth, jest.fn()]);
        axios.get.mockResolvedValueOnce({ data: mockOrders });

        // Act
        renderWithRouter();

        // Assert
        expect(screen.getByTestId("layout")).toBeInTheDocument();
        expect(screen.getByTestId("admin-menu")).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: /All Orders/i }),
        ).toBeInTheDocument();

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/all-orders");
        });

        expect(await screen.findByText("John Doe")).toBeInTheDocument();
        expect(await screen.findByText("Laptop")).toBeInTheDocument();
    });

    it("getOrders_withoutAuth_doesNotFetch", async () => {
        // Arrange
        const mockAuth = { user: null, token: "" };
        useAuth.mockReturnValue([mockAuth, jest.fn()]);

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(axios.get).not.toHaveBeenCalled();
        });
    });

    it("orderTable_rendered_showsOrderDetails", async () => {
        // Arrange
        const mockAuth = {
            user: { name: "Admin", email: "admin@test.com", role: 1 },
            token: "admin-token",
        };
        const mockOrders = [
            {
                _id: "order1",
                status: "Shipped",
                buyer: { name: "Jane Smith" },
                createAt: "2026-02-05T10:00:00Z",
                payment: { success: true },
                products: [
                    {
                        _id: "prod1",
                        name: "Mouse",
                        description: "Wireless mouse",
                        price: 50,
                    },
                ],
            },
        ];

        useAuth.mockReturnValue([mockAuth, jest.fn()]);
        axios.get.mockResolvedValueOnce({ data: mockOrders });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(screen.getByText("Jane Smith")).toBeInTheDocument();
        });

        expect(screen.getByText("2 days ago")).toBeInTheDocument();
        expect(screen.getByText("Success")).toBeInTheDocument();
        const quantities = screen.getAllByText("1");
        expect(quantities.length).toBeGreaterThan(0);
    });

    it("orderProducts_rendered_showsProductInfo", async () => {
        // Arrange
        const mockAuth = {
            user: { name: "Admin", email: "admin@test.com", role: 1 },
            token: "admin-token",
        };
        const mockOrders = [
            {
                _id: "order1",
                status: "Processing",
                buyer: { name: "Bob Johnson" },
                createAt: "2026-02-05T10:00:00Z",
                payment: { success: true },
                products: [
                    {
                        _id: "prod1",
                        name: "Keyboard",
                        description: "Mechanical keyboard with RGB lighting",
                        price: 150,
                    },
                    {
                        _id: "prod2",
                        name: "Monitor",
                        description: "27-inch 4K monitor with HDR support",
                        price: 400,
                    },
                ],
            },
        ];

        useAuth.mockReturnValue([mockAuth, jest.fn()]);
        axios.get.mockResolvedValueOnce({ data: mockOrders });

        // Act
        renderWithRouter();

        // Assert
        expect(await screen.findByText("Keyboard")).toBeInTheDocument();
        expect(await screen.findByText("Monitor")).toBeInTheDocument();
        expect(
            screen.getByText("Mechanical keyboard with RGB l"),
        ).toBeInTheDocument();
        expect(screen.getByText("27-inch 4K monitor with HDR su")).toBeInTheDocument();
        expect(screen.getByText("Price : 150")).toBeInTheDocument();
        expect(screen.getByText("Price : 400")).toBeInTheDocument();
    });

    it("productImage_rendered_hasCorrectSrc", async () => {
        // Arrange
        const mockAuth = {
            user: { name: "Admin", email: "admin@test.com", role: 1 },
            token: "admin-token",
        };
        const mockOrders = [
            {
                _id: "order1",
                status: "Processing",
                buyer: { name: "Alice Brown" },
                createAt: "2026-02-05T10:00:00Z",
                payment: { success: true },
                products: [
                    {
                        _id: "prod123",
                        name: "Headphones",
                        description: "Noise cancelling headphones",
                        price: 200,
                    },
                ],
            },
        ];

        useAuth.mockReturnValue([mockAuth, jest.fn()]);
        axios.get.mockResolvedValueOnce({ data: mockOrders });

        // Act
        renderWithRouter();

        // Assert
        const image = await screen.findByAltText("Headphones");
        expect(image).toHaveAttribute(
            "src",
            "/api/v1/product/product-photo/prod123",
        );
        expect(image).toHaveAttribute("width", "100px");
        expect(image).toHaveAttribute("height", "100px");
    });

    it("handleChange_selectNewStatus_updatesOrderStatus", async () => {
        // Arrange
        const mockAuth = {
            user: { name: "Admin", email: "admin@test.com", role: 1 },
            token: "admin-token",
        };
        const mockOrders = [
            {
                _id: "order1",
                status: "Processing",
                buyer: { name: "Charlie Davis" },
                createAt: "2026-02-05T10:00:00Z",
                payment: { success: true },
                products: [
                    {
                        _id: "prod1",
                        name: "Tablet",
                        description: "10-inch tablet",
                        price: 300,
                    },
                ],
            },
        ];

        useAuth.mockReturnValue([mockAuth, jest.fn()]);
        axios.get
            .mockResolvedValueOnce({ data: mockOrders })
            .mockResolvedValueOnce({ data: mockOrders });
        axios.put.mockResolvedValueOnce({ data: { success: true } });

        // Act
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText("Charlie Davis")).toBeInTheDocument();
        });

        // Find the Select component and simulate change
        const selectElement = screen.getByRole("combobox");
        fireEvent.mouseDown(selectElement);

        await waitFor(() => {
            const shippedOption = screen.getByText("Shipped");
            fireEvent.click(shippedOption);
        });

        // Assert
        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledWith(
                "/api/v1/auth/order-status/order1",
                { status: "Shipped" },
            );
        });

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledTimes(2);
        });
    });

    it("handleChange_apiError_logsError", async () => {
        // Arrange
        const consoleLogSpy = jest
            .spyOn(console, "log")
            .mockImplementation(() => {});
        const mockAuth = {
            user: { name: "Admin", email: "admin@test.com", role: 1 },
            token: "admin-token",
        };
        const mockOrders = [
            {
                _id: "order1",
                status: "Processing",
                buyer: { name: "Eve Wilson" },
                createAt: "2026-02-05T10:00:00Z",
                payment: { success: true },
                products: [
                    {
                        _id: "prod1",
                        name: "Phone",
                        description: "Smartphone",
                        price: 800,
                    },
                ],
            },
        ];

        useAuth.mockReturnValue([mockAuth, jest.fn()]);
        axios.get.mockResolvedValueOnce({ data: mockOrders });
        const mockError = new Error("Network error");
        axios.put.mockRejectedValueOnce(mockError);

        // Act
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText("Eve Wilson")).toBeInTheDocument();
        });

        const selectElement = screen.getByRole("combobox");
        fireEvent.mouseDown(selectElement);

        await waitFor(() => {
            const cancelOption = screen.getByText("cancel");
            fireEvent.click(cancelOption);
        });

        // Assert
        await waitFor(() => {
            expect(consoleLogSpy).toHaveBeenCalledWith(mockError);
        });

        consoleLogSpy.mockRestore();
    });

    it("emptyOrders_apiReturnsEmpty_rendersEmptyState", async () => {
        // Arrange
        const mockAuth = {
            user: { name: "Admin", email: "admin@test.com", role: 1 },
            token: "admin-token",
        };

        useAuth.mockReturnValue([mockAuth, jest.fn()]);
        axios.get.mockResolvedValueOnce({ data: [] });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/all-orders");
        });

        expect(
            screen.getByRole("heading", { name: /All Orders/i }),
        ).toBeInTheDocument();

        const tables = screen.queryAllByRole("table");
        expect(tables).toHaveLength(0);
    });

    it("getOrders_apiError_logsError", async () => {
        // Arrange
        const consoleLogSpy = jest
            .spyOn(console, "log")
            .mockImplementation(() => {});
        const mockAuth = {
            user: { name: "Admin", email: "admin@test.com", role: 1 },
            token: "admin-token",
        };
        const mockError = new Error("Failed to fetch orders");

        useAuth.mockReturnValue([mockAuth, jest.fn()]);
        axios.get.mockRejectedValueOnce(mockError);

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(consoleLogSpy).toHaveBeenCalledWith(mockError);
        });

        consoleLogSpy.mockRestore();
    });

    it("paymentStatus_success_displaysSuccess", async () => {
        // Arrange
        const mockAuth = {
            user: { name: "Admin", email: "admin@test.com", role: 1 },
            token: "admin-token",
        };
        const mockOrders = [
            {
                _id: "order1",
                status: "Processing",
                buyer: { name: "Frank Miller" },
                createAt: "2026-02-05T10:00:00Z",
                payment: { success: true },
                products: [
                    {
                        _id: "prod1",
                        name: "Camera",
                        description: "DSLR camera",
                        price: 1500,
                    },
                ],
            },
        ];

        useAuth.mockReturnValue([mockAuth, jest.fn()]);
        axios.get.mockResolvedValueOnce({ data: mockOrders });

        // Act
        renderWithRouter();

        // Assert
        expect(await screen.findByText("Success")).toBeInTheDocument();
    });

    it("paymentStatus_failed_displaysFailed", async () => {
        // Arrange
        const mockAuth = {
            user: { name: "Admin", email: "admin@test.com", role: 1 },
            token: "admin-token",
        };
        const mockOrders = [
            {
                _id: "order1",
                status: "Processing",
                buyer: { name: "Grace Lee" },
                createAt: "2026-02-05T10:00:00Z",
                payment: { success: false },
                products: [
                    {
                        _id: "prod1",
                        name: "Watch",
                        description: "Smart watch",
                        price: 250,
                    },
                ],
            },
        ];

        useAuth.mockReturnValue([mockAuth, jest.fn()]);
        axios.get.mockResolvedValueOnce({ data: mockOrders });

        // Act
        renderWithRouter();

        // Assert
        expect(await screen.findByText("Failed")).toBeInTheDocument();
    });
});
