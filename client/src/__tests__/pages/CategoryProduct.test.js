// Anthony Hermanto, A0269067R

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import CategoryProduct from "../../pages/CategoryProduct";

// Mock dependencies
jest.mock("axios");

jest.mock("../../components/Layout", () => {
    const LayoutMock = ({ children }) => (
        <div data-testid="layout">{children}</div>
    );
    return {
        __esModule: true,
        default: LayoutMock,
    };
});

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

const renderWithRouter = (
    initialEntry = "/category/electronics",
    routePath = "/category/:slug",
) => {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                <Route path={routePath} element={<CategoryProduct />} />
            </Routes>
        </MemoryRouter>,
    );
};

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "renders_categoryProductPage_displaysLoading" -> Equivalence class: loading state during async fetch
 * - "fetchProducts_onMount_callsAPIWithSlug" -> API integration partition: correct endpoint with params
 * - "displayProducts_validData_showsProductCards" -> Equivalence class: multiple products display
 * - "displayCategory_validData_showsCategoryName" -> Equivalence class: category metadata display
 * - "productPrice_displayed_formattedAsCurrency" -> Data formatting partition: price presentation
 * - "productDescription_longText_truncatesTo60Chars" -> Boundary analysis: text truncation at 60 chars
 * - "apiError_failedRequest_handlesGracefully" -> Error handling partition: network failure recovery
 * - "moreDetailsButton_hasCorrectClass" -> Structural completeness: CSS class validation
 * - "noSlug_skipsAPICall" -> Edge case: missing route parameter
 * - "moreDetailsButton_click_navigatesToProductDetails" -> Navigation partition: product detail routing
 */

describe("CategoryProduct Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "log").mockImplementation(() => {});
    });

    test("renders_categoryProductPage_displaysLoading", () => {
        // Arrange
        axios.get.mockImplementation(() => new Promise(() => {}));

        // Act
        renderWithRouter();

        // Assert
        expect(screen.getByTestId("layout")).toBeInTheDocument();
        expect(screen.getByText("Category -")).toBeInTheDocument();
    });

    test("fetchProducts_onMount_callsAPIWithSlug", async () => {
        // Arrange
        const mockData = {
            success: true,
            category: { _id: "1", name: "Electronics", slug: "electronics" },
            products: [],
        };
        axios.get.mockResolvedValueOnce({ data: mockData });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(
                "/api/v1/product/product-category/electronics",
            );
        });
    });

    test("displayProducts_validData_showsProductCards", async () => {
        // Arrange
        const mockProducts = [
            {
                _id: "1",
                name: "Laptop",
                slug: "laptop",
                price: 999,
                description: "High performance laptop",
            },
            {
                _id: "2",
                name: "Mouse",
                slug: "mouse",
                price: 25,
                description: "Wireless mouse",
            },
            {
                _id: "3",
                name: "Keyboard",
                slug: "keyboard",
                price: 75,
                description: "Mechanical keyboard",
            },
        ];
        const mockData = {
            success: true,
            category: { _id: "1", name: "Electronics", slug: "electronics" },
            products: mockProducts,
        };
        axios.get.mockResolvedValueOnce({ data: mockData });

        // Act
        renderWithRouter();

        // Assert
        expect(
            await screen.findByText("Category - Electronics"),
        ).toBeInTheDocument();
        expect(await screen.findByText("3 result found")).toBeInTheDocument();
        expect(await screen.findByText("Laptop")).toBeInTheDocument();
        expect(await screen.findByText("Mouse")).toBeInTheDocument();
        expect(await screen.findByText("Keyboard")).toBeInTheDocument();
    });

    test("displayCategory_validData_showsCategoryName", async () => {
        // Arrange
        const mockData = {
            success: true,
            category: { _id: "1", name: "Electronics", slug: "electronics" },
            products: [],
        };
        axios.get.mockResolvedValueOnce({ data: mockData });

        // Act
        renderWithRouter();

        // Assert
        expect(
            await screen.findByText("Category - Electronics"),
        ).toBeInTheDocument();
        expect(await screen.findByText("0 result found")).toBeInTheDocument();
    });

    test("productPrice_displayed_formattedAsCurrency", async () => {
        // Arrange
        const mockProducts = [
            {
                _id: "1",
                name: "Laptop",
                slug: "laptop",
                price: 999.99,
                description: "High performance laptop",
            },
        ];
        const mockData = {
            success: true,
            category: { _id: "1", name: "Electronics", slug: "electronics" },
            products: mockProducts,
        };
        axios.get.mockResolvedValueOnce({ data: mockData });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(screen.getByText("$999.99")).toBeInTheDocument();
        });
    });

    test("productDescription_longText_truncatesTo60Chars", async () => {
        // Arrange
        const longDescription =
            "This is a very long description that should be truncated to only sixty characters maximum";
        const mockProducts = [
            {
                _id: "1",
                name: "Laptop",
                slug: "laptop",
                price: 999,
                description: longDescription,
            },
        ];
        const mockData = {
            success: true,
            category: { _id: "1", name: "Electronics", slug: "electronics" },
            products: mockProducts,
        };
        axios.get.mockResolvedValueOnce({ data: mockData });

        // Act
        renderWithRouter();

        // Assert
        const truncatedText = await screen.findByText(
            /This is a very long description that should be truncated/,
        );

        expect(truncatedText).toHaveTextContent("...");
        expect(truncatedText.textContent.length).toBeLessThanOrEqual(64);
    });

    test("apiError_failedRequest_handlesGracefully", async () => {
        // Arrange
        const consoleLogSpy = jest
            .spyOn(console, "log")
            .mockImplementation(() => {});
        axios.get.mockRejectedValueOnce(new Error("Network error"));

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        consoleLogSpy.mockRestore();
    });

    test("moreDetailsButton_hasCorrectClass", async () => {
        // Arrange
        const mockProducts = [
            {
                _id: "1",
                name: "Laptop",
                slug: "laptop",
                price: 999,
                description: "High performance laptop",
            },
        ];
        const mockData = {
            success: true,
            category: { _id: "1", name: "Electronics", slug: "electronics" },
            products: mockProducts,
        };
        axios.get.mockResolvedValueOnce({ data: mockData });

        // Act
        renderWithRouter();

        // Assert
        const button = await screen.findByRole("button", {
            name: "More Details",
        });

        expect(button).toBeInTheDocument();
        expect(button).toHaveClass("btn", "btn-info");
    });

    test("noSlug_skipsAPICall", () => {
        // Arrange
        // Act
        renderWithRouter("/category/", "/category/:slug?");

        // Assert - Should not call API when no slug
        expect(axios.get).not.toHaveBeenCalled();
    });

    test("moreDetailsButton_click_navigatesToProductDetails", async () => {
        // Arrange
        const mockProducts = [
            {
                _id: "1",
                name: "Laptop",
                slug: "laptop",
                price: 999,
                description: "High performance laptop",
            },
        ];
        const mockData = {
            success: true,
            category: { _id: "1", name: "Electronics", slug: "electronics" },
            products: mockProducts,
        };
        axios.get.mockResolvedValueOnce({ data: mockData });

        // Act
        renderWithRouter();

        const button = await screen.findByRole("button", {
            name: "More Details",
        });

        fireEvent.click(button);

        // Assert
        expect(mockNavigate).toHaveBeenCalledWith("/product/laptop");
    });
});
