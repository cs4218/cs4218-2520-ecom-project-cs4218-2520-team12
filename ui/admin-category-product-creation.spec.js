// Snodgrass Eliot Peter, A0269684H

import { test, expect } from "@playwright/test";

/**
 * E2E Test Suite: Admin Category and Product Creation Flow
 *
 * Testing Approach: Black-box End-to-End Testing
 *
 * Rationale:
 * - Validates an admin workflow that spans category management and product creation.
 * - Verifies user-visible outcomes and navigation behavior rather than implementation internals.
 * - Confirms data continuity: newly created category is immediately usable in product creation.
 *
 * Scope:
 * - Admin logs in
 * - Admin creates a new category from Manage Category page
 * - Admin navigates to Create Product page
 * - Admin selects newly created category and creates product
 * - Admin navigates to Products list and verifies product appears
 * - Admin reopens created product to verify category association
 *
 * Acceptance Criteria Coverage:
 * - Admin authentication succeeds
 * - Category creation shows success message
 * - New category appears in product creation dropdown
 * - Product creation succeeds with success message and navigation
 * - Product appears in admin products flow with correct category association
 * - Test runs in CI without manual steps
 */

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

test.describe("Admin Category to Product Creation", () => {
  const adminUser = {
    _id: `admin-${Date.now()}`,
    name: "MS2 Admin",
    email: "admin-ms2@example.com",
    phone: "91234567",
    address: "12 Kent Ridge Drive",
    role: 1,
  };

  const authToken = `admin-token-${Date.now()}`;
  const createdCategoryName = `Electronics ${Date.now()}`;

  const newProductInput = {
    name: `Smart Hub ${Date.now()}`,
    description: `Created under ${createdCategoryName}`,
    price: "349.99",
    quantity: "12",
  };

  test.beforeEach(async ({ page }) => {
    let categoriesState = [
      { _id: "cat-home", name: "Home", slug: "home" },
      { _id: "cat-books", name: "Books", slug: "books" },
    ];

    let productsState = [
      {
        _id: "prod-existing-001",
        name: "Existing Product",
        description: "Existing baseline product",
        slug: "existing-product",
        price: 59,
        quantity: 8,
        shipping: true,
        category: categoriesState[0],
      },
    ];

    let newlyCreatedCategory = null;

    const transparentPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );

    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Login Successfully",
          user: adminUser,
          token: authToken,
        }),
      });
    });

    await page.route("**/api/v1/auth/admin-auth", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.route("**/api/v1/category/get-category", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, category: categoriesState }),
      });
    });

    await page.route("**/api/v1/category/create-category", async (route) => {
      const payload = route.request().postDataJSON();
      const categoryName = (payload?.name || "New Category").trim();

      newlyCreatedCategory = {
        _id: `cat-${slugify(categoryName)}-${Date.now()}`,
        name: categoryName,
        slug: slugify(categoryName),
      };

      categoriesState = [...categoriesState, newlyCreatedCategory];

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Category created successfully",
          category: newlyCreatedCategory,
        }),
      });
    });

    await page.route("**/api/v1/product/create-product", async (route) => {
      const assignedCategory = newlyCreatedCategory ?? categoriesState[0];

      const createdProduct = {
        _id: `prod-${Date.now()}`,
        name: newProductInput.name,
        description: newProductInput.description,
        slug: slugify(newProductInput.name),
        price: Number(newProductInput.price),
        quantity: Number(newProductInput.quantity),
        shipping: true,
        category: assignedCategory,
      };

      productsState = [createdProduct, ...productsState];

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Product Created Successfully",
          products: createdProduct,
        }),
      });
    });

    await page.route("**/api/v1/product/get-product", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, products: productsState }),
      });
    });

    await page.route("**/api/v1/product/get-product/*", async (route) => {
      const slug = route.request().url().split("/").pop();
      const product = productsState.find((item) => item.slug === slug);

      if (!product) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ success: false, message: "Product not found" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, product }),
      });
    });

    await page.route("**/api/v1/product/product-photo/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: transparentPng,
      });
    });
  });

  // Snodgrass Eliot Peter, A0269684H
  test("admin creates category and uses it immediately for product creation", async ({ page }) => {
    /**
     * Scenario:
     * 1) Login as admin
     * 2) Create new category from Manage Category page
     * 3) Navigate to Create Product and confirm new category in dropdown
     * 4) Create product using that category
     * 5) Verify created product appears in products list
     * 6) Open created product and verify category association persisted
     */

    await page.goto("/login");
    await page.getByPlaceholder("Enter Your Email ").fill(adminUser.email);
    await page.getByPlaceholder("Enter Your Password").fill("admin-password");
    await page.getByRole("button", { name: /^LOGIN$/ }).click();

    await expect(page).toHaveURL(/\/$/);

    await page.goto("/dashboard/admin/create-category");
    await expect(page).toHaveURL(/\/dashboard\/admin\/create-category$/);
    await expect(page.getByRole("heading", { name: /Manage Category/i })).toBeVisible();

    await page.getByPlaceholder(/Enter new category/i).fill(createdCategoryName);
    await page.getByRole("button", { name: /^Submit$/ }).click();

    await expect(page.getByText(new RegExp(`${createdCategoryName} is created`, "i"))).toBeVisible();
    await expect(page.locator("tbody tr", { hasText: createdCategoryName }).first()).toBeVisible();

    await page.goto("/dashboard/admin/create-product");
    await expect(page).toHaveURL(/\/dashboard\/admin\/create-product$/);
    await expect(page.getByRole("heading", { name: /Create Product/i })).toBeVisible();

    const categorySelect = page.locator(".ant-select").first();
    await categorySelect.click();
    await expect(page.locator(".ant-select-item-option-content", { hasText: createdCategoryName }).first()).toBeVisible();
    await page.locator(".ant-select-item-option-content", { hasText: createdCategoryName }).first().click();

    await page.getByPlaceholder(/write a name/i).fill(newProductInput.name);
    await page.getByPlaceholder(/write a description/i).fill(newProductInput.description);
    await page.getByPlaceholder(/write a Price/i).fill(newProductInput.price);
    await page.getByPlaceholder(/write a quantity/i).fill(newProductInput.quantity);

    await page.getByRole("button", { name: /CREATE PRODUCT/i }).click();

    await expect(page.getByText(/Product Created Successfully/i)).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/admin\/products$/);

    const productCardLink = page.locator(".product-link", { hasText: newProductInput.name }).first();
    await expect(productCardLink).toBeVisible();
    await expect(page.locator(".card", { hasText: newProductInput.description }).first()).toBeVisible();

    await productCardLink.click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/admin/product/${slugify(newProductInput.name)}$`));

    await expect(page.getByPlaceholder(/write a name/i)).toHaveValue(newProductInput.name);
    await expect(page.locator(".ant-select-selection-item").first()).toContainText(createdCategoryName);
  });

  // Snodgrass Eliot Peter, A0269684H
  test("admin sees category creation failure and category is not available for product creation", async ({
    page,
  }) => {
    /**
     * Scenario:
     * 1) Override category creation API to fail
     * 2) Attempt to create category and verify error message
     * 3) Navigate to Create Product and verify failed category is not selectable
     */

    await page.unroute("**/api/v1/category/create-category");
    await page.route("**/api/v1/category/create-category", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Category creation failed",
        }),
      });
    });

    await page.goto("/login");
    await page.getByPlaceholder("Enter Your Email ").fill(adminUser.email);
    await page.getByPlaceholder("Enter Your Password").fill("admin-password");
    await page.getByRole("button", { name: /^LOGIN$/ }).click();

    await expect(page).toHaveURL(/\/$/);

    await page.goto("/dashboard/admin/create-category");
    await expect(page).toHaveURL(/\/dashboard\/admin\/create-category$/);

    await page.getByPlaceholder(/Enter new category/i).fill(createdCategoryName);
    await page.getByRole("button", { name: /^Submit$/ }).click();

    await expect(page.getByText(/Category creation failed/i)).toBeVisible();
    await expect(page.locator("tbody", { hasText: createdCategoryName })).toHaveCount(0);

    await page.goto("/dashboard/admin/create-product");
    await expect(page).toHaveURL(/\/dashboard\/admin\/create-product$/);

    const categorySelect = page.locator(".ant-select").first();
    await categorySelect.click();
    await expect(
      page.locator(".ant-select-item-option-content", { hasText: createdCategoryName }),
    ).toHaveCount(0);
  });

  // Snodgrass Eliot Peter, A0269684H
  test("admin sees product creation failure after selecting newly created category", async ({
    page,
  }) => {
    /**
     * Scenario:
     * 1) Create a category successfully
     * 2) Override product creation API to fail
     * 3) Attempt to create product with new category
     * 4) Verify error message and no redirect
     * 5) Verify product is not present in products list
     */

    await page.unroute("**/api/v1/product/create-product");
    await page.route("**/api/v1/product/create-product", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Product creation failed",
        }),
      });
    });

    await page.goto("/login");
    await page.getByPlaceholder("Enter Your Email ").fill(adminUser.email);
    await page.getByPlaceholder("Enter Your Password").fill("admin-password");
    await page.getByRole("button", { name: /^LOGIN$/ }).click();

    await expect(page).toHaveURL(/\/$/);

    await page.goto("/dashboard/admin/create-category");
    await page.getByPlaceholder(/Enter new category/i).fill(createdCategoryName);
    await page.getByRole("button", { name: /^Submit$/ }).click();
    await expect(page.getByText(new RegExp(`${createdCategoryName} is created`, "i"))).toBeVisible();

    await page.goto("/dashboard/admin/create-product");
    await expect(page).toHaveURL(/\/dashboard\/admin\/create-product$/);

    const categorySelect = page.locator(".ant-select").first();
    await categorySelect.click();
    await page
      .locator(".ant-select-item-option-content", { hasText: createdCategoryName })
      .first()
      .click();

    await page.getByPlaceholder(/write a name/i).fill(newProductInput.name);
    await page.getByPlaceholder(/write a description/i).fill(newProductInput.description);
    await page.getByPlaceholder(/write a Price/i).fill(newProductInput.price);
    await page.getByPlaceholder(/write a quantity/i).fill(newProductInput.quantity);

    await page.getByRole("button", { name: /CREATE PRODUCT/i }).click();

    await expect(page.getByText(/Product creation failed/i)).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/admin\/create-product$/);

    await page.goto("/dashboard/admin/products");
    await expect(page).toHaveURL(/\/dashboard\/admin\/products$/);
    await expect(page.locator(".product-link", { hasText: newProductInput.name })).toHaveCount(0);
  });
});
