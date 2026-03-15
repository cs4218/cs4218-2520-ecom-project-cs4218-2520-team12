// David Vicedo, A0273234J

/**
 * MS2 Integration Tests - Product Discovery Routes
 *
 * Testing Approach: Route -> Controller -> Model Integration
 *
 * These tests validate product discovery functionality using
 * the real Express routes, controllers, mongoose models,
 * and MongoDB database.
 *
 * Routes Covered
 * - /product-count
 * - /product-list/:page
 * - /search/:keyword
 * - /related-product/:pid/:cid
 */

import request from "supertest";
import mongoose from "mongoose";
import app from "../../server.js";
import categoryModel from "../../models/categoryModel.js";
import productModel from "../../models/productModel.js";

const TEST_PREFIX = "ms2-product-discovery-int";
const TEST_DB_NAME = `ms2pd-${Date.now()}`;

const makeSlug = (label) =>
    `${TEST_PREFIX}-${label}-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2, 8)}`;

const cleanupSeedData = async () => {
    await productModel.deleteMany({ slug: { $regex: `^${TEST_PREFIX}` } });
    await categoryModel.deleteMany({ slug: { $regex: `^${TEST_PREFIX}` } });
};

const seedProductDiscoveryData = async () => {
    const categoryA = await categoryModel.create({
        name: `${TEST_PREFIX}-Category-A`,
        slug: makeSlug("category-a"),
    });

    const categoryB = await categoryModel.create({
        name: `${TEST_PREFIX}-Category-B`,
        slug: makeSlug("category-b"),
    });

    const product1 = await productModel.create({
        name: "iPhone Alpha",
        slug: makeSlug("iphone-alpha"),
        description: "A premium iphone product for integration testing",
        price: 999,
        category: categoryA._id,
        quantity: 25,
        shipping: true,
    });

    const product2 = await productModel.create({
        name: "Laptop Pro",
        slug: makeSlug("laptop-pro"),
        description: "A high-performance laptop in category A",
        price: 1499,
        category: categoryA._id,
        quantity: 15,
        shipping: true,
    });

    const product3 = await productModel.create({
        name: "Headphones Max",
        slug: makeSlug("headphones-max"),
        description: "Noise-cancelling headphones in category B",
        price: 299,
        category: categoryB._id,
        quantity: 40,
        shipping: true,
    });

    return { categoryA, categoryB, product1, product2, product3 };
};

describe("MS2 Integration - Product Discovery Routes", () => {
    let seededData;

    beforeAll(async () => {
        if (!process.env.MONGO_URL) {
            throw new Error("MONGO_URL must be defined for integration tests.");
        }

        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }

        await mongoose.connect(process.env.MONGO_URL, {
            dbName: TEST_DB_NAME,
        });
    });

    beforeEach(async () => {
        await cleanupSeedData();
        seededData = await seedProductDiscoveryData();
    });

    afterAll(async () => {
        await cleanupSeedData();
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });

    // David Vicedo, A0273234J
    test("GET /api/v1/product/product-count returns total product count", async () => {
        // Arrange
        const minimumExpectedTotal = 3;

        // Act
        const response = await request(app).get(
            "/api/v1/product/product-count",
        );

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("total");
        expect(typeof response.body.total).toBe("number");
        expect(response.body.total).toBeGreaterThanOrEqual(
            minimumExpectedTotal,
        );
    });

    // David Vicedo, A0273234J
    test("GET /api/v1/product/product-list/1 returns paginated products", async () => {
        // Arrange
        const route = "/api/v1/product/product-list/1";

        // Act
        const response = await request(app).get(route);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("products");
        expect(Array.isArray(response.body.products)).toBe(true);
        expect(response.body.products.length).toBeGreaterThan(0);

        response.body.products.forEach((product) => {
            expect(product).toHaveProperty("name");
            expect(product).toHaveProperty("price");
        });
    });

    // David Vicedo, A0273234J
    test("GET /api/v1/product/product-list/1 returns an empty array when dataset is empty", async () => {
        // Arrange
        await productModel.deleteMany({});

        // Act
        const response = await request(app).get(
            "/api/v1/product/product-list/1",
        );

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.products)).toBe(true);
        expect(response.body.products.length).toBe(0);
    });

    // David Vicedo, A0273234J
    test("GET /api/v1/product/search/iphone returns matching products", async () => {
        // Arrange
        const keyword = "iphone";

        // Act
        const response = await request(app).get(
            `/api/v1/product/search/${keyword}`,
        );

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);

        const hasKeywordMatch = response.body.some((product) => {
            const name = String(product.name || "");
            const description = String(product.description || "");
            return (
                name.toLowerCase().includes(keyword) ||
                description.toLowerCase().includes(keyword)
            );
        });

        expect(hasKeywordMatch).toBe(true);
    });

    // David Vicedo, A0273234J
    test("GET /api/v1/product/search/nonexistentkeyword returns no results", async () => {
        // Arrange
        const keyword = `nonexistentkeyword-${Date.now()}`;

        // Act
        const response = await request(app).get(
            `/api/v1/product/search/${keyword}`,
        );

        // Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(0);
    });

    // David Vicedo, A0273234J
    test("GET /api/v1/product/related-product/:pid/:cid returns related products in the same category", async () => {
        // Arrange
        const sourceProduct = seededData.product1;
        const sourceProductId = String(sourceProduct._id);
        const sourceCategoryId = String(seededData.categoryA._id);

        // Act
        const response = await request(app).get(
            `/api/v1/product/related-product/${sourceProductId}/${sourceCategoryId}`,
        );

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("products");
        expect(Array.isArray(response.body.products)).toBe(true);
        expect(response.body.products.length).toBeGreaterThan(0);

        response.body.products.forEach((product) => {
            const categoryId =
                product.category && typeof product.category === "object"
                    ? String(product.category._id || product.category)
                    : String(product.category);

            expect(categoryId).toBe(sourceCategoryId);
            expect(String(product._id)).not.toBe(sourceProductId);
        });
    });
});
