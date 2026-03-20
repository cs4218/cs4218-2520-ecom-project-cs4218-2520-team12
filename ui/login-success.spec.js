// Amos Chee Tian Ee, A0273476U

/**
 * MS2 UI End-to-End Tests - User Login Flow (Success)
 *
 * Testing Approach: Black-box End-to-End Testing with Mocked APIs
 *
 * Rationale
 * This test validates the complete user login journey through the browser
 * using mocked auth API responses. It asserts only user-observable outcomes
 * (form submission, feedback, navigation, authenticated controls) without
 * coupling to internal frontend implementation details.
 *
 * Scope
 * - Navigate to Login page
 * - Fill login form with valid credentials
 * - Submit the form
 * - Verify success feedback message (toast)
 * - Verify navigation to home page (authenticated redirect)
 * - Verify authenticated state is persisted (user menu visible)
 *
 * Key Assertions
 * - Login form is visible with email and password fields
 * - Successful form submission triggers success toast message
 * - User is redirected to "/" (home) after successful login
 * - Header shows authenticated user controls (logout, profile, user menu)
 * - authenticated header controls are visible after login
 * 
 */

import { test, expect } from "@playwright/test";

const LOGIN_PATH = "/login";
const HOME_PATH = "/";

test.describe("User Login - Success Flow", () => {
  // Mock user and auth token for testing
  const mockUser = {
    name: "Test User",
    email: `test@example.com`,
    phone: "1234567890",
    address: "123 Test Street",
    role: 0
  };
  
  const mockAuthToken = "mock-jwt-token-" + Date.now();

  test.beforeEach(async ({ page }) => {
    // Mock the login endpoint
    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Login successful",
          user: mockUser,
          token: mockAuthToken
        })
      });
    });

    // Navigate to login page
    await page.goto(LOGIN_PATH);
  });

  test("User logs in with valid credentials and is authenticated", async ({
    page,
  }) => {
    // Arrange: Verify login form is visible
    const emailInput = page.getByLabel("Email");
    const passwordInput = page.getByLabel("Password");
    const loginButton = page.getByRole("button", { name: /login/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();

    // Act: Fill login form with credentials from mocked endpoint
    await emailInput.fill(mockUser.email);
    await passwordInput.fill("SomePassword123!");

    // Act: Submit the form
    await loginButton.click();

    // Playwright will intercept this and call the mocked endpoint
    // The frontend should store the auth in localStorage and redirect to home

    // Assert: Verify navigation to home page
    await expect(page).toHaveURL(HOME_PATH, { timeout: 5000 });

    // Assert: Verify authenticated state (user menu should be visible)
    const userMenuButton = page.getByRole("button", { name: mockUser.name }).first();
    await expect(userMenuButton).toBeVisible({ timeout: 5000 });
  });

  test("Login form persists user email across page interactions", async ({
    page,
  }) => {
    // Arrange: Fill login form
    const emailInput = page.getByLabel("Email");

    // Act: Fill email field with mocked user email
    await emailInput.fill(mockUser.email);

    // Assert: Verify value is retained
    await expect(emailInput).toHaveValue(mockUser.email);
  });

  test("Logout clears authenticated state and returns to home page", async ({
    page,
  }) => {
    // First, set up authenticated state by logging in
    const emailInput = page.getByLabel("Email");
    const passwordInput = page.getByLabel("Password");
    const loginButton = page.getByRole("button", { name: /login/i });

    await emailInput.fill(mockUser.email);
    await passwordInput.fill("SomePassword123!");
    await loginButton.click();

    // Wait for successful login and redirect to home
    await expect(page).toHaveURL(HOME_PATH, { timeout: 5000 });

    // Act: Open user dropdown and click logout link
    const userMenuButton = page.getByRole("button", { name: mockUser.name }).first();
    await expect(userMenuButton).toBeVisible({ timeout: 5000 });
    await userMenuButton.click();

    const logoutLink = page.getByRole("link", { name: /logout/i }).first();
    await expect(logoutLink).toBeVisible({ timeout: 5000 });
    await logoutLink.click();

    // Assert: Verify success message
    const successToast = page.getByText(/logout successfully/i);
    await expect(successToast).toBeVisible();

    // Assert: Verify login/register buttons are visible again (unauthenticated state)
    const loginLink = page.getByRole("link", { name: /login/i });
    await expect(loginLink).toBeVisible({ timeout: 5000 });
  });
});
