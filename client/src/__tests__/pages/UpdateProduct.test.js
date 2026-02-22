import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";
import UpdateProduct from "../../pages/admin/UpdateProduct";

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "getSingleProduct_onMount_loadsProductData" -> Equivalence class: product fetch on mount
 * - "getSingleProduct_onMount_prepopulatesForm" -> Structural completeness: form prepopulation
 * - "getAllCategory_onMount_fetchesCategories" -> Equivalence class: category fetch on mount
 * - "form_rendered_displaysAllFields" -> Structural completeness: all input fields present
 * - "existingPhoto_displayed_whenNoNewPhotoUploaded" -> Equivalence class: existing photo display
 * - "newPhoto_uploaded_showsPreview" -> Equivalence class: new photo upload and preview
 * - "handleUpdate_validData_updatesProduct" -> Equivalence class: successful update
 * - "handleUpdate_success_navigatesToProducts" -> Regression/contract: navigation after update
 * - "handleUpdate_apiError_showsErrorToast" -> Error handling partition: update error
 * - "handleDelete_userConfirms_deletesProduct" -> Equivalence class: successful delete
 * - "handleDelete_userCancels_doesNotDelete" -> Edge case: delete cancellation
 * - "handleDelete_success_navigatesToProducts" -> Regression/contract: navigation after delete
 * - "handleDelete_apiError_showsErrorToast" -> Error handling partition: delete error
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

// Mock Ant Design Select
jest.mock("antd", () => {
    const actual = jest.requireActual("antd");
    const MockOption = ({ children, value }) => <option value={value}>{children}</option>;
    const MockSelect = ({ children, onChange, placeholder, value, ...props }) => (
        <select
            data-testid={placeholder}
            onChange={(e) => onChange && onChange(e.target.value)}
            value={value}
            {...props}
        >
            {children}
        </select>
    );
    MockSelect.Option = MockOption;
    
    return {
        ...actual,
        Select: MockSelect,
    };
});

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => "mocked-url");

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
    ...jest.requireActual("react-router-dom"),
    useNavigate: () => mockNavigate,
    useParams: () => ({ slug: "test-product" }),
}));

describe("UpdateProduct Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
        toast.success = jest.fn();
        toast.error = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const renderWithRouter = (initialEntry = "/dashboard/admin/product/test-product") => {
        return render(
            <MemoryRouter initialEntries={[initialEntry]}>
                <Routes>
                    <Route path="/dashboard/admin/product/:slug" element={<UpdateProduct />} />
                </Routes>
            </MemoryRouter>
        );
    };

    const mockProductData = {
        product: {
            _id: "product123",
            name: "Laptop Pro",
            description: "High performance laptop",
            price: 1500,
            quantity: 10,
            shipping: true,
            category: {
                _id: "cat1",
                name: "Electronics",
            },
        },
    };

    it("getSingleProduct_onMount_loadsProductData", async () => {
        // Arrange
        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/product/get-product/")) {
                return Promise.resolve({ data: mockProductData });
            }
            if (url.includes("/api/v1/category/get-category")) {
                return Promise.resolve({ data: { success: true, category: [] } });
            }
        });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith("/api/v1/product/get-product/test-product");
        });
    });

    it("getSingleProduct_onMount_prepopulatesForm", async () => {
        // Arrange
        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/product/get-product/")) {
                return Promise.resolve({ data: mockProductData });
            }
            if (url.includes("/api/v1/category/get-category")) {
                return Promise.resolve({ data: { success: true, category: [] } });
            }
        });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(screen.getByPlaceholderText(/write a name/i)).toHaveValue("Laptop Pro");
            expect(screen.getByPlaceholderText(/write a description/i)).toHaveValue("High performance laptop");
            expect(screen.getByPlaceholderText(/write a Price/i)).toHaveValue(1500);
            expect(screen.getByPlaceholderText(/write a quantity/i)).toHaveValue(10);
        });
    });

    it("getAllCategory_onMount_fetchesCategories", async () => {
        // Arrange
        const categories = [
            { _id: "cat1", name: "Electronics" },
            { _id: "cat2", name: "Books" },
        ];
        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/product/get-product/")) {
                return Promise.resolve({ data: mockProductData });
            }
            if (url.includes("/api/v1/category/get-category")) {
                return Promise.resolve({ data: { success: true, category: categories } });
            }
        });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
            const categorySelect = screen.getByTestId("Select a category");
            expect(categorySelect).toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByText("Electronics")).toBeInTheDocument();
            expect(screen.getByText("Books")).toBeInTheDocument();
        });
    });

    it("form_rendered_displaysAllFields", async () => {
        // Arrange
        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/product/get-product/")) {
                return Promise.resolve({ data: mockProductData });
            }
            if (url.includes("/api/v1/category/get-category")) {
                return Promise.resolve({ data: { success: true, category: [] } });
            }
        });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(screen.getByPlaceholderText(/write a name/i)).toBeInTheDocument();
            expect(screen.getByPlaceholderText(/write a description/i)).toBeInTheDocument();
            expect(screen.getByPlaceholderText(/write a Price/i)).toBeInTheDocument();
            expect(screen.getByPlaceholderText(/write a quantity/i)).toBeInTheDocument();
            expect(screen.getByTestId("Select a category")).toBeInTheDocument();
            expect(screen.getByTestId("Select Shipping")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /UPDATE PRODUCT/i })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /DELETE PRODUCT/i })).toBeInTheDocument();
        });
    });

    it("existingPhoto_displayed_whenNoNewPhotoUploaded", async () => {
        // Arrange
        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/product/get-product/")) {
                return Promise.resolve({ data: mockProductData });
            }
            if (url.includes("/api/v1/category/get-category")) {
                return Promise.resolve({ data: { success: true, category: [] } });
            }
        });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            const existingPhoto = screen.getByAltText("product_photo");
            expect(existingPhoto).toBeInTheDocument();
            expect(existingPhoto).toHaveAttribute("src", "/api/v1/product/product-photo/product123");
        });
    });

    it("newPhoto_uploaded_showsPreview", async () => {
        // Arrange
        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/product/get-product/")) {
                return Promise.resolve({ data: mockProductData });
            }
            if (url.includes("/api/v1/category/get-category")) {
                return Promise.resolve({ data: { success: true, category: [] } });
            }
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/Upload Photo/i)).toBeInTheDocument();
        });

        const file = new File(["dummy content"], "new-photo.jpg", {
            type: "image/jpeg",
        });
        const uploadLabel = screen.getByText(/Upload Photo/i).closest("label");
        const fileInput = uploadLabel.querySelector("input[type='file']");

        // Act
        await act(async () => {
            fireEvent.change(fileInput, { target: { files: [file] } });
        });

        // Assert
        await waitFor(() => {
            const newPhoto = screen.getByAltText("product_photo");
            expect(newPhoto).toHaveAttribute("src", "mocked-url");
            expect(screen.getByText("new-photo.jpg")).toBeInTheDocument();
        });
    });

    it("handleUpdate_validData_updatesProduct", async () => {
        // Arrange
        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/product/get-product/")) {
                return Promise.resolve({ data: mockProductData });
            }
            if (url.includes("/api/v1/category/get-category")) {
                return Promise.resolve({ data: { success: true, category: [] } });
            }
        });
        axios.put.mockResolvedValueOnce({
            data: { success: true },
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/write a name/i)).toBeInTheDocument();
        });

        // Act - modify form
        await act(async () => {
            fireEvent.change(screen.getByPlaceholderText(/write a name/i), {
                target: { value: "Updated Laptop" },
            });
            fireEvent.change(screen.getByPlaceholderText(/write a Price/i), {
                target: { value: "2000" },
            });
        });

        const updateButton = screen.getByRole("button", { name: /UPDATE PRODUCT/i });
        
        await act(async () => {
            fireEvent.click(updateButton);
        });

        // Assert
        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledWith(
                "/api/v1/product/update-product/product123",
                expect.any(FormData)
            );
        });
    });

    it("handleUpdate_success_navigatesToProducts", async () => {
        // Arrange
        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/product/get-product/")) {
                return Promise.resolve({ data: mockProductData });
            }
            if (url.includes("/api/v1/category/get-category")) {
                return Promise.resolve({ data: { success: true, category: [] } });
            }
        });
        axios.put.mockResolvedValueOnce({
            data: { success: true },
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /UPDATE PRODUCT/i })).toBeInTheDocument();
        });

        const updateButton = screen.getByRole("button", { name: /UPDATE PRODUCT/i });

        // Act
        await act(async () => {
            fireEvent.click(updateButton);
        });

        // Assert
        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith("Product Updated Successfully");
            expect(mockNavigate).toHaveBeenCalledWith("/dashboard/admin/products");
        });
    });

    it("handleUpdate_apiError_showsErrorToast", async () => {
        // Arrange
        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/product/get-product/")) {
                return Promise.resolve({ data: mockProductData });
            }
            if (url.includes("/api/v1/category/get-category")) {
                return Promise.resolve({ data: { success: true, category: [] } });
            }
        });
        axios.put.mockRejectedValueOnce(new Error("API error"));

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /UPDATE PRODUCT/i })).toBeInTheDocument();
        });

        const updateButton = screen.getByRole("button", { name: /UPDATE PRODUCT/i });

        // Act
        await act(async () => {
            fireEvent.click(updateButton);
        });

        // Assert
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("something went wrong");
        });
    });

    it("handleDelete_userConfirms_deletesProduct", async () => {
        // Arrange
        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/product/get-product/")) {
                return Promise.resolve({ data: mockProductData });
            }
            if (url.includes("/api/v1/category/get-category")) {
                return Promise.resolve({ data: { success: true, category: [] } });
            }
        });
        axios.delete.mockResolvedValueOnce({
            data: { success: true },
        });

        global.prompt = jest.fn(() => "yes");

        renderWithRouter();

        // Wait for product to load - verify form is populated
        await waitFor(() => {
            expect(screen.getByPlaceholderText(/write a name/i)).toHaveValue("Laptop Pro");
        });

        const deleteButton = screen.getByRole("button", { name: /DELETE PRODUCT/i });

        // Act
        await act(async () => {
            fireEvent.click(deleteButton);
        });

        // Assert
        await waitFor(() => {
            expect(global.prompt).toHaveBeenCalledWith("Are You Sure want to delete this product ? ");
            expect(axios.delete).toHaveBeenCalledWith("/api/v1/product/delete-product/product123");
        });
    });

    it("handleDelete_userCancels_doesNotDelete", async () => {
        // Arrange
        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/product/get-product/")) {
                return Promise.resolve({ data: mockProductData });
            }
            if (url.includes("/api/v1/category/get-category")) {
                return Promise.resolve({ data: { success: true, category: [] } });
            }
        });

        global.prompt = jest.fn(() => null); // User cancels

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /DELETE PRODUCT/i })).toBeInTheDocument();
        });

        const deleteButton = screen.getByRole("button", { name: /DELETE PRODUCT/i });

        // Act
        await act(async () => {
            fireEvent.click(deleteButton);
        });

        // Assert
        await waitFor(() => {
            expect(global.prompt).toHaveBeenCalled();
            expect(axios.delete).not.toHaveBeenCalled();
        });
    });

    it("handleDelete_success_navigatesToProducts", async () => {
        // Arrange
        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/product/get-product/")) {
                return Promise.resolve({ data: mockProductData });
            }
            if (url.includes("/api/v1/category/get-category")) {
                return Promise.resolve({ data: { success: true, category: [] } });
            }
        });
        axios.delete.mockResolvedValueOnce({
            data: { success: true },
        });

        global.prompt = jest.fn(() => "yes");

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /DELETE PRODUCT/i })).toBeInTheDocument();
        });

        const deleteButton = screen.getByRole("button", { name: /DELETE PRODUCT/i });

        // Act
        await act(async () => {
            fireEvent.click(deleteButton);
        });

        // Assert
        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith("Product Deleted Successfully");
            expect(mockNavigate).toHaveBeenCalledWith("/dashboard/admin/products");
        });
    });

    it("handleDelete_apiError_showsErrorToast", async () => {
        // Arrange
        axios.get.mockImplementation((url) => {
            if (url.includes("/api/v1/product/get-product/")) {
                return Promise.resolve({ data: mockProductData });
            }
            if (url.includes("/api/v1/category/get-category")) {
                return Promise.resolve({ data: { success: true, category: [] } });
            }
        });
        axios.delete.mockRejectedValueOnce(new Error("API error"));

        global.prompt = jest.fn(() => "yes");

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /DELETE PRODUCT/i })).toBeInTheDocument();
        });

        const deleteButton = screen.getByRole("button", { name: /DELETE PRODUCT/i });

        // Act
        await act(async () => {
            fireEvent.click(deleteButton);
        });

        // Assert
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("Something went wrong");
        });
    });
});
