// David Vicedo, A0273234J

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
    // David Vicedo, A0273234J
    test("shows product results for a valid search keyword", async ({ page }) => {
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
            const firstProductName = firstResultCard.getByRole("heading").first();
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

        expect(foundResults).toBeTruthy();
    });

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
