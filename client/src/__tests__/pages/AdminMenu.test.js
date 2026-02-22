import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import AdminMenu from "../../components/AdminMenu";

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "adminMenu_rendered_displaysHeading" -> Structural completeness: heading text displayed
 * - "adminMenu_rendered_displaysCreateCategoryLink" -> Equivalence class: Create Category navigation link
 * - "adminMenu_rendered_displaysCreateProductLink" -> Equivalence class: Create Product navigation link
 * - "adminMenu_rendered_displaysProductsLink" -> Equivalence class: Products navigation link
 * - "adminMenu_rendered_displaysOrdersLink" -> Equivalence class: Orders navigation link
 * - "createCategoryLink_rendered_hasCorrectPath" -> Regression/contract: correct route path
 * - "createProductLink_rendered_hasCorrectPath" -> Regression/contract: correct route path
 * - "productsLink_rendered_hasCorrectPath" -> Regression/contract: correct route path
 * - "ordersLink_rendered_hasCorrectPath" -> Regression/contract: correct route path
 * - "allLinks_rendered_haveCorrectStyling" -> Structural completeness: CSS classes applied
 */

const renderWithRouter = () => {
    return render(
        <BrowserRouter>
            <AdminMenu />
        </BrowserRouter>
    );
};

describe("AdminMenu Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("adminMenu_rendered_displaysHeading", () => {
        // Arrange & Act
        renderWithRouter();

        // Assert
        expect(
            screen.getByRole("heading", { name: /Admin Panel/i })
        ).toBeInTheDocument();
    });

    it("adminMenu_rendered_displaysCreateCategoryLink", () => {
        // Arrange & Act
        renderWithRouter();

        // Assert
        const link = screen.getByRole("link", { name: /Create Category/i });
        expect(link).toBeInTheDocument();
    });

    it("adminMenu_rendered_displaysCreateProductLink", () => {
        // Arrange & Act
        renderWithRouter();

        // Assert
        const link = screen.getByRole("link", { name: /Create Product/i });
        expect(link).toBeInTheDocument();
    });

    it("adminMenu_rendered_displaysProductsLink", () => {
        // Arrange & Act
        renderWithRouter();

        // Assert
        const link = screen.getByRole("link", { name: /^Products$/i });
        expect(link).toBeInTheDocument();
    });

    it("adminMenu_rendered_displaysOrdersLink", () => {
        // Arrange & Act
        renderWithRouter();

        // Assert
        const link = screen.getByRole("link", { name: /Orders/i });
        expect(link).toBeInTheDocument();
    });

    it("createCategoryLink_rendered_hasCorrectPath", () => {
        // Arrange & Act
        renderWithRouter();

        // Assert
        const link = screen.getByRole("link", { name: /Create Category/i });
        expect(link).toHaveAttribute("href", "/dashboard/admin/create-category");
    });

    it("createProductLink_rendered_hasCorrectPath", () => {
        // Arrange & Act
        renderWithRouter();

        // Assert
        const link = screen.getByRole("link", { name: /Create Product/i });
        expect(link).toHaveAttribute("href", "/dashboard/admin/create-product");
    });

    it("productsLink_rendered_hasCorrectPath", () => {
        // Arrange & Act
        renderWithRouter();

        // Assert
        const link = screen.getByRole("link", { name: /^Products$/i });
        expect(link).toHaveAttribute("href", "/dashboard/admin/products");
    });

    it("ordersLink_rendered_hasCorrectPath", () => {
        // Arrange & Act
        renderWithRouter();

        // Assert
        const link = screen.getByRole("link", { name: /Orders/i });
        expect(link).toHaveAttribute("href", "/dashboard/admin/orders");
    });

    it("allLinks_rendered_haveCorrectStyling", () => {
        // Arrange & Act
        renderWithRouter();

        // Assert
        const links = screen.getAllByRole("link");
        
        links.forEach((link) => {
            expect(link).toHaveClass("list-group-item");
            expect(link).toHaveClass("list-group-item-action");
        });
    });

    it("menuContainer_rendered_hasCorrectStructure", () => {
        // Arrange & Act
        renderWithRouter();

        // Assert
        const heading = screen.getByRole("heading", { name: /Admin Panel/i });
        const listGroup = heading.closest(".list-group");
        
        expect(listGroup).toBeInTheDocument();
        expect(listGroup).toHaveClass("dashboard-menu");
        
        const textCenter = listGroup.closest(".text-center");
        expect(textCenter).toBeInTheDocument();
    });

    it("usersLink_rendered_isCommentedOut", () => {
        // Arrange & Act
        renderWithRouter();

        // Assert
        const links = screen.getAllByRole("link");
        const userLinks = links.filter(link => link.textContent.includes("Users"));
        
        expect(userLinks.length).toBe(0);
    });
});
