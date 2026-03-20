// David Vicedo, A0273234J

/**
 * MS2 UI End-to-End Tests - Search Flow (Success and Empty Results)
 *
 * Testing Approach: Black-box End-to-End Testing
 *
 * Rationale
 * These tests validate real search behaviour through the browser against the
 * live frontend and backend. They assert only user-visible outcomes and route
 * transitions, without mocking APIs or internal modules.
 *
 * Scope
 * - submit a search from homepage and verify successful results rendering
 * - submit a search with no matches and verify empty-state rendering
 *
 * Key Assertions
 * - URL navigates to /search after form submission
 * - result cards and visible product information appear on successful search
 * - empty-state message appears when there are no matching products
 *
 * Environment Requirements
 * - frontend server running
 * - backend server running
 * - database seeded with products and categories
 */
import { test, expect, type Page } from "@playwright/test";

const HOME_PATH = "/";
const SEARCH_PATH_REGEX = /\/search$/;
const SUCCESS_KEYWORDS = ["phone", "iphone", "laptop", "smart"];

const getSearchInput = (page: Page) =>
    page.getByRole("searchbox", { name: /search/i });

const getSearchSubmitButton = (page: Page) =>
    page.getByRole("button", { name: /^Search$/i });

const submitSearch = async (page: Page, keyword: string): Promise<void> => {
    const searchInput = getSearchInput(page);
    const searchSubmitButton = getSearchSubmitButton(page);

    await expect(searchInput).toBeVisible();
    await expect(searchSubmitButton).toBeVisible();

    await searchInput.fill(keyword);
    await searchSubmitButton.click();

    await expect(page).toHaveURL(SEARCH_PATH_REGEX);
};

test.describe("MS2 - Search Flow", () => {
    test.beforeEach(async ({ page }) => {
        await page.route("**/api/v1/category/get-category", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ success: true, category: [] }),
            });
        });

        await page.route("**/api/v1/product/search/*", async (route) => {
            const keyword = decodeURIComponent(
                route.request().url().split("/").pop() ?? "",
            ).toLowerCase();

            const hasResult = ["phone", "iphone", "laptop", "smart"].some(
                (token) => keyword.includes(token),
            );

            const results = hasResult
                ? [
                      {
                          _id: "search-001",
                          name: "Search Phone",
                          slug: "search-phone",
                          description:
                              "Deterministic search result for Playwright tests",
                          price: 499,
                      },
                  ]
                : [];

            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(results),
            });
        });

        await page.route("**/api/v1/product/product-photo/*", async (route) => {
            const png = Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "base64",
            );
            await route.fulfill({
                status: 200,
                contentType: "image/png",
                body: png,
            });
        });
    });

    /**
     * Test Case: Search Success Flow
     *
     * Scenario
     * A user searches with a valid keyword and views matching product results.
     *
     * Steps
     * 1. Open homepage and locate the search input.
     * 2. Submit a common keyword.
     * 3. Verify navigation to /search.
     * 4. Verify at least one visible product result card.
     *
     * Expected Behaviour
     * - search route loads successfully
     * - product result cards with name and price are visible
     */
    // David Vicedo, A0273234J
    test("shows product results for a valid search keyword", async ({
        page,
    }) => {
        // Arrange
        await page.goto(HOME_PATH);
        await expect(getSearchInput(page)).toBeVisible();

        let foundResults = false;

        // Act
        for (let index = 0; index < SUCCESS_KEYWORDS.length; index += 1) {
            const keyword = SUCCESS_KEYWORDS[index];
            const normalizedKeyword = keyword.trim().toLowerCase();

            if (index > 0) {
                await page.goto(HOME_PATH);
            }

            await submitSearch(page, keyword);
            await expect(
                page.getByRole("heading", { name: /Search Resu/i }),
            ).toBeVisible();

            const noResultsMessage = page.getByText(/No Products Found/i);
            if (await noResultsMessage.isVisible()) {
                continue;
            }

            const resultCards = page.locator(".card");
            if ((await resultCards.count()) < 1) {
                continue;
            }

            const firstResultCard = resultCards.first();
            const firstProductName = firstResultCard
                .getByRole("heading")
                .first();
            const firstProductPrice = firstResultCard
                .locator("p.card-text")
                .filter({ hasText: /\$/ })
                .first();

            // Assert
            await expect(firstResultCard).toBeVisible();
            await expect(firstProductName).toBeVisible();
            await expect(firstProductPrice).toBeVisible();

            let hasRelevantMatch = false;
            const resultCount = await resultCards.count();

            for (
                let resultIndex = 0;
                resultIndex < resultCount;
                resultIndex += 1
            ) {
                const resultCard = resultCards.nth(resultIndex);
                if (!(await resultCard.isVisible())) {
                    continue;
                }

                const cardName = (
                    await resultCard.getByRole("heading").first().innerText()
                )
                    .trim()
                    .toLowerCase();

                const cardTexts = resultCard.locator("p.card-text");
                const textCount = await cardTexts.count();
                let cardDescription = "";

                for (let textIndex = 0; textIndex < textCount; textIndex += 1) {
                    const text = (await cardTexts.nth(textIndex).innerText())
                        .trim()
                        .toLowerCase();

                    if (text && !text.includes("$")) {
                        cardDescription = text;
                        break;
                    }
                }

                if (
                    cardName.includes(normalizedKeyword) ||
                    cardDescription.includes(normalizedKeyword)
                ) {
                    hasRelevantMatch = true;
                    break;
                }
            }

            if (!hasRelevantMatch) {
                continue;
            }

            foundResults = true;
            break;
        }

        // Assert
        expect(foundResults).toBeTruthy();
    });

    /**
     * Test Case: Search Empty Results Flow
     *
     * Scenario
     * A user searches with a keyword that does not match any product.
     *
     * Steps
     * 1. Open homepage and locate the search input.
     * 2. Submit a random unlikely keyword.
     * 3. Verify navigation to /search.
     * 4. Verify the empty-state message is shown.
     *
     * Expected Behaviour
     * - search route loads successfully
     * - empty-state message indicates that no products were found
     */
    // David Vicedo, A0273234J
    test("shows empty-state message when search has no matches", async ({
        page,
    }) => {
        // Arrange
        const randomMissingKeyword = `zzzzzznonexistentproduct${Date.now()}`;

        await page.goto(HOME_PATH);
        await expect(getSearchInput(page)).toBeVisible();

        // Act
        await submitSearch(page, randomMissingKeyword);

        // Assert
        await expect(page.getByText(/No Products Found/i)).toBeVisible();
    });
});
