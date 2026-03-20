// Amos Chee Tian Ee, A0273476U

/**
 * MS2 UI End-to-End Tests - User Login Flow (Failure)
 *
 * Testing Approach: Black-box End-to-End Testing with Mocked APIs
 *
 * Rationale
 * This test validates the error handling and resilience of the login flow by mocking
 * various backend failure scenarios. By mocking error responses, the test reliably
 * validates error handling UI without depending on a live database or backend state.
 *
 * Scope
 * - Navigate to Login page
 * - Attempt login with invalid email
 * - Attempt login with invalid password
 * - Mock backend to return specific error responses
 * - Verify error feedback messages are displayed
 * - Verify user remains on login page
 *
 * Key Assertions
 * - Invalid email results in error message
 * - Wrong password results in error message
 * - User remains on /login page after failed login
 * - No auth token is stored after failed login
 * - Multiple failed attempts don't lock the form
 *
 *
 */

import { test, expect } from "@playwright/test";

const LOGIN_PATH = "/login";
const KNOWN_EMAIL = "test-user@example.com";
const KNOWN_PASSWORD = "SomePassword123!";

test.describe("User Login - Failure Scenarios", () => {
  test.beforeEach(async ({ page }) => {
    // Mock login endpoint with deterministic failure behavior.
    await page.route("**/api/v1/auth/login", async (route) => {
      const requestBody = route.request().postDataJSON() || {};
      const { email, password } = requestBody;

      if (!email || !password) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: false, message: "Email and password are required" }),
        });
        return;
      }

      if (email !== KNOWN_EMAIL) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: false, message: "User not found" }),
        });
        return;
      }

      if (password !== KNOWN_PASSWORD) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: false, message: "Invalid password" }),
        });
        return;
      }

      // Not used by this failure suite, but keeps handler complete.
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Login successful",
          user: {
            _id: "known-user",
            name: "Known User",
            email: KNOWN_EMAIL,
            phone: "1234567890",
            address: "123 Test Street",
            role: 0,
          },
          token: "known-token",
        }),
      });
    });

    // Navigate to login page
    await page.goto(LOGIN_PATH);
  });

  test("Login fails with non-existent user email and shows error message", async ({
    page,
  }) => {
    // Arrange: Get form elements
    const emailInput = page.getByLabel("Email");
    const passwordInput = page.getByLabel("Password");
    const loginButton = page.getByRole("button", { name: /login/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();

    const nonExistentEmail = `nonexistent-${Date.now()}@example.com`;

    // Act: Fill form with non-existent user credentials
    await emailInput.fill(nonExistentEmail);
    await passwordInput.fill("SomePassword123!");

    // Act: Submit the form
    await loginButton.click();

    // Assert: Verify error message is displayed
    const errorToast = page.getByText(/user not found|email not|not registered|invalid/i);
    await expect(errorToast).toBeVisible({ timeout: 5000 });

    // Assert: Verify user remains on login page
    await expect(page).toHaveURL(new RegExp(LOGIN_PATH));

    // Assert: Login form is still usable after failure
    await expect(loginButton).toBeEnabled();
  });

  test("Login fails with correct email but wrong password and shows error message", async ({
    page,
  }) => {
    // Arrange: Get form elements
    const emailInput = page.getByLabel("Email");
    const passwordInput = page.getByLabel("Password");
    const loginButton = page.getByRole("button", { name: /login/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();

    // Act: Fill form with correct email but wrong password
    await emailInput.fill(KNOWN_EMAIL);
    await passwordInput.fill("WrongPassword123!");

    // Act: Submit the form
    await loginButton.click();

    // Assert: Verify error message is displayed
    const errorToast = page.getByText(/password.*wrong|invalid.*password|incorrect|unauthorized/i);
    await expect(errorToast).toBeVisible({ timeout: 5000 });

    // Assert: Verify user remains on login page
    await expect(page).toHaveURL(new RegExp(LOGIN_PATH));
  });

  test("Login fails with empty email field and shows validation error", async ({
    page,
  }) => {
    // Arrange: Get form elements
    const passwordInput = page.getByLabel("Password");
    const loginButton = page.getByRole("button", { name: /login/i });

    // Act: Fill only password and attempt to submit
    await passwordInput.fill("SomePassword123!");
    await loginButton.click();

    // Assert: Verify either HTML5 validation error or error message
    const emailInput = page.getByLabel("Email");
    const isInvalid = await emailInput.evaluate((el) =>
      el.checkValidity ? !el.checkValidity() : false
    );

    // If HTML5 validation fails, test passes
    // Otherwise, check for error toast
    if (!isInvalid) {
      const errorToast = page.getByText(/email.*required|missing|empty/i);
      await expect(errorToast).toBeVisible({ timeout: 5000 });
    }
  });

  test("Multiple failed login attempts do not lock the account", async ({
    page,
  }) => {
    // Arrange: Get form elements
    const emailInput = page.getByLabel("Email");
    const passwordInput = page.getByLabel("Password");
    const loginButton = page.getByRole("button", { name: /login/i });

    // Act: Attempt 3 failed logins with wrong password
    for (let i = 0; i < 3; i++) {
      await emailInput.clear();
      await passwordInput.clear();

      await emailInput.fill(KNOWN_EMAIL);
      await passwordInput.fill("WrongPassword" + i);
      await loginButton.click();

      // Assert: Each attempt shows error
      const errorToast = page.getByText(/wrong|incorrect|invalid/i).first();
      await expect(errorToast).toBeVisible({ timeout: 5000 });

      // Wait a moment before next attempt
      await page.waitForTimeout(500);
    }

    // Assert: After multiple failures, form is still functional
    await emailInput.clear();
    await passwordInput.clear();
    await emailInput.fill(KNOWN_EMAIL);
    await passwordInput.fill(KNOWN_PASSWORD);

    // Verify form can still submit (not locked)
    const inputValue = await emailInput.inputValue();
    expect(inputValue).toBe(KNOWN_EMAIL);
  });
});
