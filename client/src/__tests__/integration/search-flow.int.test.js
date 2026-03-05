// David Vicedo, A0273234J

import React from "react";
import {
    render,
    screen,
    fireEvent,
    waitFor,
    act,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import SearchInput from "../../components/Form/SearchInput";
import Search from "../../pages/Search";
import { SearchProvider } from "../../context/search";
import { AuthProvider } from "../../context/auth";
import { CartProvider } from "../../context/cart";

/**
 * MS2 Integration Tests — Search Flow (Top-Down, Incremental)
 *
 * Integration Testing Approach: Top-Down (Incremental)
 * - We begin with the driver `SearchInput` (top-level UI interaction) and incrementally integrate
 *   real dependencies “downwards”: real `SearchProvider` state, real router navigation, and the
 *   real `Search` page rendering that consumes provider state.
 *
 * Rationale (why Top-Down suits the Search flow)
 * - The search flow is user-driven (typing/submitting) and navigation-driven (redirect to `/search`).
 *   Top-down integration validates that the UI triggers the correct network request, updates shared
 *   context state, navigates using the real router, and renders results on the destination page.
 *
 * Modules integrated (minimum set)
 * - UI Driver: `SearchInput`
 * - Provider: real `SearchProvider` + `useSearch` (no mocking of context)
 * - Routing: `MemoryRouter` + `Routes`/`Route` + real `useNavigate`/`useLocation`
 * - Destination Page: `Search` page (renders results / empty state)
 * - External I/O: `axios.get` (mocked responses only)
 *
 * Critical path & integration points covered
 * - Type keyword → submit form → `axios.get(/api/v1/product/search/:keyword)`
 * - Provider state update (`results`) → router navigation to `/search`
 * - `/search` route renders `Search` and reads results from the same provider instance
 */

/**
 * Test-to-partition mapping (for MS2 traceability)
 * - searchFlow_success_submits_updatesContext_navigates_and_rendersResults
 *   - Success partition: axios resolves with non-empty results; provider carries results across navigation
 * - searchFlow_emptyResults_submits_navigates_and_showsNoProductsFound
 *   - Edge partition: axios resolves with empty results; navigation occurs and empty-state text renders
 */

jest.mock("axios");

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
    localStorage.setItem("cart", JSON.stringify([]));
    localStorage.setItem("auth", JSON.stringify({ user: null, token: "" }));
};

const SearchPageProbe = () => {
    const location = useLocation();
    return (
        <div>
            <div data-testid="current-route">{location.pathname}</div>
            <Search />
        </div>
    );
};

const renderSearchFlow = (initialEntry = "/") => {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <AuthProvider>
                <SearchProvider>
                    <CartProvider>
                        <Routes>
                            <Route path="/" element={<SearchInput />} />
                            <Route
                                path="/search"
                                element={<SearchPageProbe />}
                            />
                        </Routes>
                    </CartProvider>
                </SearchProvider>
            </AuthProvider>
        </MemoryRouter>,
    );
};

const makeSearchResultsDataShape = (products) => {
    // SearchInput sets context `results` to `data` (not `data.results`).
    // Search page expects `results` to behave like an array (length + map),
    // while this object also includes a `results` property for traceability.
    return {
        results: products,
        length: products.length,
        map: products.map.bind(products),
    };
};

describe("MS2 Integration - Search Flow", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ensureAxiosDefaultsForAuthProvider();
        setMinimalLocalStorageForProviders();
    });

    // David Vicedo, A0273234J
    it("searchFlow_success_submits_updatesContext_navigates_and_rendersResults", async () => {
        // Arrange
        const keyword = "iphone";
        const products = [
            {
                _id: "p1",
                name: "iPhone 15",
                slug: "iphone-15",
                description: "A phone with a great camera",
                price: 1000,
            },
            {
                _id: "p2",
                name: "iPhone Case",
                slug: "iphone-case",
                description: "A protective case for your phone",
                price: 25,
            },
        ];

        axios.get.mockImplementation((url) => {
            if (url === CATEGORY_URL) {
                return Promise.resolve({ data: { category: [] } });
            }
            if (url === `/api/v1/product/search/${keyword}`) {
                return Promise.resolve({
                    data: makeSearchResultsDataShape(products),
                });
            }
            return Promise.reject(new Error(`Unhandled axios.get URL: ${url}`));
        });

        // Act
        renderSearchFlow("/");

        const input = screen.getByRole("searchbox", { name: /search/i });
        fireEvent.change(input, { target: { value: keyword } });

        await waitFor(() => {
            expect(input).toHaveValue(keyword);
        });

        await act(async () => {
            fireEvent.submit(screen.getByRole("search"));
        });

        // Assert
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(
                `/api/v1/product/search/${keyword}`,
            );
        });

        expect(await screen.findByTestId("current-route")).toHaveTextContent(
            "/search",
        );

        expect(await screen.findByText("iPhone 15")).toBeInTheDocument();
        expect(await screen.findByText("iPhone Case")).toBeInTheDocument();
        expect(screen.getByText(/\$\s*1000/)).toBeInTheDocument();
        expect(screen.getByText(/\$\s*25/)).toBeInTheDocument();
    });

    // David Vicedo, A0273234J
    it("searchFlow_emptyResults_submits_navigates_and_showsNoProductsFound", async () => {
        // Arrange
        const keyword = "nothing";

        axios.get.mockImplementation((url) => {
            if (url === CATEGORY_URL) {
                return Promise.resolve({ data: { category: [] } });
            }
            if (url === `/api/v1/product/search/${keyword}`) {
                return Promise.resolve({
                    data: makeSearchResultsDataShape([]),
                });
            }
            return Promise.reject(new Error(`Unhandled axios.get URL: ${url}`));
        });

        // Act
        renderSearchFlow("/");

        const input = screen.getByRole("searchbox", { name: /search/i });
        fireEvent.change(input, { target: { value: keyword } });

        await waitFor(() => {
            expect(input).toHaveValue(keyword);
        });

        await act(async () => {
            fireEvent.submit(screen.getByRole("search"));
        });

        // Assert
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(
                `/api/v1/product/search/${keyword}`,
            );
        });

        expect(await screen.findByTestId("current-route")).toHaveTextContent(
            "/search",
        );

        expect(
            await screen.findByText(/no products found/i),
        ).toBeInTheDocument();
    });
});
