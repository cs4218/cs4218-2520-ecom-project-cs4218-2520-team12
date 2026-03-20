import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";
import CreateProduct from "../../pages/admin/CreateProduct";

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "getAllCategory_onMount_fetchesCategories" -> Equivalence class: category fetch on mount
 * - "getAllCategory_apiError_showsErrorToast" -> Error handling partition: fetch error
 * - "categoryDropdown_rendered_displaysCategories" -> Structural completeness: category options
 * - "form_rendered_displaysAllFields" -> Structural completeness: all input fields present
 * - "photoUpload_fileSelected_displaysFileName" -> Equivalence class: photo upload
 * - "photoUpload_fileSelected_showsPreview" -> Equivalence class: image preview
 * - "photoUpload_largeFile_rejectsUpload" -> Edge case: file size validation
 * - "handleCreate_validData_createsProduct" -> Equivalence class: successful creation
 * - "handleCreate_success_navigatesToProducts" -> Regression/contract: navigation after success
 * - "handleCreate_apiError_showsErrorToast" -> Error handling partition: creation error
 * - "handleCreate_missingFields_handlesGracefully" -> Edge case: missing required fields
 * - "shippingDropdown_rendered_hasYesNoOptions" -> Structural completeness: shipping options
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
}));

describe("CreateProduct Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const renderWithRouter = (initialEntry = "/dashboard/admin/create-product") => {
        return render(
            <MemoryRouter initialEntries={[initialEntry]}>
                <Routes>
                    <Route
                        path="/dashboard/admin/create-product"
                        element={<CreateProduct />}
                    />
                </Routes>
            </MemoryRouter>
        );
    };

    it("getAllCategory_onMount_fetchesCategories", async () => {
        // Arrange
        const mockCategories = [
            { _id: "cat1", name: "Electronics" },
            { _id: "cat2", name: "Books" },
        ];

        axios.get.mockResolvedValueOnce({
            data: { success: true, category: mockCategories },
        });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
        });
    });

    it("getAllCategory_apiError_showsErrorToast", async () => {
        // Arrange
        axios.get.mockRejectedValueOnce(new Error("Network error"));

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                "Something wwent wrong in getting catgeory"
            );
        });
    });

    it("categoryDropdown_rendered_displaysCategories", async () => {
        // Arrange
        const mockCategories = [
            { _id: "cat1", name: "Electronics" },
            { _id: "cat2", name: "Clothing" },
        ];

        axios.get.mockResolvedValueOnce({
            data: { success: true, category: mockCategories },
        });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(screen.getByText("Electronics")).toBeInTheDocument();
            expect(screen.getByText("Clothing")).toBeInTheDocument();
        });
    });

    it("form_rendered_displaysAllFields", async () => {
        // Arrange
        axios.get.mockResolvedValueOnce({
            data: { success: true, category: [] },
        });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(screen.getByPlaceholderText(/write a name/i)).toBeInTheDocument();
            expect(screen.getByPlaceholderText(/write a description/i)).toBeInTheDocument();
            expect(screen.getByPlaceholderText(/write a Price/i)).toBeInTheDocument();
            expect(screen.getByPlaceholderText(/write a quantity/i)).toBeInTheDocument();
            expect(screen.getByText(/Upload Photo/i)).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: /CREATE PRODUCT/i })
            ).toBeInTheDocument();
        });
    });

    it("photoUpload_fileSelected_displaysFileName", async () => {
        // Arrange
        axios.get.mockResolvedValueOnce({
            data: { success: true, category: [] },
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/Upload Photo/i)).toBeInTheDocument();
        });

        const file = new File(["dummy content"], "product.jpg", {
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
            expect(screen.getByText("product.jpg")).toBeInTheDocument();
        });
    });

    it("photoUpload_fileSelected_showsPreview", async () => {
        // Arrange
        axios.get.mockResolvedValueOnce({
            data: { success: true, category: [] },
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/Upload Photo/i)).toBeInTheDocument();
        });

        const file = new File(["dummy content"], "test-image.png", {
            type: "image/png",
        });
        const uploadLabel = screen.getByText(/Upload Photo/i).closest("label");
        const fileInput = uploadLabel.querySelector("input[type='file']");

        // Act
        await act(async () => {
            fireEvent.change(fileInput, { target: { files: [file] } });
        });

        // Assert
        await waitFor(() => {
            const image = screen.getByAltText("product_photo");
            expect(image).toBeInTheDocument();
            expect(image).toHaveAttribute("src", "mocked-url");
        });
    });

    it("photoUpload_largeFile_rejectsUpload", async () => {
        // Arrange
        axios.get.mockResolvedValueOnce({
            data: { success: true, category: [] },
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText(/Upload Photo/i)).toBeInTheDocument();
        });

        // Create a file larger than 1MB
        const largeContent = "x".repeat(1024 * 1024 + 1); // 1MB + 1 byte
        const largeFile = new File([largeContent], "large-image.jpg", {
            type: "image/jpeg",
        });

        Object.defineProperty(largeFile, "size", {
            value: 1024 * 1024 + 1,
        });

        const uploadLabel = screen.getByText(/Upload Photo/i).closest("label");
        const fileInput = uploadLabel.querySelector("input[type='file']");

        // Act
        await act(async () => {
            fireEvent.change(fileInput, { target: { files: [largeFile] } });
        });

        // Assert - large file is rejected by validation
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("Photo should be less than 1MB");
        });
        expect(screen.queryByText("large-image.jpg")).not.toBeInTheDocument();
        expect(screen.queryByAltText("product_photo")).not.toBeInTheDocument();
    });

    it("handleCreate_validData_createsProduct", async () => {
        // Arrange
        axios.get.mockResolvedValueOnce({
            data: { success: true, category: [{ _id: "cat1", name: "Electronics" }] },
        });
        axios.post.mockResolvedValueOnce({
            data: { success: true },
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/write a name/i)).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText("Electronics")).toBeInTheDocument();
        });

        // Act - fill out form
        await act(async () => {
            fireEvent.change(screen.getByPlaceholderText(/write a name/i), {
                target: { value: "Laptop Pro" },
            });
            fireEvent.change(screen.getByPlaceholderText(/write a description/i), {
                target: { value: "High performance laptop" },
            });
            fireEvent.change(screen.getByPlaceholderText(/write a Price/i), {
                target: { value: "1500" },
            });
            fireEvent.change(screen.getByPlaceholderText(/write a quantity/i), {
                target: { value: "10" },
            });

            const categorySelect = screen.getByTestId("Select a category");
            fireEvent.change(categorySelect, { target: { value: "cat1" } });

            const shippingSelect = screen.getByTestId(/Select Shipping/);
            fireEvent.change(shippingSelect, { target: { value: "1" } });

            const file = new File(["content"], "laptop.jpg", { type: "image/jpeg" });
            const uploadLabel = screen.getByText(/Upload Photo/i).closest("label");
            const fileInput = uploadLabel.querySelector("input[type='file']");
            fireEvent.change(fileInput, { target: { files: [file] } });
        });

        await waitFor(() => {
            expect(screen.getByTestId("Select a category")).toHaveValue("cat1");
        });

        const createButton = screen.getByRole("button", { name: /CREATE PRODUCT/i });
        
        await act(async () => {
            fireEvent.click(createButton);
        });

        // Assert
        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith(
                "/api/v1/product/create-product",
                expect.any(FormData)
            );
        });
    });

    it("handleCreate_success_navigatesToProducts", async () => {
        // Arrange
        axios.get.mockResolvedValueOnce({
            data: { success: true, category: [{ _id: "cat1", name: "Electronics" }] },
        });
        axios.post.mockResolvedValueOnce({
            data: { success: true }, // success: true triggers success toast
        });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /CREATE PRODUCT/i })).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText("Electronics")).toBeInTheDocument();
        });

        const createButton = screen.getByRole("button", { name: /CREATE PRODUCT/i });

        // Act
        await act(async () => {
            fireEvent.change(screen.getByPlaceholderText(/write a name/i), {
                target: { value: "Laptop Pro" },
            });
            fireEvent.change(screen.getByPlaceholderText(/write a description/i), {
                target: { value: "High performance laptop" },
            });
            fireEvent.change(screen.getByPlaceholderText(/write a Price/i), {
                target: { value: "1500" },
            });
            fireEvent.change(screen.getByPlaceholderText(/write a quantity/i), {
                target: { value: "10" },
            });
            fireEvent.change(screen.getByTestId("Select a category"), {
                target: { value: "cat1" },
            });
            fireEvent.click(createButton);
        });

        await waitFor(() => {
            expect(screen.getByTestId("Select a category")).toHaveValue("cat1");
        });

        // Assert
        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith("Product Created Successfully");
            expect(mockNavigate).toHaveBeenCalledWith("/dashboard/admin/products");
        });
    });

    it("handleCreate_apiError_showsErrorToast", async () => {
        // Arrange
        axios.get.mockResolvedValueOnce({
            data: { success: true, category: [{ _id: "cat1", name: "Electronics" }] },
        });
        axios.post.mockRejectedValueOnce(new Error("API error"));

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /CREATE PRODUCT/i })).toBeInTheDocument();
        });
        await waitFor(() => {
            expect(screen.getByText("Electronics")).toBeInTheDocument();
        });

        const createButton = screen.getByRole("button", { name: /CREATE PRODUCT/i });

        // Act
        await act(async () => {
            fireEvent.change(screen.getByPlaceholderText(/write a name/i), {
                target: { value: "Laptop Pro" },
            });
            fireEvent.change(screen.getByPlaceholderText(/write a description/i), {
                target: { value: "High performance laptop" },
            });
            fireEvent.change(screen.getByPlaceholderText(/write a Price/i), {
                target: { value: "1500" },
            });
            fireEvent.change(screen.getByPlaceholderText(/write a quantity/i), {
                target: { value: "10" },
            });
            fireEvent.change(screen.getByTestId("Select a category"), {
                target: { value: "cat1" },
            });
            fireEvent.click(createButton);
        });

        await waitFor(() => {
            expect(screen.getByTestId("Select a category")).toHaveValue("cat1");
        });

        // Assert
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("something went wrong");
        });
    });

    it("handleCreate_missingFields_handlesGracefully", async () => {
        // Arrange
        axios.get.mockResolvedValueOnce({
            data: { success: true, category: [] },
        });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /CREATE PRODUCT/i })).toBeInTheDocument();
        });

        const createButton = screen.getByRole("button", { name: /CREATE PRODUCT/i });

        // Act - submit without filling fields
        await act(async () => {
            fireEvent.click(createButton);
        });

        // Assert - validation blocks API submission
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith("Name is required");
        });
        expect(axios.post).not.toHaveBeenCalled();
    });

    it("shippingDropdown_rendered_hasYesNoOptions", async () => {
        // Arrange
        axios.get.mockResolvedValueOnce({
            data: { success: true, category: [] },
        });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            const shippingSelect = screen.getByTestId(/Select Shipping/);
            expect(shippingSelect).toBeInTheDocument();
            expect(screen.getByText("Yes")).toBeInTheDocument();
            expect(screen.getByText("No")).toBeInTheDocument();
        });
    });

    it("layout_rendered_hasCorrectTitle", async () => {
        // Arrange
        axios.get.mockResolvedValueOnce({
            data: { success: true, category: [] },
        });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(screen.getByTestId("layout-title")).toHaveTextContent(
                "Dashboard - Create Product"
            );
        });
    });

    it("adminMenu_rendered_isPresent", async () => {
        // Arrange
        axios.get.mockResolvedValueOnce({
            data: { success: true, category: [] },
        });

        // Act
        renderWithRouter();

        // Assert
        await waitFor(() => {
            expect(screen.getByTestId("admin-menu")).toBeInTheDocument();
        });
    });
});
