// Amos Chee Tian Ee, A0273476U

/**
 * MS2 UI End-to-End Tests - User Registration Flow (Success)
 *
 * Testing Approach: Black-box End-to-End Testing with Mocked APIs
 *
 * Rationale
 * This test validates the complete user registration flow through the browser UI
 * with mocked backend API responses. By mocking the registration endpoint, the test
 * reliably validates user interactions and form behavior without depending on a live
 * database or backend service. This enables fast, deterministic testing in CI/CD.
 *
 * Scope
 * - Navigate to Register page
 * - Fill registration form with valid data
 * - Submit the form
 * - Mock registration API to return success
 * - Verify success navigation to login page
 *
 * Key Assertions
 * - Register form is visible with all required input fields
 * - Form submission triggers mocked registration API
 * - Successful API response redirects to /login
 * - Form submission handles the async operation correctly
 *
 */

import { test, expect } from "@playwright/test";

const REGISTER_PATH = "/register";
const LOGIN_PATH = "/login";

test.describe("User Registration - Success Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the registration endpoint
    await page.route("**/api/v1/auth/register", async (route) => {
      const requestBody = route.request().postDataJSON();
      
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "User registration successful. Please login.",
          user: {
            name: requestBody.name,
            email: requestBody.email,
            phone: requestBody.phone,
            address: requestBody.address,
            role: 0
          }
        })
      });
    });

    // Navigate to register page
    await page.goto(REGISTER_PATH);
  });

  test("User registers with valid data and is redirected to login", async ({
    page,
  }) => {
    // Arrange: Gather all form input fields
    const nameInput = page.getByLabel("Name");
    const emailInput = page.getByLabel("Email");
    const passwordInput = page.getByLabel("Password");
    const phoneInput = page.getByLabel("Phone");
    const addressInput = page.getByLabel("Address");
    const dobInput = page.getByLabel("Date of Birth");
    const answerInput = page.getByLabel("Security Answer");
    const submitButton = page.getByRole("button", { name: /register/i });

    // Verify all inputs are visible
    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(phoneInput).toBeVisible();
    await expect(addressInput).toBeVisible();
    await expect(dobInput).toBeVisible();
    await expect(answerInput).toBeVisible();
    await expect(submitButton).toBeVisible();

    // Act: Fill form with valid registration data
    const uniqueEmail = `user-${Date.now()}@example.com`;
    await nameInput.fill("Test User");
    await emailInput.fill(uniqueEmail);
    await passwordInput.fill("SecurePassword123!");
    await phoneInput.fill("9876543210");
    await addressInput.fill("123 Test Street, Test City, TC 12345");
    await dobInput.fill("1990-01-15");
    await answerInput.fill("TestSecurityAnswer");

    // Act: Submit the form
    await submitButton.click();

    // Assert: Wait for navigation to login page (registration success redirects to login)
    await expect(page).toHaveURL(new RegExp(LOGIN_PATH), { timeout: 5000 });
  });

  test("User registration form contains all required fields", async ({
    page,
  }) => {
    // Arrange & Assert: Verify form structure by checking all input labels exist
    const requiredLabels = [
      "Name",
      "Email",
      "Password",
      "Phone",
      "Address",
      "Date of Birth",
      "Security Answer",
    ];

    for (const label of requiredLabels) {
      const input = page.getByLabel(label);
      await expect(input).toBeVisible();
    }

    // Assert: Submit button is visible and enabled
    const registerButton = page.getByRole("button", { name: /register/i });
    await expect(registerButton).toBeVisible();
    await expect(registerButton).toBeEnabled();
  });
});
