// David Vicedo, A0273234J

/**
 * MS2 UI End-to-End Tests - Browse to Product Details Flow
 *
 * Testing Approach: Black-box End-to-End Testing
 *
 * Rationale
 * This test validates a real user journey in a browser using the live
 * frontend and backend stack. It verifies navigation and rendered outcomes
 * only, without relying on internal implementation details.
 *
 * Scope
 * - browse products on the homepage
 * - open a product details page
 * - validate product details and related products section
 * - navigate to a related product details page
 *
 * Key Assertions
 * - URL updates to product detail routes
 * - product details UI is visible
 * - related products UI is visible
 * - related-product navigation leads to a different product details route
 *
 * Environment Requirements
 * - frontend server running
 * - backend server running
 * - database seeded with products and categories
 */
import { test, expect, type Locator, type Page } from "@playwright/test";

const HOME_PATH = "/";
const PRODUCT_PATH_REGEX = /\/product\/[^/]+$/;
const MAX_PRODUCTS_TO_TRY = 6;

const category = { _id: "cat-001", name: "Phones", slug: "phones" };
const productA = {
    _id: "prod-001",
    name: "Phone Alpha",
    slug: "phone-alpha",
    description: "Flagship phone alpha model for deterministic e2e tests",
    price: 899,
    category,
};
const productB = {
    _id: "prod-002",
    name: "Phone Beta",
    slug: "phone-beta",
    description: "Flagship phone beta model for deterministic e2e tests",
    price: 799,
    category,
};

const normalizeName = (value: string): string => value.trim().toLowerCase();

const extractNameValue = (nameLineText: string): string => {
    const text = nameLineText.trim();
    const match = text.match(/^Name\s*:\s*(.*)$/i);
    return (match?.[1] ?? text.replace(/^Name\s*:/i, "")).trim();
};

const readCurrentProductNameOnce = async (page: Page): Promise<string> => {
    const nameLine = page
        .locator(".product-details-info h6")
        .filter({ hasText: /^Name\s*:/i })
        .first();

    await expect(nameLine).toBeVisible();
    return extractNameValue(await nameLine.innerText());
};

const readCurrentProductName = async (
    page: Page,
    timeout = 7000,
): Promise<string> => {
    let productName = "";

    try {
        await expect
            .poll(
                async () => {
                    productName = await readCurrentProductNameOnce(page);
                    return productName;
                },
                { timeout },
            )
            .not.toBe("");
    } catch {
        return "";
    }

    return productName;
};

const waitForSpecificProductName = async (
    page: Page,
    expectedName: string,
    timeout = 7000,
): Promise<string> => {
    let productName = "";

    await expect
        .poll(
            async () => {
                productName = await readCurrentProductNameOnce(page);
                return normalizeName(productName);
            },
            { timeout },
        )
        .toBe(normalizeName(expectedName));

    return productName;
};

const readCardName = async (card: Locator): Promise<string> => {
    const cardNameHeading = card.getByRole("heading").first();
    await expect(cardNameHeading).toBeVisible();
    return (await cardNameHeading.innerText()).trim();
};

test.describe("MS2 - Browse to Product Details flow", () => {
    test.beforeEach(async ({ page }) => {
        await page.route("**/api/v1/category/get-category", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ success: true, category: [category] }),
            });
        });

        await page.route("**/api/v1/product/product-count", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ total: 2 }),
            });
        });

        await page.route("**/api/v1/product/product-list/*", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ success: true, products: [productA, productB] }),
            });
        });

        await page.route("**/api/v1/product/get-product/*", async (route) => {
            const slug = route.request().url().split("/").pop();
            const product = slug === productB.slug ? productB : productA;
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ success: true, product }),
            });
        });

        await page.route("**/api/v1/product/related-product/**", async (route) => {
            const url = route.request().url();
            const products = url.includes(productA._id) ? [productB] : [productA];
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ success: true, products }),
            });
        });

        await page.route("**/api/v1/product/product-photo/*", async (route) => {
            const png = Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "base64",
            );
            await route.fulfill({
                status: 200,
                contentType: "image/png",
                body: png,
            });
        });
    });

    /**
     * Test Case: Browse from Home to Product Details to Related Product Details
     *
     * Scenario
     * A user browses products from the homepage, opens one product details page,
     * and continues exploration via a related product.
     *
     * Steps
     * 1. Open homepage and verify products are visible.
     * 2. Open a product details page using More Details.
     * 3. Verify product details and related products section.
     * 4. Open a related product using More Details.
     * 5. Verify URL and details page update to the related product.
     *
     * Expected Behaviour
     * - navigation proceeds from home to product details routes
     * - product details content is visible
     * - related product navigation updates route and rendered product details
     */
    // David Vicedo, A0273234J
    test("navigates from homepage to product details and then to a related product", async ({
        page,
    }) => {
        // Arrange
        await page.goto(HOME_PATH);

        const homeHeading = page.getByRole("heading", {
            name: /All Products/i,
        });
        await expect(homeHeading).toBeVisible();

        const homeMoreDetailsButtons = page.getByRole("button", {
            name: /^More Details$/i,
        });
        await expect(homeMoreDetailsButtons.first()).toBeVisible();

        // Act: Home -> Product Details
        await homeMoreDetailsButtons.first().click();
        await expect(page).toHaveURL(PRODUCT_PATH_REGEX);

        const detailsHeading = page.getByRole("heading", {
            name: /^Product Details$/i,
        });
        const detailsSection = page.locator(".product-details-info");
        const relatedSection = page.locator(".similar-products");

        await expect(detailsHeading).toBeVisible();
        await expect(detailsSection).toBeVisible();
        await expect(relatedSection).toBeVisible();

        const firstDetailsPathname = new URL(page.url()).pathname;
        const firstProductName = await readCurrentProductName(page);
        expect(firstProductName).not.toEqual("");

        // Act: Product Details -> Related Product Details
        const relatedMoreDetailsButton = relatedSection
            .locator(".card")
            .first()
            .getByRole("button", { name: /^More Details$/i });

        await expect(relatedMoreDetailsButton).toBeVisible();
        await relatedMoreDetailsButton.click();

        // Assert
        await expect(page).toHaveURL(PRODUCT_PATH_REGEX);
        const secondDetailsPathname = new URL(page.url()).pathname;
        expect(secondDetailsPathname).not.toBe(firstDetailsPathname);
        await expect(detailsHeading).toBeVisible();

        const secondProductName = await readCurrentProductName(page);
        expect(secondProductName).not.toEqual("");
        expect(normalizeName(secondProductName)).not.toBe(
            normalizeName(firstProductName),
        );
    });
});
