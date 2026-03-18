import { test, expect } from "@playwright/test";

const mockCommonEndpoints = async (page) => {
  await page.route("**/api/v1/category/get-category", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, category: [] }),
    });
  });
};

test.describe("MS2 E2E - Protected Routes", () => {
  // Wong An Wei, A0273528X
  test("unauthenticated user is redirected to login when opening user dashboard route", async ({
    page,
  }) => {
    await mockCommonEndpoints(page);
    await page.goto("/dashboard/user");

    await expect(page.getByText(/redirecting to you in/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: /login form/i })).toBeVisible();
  });

  // Wong An Wei, A0273528X
  test("authenticated user can access protected profile route", async ({
    page,
  }) => {
    await mockCommonEndpoints(page);

    await page.addInitScript(() => {
      localStorage.setItem(
        "auth",
        JSON.stringify({
          user: {
            name: "Protected User",
            email: "protected@example.com",
            phone: "88888888",
            address: "Test Address",
            role: 0,
          },
          token: "user-token",
        })
      );
    });

    await page.route("**/api/v1/auth/user-auth", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/dashboard/user/profile");

    await expect(page).toHaveURL(/\/dashboard\/user\/profile$/);
    await expect(page.getByRole("heading", { name: /user profile/i })).toBeVisible();
    await expect(page.getByPlaceholder("Enter Your Name")).toHaveValue("Protected User");
  });

  // Wong An Wei, A0273528X
  test("authenticated token with failed auth check is redirected to login", async ({
    page,
  }) => {
    await mockCommonEndpoints(page);

    await page.addInitScript(() => {
      localStorage.setItem(
        "auth",
        JSON.stringify({
          user: {
            name: "Protected User",
            email: "protected@example.com",
            phone: "88888888",
            address: "Test Address",
            role: 0,
          },
          token: "expired-user-token",
        })
      );
    });

    await page.route("**/api/v1/auth/user-auth", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: false }),
      });
    });

    await page.goto("/dashboard/user/profile");

    await expect(page.getByText(/redirecting to you in/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: /login form/i })).toBeVisible();
  });
});
