
import {
  createCategoryController,
  updateCategoryController,
  categoryControlller,
  singleCategoryController,
  deleteCategoryCOntroller,
} from "../categoryController.js";
import categoryModel from "../../models/categoryModel.js";

// Mock dependencies
jest.mock("../../models/categoryModel.js");

describe("Category Controller", () => {
  let req, res;
  
  beforeEach(() => {
    req = {
      body: {},
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {})
  });
  
  /**
   * Test-to-partition mapping (for MS1 traceability)
   * - "createCategory_success_returns201" -> Equivalence class: successful category creation
   * - "createCategory_missingName_returns401" -> Input validation partition: required field missing
   * - "createCategory_alreadyExists_returns200" -> Duplicate detection partition: existing category
   * - "createCategory_error_returns500" -> Error handling partition: database operation failure
   * - "updateCategory_success_returns200" -> Equivalence class: successful category update
   * - "updateCategory_error_returns500" -> Error handling partition: update operation failure
   * - "getAllCategories_success_returns200" -> Equivalence class: fetch all categories
   * - "getAllCategories_error_returns500" -> Error handling partition: fetch operation failure
   * - "getAllCategories_emptyList_returns200" -> Edge case: no categories in database
   * - "getSingleCategory_success_returns200" -> Equivalence class: fetch single category by slug
   * - "getSingleCategory_notFound_returns200WithNull" -> Edge case: category not found
   * - "getSingleCategory_error_returns500" -> Error handling partition: fetch operation failure
   * - "deleteCategory_success_returns200" -> Equivalence class: successful category deletion
   * - "deleteCategory_notFound_stillReturns200" -> Edge case: delete non-existent category
   * - "deleteCategory_error_returns500" -> Error handling partition: delete operation failure
   */
  
  // ============ createCategoryController Tests ============
  describe("createCategoryController", () => {
    // Arrange-Act-Assert
    test("createCategory_success_returns201", async () => {
      // Arrange
      req.body = { name: "Electronics" };

      categoryModel.findOne = jest.fn().mockResolvedValue(null);
      
      const mockCategory = {
        name: "Electronics",
        slug: "electronics",
        save: jest.fn().mockResolvedValue({
          name: "Electronics",
          slug: "electronics",
        }),
      };

      categoryModel.mockImplementation(() => mockCategory);

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(categoryModel.findOne).toHaveBeenCalledWith({ name: "Electronics" });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "new category created",
        category: {
          name: "Electronics",
          slug: "electronics",
        },
      });
    });

    test("createCategory_missingName_returns401", async () => {
      // Arrange
      req.body = {};

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith({ message: "Name is required" });
    });

    test("createCategory_alreadyExists_returns200", async () => {
      // Arrange
      req.body = { name: "Electronics" };

      const existingCategory = {
        _id: "cat123",
        name: "Electronics",
        slug: "electronics",
      };

      categoryModel.findOne = jest.fn().mockResolvedValue(existingCategory);

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Category Already Exisits",
      });
    });

    test("createCategory_error_returns500", async () => {
      // Arrange
      req.body = { name: "Electronics" };
      const mockError = new Error("Database error");

      categoryModel.findOne = jest.fn().mockRejectedValue(mockError);

      // Act
      await createCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error: mockError,
        message: "Errro in Category",
      });
    });
  });

  // ============ updateCategoryController Tests ============
  describe("updateCategoryController", () => {
    test("updateCategory_success_returns200", async () => {
      // Arrange
      req.body = { name: "Updated Electronics" };
      req.params = { id: "cat123" };

      const updatedCategory = {
        _id: "cat123",
        name: "Updated Electronics",
        slug: "updated-electronics",
      };

      categoryModel.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedCategory);

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(categoryModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "cat123",
        { name: "Updated Electronics", slug: "Updated-Electronics" },
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        messsage: "Category Updated Successfully",
        category: updatedCategory,
      });
    });

    test("updateCategory_error_returns500", async () => {
      // Arrange
      req.body = { name: "Updated Electronics" };
      req.params = { id: "cat123" };
      const mockError = new Error("Database error");

      categoryModel.findByIdAndUpdate = jest.fn().mockRejectedValue(mockError);

      // Act
      await updateCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error: mockError,
        message: "Error while updating category",
      });
    });
  });

  // ============ categoryControlller Tests ============
  describe("categoryControlller", () => {
    test("getAllCategories_success_returns200", async () => {
      // Arrange
      const mockCategories = [
        { _id: "1", name: "Electronics", slug: "electronics" },
        { _id: "2", name: "Clothing", slug: "clothing" },
        { _id: "3", name: "Books", slug: "books" },
      ];

      categoryModel.find = jest.fn().mockResolvedValue(mockCategories);

      // Act
      await categoryControlller(req, res);

      // Assert
      expect(categoryModel.find).toHaveBeenCalledWith({});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "All Categories List",
        category: mockCategories,
      });
    });

    test("getAllCategories_error_returns500", async () => {
      // Arrange
      const mockError = new Error("Database error");

      categoryModel.find = jest.fn().mockRejectedValue(mockError);

      // Act
      await categoryControlller(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error: mockError,
        message: "Error while getting all categories",
      });
    });

    test("getAllCategories_emptyList_returns200", async () => {
      // Arrange
      categoryModel.find = jest.fn().mockResolvedValue([]);

      // Act
      await categoryControlller(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "All Categories List",
        category: [],
      });
    });
  });

  // ============ singleCategoryController Tests ============
  describe("singleCategoryController", () => {
    test("getSingleCategory_success_returns200", async () => {
      // Arrange
      req.params.slug = "electronics";

      const mockCategory = {
        _id: "cat123",
        name: "Electronics",
        slug: "electronics",
      };

      categoryModel.findOne = jest.fn().mockResolvedValue(mockCategory);

      // Act
      await singleCategoryController(req, res);

      // Assert
      expect(categoryModel.findOne).toHaveBeenCalledWith({ slug: "electronics" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Get SIngle Category SUccessfully",
        category: mockCategory,
      });
    });

    test("getSingleCategory_notFound_returns200WithNull", async () => {
      // Arrange
      req.params.slug = "nonexistent";

      categoryModel.findOne = jest.fn().mockResolvedValue(null);

      // Act
      await singleCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Get SIngle Category SUccessfully",
        category: null,
      });
    });

    test("getSingleCategory_error_returns500", async () => {
      // Arrange
      req.params.slug = "electronics";
      const mockError = new Error("Database error");

      categoryModel.findOne = jest.fn().mockRejectedValue(mockError);

      // Act
      await singleCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error: mockError,
        message: "Error While getting Single Category",
      });
    });
  });

  // ============ deleteCategoryCOntroller Tests ============
  describe("deleteCategoryCOntroller", () => {
    test("deleteCategory_success_returns200", async () => {
      // Arrange
      req.params.id = "cat123";

      categoryModel.findByIdAndDelete = jest.fn().mockResolvedValue({
        _id: "cat123",
        name: "Electronics",
      });

      // Act
      await deleteCategoryCOntroller(req, res);

      // Assert
      expect(categoryModel.findByIdAndDelete).toHaveBeenCalledWith("cat123");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Categry Deleted Successfully",
      });
    });

    test("deleteCategory_notFound_stillReturns200", async () => {
      // Arrange
      req.params.id = "nonexistent";

      categoryModel.findByIdAndDelete = jest.fn().mockResolvedValue(null);

      // Act
      await deleteCategoryCOntroller(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Categry Deleted Successfully",
      });
    });

    test("deleteCategory_error_returns500", async () => {
      // Arrange
      req.params.id = "cat123";
      const mockError = new Error("Database error");

      categoryModel.findByIdAndDelete = jest.fn().mockRejectedValue(mockError);

      // Act
      await deleteCategoryCOntroller(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "error while deleting category",
        error: mockError,
      });
    });
  });
});
