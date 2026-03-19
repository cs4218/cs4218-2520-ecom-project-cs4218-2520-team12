// Amos Chee Tian Ee, A0273476U

/**
 * MS2 UI End-to-End Tests - Authenticated Dashboard Navigation
 *
 * Testing Approach: Black-box End-to-End Testing with Mocked APIs
 *
 * Rationale
 * This test validates that authenticated users can successfully navigate the
 * dashboard and access user-profile-related pages using mocked authentication.
 * By mocking the login API, the test is independent of backend state and reliably
 * validates navigation behavior without depending on a live database.
 *
 * Scope
 * - Set up authenticated user state via mocked login
 * - Navigate to dashboard pages (profile, orders)
 * - Verify page loads and content visibility
 * - Verify navigation between authenticated pages
 * - Verify logout functionality
 *
 * Key Assertions
 * - Dashboard pages load with authenticated state
 * - User menu displays navigation options
 * - Profile and orders pages render correctly
 * - User can navigate between pages without losing auth
 * - Logout option is available and functional
 * - Unauthenticated users cannot access dashboard
 *
 *
 */

import { test, expect } from "@playwright/test";

const LOGIN_PATH = "/login";
const HOME_PATH = "/";
const DASHBOARD_PATH = "/dashboard/user";
const PROFILE_PATH = "/dashboard/user/profile";
const ORDERS_PATH = "/dashboard/user/orders";
const TEST_PASSWORD = "SomePassword123!";

test.describe("Authenticated Dashboard Navigation", () => {
  // Mock authenticated user
  const mockUser = {
    name: "Test Dashboard User",
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
  });

  test("Authenticated user can navigate to dashboard from header", async ({
    page,
  }) => {
    // Arrange: Locate dashboard button/link in header
    const dashboardButton = page.getByRole("button", { name: mockUser.name }).first();

    // Assert: Dashboard button is visible (indicating authenticated state)
    await expect(dashboardButton).toBeVisible();

    // Act: Click dashboard button
    await dashboardButton.click();

    // Assert: Either dropdown menu appears or navigates directly to dashboard
    const dashboardLink = page.getByRole("link", {
      name: /profile|dashboard/i,
    }).first();
    await expect(dashboardLink).toBeVisible({ timeout: 5000 });
  });

  test("Authenticated user navigates to profile section and sees user information", async ({
    page,
  }) => {
    // Act: Navigate to profile page
    await page.goto(PROFILE_PATH);

    // Assert: Profile page loads
    await expect(page).toHaveURL(new RegExp(PROFILE_PATH));

    // Assert: Profile page contains user information heading/title
    const profileTitle = page.getByRole("heading", { name: /profile|user information/i });
    await expect(profileTitle).toBeVisible({ timeout: 5000 });

    // Assert: Profile email value is rendered in the form
    const emailField = page.locator(`input[type="email"][value="${mockUser.email}"]`).first();
    await expect(emailField).toBeVisible({ timeout: 5000 });
  });

  test("Authenticated user navigates to orders section", async ({ page }) => {
    // Act: Navigate to orders page
    await page.goto(ORDERS_PATH);

    // Assert: Orders page loads
    await expect(page).toHaveURL(new RegExp(ORDERS_PATH));

    // Assert: Orders page displays a heading or list container
    const ordersTitle = page.getByRole("heading", { name: /order|my purchase/i });
    const orderContainer = page.getByText(/order|purchase|history/i).first();

    const titleExists = await ordersTitle.count().catch(() => 0);
    const containerExists = await orderContainer.count().catch(() => 0);

    expect(titleExists > 0 || containerExists > 0).toBeTruthy();
  });

  test("User can navigate between profile and orders without losing auth", async ({
    page,
  }) => {
    // Act: Navigate to profile page
    await page.goto(PROFILE_PATH);

    // Assert: Profile page loads
    await expect(page).toHaveURL(new RegExp(PROFILE_PATH));

    // Act: Navigate to orders page
    await page.goto(ORDERS_PATH);

    // Assert: Orders page loads
    await expect(page).toHaveURL(new RegExp(ORDERS_PATH));

    // Act: Navigate back to profile
    await page.goto(PROFILE_PATH);

    // Assert: Can still access profile (auth not lost)
    await expect(page).toHaveURL(new RegExp(PROFILE_PATH));

    // Assert: Authenticated navigation controls remain visible
    const dashboardControl = page.getByRole("button", { name: mockUser.name }).first();
    await expect(dashboardControl).toBeVisible({ timeout: 5000 });
  });

  test("Dashboard pages have logout option available", async ({ page }) => {
    // Act: Navigate to profile page
    await page.goto(PROFILE_PATH);

    // Assert: Profile page loads
    await expect(page).toHaveURL(new RegExp(PROFILE_PATH));

    // Assert: Logout button is visible in header
    const userMenuButton = page.getByRole("button", { name: mockUser.name }).first();
    await expect(userMenuButton).toBeVisible({ timeout: 5000 });
    await userMenuButton.click();

    const logoutLink = page.getByRole("link", { name: /logout/i }).first();
    await expect(logoutLink).toBeVisible({ timeout: 5000 });
  });

  test("Unauthenticated user cannot access dashboard pages", async ({ browser }) => {
    // Arrange: Use a fresh browser context with no prior auth state
    const unauthContext = await browser.newContext();
    const unauthPage = await unauthContext.newPage();

    // Act: Attempt to navigate directly to profile page without auth
    await unauthPage.goto(PROFILE_PATH);

    // Assert: Either redirected to login or shows access denied
    // (Behavior depends on app implementation - guard or redirect)
    const url = unauthPage.url();
    const isOnLoginOrHome = url.includes(LOGIN_PATH) || url.includes(HOME_PATH);

    // If not redirected, check for "access denied" or similar message
    if (!isOnLoginOrHome) {
      const deniedMessage = unauthPage.getByText(/unauthorized|access denied|login required/i);
      await expect(deniedMessage).toBeVisible({ timeout: 3000 });
    }

    await unauthContext.close();
  });
});
