import { test, expect } from "@playwright/test";

const baseUser = {
  name: "Profile User",
  email: "profile.user@example.com",
  phone: "90000000",
  address: "Old Address",
  role: 0,
};

test.describe("MS2 E2E - Profile", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((user) => {
      localStorage.setItem(
        "auth",
        JSON.stringify({
          user,
          token: "profile-user-token",
        })
      );
    }, baseUser);

    await page.route("**/api/v1/category/get-category", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, category: [] }),
      });
    });

    await page.route("**/api/v1/auth/user-auth", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
  });

  // Wong An Wei, A0273528X
  test("user opens profile, updates details, and saves successfully", async ({
    page,
  }) => {
    let updateRequestPayload = null;

    await page.route("**/api/v1/auth/profile", async (route) => {
      const postData = route.request().postDataJSON();
      updateRequestPayload = postData;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          updatedUser: {
            name: postData.name,
            email: postData.email,
            phone: postData.phone,
            address: postData.address,
            role: 0,
          },
        }),
      });
    });

    await page.goto("/dashboard/user/profile");

    await expect(page.getByRole("heading", { name: /user profile/i })).toBeVisible();
    await expect(page.getByPlaceholder("Enter Your Name")).toHaveValue(baseUser.name);
    await expect(page.getByPlaceholder(/Enter Your Email/i)).toHaveValue(baseUser.email);

    await page.getByPlaceholder("Enter Your Name").fill("Profile User Updated");
    await page.getByPlaceholder("Enter Your Password").fill("new-password-123");
    await page.getByPlaceholder("Enter Your Phone").fill("91112222");
    await page.getByPlaceholder("Enter Your Address").fill("New Address");

    await page.getByRole("button", { name: /update/i }).click();

    await expect(page.getByText(/profile updated successfully/i)).toBeVisible();

    expect(updateRequestPayload).toEqual({
      name: "Profile User Updated",
      email: baseUser.email,
      password: "new-password-123",
      phone: "91112222",
      address: "New Address",
    });

    const authState = await page.evaluate(() => {
      const raw = localStorage.getItem("auth");
      return raw ? JSON.parse(raw) : null;
    });

    expect(authState.user.name).toBe("Profile User Updated");
    expect(authState.user.phone).toBe("91112222");
    expect(authState.user.address).toBe("New Address");
  });

  // Wong An Wei, A0273528X
  test("profile update failure keeps previous profile state", async ({ page }) => {
    await page.route("**/api/v1/auth/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ errro: true, error: "Invalid profile data" }),
      });
    });

    await page.goto("/dashboard/user/profile");

    await page.getByPlaceholder("Enter Your Name").fill("Should Not Persist");
    await page.getByPlaceholder("Enter Your Phone").fill("90001111");
    await page.getByRole("button", { name: /update/i }).click();

    await expect(page.getByText(/invalid profile data/i)).toBeVisible();

    const authState = await page.evaluate(() => {
      const raw = localStorage.getItem("auth");
      return raw ? JSON.parse(raw) : null;
    });

    expect(authState.user.name).toBe(baseUser.name);
    expect(authState.user.phone).toBe(baseUser.phone);
  });

  // ADDED - MS3 upgrade
  test("short password update attempt shows validation error and preserves local profile", async ({ page }) => {
    await page.route("**/api/v1/auth/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          errro: true,
          error: "Passsword is required and 6 character long",
        }),
      });
    });

    await page.goto("/dashboard/user/profile");

    await page.getByPlaceholder("Enter Your Name").fill("Profile User");
    await page.getByPlaceholder("Enter Your Password").fill("12345");
    await page.getByRole("button", { name: /update/i }).click();

    await expect(page.getByText(/passsword is required and 6 character long/i)).toBeVisible();

    const authState = await page.evaluate(() => {
      const raw = localStorage.getItem("auth");
      return raw ? JSON.parse(raw) : null;
    });

    expect(authState.user.name).toBe(baseUser.name);
    expect(authState.user.phone).toBe(baseUser.phone);
    expect(authState.user.address).toBe(baseUser.address);
  });
});
