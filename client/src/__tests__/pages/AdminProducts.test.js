import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";
import Products from "../../pages/admin/Products";

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "getAllProducts_success_rendersProductCards" -> Equivalence class: API success with multiple products
 * - "productCard_rendered_showsCorrectImageSrc" -> Structural completeness: image src matches expected format
 * - "productCard_rendered_showsNameAndDescription" -> Equivalence class: product data display
 * - "productCard_link_hasCorrectHref" -> Regression/contract: Link navigation to product edit page
 * - "emptyProducts_apiReturnsEmpty_rendersEmptyState" -> Edge case: empty products array
 * - "getAllProducts_apiError_logsErrorAndShowsToast" -> Error handling partition: API failure
 */

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

const renderWithRouter = (initialEntry = "/dashboard/admin/products") => {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                <Route path="/dashboard/admin/products" element={<Products />} />
            </Routes>
        </MemoryRouter>
    );
};

describe("Admin Products Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("getAllProducts_success_rendersProductCards", async () => {
        // Arrange
        const mockProducts = [
            {
                _id: "prod1",
                name: "Laptop",
                slug: "laptop",
                description: "High performance laptop",
                price: 1200,
            },
            {
                _id: "prod2",
                name: "Mouse",
                slug: "mouse",
                description: "Wireless gaming mouse",
                price: 50,
            },
        ];

        axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

        // Act
        renderWithRouter();

        // Assert
        expect(screen.getByTestId("layout")).toBeInTheDocument();
        expect(screen.getByTestId("admin-menu")).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: /All Products List/i }),
        ).toBeInTheDocument();

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith("/api/v1/product/get-product");
        });

        const laptopName = await screen.findByText("Laptop");
        const mouseName = await screen.findByText("Mouse");

        expect(laptopName).toBeInTheDocument();
        expect(mouseName).toBeInTheDocument();
    });

    it("productCard_rendered_showsCorrectImageSrc", async () => {
        // Arrange
        const mockProducts = [
            {
                _id: "prod1",
                name: "Laptop",
                slug: "laptop",
                description: "High performance laptop",
            },
            {
                _id: "prod2",
                name: "Mouse",
                slug: "mouse",
                description: "Wireless gaming mouse",
            },
        ];

        axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

        // Act
        renderWithRouter();

        // Assert
        const images = await screen.findAllByRole("img");

        expect(images[0]).toHaveAttribute(
            "src",
            "/api/v1/product/product-photo/prod1",
        );
        expect(images[0]).toHaveAttribute("alt", "Laptop");

        expect(images[1]).toHaveAttribute(
            "src",
            "/api/v1/product/product-photo/prod2",
        );
        expect(images[1]).toHaveAttribute("alt", "Mouse");
    });

    it("productCard_rendered_showsNameAndDescription", async () => {
        // Arrange
        const mockProducts = [
            {
                _id: "prod1",
                name: "Laptop",
                slug: "laptop",
                description: "High performance laptop for developers",
            },
        ];

        axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

        // Act
        renderWithRouter();

        // Assert
        expect(await screen.findByText("Laptop")).toBeInTheDocument();
        expect(
            screen.getByText("High performance laptop for developers"),
        ).toBeInTheDocument();
    });

    it("productCard_link_hasCorrectHref", async () => {
        // Arrange
        const mockProducts = [
            {
                _id: "prod1",
                name: "Laptop",
                slug: "laptop-pro",
                description: "High performance laptop",
            },
            {
                _id: "prod2",
                name: "Mouse",
                slug: "gaming-mouse",
                description: "Wireless gaming mouse",
            },
        ];

        axios.get.mockResolvedValueOnce({ data: { products: mockProducts } });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(screen.getByText("Laptop")).toBeInTheDocument();
        });

        const links = screen.getAllByRole("link", { name: /Laptop|Mouse/i });

        expect(links[0]).toHaveAttribute(
            "href",
            "/dashboard/admin/product/laptop-pro",
        );
        expect(links[1]).toHaveAttribute(
            "href",
            "/dashboard/admin/product/gaming-mouse",
        );
    });

    it("emptyProducts_apiReturnsEmpty_rendersEmptyState", async () => {
        // Arrange
        axios.get.mockResolvedValueOnce({ data: { products: [] } });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith("/api/v1/product/get-product");
        });

        expect(
            screen.getByRole("heading", { name: /All Products List/i }),
        ).toBeInTheDocument();

        const images = screen.queryAllByRole("img");
        expect(images).toHaveLength(0);

        const productLinks = screen.queryAllByRole("link", {
            name: /./,
        });
        expect(productLinks).toHaveLength(0);
    });

    it("getAllProducts_apiError_logsErrorAndShowsToast", async () => {
        // Arrange
        const consoleLogSpy = jest
            .spyOn(console, "log")
            .mockImplementation(() => {});
        const mockError = new Error("Network error");

        axios.get.mockRejectedValueOnce(mockError);
        toast.error = jest.fn();

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(consoleLogSpy).toHaveBeenCalledWith(mockError);
        });

        expect(toast.error).toHaveBeenCalledWith("Someething Went Wrong");

        consoleLogSpy.mockRestore();
    });
});
