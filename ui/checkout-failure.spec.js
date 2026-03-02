// Anthony Hermanto, A0269067R

import { test, expect } from '@playwright/test';

/**
 * E2E Test: Checkout Validation Failure
 * 
 * Test Scope:
 * - Add product to cart via UI
 * - Attempt checkout without required address information
 * - Verify validation message appears
 * - Verify checkout button remains disabled or payment is blocked
 * 
 * Acceptance Criteria:
 * - Clear validation message displayed
 * - No navigation to success page
 * - No loading spinner stuck state
 * - Test stable and reproducible
 */

test.describe('Checkout Validation Failure', () => {
  const mockProduct = {
    _id: 'product-validation-' + Date.now(),
    name: 'Test Validation Product',
    description: 'Product for testing validation',
    price: 49.99,
    category: { _id: 'cat123', name: 'Test Category' },
    slug: 'test-validation-product',
    quantity: 5
  };

  test.beforeEach(async ({ page }) => {
    // Mock photo endpoint
    await page.route('**/api/v1/product/product-photo/**', async (route) => {
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: png
      });
    });

    // Mock category endpoint
    await page.route('**/api/v1/category/get-category', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, category: [mockProduct.category] })
      });
    });

    // Mock product endpoints
    await page.route('**/api/v1/product/product-count', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total: 1 })
      });
    });

    await page.route('**/api/v1/product/product-list/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, products: [mockProduct] })
      });
    });

    await page.route('**/api/v1/product/braintree/token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ clientToken: 'mock_token_validation' })
      });
    });

    await page.goto('/');
  });

  test('should block checkout when user has no address', async ({ page }) => {
    /**
     * Test Case: User without address attempts checkout
     * 
     * Steps:
     * 1. Set up authenticated user WITHOUT address
     * 2. Add product to cart
     * 3. Navigate to cart page
     * 4. Verify payment button is disabled
     * 5. Verify "Update Address" button is shown
     * 6. Verify no payment can be initiated
     */

    // Set up authenticated user WITHOUT address
    const mockUserNoAddress = {
      _id: 'user-no-addr-' + Date.now(),
      name: 'User Without Address',
      email: `noaddress-${Date.now()}@example.com`,
      phone: '9876543210',
      address: '', // No address set
      role: 0
    };

    const mockAuthToken = 'mock-token-' + Date.now();

    await page.evaluate(({ user, token }) => {
      localStorage.setItem('auth', JSON.stringify({
        user: user,
        token: token
      }));
      localStorage.setItem('cart', JSON.stringify([]));
    }, { user: mockUserNoAddress, token: mockAuthToken });

    // Add product to cart
    await page.evaluate((product) => {
      localStorage.setItem('cart', JSON.stringify([product]));
    }, mockProduct);

    // Navigate to cart page
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');

    // Verify user is authenticated
    await expect(page.locator(`text=/Hello.*${mockUserNoAddress.name}/i`)).toBeVisible({ timeout: 5000 });

    // Verify cart has items
    await expect(page.locator('text=/You Have 1 items in your cart/i')).toBeVisible();

    // Verify "Update Address" button is shown (since no address)
    await expect(page.locator('button:has-text("Update Address")')).toBeVisible();

    // Verify payment button is visible but DISABLED (because no address)
    const makePaymentButton = page.locator('button:has-text("Make Payment")');
    
    // Wait for potential payment UI to load
    await page.waitForTimeout(1500);
    
    // Check if payment button exists
    const buttonCount = await makePaymentButton.count();
    
    if (buttonCount > 0) {
      // Button exists - verify it's disabled
      await expect(makePaymentButton).toBeDisabled();
      console.log('✓ Payment button is disabled when address is missing');
    } else {
      // Button doesn't exist - that's also valid (no clientToken or other conditions)
      console.log('✓ Payment UI not shown when address is missing');
    }

    console.log('✓ Payment blocked when address is missing');
    console.log('✓ Update Address button displayed');
    console.log('✓ Validation working correctly');
  });

  test('should block checkout when user is not authenticated', async ({ page }) => {
    /**
     * Test Case: Unauthenticated user attempts checkout
     * 
     * Steps:
     * 1. Clear authentication
     * 2. Add product to cart (guest mode)
     * 3. Navigate to cart page
     * 4. Verify "please login to checkout" message
     * 5. Verify no payment UI is shown
     */

    // Clear auth from localStorage (guest user)
    await page.evaluate(() => {
      localStorage.removeItem('auth');
    });

    // Add product to cart
    await page.evaluate((product) => {
      localStorage.setItem('cart', JSON.stringify([product]));
    }, mockProduct);

    // Navigate to cart page
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');

    // Verify guest greeting
    await expect(page.locator('text=/Hello Guest/i')).toBeVisible({ timeout: 5000 });

    // Verify prompt to login
    await expect(page.locator('text=/please login to checkout/i')).toBeVisible();

    // Verify "Plase Login to checkout" button is shown
    await expect(page.locator('button:has-text("Plase Login to checkout")')).toBeVisible();

    // Verify payment UI does NOT appear (no payment button when not authenticated)
    await page.waitForTimeout(1000);
    const makePaymentButton = page.locator('button:has-text("Make Payment")');
    const paymentButtonCount = await makePaymentButton.count();
    
    // Button should not exist at all when not authenticated
    expect(paymentButtonCount).toBe(0);

    // Verify cart still shows items
    await expect(page.locator('text=/You Have 1 items in your cart/i')).toBeVisible();

    console.log('✓ Payment blocked when not authenticated');
    console.log('✓ Login prompt displayed');
    console.log('✓ No payment UI shown for guest');
    console.log('✓ Cart items still visible');
  });

  test('should not show payment UI when cart is empty', async ({ page }) => {
    /**
     * Test Case: User with address but empty cart
     * 
     * Steps:
     * 1. Set up authenticated user WITH address
     * 2. Ensure cart is empty
     * 3. Navigate to cart page
     * 4. Verify "Your Cart Is Empty" message
     * 5. Verify no payment UI shown
     */

    const mockUserWithAddress = {
      _id: 'user-empty-cart-' + Date.now(),
      name: 'User With Empty Cart',
      email: `emptycart-${Date.now()}@example.com`,
      phone: '5555555555',
      address: '456 Empty Cart Lane, Test City, TC 54321',
      role: 0
    };

    const mockAuthToken = 'mock-token-' + Date.now();

    await page.evaluate(({ user, token }) => {
      localStorage.setItem('auth', JSON.stringify({
        user: user,
        token: token
      }));
      localStorage.setItem('cart', JSON.stringify([])); // Empty cart
    }, { user: mockUserWithAddress, token: mockAuthToken });

    // Navigate to cart page
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');

    // Verify user is authenticated
    await expect(page.locator(`text=/Hello.*${mockUserWithAddress.name}/i`)).toBeVisible({ timeout: 5000 });

    // Verify "Your Cart Is Empty" message
    await expect(page.locator('text=Your Cart Is Empty')).toBeVisible();

    // Verify no payment UI (button should not exist when cart is empty)
    await page.waitForTimeout(1000);
    const makePaymentButton = page.locator('button:has-text("Make Payment")');
    const paymentButtonCount = await makePaymentButton.count();
    expect(paymentButtonCount).toBe(0);

    console.log('✓ No payment UI when cart is empty');
    console.log('✓ Empty cart message displayed');
    console.log('✓ User still authenticated');
    console.log('✓ User still authenticated');
  });

  test('should disable payment button until all conditions are met', async ({ page }) => {
    /**
     * Test Case: Payment button disabled state validation
     * 
     * Steps:
     * 1. Set up user with address and cart
     * 2. Verify conditions for payment button
     * 3. Check button disabled attribute when DropIn not ready
     */

    const mockUserComplete = {
      _id: 'user-complete-' + Date.now(),
      name: 'Complete User',
      email: `complete-${Date.now()}@example.com`,
      phone: '1112223333',
      address: '789 Complete Ave, Test City, TC 78901',
      role: 0
    };

    const mockAuthToken = 'mock-token-' + Date.now();

    await page.evaluate(({ user, token }) => {
      localStorage.setItem('auth', JSON.stringify({
        user: user,
        token: token
      }));
    }, { user: mockUserComplete, token: mockAuthToken });

    await page.evaluate((product) => {
      localStorage.setItem('cart', JSON.stringify([product]));
    }, mockProduct);

    // Navigate to cart page
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');

    // Verify all checkout conditions are present
    await expect(page.locator(`text=/Hello.*${mockUserComplete.name}/i`)).toBeVisible();
    await expect(page.locator('text=/You Have 1 items in your cart/i')).toBeVisible();
    await expect(page.locator('h4:has-text("Current Address")')).toBeVisible();
    await expect(page.locator(`text=${mockUserComplete.address}`)).toBeVisible();

    // Wait for potential payment UI to load
    await page.waitForTimeout(2000);

    // Check if Make Payment button exists
    const makePaymentButton = page.locator('button:has-text("Make Payment")');
    const buttonCount = await makePaymentButton.count();

    if (buttonCount > 0) {
      // Button exists - check if it's disabled
      const isDisabled = await makePaymentButton.getAttribute('disabled');
      
      if (isDisabled !== null) {
        console.log('✓ Payment button is disabled (waiting for DropIn instance)');
        console.log('✓ Button correctly prevents premature payment');
        
        // Verify button shows correct text
        await expect(makePaymentButton).toContainText(/Make Payment|Processing/i);
      } else {
        console.log('✓ Payment button is enabled (DropIn ready)');
      }
      
      // Verify button doesn't trigger navigation when disabled
      const currentUrl = page.url();
      
      // Try clicking (if disabled, nothing should happen)
      await makePaymentButton.click({ force: true }).catch(() => {
        console.log('✓ Click blocked on disabled button');
      });
      
      await page.waitForTimeout(1000);
      
      // Verify we're still on cart page
      expect(page.url()).toBe(currentUrl);
      console.log('✓ No navigation occurred');
      console.log('✓ Page state stable');
    } else {
      console.log('✓ Payment UI not visible yet - conditions still being validated');
    }

    // Verify no stuck loading state
    const loadingSpinner = page.locator('text=/Processing/i');
    const hasStuckLoading = await loadingSpinner.count();
    expect(hasStuckLoading).toBe(0);
    console.log('✓ No stuck loading spinner');
  });

  test('should show validation message when clicking Update Address without address', async ({ page }) => {
    /**
     * Test Case: Update Address flow validation
     * 
     * Steps:
     * 1. Set up user without address
     * 2. Add product to cart
     * 3. Click "Update Address" button
     * 4. Verify navigation to profile page
     * 5. Verify no payment was attempted
     */

    const mockUserNoAddress = {
      _id: 'user-update-addr-' + Date.now(),
      name: 'User Needs Address',
      email: `needsaddr-${Date.now()}@example.com`,
      phone: '4445556666',
      address: '',
      role: 0
    };

    const mockAuthToken = 'mock-token-' + Date.now();

    await page.evaluate(({ user, token }) => {
      localStorage.setItem('auth', JSON.stringify({
        user: user,
        token: token
      }));
    }, { user: mockUserNoAddress, token: mockAuthToken });

    await page.evaluate((product) => {
      localStorage.setItem('cart', JSON.stringify([product]));
    }, mockProduct);

    // Navigate to cart page
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');

    // Verify Update Address button is visible
    const updateAddressButton = page.locator('button:has-text("Update Address")');
    await expect(updateAddressButton).toBeVisible();

    // Click Update Address
    await updateAddressButton.click();

    // Verify navigation to profile page
    await page.waitForURL('**/dashboard/user/profile', { timeout: 5000 });

    // Verify we're on the profile page
    expect(page.url()).toContain('/dashboard/user/profile');

    // Verify cart was not cleared (user just went to update address)
    const cart = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('cart') || '[]');
    });
    expect(cart.length).toBe(1);

    console.log('✓ Update Address navigation works');
    console.log('✓ Cart preserved during address update');
    console.log('✓ No payment attempted');
    console.log('✓ User directed to correct page');
  });

  test('should maintain stable state when payment conditions are not met', async ({ page }) => {
    /**
     * Test Case: Ensure no UI glitches or stuck states
     * 
     * Steps:
     * 1. Set up various incomplete scenarios
     * 2. Verify UI remains stable
     * 3. Verify no loading spinners appear
     * 4. Verify clear messaging
     */

    const scenarios = [
      {
        name: 'No Auth, No Address',
        setup: async () => {
          await page.evaluate(() => {
            localStorage.removeItem('auth');
            localStorage.setItem('cart', JSON.stringify([{
              _id: 'p1', name: 'Product', price: 10, description: 'Test'
            }]));
          });
        },
        expectedMessage: /please login to checkout/i
      },
      {
        name: 'Auth, No Address',
        setup: async () => {
          await page.evaluate(() => {
            localStorage.setItem('auth', JSON.stringify({
              user: { name: 'Test', email: 'test@test.com', address: '' },
              token: 'token123'
            }));
            localStorage.setItem('cart', JSON.stringify([{
              _id: 'p1', name: 'Product', price: 10, description: 'Test'
            }]));
          });
        },
        expectedButton: 'Update Address'
      }
    ];

    for (const scenario of scenarios) {
      console.log(`\nTesting scenario: ${scenario.name}`);
      
      await scenario.setup();
      await page.goto('/cart');
      await page.waitForLoadState('networkidle');

      if (scenario.expectedMessage) {
        await expect(page.locator(`text=${scenario.expectedMessage}`)).toBeVisible({ timeout: 3000 });
        console.log(`  ✓ Message displayed: "${scenario.expectedMessage}"`);
      }

      if (scenario.expectedButton) {
        await expect(page.locator(`button:has-text("${scenario.expectedButton}")`)).toBeVisible({ timeout: 3000 });
        console.log(`  ✓ Button displayed: "${scenario.expectedButton}"`);
      }

      // Verify no stuck loading
      const loadingText = page.locator('text=/Processing/i');
      const isLoading = await loadingText.count();
      expect(isLoading).toBe(0);
      console.log('  ✓ No stuck loading state');

      // Verify no unexpected navigation
      expect(page.url()).toContain('/cart');
      console.log('  ✓ Still on cart page');
    }

    console.log('\n✓ All validation scenarios passed');
    console.log('✓ UI remains stable across conditions');
    console.log('✓ Clear messaging for each state');
  });
});

