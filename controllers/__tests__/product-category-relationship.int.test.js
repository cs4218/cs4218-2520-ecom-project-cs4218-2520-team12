// Eliot Snodgrass, A0269684H

/**
 * MS2 Integration Tests — Product-Category Relationship Integrity
 *
 * Testing Approach: Route -> Controller integration with mocked model responses
 *
 * Modules integrated
 * - Product routes/controllers
 * - Category routes/controllers
 * - Model boundary mocked to remove external DB/network dependency
 *
 * Core relationship paths covered
 * - get-product/:slug returns product with populated category
 * - update-product/:pid can change category relationship
 * - update-category/:id propagates category name/slug to product displays via populate
 * - delete-category/:id leaves product accessible and relationship handling is graceful
 */

jest.mock("braintree", () => ({
    BraintreeGateway: jest.fn(function BraintreeGatewayMock() {
        return {};
    }),
    Environment: {
        Sandbox: "sandbox",
    },
}));

jest.mock("../../models/categoryModel.js", () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
        find: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        findByIdAndDelete: jest.fn(),
    },
}));

jest.mock("../../models/productModel.js", () => ({
    __esModule: true,
    default: {
        findOne: jest.fn(),
        find: jest.fn(),
        findByIdAndUpdate: jest.fn(),
    },
}));

import express from "express";
import formidable from "express-formidable";
import request from "supertest";
import slugify from "slugify";

import {
    categoryControlller,
    deleteCategoryCOntroller,
    updateCategoryController,
} from "../categoryController.js";
import {
    getSingleProductController,
    productCategoryController,
    updateProductController,
} from "../productController.js";

import categoryModel from "../../models/categoryModel.js";
import productModel from "../../models/productModel.js";

const TEST_PREFIX = "ms2-product-category-relationship";

const app = express();
app.use(express.json());
app.get("/api/v1/product/get-product/:slug", getSingleProductController);
app.put(
    "/api/v1/product/update-product/:pid",
    formidable(),
    updateProductController,
);
app.get("/api/v1/product/product-category/:slug", productCategoryController);
app.put("/api/v1/category/update-category/:id", updateCategoryController);
app.get("/api/v1/category/get-category", categoryControlller);
app.delete("/api/v1/category/delete-category/:id", deleteCategoryCOntroller);

const makeCategory = (id, name) => ({ _id: id, name, slug: slugify(name) });

describe("MS2 Integration - Product Category Relationship", () => {
    let seeded;
    let categoriesById;
    let product;

    const getCategoryBySlug = (slug) =>
        Object.values(categoriesById).find((category) => category.slug === slug) || null;

    const getPopulatedProduct = () => ({
        ...product,
        category: categoriesById[product.category] || null,
    });

    beforeEach(() => {
        jest.clearAllMocks();

        const categoryOne = makeCategory("cat-1", `${TEST_PREFIX} Category One`);
        const categoryTwo = makeCategory("cat-2", `${TEST_PREFIX} Category Two`);

        categoriesById = {
            [categoryOne._id]: { ...categoryOne },
            [categoryTwo._id]: { ...categoryTwo },
        };

        product = {
            _id: "prod-1",
            slug: `${TEST_PREFIX}-product-alpha`,
            name: `${TEST_PREFIX} Product Alpha`,
            description: "Relationship integrity product",
            price: 100,
            category: categoryOne._id,
            quantity: 5,
            shipping: true,
            photo: {},
        };

        seeded = {
            categoryOne: { ...categoryOne },
            categoryTwo: { ...categoryTwo },
            product: { ...product },
        };

        categoryModel.findOne.mockImplementation(async (query) => {
            if (query?.slug) {
                return getCategoryBySlug(query.slug);
            }
            if (query?.name) {
                return (
                    Object.values(categoriesById).find((category) => category.name === query.name) ||
                    null
                );
            }
            return null;
        });

        categoryModel.findByIdAndUpdate.mockImplementation(async (id, update) => {
            const existingCategory = categoriesById[id];
            if (!existingCategory) {
                return null;
            }

            const updatedCategory = {
                ...existingCategory,
                ...update,
            };

            categoriesById[id] = updatedCategory;
            return updatedCategory;
        });

        categoryModel.find.mockImplementation(async () => Object.values(categoriesById));

        categoryModel.findByIdAndDelete.mockImplementation(async (id) => {
            const existingCategory = categoriesById[id] || null;
            delete categoriesById[id];
            return existingCategory;
        });

        productModel.findOne.mockImplementation((query) => ({
            select: jest.fn().mockReturnValue({
                populate: jest.fn().mockResolvedValue(
                    query?.slug === product.slug ? getPopulatedProduct() : null,
                ),
            }),
        }));

        productModel.findByIdAndUpdate.mockImplementation(async (id, payload) => {
            if (id !== product._id) {
                return null;
            }

            product = {
                ...product,
                ...payload,
            };

            return {
                ...product,
                photo: product.photo || {},
                save: jest.fn().mockResolvedValue(true),
            };
        });

        productModel.find.mockImplementation((query) => {
            const rawCategory = query?.category;
            const categoryId =
                rawCategory && typeof rawCategory === "object"
                    ? String(rawCategory._id)
                    : rawCategory
                      ? String(rawCategory)
                      : null;

            const shouldReturnProduct =
                !!categoryId &&
                !!categoriesById[categoryId] &&
                String(product.category) === String(categoryId);

            const products = shouldReturnProduct ? [getPopulatedProduct()] : [];

            return {
                populate: jest.fn().mockResolvedValue(products),
            };
        });
    });

    // Eliot Snodgrass, A0269684H
    test("UpdateProduct fetch flow: GET /get-product/:slug returns populated category and usable current selection id", async () => {
        const response = await request(app).get(
            `/api/v1/product/get-product/${seeded.product.slug}`,
        );

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.product).toHaveProperty("category");
        expect(typeof response.body.product.category).toBe("object");
        expect(String(response.body.product.category._id)).toBe(
            String(seeded.categoryOne._id),
        );
        expect(response.body.product.category.name).toBe(seeded.categoryOne.name);
    });

    // Eliot Snodgrass, A0269684H
    test("Changing product category via /update-product/:pid updates relationship in database", async () => {
        const updatedName = `${seeded.product.name} Updated`;

        const updateResponse = await request(app)
            .put(`/api/v1/product/update-product/${seeded.product._id}`)
            .field("name", updatedName)
            .field("description", "Updated description")
            .field("price", "150")
            .field("quantity", "7")
            .field("category", String(seeded.categoryTwo._id));

        expect(updateResponse.status).toBe(201);
        expect(updateResponse.body.success).toBe(true);

        expect(String(product.category)).toBe(String(seeded.categoryTwo._id));

        const fetched = await request(app).get(
            `/api/v1/product/get-product/${updateResponse.body.products.slug}`,
        );

        expect(fetched.status).toBe(200);
        expect(String(fetched.body.product.category._id)).toBe(
            String(seeded.categoryTwo._id),
        );
        expect(fetched.body.product.category.name).toBe(seeded.categoryTwo.name);
    });

    // Eliot Snodgrass, A0269684H
    test("Category name update propagates to product displays and slug consistency is maintained", async () => {
        const renamedCategoryName = `${seeded.categoryOne.name} Renamed`;
        const expectedSlug = slugify(renamedCategoryName);

        const categoryUpdateResponse = await request(app)
            .put(`/api/v1/category/update-category/${seeded.categoryOne._id}`)
            .send({ name: renamedCategoryName });

        expect(categoryUpdateResponse.status).toBe(200);
        expect(categoryUpdateResponse.body.success).toBe(true);
        expect(categoryUpdateResponse.body.category.slug).toBe(expectedSlug);

        const productResponse = await request(app).get(
            `/api/v1/product/get-product/${seeded.product.slug}`,
        );

        expect(productResponse.status).toBe(200);
        expect(productResponse.body.product.category.name).toBe(renamedCategoryName);
        expect(productResponse.body.product.category.slug).toBe(expectedSlug);

        const categoryWiseProducts = await request(app).get(
            `/api/v1/product/product-category/${expectedSlug}`,
        );

        expect(categoryWiseProducts.status).toBe(200);
        expect(categoryWiseProducts.body.success).toBe(true);
        expect(categoryWiseProducts.body.category.slug).toBe(expectedSlug);
        expect(Array.isArray(categoryWiseProducts.body.products)).toBe(true);
        expect(categoryWiseProducts.body.products.length).toBeGreaterThan(0);
        expect(
            categoryWiseProducts.body.products.some(
                (oneProduct) => String(oneProduct._id) === String(seeded.product._id),
            ),
        ).toBe(true);
    });

    // Eliot Snodgrass, A0269684H
    test("Category dropdown source (/get-category) reflects category name changes and deletions", async () => {
        const renamedCategoryName = `${seeded.categoryTwo.name} Updated`;

        const renameResponse = await request(app)
            .put(`/api/v1/category/update-category/${seeded.categoryTwo._id}`)
            .send({ name: renamedCategoryName });

        expect(renameResponse.status).toBe(200);

        const deleteResponse = await request(app).delete(
            `/api/v1/category/delete-category/${seeded.categoryOne._id}`,
        );

        expect(deleteResponse.status).toBe(200);

        const categoriesResponse = await request(app).get(
            "/api/v1/category/get-category",
        );

        expect(categoriesResponse.status).toBe(200);
        expect(categoriesResponse.body.success).toBe(true);

        const returnedNames = categoriesResponse.body.category.map((category) => category.name);
        expect(returnedNames).toContain(renamedCategoryName);
        expect(returnedNames).not.toContain(seeded.categoryOne.name);
    });

    // Eliot Snodgrass, A0269684H
    test("Category deletion handling is graceful for related products", async () => {
        const deleteResponse = await request(app).delete(
            `/api/v1/category/delete-category/${seeded.categoryOne._id}`,
        );

        expect(deleteResponse.status).toBe(200);

        const productAfterCategoryDelete = await request(app).get(
            `/api/v1/product/get-product/${seeded.product.slug}`,
        );

        expect(productAfterCategoryDelete.status).toBe(200);
        expect(productAfterCategoryDelete.body.success).toBe(true);
        expect(productAfterCategoryDelete.body.product).toHaveProperty("name");

        const categoryScopedQuery = await request(app).get(
            `/api/v1/product/product-category/${seeded.categoryOne.slug}`,
        );

        expect(categoryScopedQuery.status).toBe(200);
        expect(categoryScopedQuery.body.success).toBe(true);
        expect(categoryScopedQuery.body.category).toBeNull();
        expect(Array.isArray(categoryScopedQuery.body.products)).toBe(true);
        expect(categoryScopedQuery.body.products.length).toBe(0);
    });
});