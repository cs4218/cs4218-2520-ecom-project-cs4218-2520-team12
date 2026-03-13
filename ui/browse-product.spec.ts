// David Vicedo, A0273234J

/**
 * MS2 UI End-to-End Tests - Browse to Product Details Flow
 *
 * Testing Approach: Black-box End-to-End Testing
 *
 * Rationale
 * This test validates a real user journey in a browser using the live
 * frontend and backend stack. It verifies navigation and rendered outcomes
 * only, without relying on internal implementation details.
 *
 * Scope
 * - browse products on the homepage
 * - open a product details page
 * - validate product details and related products section
 * - navigate to a related product details page
 *
 * Key Assertions
 * - URL updates to product detail routes
 * - product details UI is visible
 * - related products UI is visible
 * - related-product navigation leads to a different product details route
 *
 * Environment Requirements
 * - frontend server running
 * - backend server running
 * - database seeded with products and categories
 */
import { test, expect, type Locator, type Page } from "@playwright/test";

const HOME_PATH = "/";
const PRODUCT_PATH_REGEX = /\/product\/[^/]+$/;
const MAX_PRODUCTS_TO_TRY = 6;

const normalizeName = (value: string): string => value.trim().toLowerCase();

const extractNameValue = (nameLineText: string): string => {
    const text = nameLineText.trim();
    const match = text.match(/^Name\s*:\s*(.*)$/i);
    return (match?.[1] ?? text.replace(/^Name\s*:/i, "")).trim();
};

const readCurrentProductNameOnce = async (page: Page): Promise<string> => {
    const nameLine = page
        .locator(".product-details-info h6")
        .filter({ hasText: /^Name\s*:/i })
        .first();

    await expect(nameLine).toBeVisible();
    return extractNameValue(await nameLine.innerText());
};

const readCurrentProductName = async (
    page: Page,
    timeout = 7000,
): Promise<string> => {
    let productName = "";

    try {
        await expect
            .poll(
                async () => {
                    productName = await readCurrentProductNameOnce(page);
                    return productName;
                },
                { timeout },
            )
            .not.toBe("");
    } catch {
        return "";
    }

    return productName;
};

const waitForSpecificProductName = async (
    page: Page,
    expectedName: string,
    timeout = 7000,
): Promise<string> => {
    let productName = "";

    await expect
        .poll(
            async () => {
                productName = await readCurrentProductNameOnce(page);
                return normalizeName(productName);
            },
            { timeout },
        )
        .toBe(normalizeName(expectedName));

    return productName;
};

const readCardName = async (card: Locator): Promise<string> => {
    const cardNameHeading = card.getByRole("heading").first();
    await expect(cardNameHeading).toBeVisible();
    return (await cardNameHeading.innerText()).trim();
};

test.describe("MS2 - Browse to Product Details flow", () => {
    /**
     * Test Case: Browse from Home to Product Details to Related Product Details
     *
     * Scenario
     * A user browses products from the homepage, opens one product details page,
     * and continues exploration via a related product.
     *
     * Steps
     * 1. Open homepage and verify products are visible.
     * 2. Open a product details page using More Details.
     * 3. Verify product details and related products section.
     * 4. Open a related product using More Details.
     * 5. Verify URL and details page update to the related product.
     *
     * Expected Behaviour
     * - navigation proceeds from home to product details routes
     * - product details content is visible
     * - related product navigation updates route and rendered product details
     */
    // David Vicedo, A0273234J
    test("navigates from homepage to product details and then to a related product", async ({
        page,
    }) => {
        // Arrange
        await page.goto(HOME_PATH);

        const homeHeading = page.getByRole("heading", {
            name: /All Products/i,
        });
        await expect(homeHeading).toBeVisible();

        const homeMoreDetailsButtons = page.getByRole("button", {
            name: /^More Details$/i,
        });
        await expect(homeMoreDetailsButtons.first()).toBeVisible();

        const totalHomeProducts = await homeMoreDetailsButtons.count();
        const attempts = Math.min(totalHomeProducts, MAX_PRODUCTS_TO_TRY);
        expect(attempts).toBeGreaterThan(0);

        let completed = false;

        // Act
        for (let index = 0; index < attempts; index += 1) {
            if (index > 0) {
                await page.goto(HOME_PATH);
                await expect(homeHeading).toBeVisible();
            }

            const currentHomeButtons = page.getByRole("button", {
                name: /^More Details$/i,
            });
            await expect(currentHomeButtons.first()).toBeVisible();
            if (index >= (await currentHomeButtons.count())) {
                break;
            }

            const firstProductButton = currentHomeButtons.nth(index);
            await firstProductButton.scrollIntoViewIfNeeded();
            await firstProductButton.click();

            await expect(page).toHaveURL(PRODUCT_PATH_REGEX);

            const detailsHeading = page.getByRole("heading", {
                name: /^Product Details$/i,
            });
            const detailsSection = page.locator(".product-details-info");
            const similarProductsHeading = page.getByRole("heading", {
                name: /Similar Products/i,
            });
            const relatedSection = page.locator(".similar-products");

            await expect(detailsHeading).toBeVisible();
            await expect(detailsSection).toBeVisible();
            await expect(similarProductsHeading).toBeVisible();
            await expect(relatedSection).toBeVisible();

            const firstProductName = await readCurrentProductName(page);
            if (!firstProductName) {
                continue;
            }

            const noRelatedText = relatedSection.getByText(
                /No Similar Products found/i,
            );
            if (await noRelatedText.isVisible()) {
                continue;
            }

            const relatedCards = relatedSection.locator(".card");
            const relatedCount = await relatedCards.count();
            if (relatedCount < 1) {
                continue;
            }

            let relatedCardIndex = 0;
            let chosenRelatedName = "";

            for (
                let relatedIndex = 0;
                relatedIndex < relatedCount;
                relatedIndex += 1
            ) {
                const candidateCard = relatedCards.nth(relatedIndex);
                const candidateName = await readCardName(candidateCard);

                if (!chosenRelatedName) {
                    chosenRelatedName = candidateName;
                    relatedCardIndex = relatedIndex;
                }

                if (
                    candidateName &&
                    normalizeName(candidateName) !==
                        normalizeName(firstProductName)
                ) {
                    chosenRelatedName = candidateName;
                    relatedCardIndex = relatedIndex;
                    break;
                }
            }

            const firstDetailsPathname = new URL(page.url()).pathname;
            const selectedRelatedCard = relatedCards.nth(relatedCardIndex);
            const relatedMoreDetailsButton = selectedRelatedCard.getByRole(
                "button",
                {
                    name: /^More Details$/i,
                },
            );

            await expect(relatedMoreDetailsButton).toBeVisible();
            await relatedMoreDetailsButton.click();

            await expect(page).toHaveURL(PRODUCT_PATH_REGEX);
            const secondDetailsPathname = new URL(page.url()).pathname;

            // Assert
            expect(secondDetailsPathname).not.toBe(firstDetailsPathname);
            await expect(detailsHeading).toBeVisible();

            let secondProductName = "";

            if (
                chosenRelatedName &&
                normalizeName(chosenRelatedName) !==
                    normalizeName(firstProductName)
            ) {
                secondProductName = await waitForSpecificProductName(
                    page,
                    chosenRelatedName,
                );
                expect(normalizeName(secondProductName)).not.toBe(
                    normalizeName(firstProductName),
                );
            } else {
                secondProductName = await readCurrentProductName(page);
                expect(secondProductName).not.toEqual("");
            }

            completed = true;
            break;
        }

        // Assert
        expect(completed).toBeTruthy();
    });
});
