// Snodgrass Eliot Peter, A0269684H

import { test, expect } from "@playwright/test";

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const formatPriceForInput = (value) => String(Number(value));

test.describe("Admin Product Update Persistence", () => {
  const adminUser = {
    _id: `admin-${Date.now()}`,
    name: "MS2 Admin",
    email: "admin-ms2@example.com",
    phone: "91234567",
    address: "12 Kent Ridge Drive",
    role: 1,
  };

  const authToken = `admin-token-${Date.now()}`;

  const categories = [
    { _id: "cat-electronics", name: "Electronics", slug: "electronics" },
    { _id: "cat-home", name: "Home Appliances", slug: "home-appliances" },
    { _id: "cat-books", name: "Books", slug: "books" },
  ];

  const originalProduct = {
    _id: "prod-admin-001",
    name: "Legacy Blender",
    description: "High-speed kitchen blender",
    slug: "legacy-blender",
    price: 89,
    quantity: 20,
    shipping: true,
    category: categories[0],
  };

  const secondProduct = {
    _id: "prod-admin-002",
    name: "Compact Speaker",
    description: "Portable bluetooth speaker",
    slug: "compact-speaker",
    price: 59,
    quantity: 30,
    shipping: true,
    category: categories[0],
  };

  const updatedFields = {
    name: "Precision Blender Pro",
    price: "1299.50",
    category: categories[1],
  };

  test.beforeEach(async ({ page }) => {
    let productsState = [
      { ...originalProduct },
      { ...secondProduct },
    ];

    const findProductBySlug = (slug) =>
      productsState.find((product) => product.slug === slug);

    const findProductById = (id) => productsState.find((product) => product._id === id);

    await page.route("**/api/v1/category/get-category", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, category: categories }),
      });
    });

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

    await page.route("**/api/v1/product/get-product", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          products: productsState,
        }),
      });
    });

    await page.route("**/api/v1/product/get-product/*", async (route) => {
      const slug = route.request().url().split("/").pop();
      const product = findProductBySlug(slug);

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
        body: JSON.stringify({
          success: true,
          product,
        }),
      });
    });

    await page.route("**/api/v1/product/update-product/*", async (route) => {
      const id = route.request().url().split("/").pop();
      const product = findProductById(id);

      if (!product) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ success: false, message: "Product not found" }),
        });
        return;
      }

      const nextSlug = slugify(updatedFields.name);
      const nextCategory = categories.find(
        (category) => category._id === updatedFields.category._id,
      );

      productsState = productsState.map((existingProduct) => {
        if (existingProduct._id !== id) {
          return existingProduct;
        }

        return {
          ...existingProduct,
          name: updatedFields.name,
          slug: nextSlug,
          price: Number(updatedFields.price),
          category: nextCategory,
        };
      });

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Product Updated Successfully",
          products: findProductById(id),
        }),
      });
    });

    await page.route("**/api/v1/product/product-photo/*", async (route) => {
      const transparentPng = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );

      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: transparentPng,
      });
    });
  });

  // Snodgrass Eliot Peter, A0269684H
  test("admin updates product details and sees persisted values on reopen", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByPlaceholder("Enter Your Email ").fill(adminUser.email);
    await page.getByPlaceholder("Enter Your Password").fill("admin-password");
    await page.getByRole("button", { name: /^LOGIN$/ }).click();

    await expect(page).toHaveURL(/\/$/);

    await page.goto("/dashboard/admin");
    await expect(page).toHaveURL(/\/dashboard\/admin$/);

    await page.getByRole("link", { name: /^Products$/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/admin\/products$/);
    await expect(page.getByRole("heading", { name: /All Products List/i })).toBeVisible();

    await expect(page.locator(".product-link", { hasText: originalProduct.name }).first()).toBeVisible();
    await page.locator(".product-link", { hasText: originalProduct.name }).first().click();

    await expect(page).toHaveURL(/\/dashboard\/admin\/product\/legacy-blender$/);
    await expect(page.getByRole("heading", { name: /Update Product/i })).toBeVisible();

    const nameInput = page.getByPlaceholder(/write a name/i);
    const priceInput = page.getByPlaceholder(/write a Price/i);

    await expect(nameInput).toHaveValue(originalProduct.name);
    await expect(priceInput).toHaveValue(formatPriceForInput(originalProduct.price));

    await nameInput.fill(updatedFields.name);
    await priceInput.fill(updatedFields.price);

    const categorySelect = page.locator(".ant-select").first();
    await categorySelect.click();
    await page.locator(".ant-select-item-option-content", { hasText: updatedFields.category.name }).first().click();

    await page.getByRole("button", { name: /UPDATE PRODUCT/i }).click();

    await expect(page.getByText(/Product Updated Successfully/i)).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/admin\/products$/);

    const updatedProductLink = page.locator(".product-link", { hasText: updatedFields.name }).first();
    await expect(updatedProductLink).toBeVisible();
    await updatedProductLink.click();

    await expect(page).toHaveURL(new RegExp(`/dashboard/admin/product/${slugify(updatedFields.name)}$`));
    await expect(nameInput).toHaveValue(updatedFields.name);
    expect(Number(await priceInput.inputValue())).toBeCloseTo(Number(updatedFields.price), 2);

    await expect(page.locator(".ant-select-selection-item").first()).toContainText(updatedFields.category.name);

    const currentPriceValue = await priceInput.inputValue();
    expect(currentPriceValue).toMatch(/^\d+(\.\d{1,2})?$/);
  });

  // Snodgrass Eliot Peter, A0269684H
  test("admin sees update error and original product remains unchanged", async ({
    page,
  }) => {
    await page.unroute("**/api/v1/product/update-product/*");
    await page.route("**/api/v1/product/update-product/*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Unable to update product",
        }),
      });
    });

    await page.goto("/login");
    await page.getByPlaceholder("Enter Your Email ").fill(adminUser.email);
    await page.getByPlaceholder("Enter Your Password").fill("admin-password");
    await page.getByRole("button", { name: /^LOGIN$/ }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/dashboard/admin/products");
    await expect(page).toHaveURL(/\/dashboard\/admin\/products$/);

    const originalProductLink = page.locator(".product-link", { hasText: originalProduct.name }).first();
    await expect(originalProductLink).toBeVisible();
    await originalProductLink.click();

    await expect(page).toHaveURL(/\/dashboard\/admin\/product\/legacy-blender$/);

    const nameInput = page.getByPlaceholder(/write a name/i);
    const priceInput = page.getByPlaceholder(/write a Price/i);

    await nameInput.fill("Failed Update Name");
    await priceInput.fill("777.77");

    await page.getByRole("button", { name: /UPDATE PRODUCT/i }).click();

    await expect(page.getByText(/Unable to update product/i)).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/admin\/product\/legacy-blender$/);

    await page.goto("/dashboard/admin/products");
    await expect(page).toHaveURL(/\/dashboard\/admin\/products$/);

    const reopenedOriginalLink = page.locator(".product-link", { hasText: originalProduct.name }).first();
    await expect(reopenedOriginalLink).toBeVisible();
    await reopenedOriginalLink.click();

    await expect(page).toHaveURL(/\/dashboard\/admin\/product\/legacy-blender$/);
    await expect(nameInput).toHaveValue(originalProduct.name);
    await expect(priceInput).toHaveValue(formatPriceForInput(originalProduct.price));
    await expect(page.locator(".ant-select-selection-item").first()).toContainText(originalProduct.category.name);
  });
});
