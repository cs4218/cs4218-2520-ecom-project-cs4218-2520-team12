import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import ProductDetails from "../../pages/ProductDetails";

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "renders product details and fetches related products" -> Equivalence class: params.slug present, API success
 * - "renders empty similar state when no related products" -> Equivalence class: relatedProducts.length < 1
 * - "renders similar product cards and navigates on More Details" -> Equivalence class: relatedProducts.length >= 1
 * - "missing slug does not call API" -> Edge case: params.slug absent
 * - "getProduct error logs and renders fallback" -> Failure partition: first axios call rejects
 * - "getSimilarProduct error logs and keeps empty state" -> Failure partition: second axios call rejects
 */

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
    function matchMedia() {
        return {
            matches: false,
            addListener: function () {},
            removeListener: function () {},
        };
    };

const renderWithRouter = (
    initialEntry = "/product/test-slug",
    routePath = "/product/:slug",
) => {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                <Route path={routePath} element={<ProductDetails />} />
            </Routes>
        </MemoryRouter>,
    );
};

describe("ProductDetails Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("getProduct_success_rendersDetailsAndCallsRelatedProducts", async () => {
        // Arrange
        const product = {
            _id: "p1",
            name: "iPhone",
            description: "A phone",
            price: 1000,
            category: { _id: "c1", name: "Phones" },
        };

        axios.get
            .mockResolvedValueOnce({ data: { product } })
            .mockResolvedValueOnce({ data: { products: [] } });

        // Act
        renderWithRouter("/product/iphone");

        // Assert
        expect(screen.getByTestId("layout")).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: /product details/i }),
        ).toBeInTheDocument();

        expect(
            await screen.findByText(/Name\s*:\s*iPhone/),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Description\s*:\s*A phone/),
        ).toBeInTheDocument();
        expect(screen.getByText(/Category\s*:\s*Phones/)).toBeInTheDocument();
        expect(screen.getByText(/\$1,000\.00/)).toBeInTheDocument();

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(
                "/api/v1/product/get-product/iphone",
            );
            expect(axios.get).toHaveBeenCalledWith(
                "/api/v1/product/related-product/p1/c1",
            );
        });

        expect(
            screen.getByText(/No Similar Products found/i),
        ).toBeInTheDocument();
    });

    it("relatedProducts_nonEmpty_rendersCardsAndNavigatesToDetails", async () => {
        // Arrange
        const product = {
            _id: "p1",
            name: "iPhone",
            description: "A phone",
            price: 1000,
            category: { _id: "c1", name: "Phones" },
        };

        const relatedProducts = [
            {
                _id: "rp1",
                name: "Case",
                slug: "case",
                description:
                    "This is a long description for a case that should be truncated in the UI",
                price: 25,
            },
            {
                _id: "rp2",
                name: "Charger",
                slug: "charger",
                description:
                    "This is a long description for a charger that should be truncated in the UI",
                price: 49,
            },
        ];

        axios.get
            .mockResolvedValueOnce({ data: { product } })
            .mockResolvedValueOnce({ data: { products: relatedProducts } });

        // Act
        renderWithRouter("/product/iphone");

        // Assert
        expect(
            await screen.findByText("Similar Products ➡️"),
        ).toBeInTheDocument();

        expect(await screen.findByText("Case")).toBeInTheDocument();
        expect(await screen.findByText("Charger")).toBeInTheDocument();
        expect(screen.getByText(/\$25\.00/)).toBeInTheDocument();
        expect(screen.getByText(/\$49\.00/)).toBeInTheDocument();

        await waitFor(() => {
            expect(
                screen.queryByText(/No Similar Products found/i),
            ).not.toBeInTheDocument();
            expect(axios.get).toHaveBeenCalledTimes(2);
        });

        const moreDetailsButtons = await screen.findAllByRole("button", {
            name: /more details/i,
        });

        fireEvent.click(moreDetailsButtons[0]);
        expect(mockNavigate).toHaveBeenCalledWith("/product/case");
    });

    it("getProduct_missingSlug_doesNotCallApi", () => {
        // Arrange
        // no axios stubbing needed; should not be called

        // Act
        renderWithRouter("/product", "/product/:slug?");

        // Assert
        expect(axios.get).not.toHaveBeenCalled();
        expect(
            screen.getByText(/No Similar Products found/i),
        ).toBeInTheDocument();
    });

    it("getProduct_apiRejects_logsErrorAndRendersEmptyState", async () => {
        // Arrange
        const consoleSpy = jest
            .spyOn(console, "log")
            .mockImplementation(() => {});
        axios.get.mockRejectedValueOnce(new Error("network"));

        // Act
        renderWithRouter("/product/iphone");

        // Assert
        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalled();
        });
        expect(
            screen.getByText(/No Similar Products found/i),
        ).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    it("getSimilarProduct_apiRejects_logsErrorAndKeepsEmptyState", async () => {
        // Arrange
        const consoleSpy = jest
            .spyOn(console, "log")
            .mockImplementation(() => {});

        const product = {
            _id: "p1",
            name: "iPhone",
            description: "A phone",
            price: 1000,
            category: { _id: "c1", name: "Phones" },
        };

        axios.get
            .mockResolvedValueOnce({ data: { product } })
            .mockRejectedValueOnce(new Error("related failed"));

        // Act
        renderWithRouter("/product/iphone");

        // Assert
        expect(
            await screen.findByText(/Name\s*:\s*iPhone/),
        ).toBeInTheDocument();

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(
                "/api/v1/product/related-product/p1/c1",
            );
        });

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalled();
        });

        expect(
            screen.getByText(/No Similar Products found/i),
        ).toBeInTheDocument();

        consoleSpy.mockRestore();
    });
});
