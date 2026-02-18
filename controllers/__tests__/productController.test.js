// David Vicedo, A0273234J

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
} from "../productController.js";

import productModel from "../../models/productModel.js";
import categoryModel from "../../models/categoryModel.js";
import fs from "fs";
import slugify from "slugify";

jest.mock("../../models/productModel.js");
jest.mock("../../models/categoryModel.js");
jest.mock("fs");
jest.mock("slugify", () => jest.fn());

// productController initializes a Braintree gateway on import.
// Mock these modules to avoid env/config side effects.
jest.mock("dotenv", () => ({
    config: jest.fn(),
}));

jest.mock("braintree", () => ({
    BraintreeGateway: jest.fn(function BraintreeGatewayMock() {
        return {};
    }),
    Environment: {
        Sandbox: "sandbox",
    },
}));

const createRes = () => {
    const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
    };
    return res;
};

const createReq = () => {
    const req = {
        fields: {},
        files: {},
        body: {},
        params: {},
    };
    return req;
};

const createQueryChain = (finalMethodName, finalResolvedValue) => {
    const chain = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
    };

    chain[finalMethodName] = jest.fn().mockResolvedValue(finalResolvedValue);
    return chain;
};

describe("Product Controller", () => {
    let req;
    let res;

    beforeEach(() => {
        req = createReq();
        res = createRes();

        jest.clearAllMocks();

        jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});

        slugify.mockImplementation(() => "mock-slug");
    });

    /**
     * Test-to-partition mapping (for MS1 traceability)
     * - createProduct_missingName_returns500 -> Validation partition: missing required name
     * - createProduct_photoTooLarge_returns500 -> Validation partition: photo.size > 1_000_000
     * - createProduct_success_withPhoto_returns201 -> Happy path: persists product + photo
     * - createProduct_error_returns500 -> Error handling: save throws
     *
     * - getProducts_success_returns200 -> Happy path: list products (query chain)
     * - getProducts_error_returns500 -> Error handling: query throws
     *
     * - getSingleProduct_success_returns200 -> Happy path: findOne by slug
     * - getSingleProduct_error_returns500 -> Error handling: findOne throws
     *
     * - getPhoto_hasData_setsContentTypeAndReturns200 -> Happy path: photo exists
     * - getPhoto_noData_doesNotSendPhoto -> Edge: photo.data falsy
     * - getPhoto_error_returns500 -> Error handling: findById throws
     *
     * - deleteProduct_success_returns200 -> Happy path: delete by id
     * - deleteProduct_error_returns500 -> Error handling: delete throws
     *
     * - updateProduct_missingName_returns500 -> Validation partition: missing required name
     * - updateProduct_photoTooLarge_returns500 -> Validation partition: photo.size > 1_000_000
     * - updateProduct_success_withPhoto_returns201 -> Happy path: update + save + photo
     * - updateProduct_success_withoutPhoto_returns201 -> Happy path: update + save without touching photo
     * - updateProduct_error_returns500 -> Error handling: update throws
     *
     * - filterProducts_categoryAndPrice_callsFindWithArgs_returns200 -> Partition: checked+radio
     * - filterProducts_noFilters_callsFindWithEmptyArgs_returns200 -> Partition: no filters
     * - filterProducts_error_returns400 -> Error handling: find throws
     *
     * - countProducts_success_returns200 -> Happy path: estimatedDocumentCount
     * - countProducts_error_returns400 -> Error handling: count throws
     *
     * - listProducts_defaultPage_returns200 -> Partition: page missing (defaults to 1)
     * - listProducts_page2_returns200 -> Boundary partition: page=2 (skip=6)
     * - listProducts_error_returns400 -> Error handling: query throws
     *
     * - searchProducts_success_returnsJson -> Happy path: regex query
     * - searchProducts_error_returns400 -> Error handling: find throws
     *
     * - relatedProducts_success_returns200 -> Happy path: related query with $ne
     * - relatedProducts_error_returns400 -> Error handling: find throws
     *
     * - categoryProducts_success_returns200 -> Happy path: find category then products
     * - categoryProducts_error_returns400 -> Error handling: findOne throws
     */

    // ============ createProductController ============
    describe("createProductController", () => {
        test("createProduct_missingName_returns500", async () => {
            // Arrange
            req.fields = {
                description: "d",
                price: 10,
                category: "c1",
                quantity: 1,
                shipping: true,
            };
            req.files = {};

            // Act
            await createProductController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith({
                error: "Name is Required",
            });
        });

        test("createProduct_missingDescription_returns500", async () => {
            // Arrange
            req.fields = {
                name: "Phone",
                price: 10,
                category: "c1",
                quantity: 1,
                shipping: true,
            };
            req.files = {};

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
                name: "Phone",
                description: "d",
                category: "c1",
                quantity: 1,
                shipping: true,
            };
            req.files = {};

            // Act
            await createProductController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith({
                error: "Price is Required",
            });
        });

        test("createProduct_missingCategory_returns500", async () => {
            // Arrange
            req.fields = {
                name: "Phone",
                description: "d",
                price: 10,
                quantity: 1,
                shipping: true,
            };
            req.files = {};

            // Act
            await createProductController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith({
                error: "Category is Required",
            });
        });

        test("createProduct_missingQuantity_returns500", async () => {
            // Arrange
            req.fields = {
                name: "Phone",
                description: "d",
                price: 10,
                category: "c1",
                shipping: true,
            };
            req.files = {};

            // Act
            await createProductController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith({
                error: "Quantity is Required",
            });
        });

        test("createProduct_photoTooLarge_returns500", async () => {
            // Arrange
            req.fields = {
                name: "Phone",
                description: "d",
                price: 10,
                category: "c1",
                quantity: 1,
                shipping: true,
            };
            req.files = {
                photo: { size: 1000001, path: "/tmp/a", type: "image/jpeg" },
            };

            // Act
            await createProductController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith({
                error: "photo is Required and should be less then 1mb",
            });
        });

        test("createProduct_success_withPhoto_returns201", async () => {
            // Arrange
            req.fields = {
                name: "Phone",
                description: "Nice",
                price: 10,
                category: "c1",
                quantity: 1,
                shipping: true,
            };
            req.files = {
                photo: {
                    size: 10,
                    path: "C:/tmp/photo.jpg",
                    type: "image/jpeg",
                },
            };

            const mockProductInstance = {
                photo: { data: null, contentType: null },
                save: jest.fn().mockResolvedValue(true),
            };

            productModel.mockImplementation(() => mockProductInstance);
            fs.readFileSync.mockReturnValue(Buffer.from("img"));

            // Act
            await createProductController(req, res);

            // Assert
            expect(slugify).toHaveBeenCalledWith("Phone");
            expect(productModel).toHaveBeenCalledWith({
                ...req.fields,
                slug: "mock-slug",
            });
            expect(fs.readFileSync).toHaveBeenCalledWith("C:/tmp/photo.jpg");
            expect(mockProductInstance.photo.data).toEqual(Buffer.from("img"));
            expect(mockProductInstance.photo.contentType).toBe("image/jpeg");
            expect(mockProductInstance.save).toHaveBeenCalled();

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                message: "Product Created Successfully",
                products: mockProductInstance,
            });
        });

        test("createProduct_error_returns500", async () => {
            // Arrange
            req.fields = {
                name: "Phone",
                description: "Nice",
                price: 10,
                category: "c1",
                quantity: 1,
                shipping: true,
            };
            req.files = {};

            const mockError = new Error("save failed");
            const mockProductInstance = {
                photo: { data: null, contentType: null },
                save: jest.fn().mockRejectedValue(mockError),
            };

            productModel.mockImplementation(() => mockProductInstance);

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

    // ============ getProductController ============
    describe("getProductController", () => {
        test("getProducts_success_returns200", async () => {
            // Arrange
            const mockProducts = [{ _id: "p1" }, { _id: "p2" }];
            const query = createQueryChain("sort", mockProducts);
            productModel.find = jest.fn().mockReturnValue(query);
            query.populate.mockReturnThis();
            query.select.mockReturnThis();
            query.limit.mockReturnThis();

            // Act
            await getProductController(req, res);

            // Assert
            expect(productModel.find).toHaveBeenCalledWith({});
            expect(query.populate).toHaveBeenCalledWith("category");
            expect(query.select).toHaveBeenCalledWith("-photo");
            expect(query.limit).toHaveBeenCalledWith(12);
            expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });

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
            const mockError = new Error("db");
            productModel.find = jest.fn().mockImplementation(() => {
                throw mockError;
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

    // ============ getSingleProductController ============
    describe("getSingleProductController", () => {
        test("getSingleProduct_success_returns200", async () => {
            // Arrange
            req.params.slug = "phone";
            const mockProduct = { _id: "p1", name: "Phone" };

            const query = {
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockResolvedValue(mockProduct),
            };

            productModel.findOne = jest.fn().mockReturnValue(query);

            // Act
            await getSingleProductController(req, res);

            // Assert
            expect(productModel.findOne).toHaveBeenCalledWith({
                slug: "phone",
            });
            expect(query.select).toHaveBeenCalledWith("-photo");
            expect(query.populate).toHaveBeenCalledWith("category");

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                message: "Single Product Fetched",
                product: mockProduct,
            });
        });

        test("getSingleProduct_error_returns500", async () => {
            // Arrange
            req.params.slug = "phone";
            const mockError = new Error("db");
            productModel.findOne = jest.fn().mockImplementation(() => {
                throw mockError;
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

    // ============ productPhotoController ============
    describe("productPhotoController", () => {
        test("getPhoto_hasData_setsContentTypeAndReturns200", async () => {
            // Arrange
            req.params.pid = "p1";
            const mockProduct = {
                photo: {
                    data: Buffer.from("abc"),
                    contentType: "image/png",
                },
            };

            const query = {
                select: jest.fn().mockResolvedValue(mockProduct),
            };
            productModel.findById = jest.fn().mockReturnValue(query);

            // Act
            await productPhotoController(req, res);

            // Assert
            expect(productModel.findById).toHaveBeenCalledWith("p1");
            expect(query.select).toHaveBeenCalledWith("photo");
            expect(res.set).toHaveBeenCalledWith("Content-type", "image/png");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith(Buffer.from("abc"));
        });

        test("getPhoto_noData_doesNotSendPhoto", async () => {
            // Arrange
            req.params.pid = "p1";
            const mockProduct = {
                photo: { data: null, contentType: "image/png" },
            };

            const query = {
                select: jest.fn().mockResolvedValue(mockProduct),
            };
            productModel.findById = jest.fn().mockReturnValue(query);

            // Act
            await productPhotoController(req, res);

            // Assert
            expect(res.set).not.toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalledWith(200);
            expect(res.send).not.toHaveBeenCalled();
        });

        test("getPhoto_error_returns500", async () => {
            // Arrange
            req.params.pid = "p1";
            const mockError = new Error("db");
            productModel.findById = jest.fn().mockImplementation(() => {
                throw mockError;
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

    // ============ deleteProductController ============
    describe("deleteProductController", () => {
        test("deleteProduct_success_returns200", async () => {
            // Arrange
            req.params.pid = "p1";
            const query = {
                select: jest.fn().mockResolvedValue({}),
            };
            productModel.findByIdAndDelete = jest.fn().mockReturnValue(query);

            // Act
            await deleteProductController(req, res);

            // Assert
            expect(productModel.findByIdAndDelete).toHaveBeenCalledWith("p1");
            expect(query.select).toHaveBeenCalledWith("-photo");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                message: "Product Deleted successfully",
            });
        });

        test("deleteProduct_error_returns500", async () => {
            // Arrange
            req.params.pid = "p1";
            const mockError = new Error("db");
            productModel.findByIdAndDelete = jest
                .fn()
                .mockImplementation(() => {
                    throw mockError;
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

    // ============ updateProductController ============
    describe("updateProductController", () => {
        test("updateProduct_missingName_returns500", async () => {
            // Arrange
            req.params.pid = "p1";
            req.fields = {
                description: "d",
                price: 10,
                category: "c1",
                quantity: 1,
                shipping: true,
            };
            req.files = {};

            // Act
            await updateProductController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith({
                error: "Name is Required",
            });
        });

        test("updateProduct_missingDescription_returns500", async () => {
            // Arrange
            req.params.pid = "p1";
            req.fields = {
                name: "Phone",
                price: 10,
                category: "c1",
                quantity: 1,
                shipping: true,
            };
            req.files = {};

            // Act
            await updateProductController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith({
                error: "Description is Required",
            });
        });

        test("updateProduct_missingPrice_returns500", async () => {
            // Arrange
            req.params.pid = "p1";
            req.fields = {
                name: "Phone",
                description: "d",
                category: "c1",
                quantity: 1,
                shipping: true,
            };
            req.files = {};

            // Act
            await updateProductController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith({
                error: "Price is Required",
            });
        });

        test("updateProduct_missingCategory_returns500", async () => {
            // Arrange
            req.params.pid = "p1";
            req.fields = {
                name: "Phone",
                description: "d",
                price: 10,
                quantity: 1,
                shipping: true,
            };
            req.files = {};

            // Act
            await updateProductController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith({
                error: "Category is Required",
            });
        });

        test("updateProduct_missingQuantity_returns500", async () => {
            // Arrange
            req.params.pid = "p1";
            req.fields = {
                name: "Phone",
                description: "d",
                price: 10,
                category: "c1",
                shipping: true,
            };
            req.files = {};

            // Act
            await updateProductController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith({
                error: "Quantity is Required",
            });
        });

        test("updateProduct_photoTooLarge_returns500", async () => {
            // Arrange
            req.params.pid = "p1";
            req.fields = {
                name: "Phone",
                description: "d",
                price: 10,
                category: "c1",
                quantity: 1,
                shipping: true,
            };
            req.files = {
                photo: { size: 1000001, path: "/tmp/a", type: "image/jpeg" },
            };

            // Act
            await updateProductController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith({
                error: "photo is Required and should be less then 1mb",
            });
        });

        test("updateProduct_success_withPhoto_returns201", async () => {
            // Arrange
            req.params.pid = "p1";
            req.fields = {
                name: "Phone",
                description: "Nice",
                price: 10,
                category: "c1",
                quantity: 1,
                shipping: true,
            };
            req.files = {
                photo: {
                    size: 10,
                    path: "C:/tmp/photo.jpg",
                    type: "image/jpeg",
                },
            };

            const mockUpdated = {
                photo: { data: null, contentType: null },
                save: jest.fn().mockResolvedValue(true),
            };

            productModel.findByIdAndUpdate = jest
                .fn()
                .mockResolvedValue(mockUpdated);
            fs.readFileSync.mockReturnValue(Buffer.from("img"));

            // Act
            await updateProductController(req, res);

            // Assert
            expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
                "p1",
                { ...req.fields, slug: "mock-slug" },
                { new: true },
            );
            expect(fs.readFileSync).toHaveBeenCalledWith("C:/tmp/photo.jpg");
            expect(mockUpdated.photo.data).toEqual(Buffer.from("img"));
            expect(mockUpdated.photo.contentType).toBe("image/jpeg");
            expect(mockUpdated.save).toHaveBeenCalled();

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                message: "Product Updated Successfully",
                products: mockUpdated,
            });
        });

        test("updateProduct_success_withoutPhoto_returns201", async () => {
            // Arrange
            req.params.pid = "p1";
            req.fields = {
                name: "Phone",
                description: "Nice",
                price: 10,
                category: "c1",
                quantity: 1,
                shipping: true,
            };
            req.files = {};

            const mockUpdated = {
                photo: {
                    data: Buffer.from("existing"),
                    contentType: "image/jpeg",
                },
                save: jest.fn().mockResolvedValue(true),
            };

            productModel.findByIdAndUpdate = jest
                .fn()
                .mockResolvedValue(mockUpdated);

            // Act
            await updateProductController(req, res);

            // Assert
            expect(productModel.findByIdAndUpdate).toHaveBeenCalledWith(
                "p1",
                { ...req.fields, slug: "mock-slug" },
                { new: true },
            );
            expect(fs.readFileSync).not.toHaveBeenCalled();
            expect(mockUpdated.save).toHaveBeenCalled();

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                message: "Product Updated Successfully",
                products: mockUpdated,
            });
        });

        test("updateProduct_error_returns500", async () => {
            // Arrange
            req.params.pid = "p1";
            req.fields = {
                name: "Phone",
                description: "Nice",
                price: 10,
                category: "c1",
                quantity: 1,
                shipping: true,
            };
            req.files = {};

            const mockError = new Error("db");
            productModel.findByIdAndUpdate = jest
                .fn()
                .mockRejectedValue(mockError);

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

    // ============ productFiltersController ============
    describe("productFiltersController", () => {
        test("filterProducts_categoryAndPrice_callsFindWithArgs_returns200", async () => {
            // Arrange
            req.body = { checked: ["c1"], radio: [10, 50] };
            const mockProducts = [{ _id: "p1" }];
            productModel.find = jest.fn().mockResolvedValue(mockProducts);

            // Act
            await productFiltersController(req, res);

            // Assert
            expect(productModel.find).toHaveBeenCalledWith({
                category: ["c1"],
                price: { $gte: 10, $lte: 50 },
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                products: mockProducts,
            });
        });

        test("filterProducts_noFilters_callsFindWithEmptyArgs_returns200", async () => {
            // Arrange
            req.body = { checked: [], radio: [] };
            productModel.find = jest.fn().mockResolvedValue([]);

            // Act
            await productFiltersController(req, res);

            // Assert
            expect(productModel.find).toHaveBeenCalledWith({});
            expect(res.status).toHaveBeenCalledWith(200);
        });

        test("filterProducts_error_returns400", async () => {
            // Arrange
            req.body = { checked: ["c1"], radio: [] };
            const mockError = new Error("db");
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

    // ============ productCountController ============
    describe("productCountController", () => {
        test("countProducts_success_returns200", async () => {
            // Arrange
            const query = {
                estimatedDocumentCount: jest.fn().mockResolvedValue(123),
            };
            productModel.find = jest.fn().mockReturnValue(query);

            // Act
            await productCountController(req, res);

            // Assert
            expect(productModel.find).toHaveBeenCalledWith({});
            expect(query.estimatedDocumentCount).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                total: 123,
            });
        });

        test("countProducts_error_returns400", async () => {
            // Arrange
            const mockError = new Error("db");
            productModel.find = jest.fn().mockImplementation(() => {
                throw mockError;
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

    // ============ productListController ============
    describe("productListController", () => {
        test("listProducts_defaultPage_returns200", async () => {
            // Arrange
            req.params.page = undefined;
            const mockProducts = [{ _id: "p1" }];

            const query = createQueryChain("sort", mockProducts);
            productModel.find = jest.fn().mockReturnValue(query);

            // Act
            await productListController(req, res);

            // Assert
            expect(query.skip).toHaveBeenCalledWith(0);
            expect(query.limit).toHaveBeenCalledWith(6);
            expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                products: mockProducts,
            });
        });

        test("listProducts_page2_returns200", async () => {
            // Arrange
            req.params.page = 2;
            const mockProducts = [{ _id: "p2" }];

            const query = createQueryChain("sort", mockProducts);
            productModel.find = jest.fn().mockReturnValue(query);

            // Act
            await productListController(req, res);

            // Assert
            expect(query.skip).toHaveBeenCalledWith(6);
            expect(query.limit).toHaveBeenCalledWith(6);
            expect(res.status).toHaveBeenCalledWith(200);
        });

        test("listProducts_error_returns400", async () => {
            // Arrange
            const mockError = new Error("db");
            productModel.find = jest.fn().mockImplementation(() => {
                throw mockError;
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

    // ============ searchProductController ============
    describe("searchProductController", () => {
        test("searchProducts_success_returnsJson", async () => {
            // Arrange
            req.params.keyword = "iph";
            const mockResults = [{ _id: "p1" }];

            const query = {
                select: jest.fn().mockResolvedValue(mockResults),
            };
            productModel.find = jest.fn().mockReturnValue(query);

            // Act
            await searchProductController(req, res);

            // Assert
            expect(productModel.find).toHaveBeenCalledWith({
                $or: [
                    { name: { $regex: "iph", $options: "i" } },
                    { description: { $regex: "iph", $options: "i" } },
                ],
            });
            expect(query.select).toHaveBeenCalledWith("-photo");
            expect(res.json).toHaveBeenCalledWith(mockResults);
        });

        test("searchProducts_error_returns400", async () => {
            // Arrange
            req.params.keyword = "iph";
            const mockError = new Error("db");
            const query = {
                select: jest.fn().mockRejectedValue(mockError),
            };
            productModel.find = jest.fn().mockReturnValue(query);

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

    // ============ realtedProductController ============
    describe("realtedProductController", () => {
        test("relatedProducts_success_returns200", async () => {
            // Arrange
            req.params.pid = "p1";
            req.params.cid = "c1";
            const mockProducts = [{ _id: "p2" }];

            const query = {
                select: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                populate: jest.fn().mockResolvedValue(mockProducts),
            };

            productModel.find = jest.fn().mockReturnValue(query);

            // Act
            await realtedProductController(req, res);

            // Assert
            expect(productModel.find).toHaveBeenCalledWith({
                category: "c1",
                _id: { $ne: "p1" },
            });
            expect(query.select).toHaveBeenCalledWith("-photo");
            expect(query.limit).toHaveBeenCalledWith(3);
            expect(query.populate).toHaveBeenCalledWith("category");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                products: mockProducts,
            });
        });

        test("relatedProducts_error_returns400", async () => {
            // Arrange
            req.params.pid = "p1";
            req.params.cid = "c1";
            const mockError = new Error("db");
            const query = {
                select: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                populate: jest.fn().mockRejectedValue(mockError),
            };
            productModel.find = jest.fn().mockReturnValue(query);

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

    // ============ productCategoryController ============
    describe("productCategoryController", () => {
        test("categoryProducts_success_returns200", async () => {
            // Arrange
            req.params.slug = "electronics";

            const mockCategory = { _id: "c1", slug: "electronics" };
            categoryModel.findOne = jest.fn().mockResolvedValue(mockCategory);

            const mockProducts = [{ _id: "p1" }];
            const query = {
                populate: jest.fn().mockResolvedValue(mockProducts),
            };
            productModel.find = jest.fn().mockReturnValue(query);

            // Act
            await productCategoryController(req, res);

            // Assert
            expect(categoryModel.findOne).toHaveBeenCalledWith({
                slug: "electronics",
            });
            expect(productModel.find).toHaveBeenCalledWith({
                category: mockCategory,
            });
            expect(query.populate).toHaveBeenCalledWith("category");

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                category: mockCategory,
                products: mockProducts,
            });
        });

        test("categoryProducts_error_returns400", async () => {
            // Arrange
            req.params.slug = "electronics";
            const mockError = new Error("db");
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
});
