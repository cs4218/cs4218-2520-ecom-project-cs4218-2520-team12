//Eliot Snodgrass, A0269684H

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";
import CreateCategory from "../../pages/admin/CreateCategory";
import AdminRoute from "../../components/Routes/AdminRoute";
import { AuthProvider } from "../../context/auth";
import { SearchProvider } from "../../context/search";
import { CartProvider } from "../../context/cart";

/**
 * MS2 Integration Tests — CreateCategory API & Admin Middleware (Top-Down, Incremental)
 *
 * Integration Testing Approach: Top-Down (Incremental)
 * - Start from route-level admin access (`AdminRoute`) and integrate downward into
 *   real `CreateCategory` UI interactions, real providers, and mocked backend responses.
 *
 * Modules integrated
 * - Routing and route-guard: `MemoryRouter`, `Routes/Route`, `AdminRoute`
 * - Context providers: `AuthProvider`, `SearchProvider`, `CartProvider`
 * - Feature page and form workflow: `CreateCategory`, `CategoryForm`
 * - API interaction boundary: `axios.get/post/put/delete` (endpoint-level mocked responses)
 *
 * Critical paths covered
 * - admin-auth gate -> page render
 * - create-category -> success/error -> list refresh
 * - update-category -> success -> list refresh
 * - delete-category -> success -> list refresh
 */

jest.mock("axios");
jest.mock("react-hot-toast");

const CATEGORY_GET_URL = "/api/v1/category/get-category";
const CATEGORY_CREATE_URL = "/api/v1/category/create-category";
const ADMIN_AUTH_URL = "/api/v1/auth/admin-auth";

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
    axios.defaults = axios.defaults || {};
    axios.defaults.headers = axios.defaults.headers || {};
    axios.defaults.headers.common = axios.defaults.headers.common || {};
};

const setAdminAuthInLocalStorage = () => {
    localStorage.clear();
    localStorage.setItem("cart", JSON.stringify([]));
    localStorage.setItem(
        "auth",
        JSON.stringify({
            user: { _id: "admin-1", name: "Admin User", role: 1 },
            token: "admin-token",
        }),
    );
};

const countGetCallsFor = (url) =>
    axios.get.mock.calls.filter((call) => call[0] === url).length;

const getMainCategoryInput = () => screen.getByPlaceholderText(/enter new category/i);

const renderCreateCategoryViaAdminRoute = (
    initialEntry = "/dashboard/admin/create-category",
) => {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <AuthProvider>
                <SearchProvider>
                    <CartProvider>
                        <Routes>
                            <Route path="/dashboard" element={<AdminRoute />}>
                                <Route
                                    path="admin/create-category"
                                    element={<CreateCategory />}
                                />
                            </Route>
                        </Routes>
                    </CartProvider>
                </SearchProvider>
            </AuthProvider>
        </MemoryRouter>,
    );
};

const setupAxiosEndpointDispatcher = ({
    isAdminAuthorized = true,
    initialCategories = [],
    onCreate,
    onUpdate,
    onDelete,
}) => {
    let categoriesState = [...initialCategories];

    const setCategoriesState = (nextState) => {
        categoriesState = [...nextState];
    };

    axios.get.mockImplementation((url) => {
        if (url === ADMIN_AUTH_URL) {
            return Promise.resolve({ data: { ok: isAdminAuthorized } });
        }

        if (url === CATEGORY_GET_URL) {
            return Promise.resolve({
                data: { success: true, category: categoriesState },
            });
        }

        return Promise.reject(new Error(`Unhandled axios.get URL: ${url}`));
    });

    axios.post.mockImplementation((url, body) => {
        if (url !== CATEGORY_CREATE_URL) {
            return Promise.reject(new Error(`Unhandled axios.post URL: ${url}`));
        }
        if (onCreate) return onCreate({ url, body, setCategoriesState, categoriesState });
        return Promise.resolve({ data: { success: true, message: "Created" } });
    });

    axios.put.mockImplementation((url, body) => {
        if (!url.startsWith("/api/v1/category/update-category/")) {
            return Promise.reject(new Error(`Unhandled axios.put URL: ${url}`));
        }
        if (onUpdate) return onUpdate({ url, body, setCategoriesState, categoriesState });
        return Promise.resolve({ data: { success: true, message: "Updated" } });
    });

    axios.delete.mockImplementation((url) => {
        if (!url.startsWith("/api/v1/category/delete-category/")) {
            return Promise.reject(new Error(`Unhandled axios.delete URL: ${url}`));
        }
        if (onDelete) return onDelete({ url, setCategoriesState, categoriesState });
        return Promise.resolve({ data: { success: true, message: "Deleted" } });
    });
};

describe("MS2 Integration - CreateCategory API", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ensureAxiosDefaultsForAuthProvider();
        setAdminAuthInLocalStorage();
        jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("createCategory_adminMiddleware_authorized_rendersPage", async () => {
        setupAxiosEndpointDispatcher({
            isAdminAuthorized: true,
            initialCategories: [{ _id: "c1", name: "Electronics" }],
        });

        renderCreateCategoryViaAdminRoute();

        expect(
            await screen.findByRole("heading", { name: /manage category/i }),
        ).toBeInTheDocument();

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(ADMIN_AUTH_URL);
            expect(countGetCallsFor(CATEGORY_GET_URL)).toBeGreaterThan(0);
        });

        expect(
            await screen.findByRole("cell", { name: "Electronics" }),
        ).toBeInTheDocument();
    });

    it("createCategory_adminMiddleware_unauthorized_blocksPage", async () => {
        setupAxiosEndpointDispatcher({
            isAdminAuthorized: false,
            initialCategories: [{ _id: "c1", name: "Electronics" }],
        });

        renderCreateCategoryViaAdminRoute();

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(ADMIN_AUTH_URL);
        });

        expect(
            screen.queryByRole("heading", { name: /manage category/i }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByText(/redirecting to you in/i),
        ).toBeInTheDocument();
    });

    it("createCategory_success_createsToastAndRefreshesList", async () => {
        setupAxiosEndpointDispatcher({
            initialCategories: [{ _id: "c1", name: "Electronics" }],
            onCreate: ({ body, setCategoriesState, categoriesState }) => {
                setCategoriesState([
                    ...categoriesState,
                    { _id: "c2", name: body.name },
                ]);
                return Promise.resolve({
                    data: { success: true, message: `${body.name} is created` },
                });
            },
        });

        renderCreateCategoryViaAdminRoute();

        await screen.findByRole("heading", { name: /manage category/i });
        await screen.findByRole("cell", { name: "Electronics" });

        const getCallsBeforeCreate = countGetCallsFor(CATEGORY_GET_URL);

        fireEvent.change(getMainCategoryInput(), {
            target: { value: "Books" },
        });
        fireEvent.click(screen.getAllByRole("button", { name: /submit/i })[0]);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(CATEGORY_CREATE_URL, {
                name: "Books",
            });
        });

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith("Books is created");
            expect(countGetCallsFor(CATEGORY_GET_URL)).toBeGreaterThan(
                getCallsBeforeCreate,
            );
        });

        expect(
            await screen.findByRole("cell", { name: "Books" }),
        ).toBeInTheDocument();
    });

    it("createCategory_duplicate_showsErrorAndDoesNotRefreshList", async () => {
        setupAxiosEndpointDispatcher({
            initialCategories: [{ _id: "c1", name: "Electronics" }],
            onCreate: () =>
                Promise.resolve({
                    data: {
                        success: false,
                        message: "Category already exists",
                    },
                }),
        });

        renderCreateCategoryViaAdminRoute();

        await screen.findByRole("heading", { name: /manage category/i });
        await screen.findByRole("cell", { name: "Electronics" });

        const getCallsBeforeCreate = countGetCallsFor(CATEGORY_GET_URL);

        fireEvent.change(getMainCategoryInput(), {
            target: { value: "Electronics" },
        });
        fireEvent.click(screen.getAllByRole("button", { name: /submit/i })[0]);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(CATEGORY_CREATE_URL, {
                name: "Electronics",
            });
            expect(toast.error).toHaveBeenCalledWith("Category already exists");
        });

        expect(countGetCallsFor(CATEGORY_GET_URL)).toBe(getCallsBeforeCreate);
    });

    it("createCategory_emptyName_validationError", async () => {
        setupAxiosEndpointDispatcher({
            initialCategories: [{ _id: "c1", name: "Electronics" }],
            onCreate: () =>
                Promise.resolve({
                    data: {
                        success: false,
                        message: "Category name is required",
                    },
                }),
        });

        renderCreateCategoryViaAdminRoute();

        await screen.findByRole("heading", { name: /manage category/i });

        fireEvent.click(screen.getAllByRole("button", { name: /submit/i })[0]);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(CATEGORY_CREATE_URL, {
                name: "",
            });
            expect(toast.error).toHaveBeenCalledWith("Category name is required");
        });
    });

    it("createCategory_update_success_updatesCategoryAndRefreshes", async () => {
        setupAxiosEndpointDispatcher({
            initialCategories: [{ _id: "c1", name: "Electronics" }],
            onUpdate: ({ url, body, setCategoriesState, categoriesState }) => {
                const id = url.split("/").pop();
                setCategoriesState(
                    categoriesState.map((item) =>
                        item._id === id ? { ...item, name: body.name } : item,
                    ),
                );
                return Promise.resolve({
                    data: { success: true, message: `${body.name} is updated` },
                });
            },
        });

        renderCreateCategoryViaAdminRoute();

        await screen.findByRole("heading", { name: /manage category/i });
        await screen.findByRole("cell", { name: "Electronics" });

        const getCallsBeforeUpdate = countGetCallsFor(CATEGORY_GET_URL);

        fireEvent.click(screen.getByRole("button", { name: /edit/i }));

        await waitFor(() => {
            expect(screen.getAllByPlaceholderText(/enter new category/i).length).toBeGreaterThan(1);
        });

        const allInputs = screen.getAllByPlaceholderText(/enter new category/i);
        const modalInput = allInputs[allInputs.length - 1];

        fireEvent.change(modalInput, { target: { value: "Gadgets" } });

        const submitButtons = screen.getAllByRole("button", { name: /submit/i });
        fireEvent.click(submitButtons[submitButtons.length - 1]);

        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledWith(
                "/api/v1/category/update-category/c1",
                { name: "Gadgets" },
            );
            expect(toast.success).toHaveBeenCalledWith("Gadgets is updated");
            expect(countGetCallsFor(CATEGORY_GET_URL)).toBeGreaterThan(
                getCallsBeforeUpdate,
            );
        });

        expect(await screen.findByText("Gadgets")).toBeInTheDocument();
    });

    it("createCategory_delete_success_deletesAndRefreshes", async () => {
        setupAxiosEndpointDispatcher({
            initialCategories: [
                { _id: "c1", name: "Electronics" },
                { _id: "c2", name: "Books" },
            ],
            onDelete: ({ url, setCategoriesState, categoriesState }) => {
                const id = url.split("/").pop();
                setCategoriesState(
                    categoriesState.filter((item) => item._id !== id),
                );
                return Promise.resolve({
                    data: { success: true, message: "category is deleted" },
                });
            },
        });

        renderCreateCategoryViaAdminRoute();

        await screen.findByRole("heading", { name: /manage category/i });
        await screen.findByRole("cell", { name: "Electronics" });
        await screen.findByRole("cell", { name: "Books" });

        const getCallsBeforeDelete = countGetCallsFor(CATEGORY_GET_URL);

        fireEvent.click(screen.getAllByRole("button", { name: /delete/i })[0]);

        await waitFor(() => {
            expect(axios.delete).toHaveBeenCalledWith(
                "/api/v1/category/delete-category/c1",
            );
            expect(toast.success).toHaveBeenCalledWith("category is deleted");
            expect(countGetCallsFor(CATEGORY_GET_URL)).toBeGreaterThan(
                getCallsBeforeDelete,
            );
        });

        await waitFor(() => {
            expect(
                screen.queryByRole("cell", { name: "Electronics" }),
            ).not.toBeInTheDocument();
        });
        expect(screen.getByRole("cell", { name: "Books" })).toBeInTheDocument();
    });
});
