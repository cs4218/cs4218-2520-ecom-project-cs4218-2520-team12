import {
  createProductController,
  getProductController,
  getSingleProductController,
  productPhotoController,
  deleteProductController,
  updateProductController,
  productFiltersController,
  productCountController,
  productListController,
  searchProductController,
  realtedProductController,
  productCategoryController,
  braintreeTokenController,
  brainTreePaymentController,
} from "../productController.js";
import productModel from "../../models/productModel.js";
import categoryModel from "../../models/categoryModel.js";
import orderModel from "../../models/orderModel.js";
import fs from "fs";
import braintree from "braintree";

// Use var for hoisting - will be assigned in jest.mock factory
var mockClientTokenGenerate;
var mockTransactionSale;

// Mock braintree - create mocks inside factory to avoid hoisting issues
jest.mock("braintree", () => {
  // Initialize mocks inside the factory
  mockClientTokenGenerate = jest.fn();
  mockTransactionSale = jest.fn();
  
  return {
    BraintreeGateway: jest.fn(function() {
      return {
        clientToken: {
          generate: mockClientTokenGenerate,
        },
        transaction: {
          sale: mockTransactionSale,
        },
      };
    }),
    Environment: {
      Sandbox: "sandbox",
    },
  };
});

// Mock other dependencies
jest.mock("../../models/productModel.js");
jest.mock("../../models/categoryModel.js");
jest.mock("../../models/orderModel.js");
jest.mock("fs");

describe("Product Controller", () => {
  let req, res;

  beforeEach(() => {
    req = {
      fields: {},
      files: {},
      params: {},
      body: {},
      user: { _id: "user123" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {})
  });

  // ============ createProductController Tests ============
  describe("createProductController", () => {
    // Arrange-Act-Assert
    test("createProduct_success_returns201", async () => {
      // Arrange
      req.fields = {
        name: "Test Product",
        description: "Test Description",
        price: 100,
        category: "cat123",
        quantity: 10,
        shipping: true,
      };
      req.files = {
        photo: {
          path: "/test/path",
          type: "image/jpeg",
          size: 500000,
        },
      };

      const mockProduct = {
        ...req.fields,
        slug: "test-product",
        photo: { data: Buffer.from("test"), contentType: "image/jpeg" },
        save: jest.fn().mockResolvedValue(true),
      };

      productModel.mockImplementation(() => mockProduct);
      fs.readFileSync.mockReturnValue(Buffer.from("test"));

      // Act
      await createProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Product Created Successfully",
        products: mockProduct,
      });
    });

    test("createProduct_missingName_returns500", async () => {
      // Arrange
      req.fields = {
        description: "Test Description",
        price: 100,
        category: "cat123",
        quantity: 10,
      };

      // Act
      await createProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({ error: "Name is Required" });
    });

    test("createProduct_missingDescription_returns500", async () => {
      // Arrange
      req.fields = {
        name: "Test Product",
        price: 100,
        category: "cat123",
        quantity: 10,
      };

      // Act
      await createProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        error: "Description is Required",
      });
    });

    test("createProduct_missingPrice_returns500", async () => {
      // Arrange
      req.fields = {
        name: "Test Product",
        description: "Test Description",
        category: "cat123",
        quantity: 10,
      };

      // Act
      await createProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({ error: "Price is Required" });
    });

    test("createProduct_missingCategory_returns500", async () => {
      // Arrange
      req.fields = {
        name: "Test Product",
        description: "Test Description",
        price: 100,
        quantity: 10,
      };

      // Act
      await createProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({ error: "Category is Required" });
    });

    test("createProduct_missingQuantity_returns500", async () => {
      // Arrange
      req.fields = {
        name: "Test Product",
        description: "Test Description",
        price: 100,
        category: "cat123",
      };

      // Act
      await createProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({ error: "Quantity is Required" });
    });

    test("createProduct_photoTooLarge_returns500", async () => {
      // Arrange
      req.fields = {
        name: "Test Product",
        description: "Test Description",
        price: 100,
        category: "cat123",
        quantity: 10,
      };
      req.files = {
        photo: {
          size: 2000000, // 2MB
        },
      };

      // Act
      await createProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        error: "photo is Required and should be less then 1mb",
      });
    });

    test("createProduct_errorDuringSave_returns500", async () => {
      // Arrange
      req.fields = {
        name: "Test Product",
        description: "Test Description",
        price: 100,
        category: "cat123",
        quantity: 10,
      };

      const mockError = new Error("Database error");
      productModel.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(mockError),
      }));

      // Act
      await createProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error: mockError,
        message: "Error in crearing product",
      });
    });
  });

  // ============ getProductController Tests ============
  describe("getProductController", () => {
    test("getProducts_success_returnsProducts", async () => {
      // Arrange
      const mockProducts = [
        { _id: "1", name: "Product 1" },
        { _id: "2", name: "Product 2" },
      ];

      productModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockProducts),
      });

      // Act
      await getProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        counTotal: 2,
        message: "ALlProducts ",
        products: mockProducts,
      });
    });

    test("getProducts_error_returns500", async () => {
      // Arrange
      const mockError = new Error("Database error");
      productModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockRejectedValue(mockError),
      });

      // Act
      await getProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Erorr in getting products",
        error: mockError.message,
      });
    });
  });

  // ============ getSingleProductController Tests ============
  describe("getSingleProductController", () => {
    test("getSingleProduct_success_returnsProduct", async () => {
      // Arrange
      req.params.slug = "test-product";
      const mockProduct = { _id: "1", name: "Test Product", slug: "test-product" };

      productModel.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockProduct),
      });

      // Act
      await getSingleProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Single Product Fetched",
        product: mockProduct,
      });
    });

    test("getSingleProduct_error_returns500", async () => {
      // Arrange
      req.params.slug = "test-product";
      const mockError = new Error("Database error");

      productModel.findOne = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        populate: jest.fn().mockRejectedValue(mockError),
      });

      // Act
      await getSingleProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Eror while getitng single product",
        error: mockError,
      });
    });
  });

  // ============ productPhotoController Tests ============
  describe("productPhotoController", () => {
    test("getPhoto_success_returnsPhotoData", async () => {
      // Arrange
      req.params.pid = "product123";
      const mockPhotoData = Buffer.from("test image data");
      const mockProduct = {
        photo: {
          data: mockPhotoData,
          contentType: "image/jpeg",
        },
      };

      productModel.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockProduct),
      });

      // Act
      await productPhotoController(req, res);

      // Assert
      expect(res.set).toHaveBeenCalledWith("Content-type", "image/jpeg");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(mockPhotoData);
    });

    test("getPhoto_error_returns500", async () => {
      // Arrange
      req.params.pid = "product123";
      const mockError = new Error("Database error");

      productModel.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockRejectedValue(mockError),
      });

      // Act
      await productPhotoController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Erorr while getting photo",
        error: mockError,
      });
    });
  });

  // ============ deleteProductController Tests ============
  describe("deleteProductController", () => {
    test("deleteProduct_success_returns200", async () => {
      // Arrange
      req.params.pid = "product123";

      productModel.findByIdAndDelete = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({}),
      });

      // Act
      await deleteProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Product Deleted successfully",
      });
    });

    test("deleteProduct_error_returns500", async () => {
      // Arrange
      req.params.pid = "product123";
      const mockError = new Error("Database error");

      productModel.findByIdAndDelete = jest.fn().mockReturnValue({
        select: jest.fn().mockRejectedValue(mockError),
      });

      // Act
      await deleteProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Error while deleting product",
        error: mockError,
      });
    });
  });

  // ============ updateProductController Tests ============
  describe("updateProductController", () => {
    test("updateProduct_success_returns201", async () => {
      // Arrange
      req.params.pid = "product123";
      req.fields = {
        name: "Updated Product",
        description: "Updated Description",
        price: 200,
        category: "cat456",
        quantity: 20,
        shipping: false,
      };
      req.files = {
        photo: {
          path: "/test/path",
          type: "image/png",
          size: 500000,
        },
      };

      const mockProduct = {
        ...req.fields,
        slug: "updated-product",
        photo: { data: Buffer.from("test"), contentType: "image/png" },
        save: jest.fn().mockResolvedValue(true),
      };

      productModel.findByIdAndUpdate = jest.fn().mockResolvedValue(mockProduct);
      fs.readFileSync.mockReturnValue(Buffer.from("test"));

      // Act
      await updateProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Product Updated Successfully",
        products: mockProduct,
      });
    });

    test("updateProduct_successWithoutPhoto_returns201", async () => {
      // Arrange
      req.params.pid = "product123";
      req.fields = {
        name: "Updated Product",
        description: "Updated Description",
        price: 200,
        category: "cat456",
        quantity: 20,
        shipping: false,
      };
      req.files = {}; // No photo

      const mockProduct = {
        ...req.fields,
        slug: "updated-product",
        save: jest.fn().mockResolvedValue(true),
      };

      productModel.findByIdAndUpdate = jest.fn().mockResolvedValue(mockProduct);

      // Act
      await updateProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Product Updated Successfully",
        products: mockProduct,
      });
      expect(mockProduct.save).toHaveBeenCalled();
    });

    test("updateProduct_missingName_returns500", async () => {
      // Arrange
      req.params.pid = "product123";
      req.fields = {
        description: "Updated Description",
        price: 200,
        category: "cat456",
        quantity: 20,
      };

      // Act
      await updateProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({ error: "Name is Required" });
    });

    test("updateProduct_missingDescription_returns500", async () => {
      // Arrange
      req.params.pid = "product123";
      req.fields = {
        name: "Updated Product",
        price: 200,
        category: "cat456",
        quantity: 20,
      };

      // Act
      await updateProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({ error: "Description is Required" });
    });

    test("updateProduct_missingPrice_returns500", async () => {
      // Arrange
      req.params.pid = "product123";
      req.fields = {
        name: "Updated Product",
        description: "Updated Description",
        category: "cat456",
        quantity: 20,
      };

      // Act
      await updateProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({ error: "Price is Required" });
    });

    test("updateProduct_missingCategory_returns500", async () => {
      // Arrange
      req.params.pid = "product123";
      req.fields = {
        name: "Updated Product",
        description: "Updated Description",
        price: 200,
        quantity: 20,
      };

      // Act
      await updateProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({ error: "Category is Required" });
    });

    test("updateProduct_missingQuantity_returns500", async () => {
      // Arrange
      req.params.pid = "product123";
      req.fields = {
        name: "Updated Product",
        description: "Updated Description",
        price: 200,
        category: "cat456",
      };

      // Act
      await updateProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({ error: "Quantity is Required" });
    });

    test("updateProduct_photoTooLarge_returns500", async () => {
      // Arrange
      req.params.pid = "product123";
      req.fields = {
        name: "Updated Product",
        description: "Updated Description",
        price: 200,
        category: "cat456",
        quantity: 20,
      };
      req.files = {
        photo: {
          size: 2000000, // 2MB - too large
        },
      };

      // Act
      await updateProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        error: "photo is Required and should be less then 1mb",
      });
    });

    test("updateProduct_error_returns500", async () => {
      // Arrange
      req.params.pid = "product123";
      req.fields = {
        name: "Updated Product",
        description: "Updated Description",
        price: 200,
        category: "cat456",
        quantity: 20,
      };

      const mockError = new Error("Database error");
      productModel.findByIdAndUpdate = jest.fn().mockRejectedValue(mockError);

      // Act
      await updateProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error: mockError,
        message: "Error in Updte product",
      });
    });
  });

  // ============ productFiltersController Tests ============
  describe("productFiltersController", () => {
    test("filterProducts_withCategoryAndPrice_returnsFilteredProducts", async () => {
      // Arrange
      req.body = {
        checked: ["cat1", "cat2"],
        radio: [10, 50],
      };

      const mockProducts = [
        { _id: "1", name: "Product 1" },
        { _id: "2", name: "Product 2" },
      ];

      productModel.find = jest.fn().mockResolvedValue(mockProducts);

      // Act
      await productFiltersController(req, res);

      // Assert
      expect(productModel.find).toHaveBeenCalledWith({
        category: ["cat1", "cat2"],
        price: { $gte: 10, $lte: 50 },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        products: mockProducts,
      });
    });

    test("filterProducts_withCategoryOnly_returnsFilteredProducts", async () => {
      // Arrange
      req.body = {
        checked: ["cat1"],
        radio: [],
      };

      const mockProducts = [{ _id: "1", name: "Product 1" }];
      productModel.find = jest.fn().mockResolvedValue(mockProducts);

      // Act
      await productFiltersController(req, res);

      // Assert
      expect(productModel.find).toHaveBeenCalledWith({
        category: ["cat1"],
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("filterProducts_error_returns400", async () => {
      // Arrange
      req.body = {
        checked: [],
        radio: [],
      };

      const mockError = new Error("Database error");
      productModel.find = jest.fn().mockRejectedValue(mockError);

      // Act
      await productFiltersController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Error WHile Filtering Products",
        error: mockError,
      });
    });
  });

  // ============ productCountController Tests ============
  describe("productCountController", () => {
    test("getProductCount_success_returnsCount", async () => {
      // Arrange
      const mockCount = 25;
      productModel.find = jest.fn().mockReturnValue({
        estimatedDocumentCount: jest.fn().mockResolvedValue(mockCount),
      });

      // Act
      await productCountController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        total: mockCount,
      });
    });

    test("getProductCount_error_returns400", async () => {
      // Arrange
      const mockError = new Error("Database error");
      productModel.find = jest.fn().mockReturnValue({
        estimatedDocumentCount: jest.fn().mockRejectedValue(mockError),
      });

      // Act
      await productCountController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        message: "Error in product count",
        error: mockError,
        success: false,
      });
    });
  });

  // ============ productListController Tests ============
  describe("productListController", () => {
    test("getProductList_withPage_returnsPagedProducts", async () => {
      // Arrange
      req.params.page = 2;
      const mockProducts = [
        { _id: "7", name: "Product 7" },
        { _id: "8", name: "Product 8" },
      ];

      productModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockProducts),
      });

      // Act
      await productListController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        products: mockProducts,
      });
    });

    test("getProductList_withoutPage_returnsFirstPage", async () => {
      // Arrange
      const mockProducts = [
        { _id: "1", name: "Product 1" },
        { _id: "2", name: "Product 2" },
      ];

      productModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockProducts),
      });

      // Act
      await productListController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        products: mockProducts,
      });
    });

    test("getProductList_error_returns400", async () => {
      // Arrange
      const mockError = new Error("Database error");
      productModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockRejectedValue(mockError),
      });

      // Act
      await productListController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "error in per page ctrl",
        error: mockError,
      });
    });
  });

  // ============ searchProductController Tests ============
  describe("searchProductController", () => {
    test("searchProduct_success_returnsMatchingProducts", async () => {
      // Arrange
      req.params.keyword = "laptop";
      const mockProducts = [
        { _id: "1", name: "Gaming Laptop" },
        { _id: "2", name: "Business Laptop" },
      ];

      productModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockProducts),
      });

      // Act
      await searchProductController(req, res);

      // Assert
      expect(productModel.find).toHaveBeenCalledWith({
        $or: [
          { name: { $regex: "laptop", $options: "i" } },
          { description: { $regex: "laptop", $options: "i" } },
        ],
      });
      expect(res.json).toHaveBeenCalledWith(mockProducts);
    });

    test("searchProduct_error_returns400", async () => {
      // Arrange
      req.params.keyword = "laptop";
      const mockError = new Error("Database error");

      productModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockRejectedValue(mockError),
      });

      // Act
      await searchProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Error In Search Product API",
        error: mockError,
      });
    });
  });

  // ============ realtedProductController Tests ============
  describe("realtedProductController", () => {
    test("getRelatedProducts_success_returnsRelatedProducts", async () => {
      // Arrange
      req.params.pid = "product123";
      req.params.cid = "category456";
      const mockProducts = [
        { _id: "2", name: "Related Product 1" },
        { _id: "3", name: "Related Product 2" },
      ];

      productModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockProducts),
      });

      // Act
      await realtedProductController(req, res);

      // Assert
      expect(productModel.find).toHaveBeenCalledWith({
        category: "category456",
        _id: { $ne: "product123" },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        products: mockProducts,
      });
    });

    test("getRelatedProducts_error_returns400", async () => {
      // Arrange
      req.params.pid = "product123";
      req.params.cid = "category456";
      const mockError = new Error("Database error");

      productModel.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockRejectedValue(mockError),
      });

      // Act
      await realtedProductController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "error while geting related product",
        error: mockError,
      });
    });
  });

  // ============ productCategoryController Tests ============
  describe("productCategoryController", () => {
    test("getProductsByCategory_success_returnsProducts", async () => {
      // Arrange
      req.params.slug = "electronics";
      const mockCategory = { _id: "cat123", name: "Electronics", slug: "electronics" };
      const mockProducts = [
        { _id: "1", name: "Product 1" },
        { _id: "2", name: "Product 2" },
      ];

      categoryModel.findOne = jest.fn().mockResolvedValue(mockCategory);
      productModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockProducts),
      });

      // Act
      await productCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        category: mockCategory,
        products: mockProducts,
      });
    });

    test("getProductsByCategory_error_returns400", async () => {
      // Arrange
      req.params.slug = "electronics";
      const mockError = new Error("Database error");

      categoryModel.findOne = jest.fn().mockRejectedValue(mockError);

      // Act
      await productCategoryController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        error: mockError,
        message: "Error While Getting products",
      });
    });
  });

  // ============ braintreeTokenController Tests ============
  describe("braintreeTokenController", () => {
    test("getToken_success_returnsToken", async () => {
      // Arrange
      const mockResponse = { clientToken: "test-token-123" };
      mockClientTokenGenerate.mockImplementation((options, callback) => {
        callback(null, mockResponse);
      });

      // Act
      await braintreeTokenController(req, res);

      // Assert
      expect(mockClientTokenGenerate).toHaveBeenCalled();
      expect(res.send).toHaveBeenCalledWith(mockResponse);
    });

    test("getToken_error_returns500", async () => {
      // Arrange
      const mockError = new Error("Braintree error");
      mockClientTokenGenerate.mockImplementation((options, callback) => {
        callback(mockError, null);
      });

      // Act
      await braintreeTokenController(req, res);

      // Assert
      expect(mockClientTokenGenerate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(mockError);
    });

    test("getToken_catchBlockError_logsError", async () => {
      // Arrange
      const mockError = new Error("Unexpected error");
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
      mockClientTokenGenerate.mockImplementation(() => {
        throw mockError;
      });

      // Act
      await braintreeTokenController(req, res);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(mockError);
      consoleLogSpy.mockRestore();
    });
  });

  // ============ brainTreePaymentController Tests ============
  describe("brainTreePaymentController", () => {
    test("processPayment_success_createsOrder", async () => {
      // Arrange
      req.body = {
        nonce: "test-nonce",
        cart: [
          { price: 100, name: "Product 1" },
          { price: 200, name: "Product 2" },
        ],
      };

      const mockTransactionResult = {
        success: true,
        transaction: { id: "txn123" },
      };

      mockTransactionSale.mockImplementation((options, callback) => {
        callback(null, mockTransactionResult);
      });

      const mockOrder = {
        save: jest.fn().mockResolvedValue(true),
      };
      orderModel.mockImplementation(() => mockOrder);

      // Act
      await brainTreePaymentController(req, res);

      // Assert
      expect(mockTransactionSale).toHaveBeenCalledWith(
        {
          amount: 300,
          paymentMethodNonce: "test-nonce",
          options: {
            submitForSettlement: true,
          },
        },
        expect.any(Function)
      );
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("processPayment_error_returns500", async () => {
      // Arrange
      req.body = {
        nonce: "test-nonce",
        cart: [{ price: 100 }],
      };

      const mockError = new Error("Payment failed");
      mockTransactionSale.mockImplementation((options, callback) => {
        callback(mockError, null);
      });

      // Act
      await brainTreePaymentController(req, res);

      // Assert
      expect(mockTransactionSale).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(mockError);
    });

    test("processPayment_catchBlockError_logsError", async () => {
      // Arrange
      req.body = {
        nonce: "test-nonce",
        cart: [{ price: 100 }],
      };

      const mockError = new Error("Unexpected error");
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
      mockTransactionSale.mockImplementation(() => {
        throw mockError;
      });

      // Act
      await brainTreePaymentController(req, res);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(mockError);
      consoleLogSpy.mockRestore();
    });
  });
});
