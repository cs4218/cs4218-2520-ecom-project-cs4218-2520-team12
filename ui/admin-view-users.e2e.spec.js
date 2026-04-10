import { test, expect } from "@playwright/test";

const adminUser = {
  _id: "admin-001",
  name: "Admin Tester",
  email: "admin.tester@example.com",
  phone: "81110000",
  address: "Admin Street",
  role: 1,
};

test.describe("MS2 E2E - Admin View Users", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/category/get-category", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, category: [] }),
      });
    });

    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Login Success",
          user: adminUser,
          token: "admin-token",
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
  });

  // Wong An Wei, A0273528X
  test("admin logs in, opens dashboard users page, and sees users view", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByPlaceholder(/Enter Your Email/i).fill(adminUser.email);
    await page.getByPlaceholder("Enter Your Password").fill("admin-password");
    await page.getByRole("button", { name: /login/i }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(adminUser.name)).toBeVisible();

    await page.goto("/dashboard/admin/users");

    await expect(page).toHaveURL(/\/dashboard\/admin\/users$/);
    await expect(page.getByRole("heading", { name: /all users/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /admin panel/i })).toBeVisible();
  });

  // Wong An Wei, A0273528X
  test("non-admin auth result blocks admin users route and redirects to login", async ({
    page,
  }) => {
    await page.route("**/api/v1/auth/admin-auth", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: false }),
      });
    });

    await page.goto("/login");
    await page.getByPlaceholder(/Enter Your Email/i).fill(adminUser.email);
    await page.getByPlaceholder("Enter Your Password").fill("admin-password");
    await page.getByRole("button", { name: /login/i }).click();

    await page.goto("/dashboard/admin/users");

    await expect(page.getByText(/redirecting to you in/i)).toBeVisible();
      await expect(page).toHaveURL(/\/login$/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: /login form/i })).toBeVisible();
  });

  // ADDED - MS3 upgrade
  test("unauthenticated deep-link to admin users route redirects to login", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("auth");
    });

    await page.goto("/dashboard/admin/users");

    await expect(page.getByText(/redirecting to you in/i)).toBeVisible();
      await expect(page).toHaveURL(/\/login$/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: /all users/i })).toHaveCount(0);
  });
});
