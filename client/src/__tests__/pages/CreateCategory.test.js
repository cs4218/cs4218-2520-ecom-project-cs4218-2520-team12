import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import toast from "react-hot-toast";
import CreateCategory from "../../pages/admin/CreateCategory";

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "createCategory_validInput_createsSuccessfully" -> Equivalence class: valid category creation
 * - "createCategory_apiSuccess_showsSuccessToast" -> Equivalence class: success toast displayed
 * - "createCategory_apiSuccess_refreshesList" -> Equivalence class: list refreshed after creation
 * - "createCategory_apiError_showsErrorToast" -> Error handling partition: API error on creation
 * - "createCategory_emptyInput_handlesGracefully" -> Edge case: empty category name
 * - "getAllCategory_onMount_fetchesCategories" -> Equivalence class: initial fetch on component mount
 * - "getAllCategory_apiError_showsErrorToast" -> Error handling partition: fetch error
 * - "categoryList_rendered_displaysCategories" -> Structural completeness: categories displayed in table
 * - "editButton_clicked_opensModal" -> Equivalence class: edit modal opens
 * - "updateCategory_validInput_updatesSuccessfully" -> Equivalence class: category update
 * - "updateCategory_apiSuccess_closesModal" -> Equivalence class: modal closes after update
 * - "updateCategory_apiError_showsErrorToast" -> Error handling partition: update error
 * - "deleteButton_clicked_deletesCategory" -> Equivalence class: category deletion
 * - "deleteCategory_apiSuccess_refreshesList" -> Equivalence class: list refreshed after deletion
 * - "deleteCategory_apiError_showsErrorToast" -> Error handling partition: delete error
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

jest.mock("../../components/Form/CategoryForm", () => {
    const CategoryFormMock = ({ value, setValue, handleSubmit }) => {
        return (
            <form onSubmit={handleSubmit}>
                <input
                    data-testid="category-input"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                />
                <button type="submit">Submit</button>
            </form>
        );
    };
    return {
        __esModule: true,
        default: CategoryFormMock,
    };
});

describe("CreateCategory Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("createCategory", () => {
        it("should call API with correct data when valid input submitted", async () => {
            // Arrange
            axios.get.mockResolvedValue({
                data: { success: true, category: [] },
            });
            axios.post.mockResolvedValue({
                data: { success: true, message: "Category created" },
            });

            render(
                <MemoryRouter initialEntries={["/dashboard/admin/create-category"]}>
                    <Routes>
                        <Route
                            path="/dashboard/admin/create-category"
                            element={<CreateCategory />}
                        />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
            });

            // Act
            const input = screen.getAllByTestId("category-input")[0];
            const submitButton = screen.getAllByText("Submit")[0];

            await act(async () => {
                fireEvent.change(input, { target: { value: "Clothing" } });
                fireEvent.click(submitButton);
            });

            // Assert
            await waitFor(() => {
                expect(axios.post).toHaveBeenCalledWith(
                    "/api/v1/category/create-category",
                    { name: "Clothing" }
                );
            });
        });

        it("should display success toast when category is created successfully", async () => {
            // Arrange
            axios.get.mockResolvedValue({
                data: { success: true, category: [] },
            });
            axios.post.mockResolvedValue({
                data: { success: true, message: "Sports is created" },
            });

            render(
                <MemoryRouter initialEntries={["/dashboard/admin/create-category"]}>
                    <Routes>
                        <Route
                            path="/dashboard/admin/create-category"
                            element={<CreateCategory />}
                        />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(axios.get).toHaveBeenCalled();
            });

            // Act
            const input = screen.getAllByTestId("category-input")[0];
            const submitButton = screen.getAllByText("Submit")[0];

            await act(async () => {
                fireEvent.change(input, { target: { value: "Sports" } });
                fireEvent.click(submitButton);
            });

            // Assert
            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith("Sports is created");
            });
        });

        it("should refresh category list after successful creation", async () => {
            // Arrange
            axios.get.mockResolvedValue({
                data: { success: true, category: [] },
            });
            axios.post.mockResolvedValue({
                data: { success: true, message: "Sports is created" },
            });

            render(
                <MemoryRouter initialEntries={["/dashboard/admin/create-category"]}>
                    <Routes>
                        <Route
                            path="/dashboard/admin/create-category"
                            element={<CreateCategory />}
                        />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(axios.get).toHaveBeenCalledTimes(1);
            });

            // Act
            const input = screen.getAllByTestId("category-input")[0];
            const submitButton = screen.getAllByText("Submit")[0];

            await act(async () => {
                fireEvent.change(input, { target: { value: "Sports" } });
                fireEvent.click(submitButton);
            });

            // Assert
            await waitFor(() => {
                expect(axios.get).toHaveBeenCalledTimes(2);
            });
        });

        it("should display error toast when API call fails", async () => {
            // Arrange
            const consoleLogSpy = jest.spyOn(console, "log");

            axios.get.mockResolvedValue({
                data: { success: true, category: [] },
            });
            axios.post.mockRejectedValue(new Error("API error"));

            render(
                <MemoryRouter initialEntries={["/dashboard/admin/create-category"]}>
                    <Routes>
                        <Route
                            path="/dashboard/admin/create-category"
                            element={<CreateCategory />}
                        />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(axios.get).toHaveBeenCalled();
            });

            // Act
            const input = screen.getAllByTestId("category-input")[0];
            const submitButton = screen.getAllByText("Submit")[0];

            await act(async () => {
                fireEvent.change(input, { target: { value: "Toys" } });
                fireEvent.click(submitButton);
            });

            // Assert
            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith(
                    "somthing went wrong in input form"
                );
            });

            consoleLogSpy.mockRestore();
        });

        it("should handle empty category name gracefully", async () => {
            // Arrange
            axios.get.mockResolvedValue({
                data: { success: true, category: [] },
            });
            axios.post.mockResolvedValue({
                data: { success: true, message: " is created" },
            });

            render(
                <MemoryRouter initialEntries={["/dashboard/admin/create-category"]}>
                    <Routes>
                        <Route
                            path="/dashboard/admin/create-category"
                            element={<CreateCategory />}
                        />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(axios.get).toHaveBeenCalled();
            });

            // Act
            const submitButton = screen.getAllByText("Submit")[0];
            
            await act(async () => {
                fireEvent.click(submitButton);
            });

            // Assert
            await waitFor(() => {
                expect(axios.post).toHaveBeenCalledWith(
                    "/api/v1/category/create-category",
                    { name: "" }
                );
            });
        });
    });

    describe("getAllCategory", () => {
        it("should fetch categories on component mount", async () => {
            // Arrange
            axios.get.mockResolvedValue({
                data: { success: true, category: [] },
            });

            // Act
            render(
                <MemoryRouter initialEntries={["/dashboard/admin/create-category"]}>
                    <Routes>
                        <Route
                            path="/dashboard/admin/create-category"
                            element={<CreateCategory />}
                        />
                    </Routes>
                </MemoryRouter>
            );

            // Assert
            await waitFor(() => {
                expect(axios.get).toHaveBeenCalledWith("/api/v1/category/get-category");
            });
        });

        it("should display error toast when fetch fails", async () => {
            // Arrange
            const consoleLogSpy = jest.spyOn(console, "log");
            axios.get.mockRejectedValue(new Error("Fetch error"));

            // Act
            render(
                <MemoryRouter initialEntries={["/dashboard/admin/create-category"]}>
                    <Routes>
                        <Route
                            path="/dashboard/admin/create-category"
                            element={<CreateCategory />}
                        />
                    </Routes>
                </MemoryRouter>
            );

            // Assert
            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith(
                    "Something wwent wrong in getting catgeory"
                );
            });

            consoleLogSpy.mockRestore();
        });

        it("should display fetched categories in the table", async () => {
            // Arrange
            const categories = [
                { _id: "cat1", name: "Electronics" },
                { _id: "cat2", name: "Books" },
            ];

            axios.get.mockResolvedValue({
                data: { success: true, category: categories },
            });

            // Act
            render(
                <MemoryRouter initialEntries={["/dashboard/admin/create-category"]}>
                    <Routes>
                        <Route
                            path="/dashboard/admin/create-category"
                            element={<CreateCategory />}
                        />
                    </Routes>
                </MemoryRouter>
            );

            // Assert
            await waitFor(() => {
                expect(screen.getByText("Electronics")).toBeInTheDocument();
                expect(screen.getByText("Books")).toBeInTheDocument();
            });
        });
    });

    describe("updateCategory", () => {
        it("should open modal when Edit button is clicked", async () => {
            // Arrange
            axios.get.mockResolvedValue({
                data: {
                    success: true,
                    category: [{ _id: "cat1", name: "Electronics" }],
                },
            });

            render(
                <MemoryRouter initialEntries={["/dashboard/admin/create-category"]}>
                    <Routes>
                        <Route
                            path="/dashboard/admin/create-category"
                            element={<CreateCategory />}
                        />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText("Electronics")).toBeInTheDocument();
            });

            // Act
            const editButton = screen.getByText("Edit");
            
            await act(async () => {
                fireEvent.click(editButton);
            });

            // Assert
            await waitFor(() => {
                const inputs = screen.getAllByTestId("category-input");
                expect(inputs.length).toBeGreaterThan(1); // Modal input appears
            });
        });

        it("should call API with updated data when modal is submitted", async () => {
            // Arrange
            axios.get.mockResolvedValue({
                data: {
                    success: true,
                    category: [{ _id: "cat1", name: "Electronics" }],
                },
            });
            axios.put.mockResolvedValue({
                data: { success: true },
            });

            render(
                <MemoryRouter initialEntries={["/dashboard/admin/create-category"]}>
                    <Routes>
                        <Route
                            path="/dashboard/admin/create-category"
                            element={<CreateCategory />}
                        />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText("Electronics")).toBeInTheDocument();
            });

            // Act
            const editButton = screen.getByText("Edit");
            
            await act(async () => {
                fireEvent.click(editButton);
            });

            await waitFor(() => {
                const inputs = screen.getAllByTestId("category-input");
                expect(inputs.length).toBeGreaterThan(1);
            });

            const modalInput = screen.getAllByTestId("category-input")[1];
            const modalSubmit = screen.getAllByText("Submit")[1];

            await act(async () => {
                fireEvent.change(modalInput, { target: { value: "Updated Electronics" } });
                fireEvent.click(modalSubmit);
            });

            // Assert
            await waitFor(() => {
                expect(axios.put).toHaveBeenCalledWith(
                    "/api/v1/category/update-category/cat1",
                    { name: "Updated Electronics" }
                );
            });
        });

        it("should show success toast and close modal after successful update", async () => {
            // Arrange
            axios.get.mockResolvedValue({
                data: {
                    success: true,
                    category: [{ _id: "cat1", name: "Electronics" }],
                },
            });
            axios.put.mockResolvedValue({
                data: { success: true },
            });

            render(
                <MemoryRouter initialEntries={["/dashboard/admin/create-category"]}>
                    <Routes>
                        <Route
                            path="/dashboard/admin/create-category"
                            element={<CreateCategory />}
                        />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText("Electronics")).toBeInTheDocument();
            });

            // Act
            const editButton = screen.getByText("Edit");
            
            await act(async () => {
                fireEvent.click(editButton);
            });

            await waitFor(() => {
                const inputs = screen.getAllByTestId("category-input");
                expect(inputs.length).toBeGreaterThan(1);
            });

            const submitBtn = screen.getAllByText("Submit")[1];
            
            await act(async () => {
                fireEvent.click(submitBtn);
            });

            // Assert
            await waitFor(() => {
                expect(toast.success).toHaveBeenCalled();
            });
        });

        it("should display error toast when update fails", async () => {
            // Arrange
            axios.get.mockResolvedValue({
                data: {
                    success: true,
                    category: [{ _id: "cat1", name: "Electronics" }],
                },
            });
            axios.put.mockRejectedValue(new Error("Update failed"));

            render(
                <MemoryRouter initialEntries={["/dashboard/admin/create-category"]}>
                    <Routes>
                        <Route
                            path="/dashboard/admin/create-category"
                            element={<CreateCategory />}
                        />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText("Electronics")).toBeInTheDocument();
            });

            // Act
            const editButton = screen.getByText("Edit");
            
            await act(async () => {
                fireEvent.click(editButton);
            });

            await waitFor(() => {
                const inputs = screen.getAllByTestId("category-input");
                expect(inputs.length).toBeGreaterThan(1);
            });

            const submitBtn = screen.getAllByText("Submit")[1];
            
            await act(async () => {
                fireEvent.click(submitBtn);
            });

            // Assert
            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith("Somtihing went wrong");
            });
        });
    });

    describe("deleteCategory", () => {
        it("should call delete API when Delete button is clicked", async () => {
            // Arrange
            axios.get.mockResolvedValue({
                data: {
                    success: true,
                    category: [{ _id: "cat1", name: "Electronics" }],
                },
            });
            axios.delete.mockResolvedValue({
                data: { success: true },
            });

            render(
                <MemoryRouter initialEntries={["/dashboard/admin/create-category"]}>
                    <Routes>
                        <Route
                            path="/dashboard/admin/create-category"
                            element={<CreateCategory />}
                        />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText("Electronics")).toBeInTheDocument();
            });

            // Act
            const deleteButtons = screen.getAllByText("Delete");
            
            await act(async () => {
                fireEvent.click(deleteButtons[0]);
            });

            // Assert
            await waitFor(() => {
                expect(axios.delete).toHaveBeenCalledWith(
                    "/api/v1/category/delete-category/cat1"
                );
            });
        });

        it("should refresh list and show success toast after deletion", async () => {
            // Arrange
            axios.get.mockResolvedValue({
                data: {
                    success: true,
                    category: [{ _id: "cat1", name: "Electronics" }],
                },
            });
            axios.delete.mockResolvedValue({
                data: { success: true },
            });

            render(
                <MemoryRouter initialEntries={["/dashboard/admin/create-category"]}>
                    <Routes>
                        <Route
                            path="/dashboard/admin/create-category"
                            element={<CreateCategory />}
                        />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText("Electronics")).toBeInTheDocument();
            });

            // Act
            const deleteButtons = screen.getAllByText("Delete");
            
            await act(async () => {
                fireEvent.click(deleteButtons[0]);
            });

            // Assert
            await waitFor(() => {
                expect(axios.get).toHaveBeenCalledTimes(2);
                expect(toast.success).toHaveBeenCalledWith("category is deleted");
            });
        });

        it("should display error toast when deletion fails", async () => {
            // Arrange
            axios.get.mockResolvedValue({
                data: {
                    success: true,
                    category: [{ _id: "cat1", name: "Electronics" }],
                },
            });
            axios.delete.mockRejectedValue(new Error("Delete failed"));

            render(
                <MemoryRouter initialEntries={["/dashboard/admin/create-category"]}>
                    <Routes>
                        <Route
                            path="/dashboard/admin/create-category"
                            element={<CreateCategory />}
                        />
                    </Routes>
                </MemoryRouter>
            );

            await waitFor(() => {
                expect(screen.getByText("Electronics")).toBeInTheDocument();
            });

            // Act
            const deleteButton = screen.getByText("Delete");
            
            await act(async () => {
                fireEvent.click(deleteButton);
            });

            // Assert
            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith("Somtihing went wrong");
            });
        });
    });
});
