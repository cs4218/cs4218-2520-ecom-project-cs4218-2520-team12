// Amos Chee Tian Ee, A0273476U

/**
 * MS2 UI End-to-End Tests - User Menu Navigation
 *
 * Testing Approach: Black-box End-to-End Testing with Mocked APIs
 *
 * Rationale
 * This test validates the user menu functionality and route navigation for
 * authenticated users using mocked authentication. By mocking the login API,
 * the test reliably validates menu interactions and navigation without depending
 * on a live backend.
 *
 * Scope
 * - Set up authenticated user via mocked auth
 * - User menu/profile button is visible in header
 * - User can click to open dropdown menu
 * - Menu displays navigation options (Dashboard, Logout)
 * - Clicking menu items navigates to correct routes
 * - Logout clears auth state
 *
 * Key Assertions
 * - User menu button is visible and clickable
 * - Menu dropdown contains Dashboard and Logout links
 * - Profile link navigates to /dashboard/user/profile
 * - Orders link navigates to /dashboard/user/orders
 * - Logout option is available in menu
 * - Clicking logout removes auth and shows unauthenticated header
 *
 */

import { test, expect } from "@playwright/test";

const LOGIN_PATH = "/login";
const HOME_PATH = "/";
const PROFILE_PATH = "/dashboard/user/profile";
const ORDERS_PATH = "/dashboard/user/orders";
const TEST_PASSWORD = "SomePassword123!";

test.describe("User Menu Navigation and Interactions", () => {
  // Mock authenticated user
  const mockUser = {
    name: "Test Menu User",
    email: `test@example.com`,
    phone: "1234567890",
    address: "123 Test Street",
    role: 0
  };
  
  const mockAuthToken = "mock-jwt-token-" + Date.now();

  test.beforeEach(async ({ page }) => {
    // Mock login endpoint and authenticate via UI (black-box setup)
    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Login successful",
          user: mockUser,
          token: mockAuthToken,
        }),
      });
    });

    // Protected routes validate auth token via this endpoint.
    await page.route("**/api/v1/auth/user-auth", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto(LOGIN_PATH);
    await page.getByLabel("Email").fill(mockUser.email);
    await page.getByLabel("Password").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /login/i }).click();
    await expect(page).toHaveURL(HOME_PATH, { timeout: 5000 });

    // Ensure tests begin from home page in authenticated state
    await page.goto(HOME_PATH);
  });

  test("User menu button is visible and can be opened", async ({ page }) => {
    // Arrange: Goto home page (already there from beforeEach)
    await page.goto(HOME_PATH);

    // Act & Assert: User menu button is visible
    const userMenuButton = page.getByRole("button", { name: mockUser.name }).first();

    await expect(userMenuButton).toBeVisible();

    // Act: Click to open menu
    await userMenuButton.click();

    // Assert: Header dropdown items appear
    const dashboardLink = page.getByRole("link", { name: /dashboard/i }).first();
    const logoutLink = page.getByRole("link", { name: /logout/i }).first();

    await expect(dashboardLink).toBeVisible({ timeout: 5000 });
    await expect(logoutLink).toBeVisible({ timeout: 5000 });
  });

  test("Clicking Profile link in menu navigates to profile page", async ({
    page,
  }) => {
    // Arrange: Ensure we're on home page
    await page.goto(HOME_PATH);

    // Act: Open user menu
    const userMenuButton = page.getByRole("button", { name: mockUser.name }).first();
    await userMenuButton.click();

    // Act: Navigate to dashboard, then open profile from dashboard menu
    const dashboardLink = page.getByRole("link", { name: /dashboard/i }).first();
    await dashboardLink.click();

    const profileLink = page.getByRole("link", { name: /^profile$/i }).first();
    await profileLink.click();

    // Assert: Navigate to profile page
    await expect(page).toHaveURL(new RegExp(PROFILE_PATH), { timeout: 5000 });

    // Assert: Profile content loads
    const profileTitle = page.getByRole("heading", {
      name: /profile|user information/i,
    });
    await expect(profileTitle).toBeVisible({ timeout: 5000 });
  });

  test("Clicking Orders link in menu navigates to orders page", async ({
    page,
  }) => {
    // Arrange: Ensure we're on home page
    await page.goto(HOME_PATH);

    // Act: Open user menu
    const userMenuButton = page.getByRole("button", { name: mockUser.name }).first();
    await userMenuButton.click();

    // Act: Navigate to dashboard, then open orders from dashboard menu
    const dashboardLink = page.getByRole("link", { name: /dashboard/i }).first();
    await dashboardLink.click();

    const ordersLink = page.getByRole("link", { name: /^orders$/i }).first();
    await ordersLink.click();

    // Assert: Navigate to orders page
    await expect(page).toHaveURL(new RegExp(ORDERS_PATH), { timeout: 5000 });

    // Assert: Orders page renders (heading or content)
    const ordersContent = page.getByText(/order|purchase|history/i).first();
    await expect(ordersContent).toBeVisible({ timeout: 5000 });
  });

  test("User can navigate between menu options without losing auth", async ({
    page,
  }) => {
    // Act: Navigate to profile via menu
    await page.goto(HOME_PATH);
    let userMenuButton = page.getByRole("button", { name: mockUser.name }).first();
    await userMenuButton.click();

    let dashboardLink = page.getByRole("link", { name: /dashboard/i }).first();
    await dashboardLink.click();

    let profileLink = page.getByRole("link", { name: /^profile$/i }).first();
    await profileLink.click();

    // Assert: On profile page
    await expect(page).toHaveURL(new RegExp(PROFILE_PATH), { timeout: 5000 });

    // Act: Navigate back to home
    await page.goto(HOME_PATH);

    // Act: Open menu again and click Orders
    userMenuButton = page.getByRole("button", { name: mockUser.name }).first();
    await userMenuButton.click();

    dashboardLink = page.getByRole("link", { name: /dashboard/i }).first();
    await dashboardLink.click();

    const ordersLink = page.getByRole("link", { name: /^orders$/i }).first();
    await ordersLink.click();

    // Assert: On orders page
    await expect(page).toHaveURL(new RegExp(ORDERS_PATH), { timeout: 5000 });
  });

  test("Logout option in menu clears auth and returns to home", async ({
    page,
  }) => {
    // Arrange: Ensure we're on home page
    await page.goto(HOME_PATH);

    // Act: Open user menu
    const userMenuButton = page.getByRole("button", { name: mockUser.name }).first();
    await userMenuButton.click();

    // Act: Click logout button/option
    const logoutLink = page.getByRole("link", { name: /logout/i }).first();
    await expect(logoutLink).toBeVisible({ timeout: 5000 });
    await logoutLink.click();

    // Assert: Success toast appears
    const successToast = page.getByText(/logout successfully/i);
    await expect(successToast).toBeVisible({ timeout: 5000 });

    // Assert: Unauthenticated header is shown
    const loginLink = page.getByRole("link", { name: /login/i });
    await expect(loginLink).toBeVisible({ timeout: 5000 });

    // Assert: User menu is no longer visible
    const userMenu = page.getByRole("button", { name: mockUser.name }).first();
    const menuCount = await userMenu.count().catch(() => 0);
    expect(menuCount).toBe(0);
  });

  test("User menu reflects authentication state after logout", async ({
    page,
  }) => {
    // Arrange: Start authenticated
    await page.goto(HOME_PATH);

    // Assert: Authenticated menu is visible
    let userMenuButton = page.getByRole("button", { name: mockUser.name }).first();
    await expect(userMenuButton).toBeVisible();

    // Act: Open and click logout
    await userMenuButton.click();
    const logoutLink = page.getByRole("link", { name: /logout/i }).first();
    await logoutLink.click();

    // Wait for logout to complete
    await page.waitForTimeout(1000);

    // Assert: Menu is no longer visible (unauthenticated state)
    userMenuButton = page.getByRole("button", { name: mockUser.name }).first();
    const isVisible = await userMenuButton.isVisible().catch(() => false);
    expect(isVisible).toBe(false);

    // Assert: Login/Register links are now visible
    const loginLink = page.getByRole("link", { name: /login/i });
    await expect(loginLink).toBeVisible({ timeout: 5000 });
  });
});
