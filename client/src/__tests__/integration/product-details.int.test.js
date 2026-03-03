// David Vicedo, A0273234J

import React from "react";
import {
    render,
    screen,
    fireEvent,
    waitFor,
    act,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import ProductDetails from "../../pages/ProductDetails";
import { AuthProvider } from "../../context/auth";
import { CartProvider } from "../../context/cart";
import { SearchProvider } from "../../context/search";

/**
 * MS2 Integration Tests — ProductDetails (Top-Down, Incremental)
 *
 * Integration Testing Approach: Top-Down (Incremental)
 * - We start from the top-level `ProductDetails` UI as the driver and progressively integrate
 *   real dependencies “downwards” until we cover the critical runtime path.
 *
 * Rationale (why Top-Down fits ProductDetails)
 * - `ProductDetails` is route-driven (depends on real route params) and user-driven (depends on
 *   navigation via “More Details”). Top-down integration ensures we validate the UI and routing
 *   behavior first, while incrementally incorporating real layout dependencies and async I/O.
 *
 * Modules integrated (minimum set)
 * - UI Driver: `ProductDetails` (page)
 * - Layout Composition: real `Layout` → real `Header` (and its dependencies)
 * - Routing: `MemoryRouter` + `Routes`/`Route` + real `useParams`/`useNavigate`
 * - State Providers: real `AuthProvider`, `CartProvider`, `SearchProvider` (required by Header)
 * - I/O: `axios.get` (mocked responses only) and async rendering/waiting
 *
 * Critical path & integration points covered
 * - Router param → `ProductDetails` effect → `axios.get(get-product/:slug)` → state render
 * - Downstream call chaining → `axios.get(related-product/:pid/:cid)` → related state render
 * - User click on “More Details” → real router navigation → param changes → refetch & rerender
 */

/**
 * Test-to-partition mapping (for MS2 traceability)
 * - productDetails_success_validSlug_rendersProductAndRequestsRelated
 *   - Success partition: valid `slug` param, both axios calls resolve
 * - productDetails_success_relatedNonEmpty_rendersRelatedCards
 *   - Success partition: relatedProducts.length >= 1 renders cards + actions
 * - productDetails_navigation_clickMoreDetails_updatesRouteAndFetchesNewSlug
 *   - Navigation partition: clicking “More Details” triggers real navigation + refetch on new slug
 * - productDetails_failure_invalidSlug_rejectsAndShowsFallback
 *   - Failure partition: getProduct axios call rejects; component remains stable and shows fallback
 * - productDetails_edge_missingSlug_doesNotCallApi
 *   - Edge partition: slug absent; getProduct is not invoked
 */

jest.mock("axios");

const createDeferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const CATEGORY_URL = "/api/v1/category/get-category";

window.matchMedia =
    window.matchMedia ||
    function matchMedia() {
        return {
            matches: false,
            addListener: function () {},
            removeListener: function () {},
        };
    };

const ensureAxiosDefaultsForAuthProvider = () => {
    // AuthProvider writes to axios.defaults.headers.common["Authorization"].
    // When `axios` is mocked, we need to ensure this shape exists.
    axios.defaults = axios.defaults || {};
    axios.defaults.headers = axios.defaults.headers || {};
    axios.defaults.headers.common = axios.defaults.headers.common || {};
};

const setMinimalLocalStorageForProviders = () => {
    localStorage.clear();
    // CartProvider reads `cart` on mount.
    localStorage.setItem("cart", JSON.stringify([]));
    // AuthProvider reads `auth` on mount (null is acceptable but we keep it explicit).
    localStorage.setItem("auth", JSON.stringify({ user: null, token: "" }));
};

const mockAxiosGetWithCategoryAndHandlers = (handlersByUrl) => {
    axios.get.mockImplementation((url) => {
        if (url === CATEGORY_URL) {
            return Promise.resolve({ data: { category: [] } });
        }
        const handler = handlersByUrl[url];
        if (handler) return handler();
        return Promise.reject(new Error(`Unhandled axios.get URL: ${url}`));
    });
};

const renderWithRouterAndProviders = (
    initialEntry = "/product/test-slug",
    routePath = "/product/:slug",
) => {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <AuthProvider>
                <SearchProvider>
                    <CartProvider>
                        <Routes>
                            <Route
                                path={routePath}
                                element={<ProductDetails />}
                            />
                        </Routes>
                    </CartProvider>
                </SearchProvider>
            </AuthProvider>
        </MemoryRouter>,
    );
};

describe("MS2 Integration - ProductDetails", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ensureAxiosDefaultsForAuthProvider();
        setMinimalLocalStorageForProviders();
    });

    // David Vicedo, A0273234J
    it("productDetails_success_validSlug_rendersProductAndRequestsRelated", async () => {
        // Arrange
        const product = {
            _id: "p1",
            name: "iPhone",
            description: "A phone",
            price: 1000,
            slug: "iphone",
            category: { _id: "c1", name: "Phones" },
        };

        const relatedRequest = createDeferred();

        mockAxiosGetWithCategoryAndHandlers({
            "/api/v1/product/get-product/iphone": () =>
                Promise.resolve({ data: { product } }),
            "/api/v1/product/related-product/p1/c1": () =>
                relatedRequest.promise,
        });

        // Act
        renderWithRouterAndProviders("/product/iphone");

        // Assert
        expect(
            await screen.findByRole("heading", { name: /product details/i }),
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

        await act(async () => {
            relatedRequest.resolve({ data: { products: [] } });
            await relatedRequest.promise;
        });

        expect(
            await screen.findByText(/No Similar Products found/i),
        ).toBeInTheDocument();
    });

    // David Vicedo, A0273234J
    it("productDetails_success_relatedNonEmpty_rendersRelatedCards", async () => {
        // Arrange
        const product = {
            _id: "p1",
            name: "iPhone",
            description: "A phone",
            price: 1000,
            slug: "iphone",
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

        const relatedRequest = createDeferred();

        mockAxiosGetWithCategoryAndHandlers({
            "/api/v1/product/get-product/iphone": () =>
                Promise.resolve({ data: { product } }),
            "/api/v1/product/related-product/p1/c1": () =>
                relatedRequest.promise,
        });

        // Act
        renderWithRouterAndProviders("/product/iphone");

        // Assert
        expect(
            await screen.findByText("Similar Products ➡️"),
        ).toBeInTheDocument();

        await act(async () => {
            relatedRequest.resolve({ data: { products: relatedProducts } });
            await relatedRequest.promise;
        });

        expect(await screen.findByText("Case")).toBeInTheDocument();
        expect(await screen.findByText("Charger")).toBeInTheDocument();

        const moreDetailsButtons = await screen.findAllByRole("button", {
            name: /more details/i,
        });
        expect(moreDetailsButtons.length).toBeGreaterThanOrEqual(2);
    });

    // David Vicedo, A0273234J
    it("productDetails_navigation_clickMoreDetails_updatesRouteAndFetchesNewSlug", async () => {
        // Arrange
        const iphoneProduct = {
            _id: "p1",
            name: "iPhone",
            description: "A phone",
            price: 1000,
            slug: "iphone",
            category: { _id: "c1", name: "Phones" },
        };

        const caseProduct = {
            _id: "p2",
            name: "Case",
            description: "A protective case",
            price: 25,
            slug: "case",
            category: { _id: "c2", name: "Accessories" },
        };

        const relatedForIphone = [
            {
                _id: "rp1",
                name: "Case",
                slug: "case",
                description:
                    "This is a long description for a case that should be truncated in the UI",
                price: 25,
            },
        ];

        const relatedForCaseRequest = createDeferred();

        mockAxiosGetWithCategoryAndHandlers({
            "/api/v1/product/get-product/iphone": () =>
                Promise.resolve({ data: { product: iphoneProduct } }),
            "/api/v1/product/related-product/p1/c1": () =>
                Promise.resolve({ data: { products: relatedForIphone } }),
            "/api/v1/product/get-product/case": () =>
                Promise.resolve({ data: { product: caseProduct } }),
            "/api/v1/product/related-product/p2/c2": () =>
                relatedForCaseRequest.promise,
        });

        // Act
        renderWithRouterAndProviders("/product/iphone");

        expect(
            await screen.findByText(/Name\s*:\s*iPhone/),
        ).toBeInTheDocument();
        expect(await screen.findByText("Case")).toBeInTheDocument();

        const moreDetailsButtons = await screen.findAllByRole("button", {
            name: /more details/i,
        });

        fireEvent.click(moreDetailsButtons[0]);

        // Assert
        expect(await screen.findByText(/Name\s*:\s*Case/)).toBeInTheDocument();

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(
                "/api/v1/product/get-product/case",
            );
        });

        await act(async () => {
            relatedForCaseRequest.resolve({ data: { products: [] } });
            await relatedForCaseRequest.promise;
        });
    });

    // David Vicedo, A0273234J
    it("productDetails_failure_invalidSlug_rejectsAndShowsFallback", async () => {
        // Arrange
        const consoleSpy = jest
            .spyOn(console, "log")
            .mockImplementation(() => {});

        mockAxiosGetWithCategoryAndHandlers({
            "/api/v1/product/get-product/bad-slug": () =>
                Promise.reject(new Error("network")),
        });

        // Act
        renderWithRouterAndProviders("/product/bad-slug");

        // Assert
        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalled();
        });

        expect(
            await screen.findByText(/No Similar Products found/i),
        ).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    // David Vicedo, A0273234J
    it("productDetails_edge_missingSlug_doesNotCallApi", async () => {
        // Arrange
        // Header/useCategory performs a category fetch; we stub it so the real Layout/Header can mount.
        // Any unexpected ProductDetails calls will fail the test.
        axios.get.mockImplementation((url) => {
            if (url === CATEGORY_URL) {
                return Promise.resolve({ data: { category: [] } });
            }
            return Promise.reject(new Error(`Unhandled axios.get URL: ${url}`));
        });

        // Act
        renderWithRouterAndProviders("/product", "/product/:slug?");

        // Assert
        // Wait for the Header category fetch, then clear calls so we can assert ProductDetails makes none.
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(CATEGORY_URL);
        });

        axios.get.mockClear();

        expect(
            await screen.findByText(/No Similar Products found/i),
        ).toBeInTheDocument();

        await waitFor(() => {
            expect(axios.get).not.toHaveBeenCalled();
        });
    });

    // David Vicedo, A0273234J
    it("productDetails_failure_emptyProductResponse_showsFallbackAndSkipsRelated", async () => {
        // Arrange
        mockAxiosGetWithCategoryAndHandlers({
            "/api/v1/product/get-product/iphone": () =>
                Promise.resolve({ data: { product: null } }),
        });

        // Act
        renderWithRouterAndProviders("/product/iphone");

        // Assert
        expect(
            await screen.findByText(/No Similar Products found/i),
        ).toBeInTheDocument();

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(
                "/api/v1/product/get-product/iphone",
            );
        });

        await waitFor(() => {
            expect(axios.get).not.toHaveBeenCalledWith(
                expect.stringContaining("/api/v1/product/related-product/"),
            );
        });
    });
});
