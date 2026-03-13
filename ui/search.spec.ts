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
            if (index > 0) {
                await page.goto(HOME_PATH);
            }

            await submitSearch(page, SUCCESS_KEYWORDS[index]);
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
