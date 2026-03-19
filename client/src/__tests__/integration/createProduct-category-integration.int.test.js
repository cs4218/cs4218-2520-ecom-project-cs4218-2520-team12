//Eliot Snodgras, A0269684H

import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";
import CreateProduct from "../../pages/admin/CreateProduct";
import { AuthProvider } from "../../context/auth";
import { SearchProvider } from "../../context/search";
import { CartProvider } from "../../context/cart";

/**
 * MS2 Integration Tests — CreateProduct Category & Form Workflow (Top-Down, Incremental)
 *
 * Integration Testing Approach: Top-Down (Incremental)
 * - Start from real `CreateProduct` UI interactions and integrate downward through
 *   real providers/router, form state, and API boundaries (endpoint-level mocked axios).
 *
 * Modules integrated
 * - UI driver: `CreateProduct` page
 * - Context/providers: `AuthProvider`, `SearchProvider`, `CartProvider`
 * - Routing: `MemoryRouter`, `Routes/Route`, real `useNavigate`
 * - API boundary: `axios.get` + `axios.post` with URL-level handlers
 *
 * Critical paths covered
 * - category fetch -> dropdown population
 * - file upload handling and photo-size validation
 * - required-fields validation before API call
 * - product creation with FormData payload structure
 * - success toast + navigation
 * - failure toast + staying on same page
 */

jest.mock("axios");
jest.mock("react-hot-toast");

jest.mock("antd", () => {
    const actual = jest.requireActual("antd");

    const MockOption = ({ children, value }) => (
        <option value={value}>{children}</option>
    );

    const MockSelect = ({
        children,
        onChange,
        placeholder,
        className,
        value,
    }) => (
        <select
            aria-label={placeholder}
            data-testid={placeholder}
            className={className}
            value={value || ""}
            onChange={(e) => onChange && onChange(e.target.value)}
        >
            <option value="">{placeholder}</option>
            {children}
        </select>
    );

    MockSelect.Option = MockOption;

    return {
        ...actual,
        Select: MockSelect,
    };
});

const CATEGORY_URL = "/api/v1/category/get-category";
const CREATE_PRODUCT_URL = "/api/v1/product/create-product";

window.matchMedia =
    window.matchMedia ||
    function matchMedia() {
        return {
            matches: false,
            addListener: function () {},
            removeListener: function () {},
        };
    };

global.URL.createObjectURL = jest.fn(() => "blob:mock-product-photo");

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

const renderCreateProductFlow = (
    initialEntry = "/dashboard/admin/create-product",
) => {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <AuthProvider>
                <SearchProvider>
                    <CartProvider>
                        <Routes>
                            <Route
                                path="/dashboard/admin/create-product"
                                element={<CreateProduct />}
                            />
                            <Route
                                path="/dashboard/admin/products"
                                element={<div data-testid="products-page">Products Page</div>}
                            />
                        </Routes>
                    </CartProvider>
                </SearchProvider>
            </AuthProvider>
        </MemoryRouter>,
    );
};

const setupAxiosHandlers = ({ categories = [], postHandler } = {}) => {
    axios.get.mockImplementation((url) => {
        if (url === CATEGORY_URL) {
            return Promise.resolve({
                data: { success: true, category: categories },
            });
        }
        return Promise.reject(new Error(`Unhandled axios.get URL: ${url}`));
    });

    axios.post.mockImplementation((url, body) => {
        if (url !== CREATE_PRODUCT_URL) {
            return Promise.reject(new Error(`Unhandled axios.post URL: ${url}`));
        }
        if (postHandler) return postHandler(body);
        return Promise.resolve({ data: { success: true } });
    });
};

const fillRequiredFields = () => {
    fireEvent.change(screen.getByPlaceholderText(/write a name/i), {
        target: { value: "MacBook Pro" },
    });
    fireEvent.change(screen.getByPlaceholderText(/write a description/i), {
        target: { value: "High performance laptop" },
    });
    fireEvent.change(screen.getByPlaceholderText(/write a Price/i), {
        target: { value: "2500" },
    });
    fireEvent.change(screen.getByPlaceholderText(/write a quantity/i), {
        target: { value: "10" },
    });
    fireEvent.change(screen.getByTestId("Select a category"), {
        target: { value: "cat-1" },
    });
};

const uploadPhoto = (file) => {
    const input = document.querySelector('input[name="photo"]');
    fireEvent.change(input, { target: { files: [file] } });
};

describe("MS2 Integration - CreateProduct", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ensureAxiosDefaultsForAuthProvider();
        setAdminAuthInLocalStorage();
        jest.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // Eliot, <ADD_STUDENT_ID>
    it("createProduct_categoriesLoaded_populatesCategoryDropdown", async () => {
        setupAxiosHandlers({
            categories: [
                { _id: "cat-1", name: "Electronics" },
                { _id: "cat-2", name: "Books" },
            ],
        });

        renderCreateProductFlow();

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(CATEGORY_URL);
        });

        const categorySelect = screen.getByTestId("Select a category");
        await waitFor(() => {
            expect(
                within(categorySelect).getByRole("option", {
                    name: "Electronics",
                }),
            ).toBeInTheDocument();
            expect(
                within(categorySelect).getByRole("option", { name: "Books" }),
            ).toBeInTheDocument();
        });
    });

    it("createProduct_photoUpload_validFile_showsFileNameAndPreview", async () => {
        setupAxiosHandlers({
            categories: [{ _id: "cat-1", name: "Electronics" }],
        });

        renderCreateProductFlow();

        await screen.findByRole("heading", { name: /create product/i });

        const validPhoto = new File(["image-content"], "product-photo.png", {
            type: "image/png",
        });

        uploadPhoto(validPhoto);

        expect(await screen.findByText("product-photo.png")).toBeInTheDocument();
        expect(screen.getByAltText("product_photo")).toBeInTheDocument();
    });

    it("createProduct_photoUpload_over1MB_rejected", async () => {
        setupAxiosHandlers({
            categories: [{ _id: "cat-1", name: "Electronics" }],
        });

        renderCreateProductFlow();

        await screen.findByRole("heading", { name: /create product/i });

        const oversizedPhoto = new File(["x"], "oversized.jpg", {
            type: "image/jpeg",
        });
        Object.defineProperty(oversizedPhoto, "size", {
            value: 1024 * 1024 + 1,
        });

        uploadPhoto(oversizedPhoto);

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("Photo should be less than 1MB");
        });

        expect(screen.queryByText("oversized.jpg")).not.toBeInTheDocument();
        expect(screen.queryByAltText("product_photo")).not.toBeInTheDocument();
    });

    it("createProduct_requiredFields_validation_blocksSubmission", async () => {
        setupAxiosHandlers({
            categories: [{ _id: "cat-1", name: "Electronics" }],
        });

        renderCreateProductFlow();

        await screen.findByRole("heading", { name: /create product/i });

        fireEvent.click(screen.getByRole("button", { name: /create product/i }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("Name is required");
        });

        fireEvent.change(screen.getByPlaceholderText(/write a name/i), {
            target: { value: "MacBook Pro" },
        });
        fireEvent.click(screen.getByRole("button", { name: /create product/i }));
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("Description is required");
        });

        fireEvent.change(screen.getByPlaceholderText(/write a description/i), {
            target: { value: "High performance laptop" },
        });
        fireEvent.click(screen.getByRole("button", { name: /create product/i }));
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("Price is required");
        });

        fireEvent.change(screen.getByPlaceholderText(/write a Price/i), {
            target: { value: "2500" },
        });
        fireEvent.click(screen.getByRole("button", { name: /create product/i }));
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("Category is required");
        });

        fireEvent.change(screen.getByTestId("Select a category"), {
            target: { value: "cat-1" },
        });
        fireEvent.click(screen.getByRole("button", { name: /create product/i }));
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("Quantity is required");
        });

        expect(axios.post).not.toHaveBeenCalled();
    });

    it("createProduct_submission_postsFormDataWithAllFields", async () => {
        setupAxiosHandlers({
            categories: [{ _id: "cat-1", name: "Electronics" }],
            postHandler: () => Promise.resolve({ data: { success: true } }),
        });

        renderCreateProductFlow();

        await screen.findByRole("heading", { name: /create product/i });

        fillRequiredFields();

        const validPhoto = new File(["photo-content"], "macbook.jpg", {
            type: "image/jpeg",
        });
        uploadPhoto(validPhoto);

        fireEvent.click(screen.getByRole("button", { name: /create product/i }));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                CREATE_PRODUCT_URL,
                expect.any(FormData),
            );
        });

        const sentFormData = axios.post.mock.calls[0][1];
        expect(sentFormData.get("name")).toBe("MacBook Pro");
        expect(sentFormData.get("description")).toBe("High performance laptop");
        expect(sentFormData.get("price")).toBe("2500");
        expect(sentFormData.get("quantity")).toBe("10");
        expect(sentFormData.get("category")).toBe("cat-1");
        expect(sentFormData.get("photo")).toBe(validPhoto);
    });

    it("createProduct_success_showsToastAndNavigatesToProducts", async () => {
        setupAxiosHandlers({
            categories: [{ _id: "cat-1", name: "Electronics" }],
            postHandler: () => Promise.resolve({ data: { success: true } }),
        });

        renderCreateProductFlow();

        await screen.findByRole("heading", { name: /create product/i });

        fillRequiredFields();
        fireEvent.click(screen.getByRole("button", { name: /create product/i }));

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith("Product Created Successfully");
        });

        expect(await screen.findByTestId("products-page")).toBeInTheDocument();
    });

    it("createProduct_failure_showsErrorToast_andRemainsOnPage", async () => {
        setupAxiosHandlers({
            categories: [{ _id: "cat-1", name: "Electronics" }],
            postHandler: () =>
                Promise.resolve({
                    data: { success: false, message: "Unable to create product" },
                }),
        });

        renderCreateProductFlow();

        await screen.findByRole("heading", { name: /create product/i });

        fillRequiredFields();
        fireEvent.click(screen.getByRole("button", { name: /create product/i }));

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("Unable to create product");
        });

        expect(
            screen.queryByTestId("products-page"),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: /create product/i }),
        ).toBeInTheDocument();
    });
});
