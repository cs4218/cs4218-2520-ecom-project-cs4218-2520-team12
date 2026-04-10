// Wong An Wei, A0273528X

import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";

import Users from "../../pages/admin/Users";

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "adminUsers_routeRendersPage" -> Basis path: route resolves to component
 * - "adminUsers_layoutTitleDisplayed" -> Structural completeness: Layout title passed through
 * - "adminUsers_adminMenuDisplayed" -> Structural completeness: AdminMenu present
 */

jest.mock("../../components/Layout", () => {
    const LayoutMock = ({ children, title }) => (
        <div data-testid="layout">
            <div data-testid="layout-title">{title}</div>
            {children}
        </div>
    );
    return {
        __esModule: true,
        default: LayoutMock,
    };
});

jest.mock("../../components/AdminMenu", () => {
    const AdminMenuMock = () => <div data-testid="admin-menu">Admin Menu</div>;
    return {
        __esModule: true,
        default: AdminMenuMock,
    };
});

window.matchMedia =
    window.matchMedia ||
    function matchMedia() {
        return {
            matches: false,
            addListener: function () {},
            removeListener: function () {},
        };
    };

const renderWithRouter = (initialEntry = "/dashboard/admin/users") => {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                <Route path="/dashboard/admin/users" element={<Users />} />
            </Routes>
        </MemoryRouter>
    );
};

describe("Admin Users Page", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("adminUsers_routeRendersPage", () => {
        renderWithRouter();

        expect(screen.getByTestId("layout")).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: /All Users/i }),
        ).toBeInTheDocument();
    });

    it("adminUsers_layoutTitleDisplayed", () => {
        renderWithRouter();

        expect(screen.getByTestId("layout-title")).toHaveTextContent(
            "Dashboard - All Users",
        );
    });

    it("adminUsers_adminMenuDisplayed", () => {
        renderWithRouter();

        expect(screen.getByTestId("admin-menu")).toBeInTheDocument();
    });

    // ADDED - MS3 upgrade
    it("adminUsers_routeMismatch_doesNotRenderUsersPage", () => {
        // Strategy: EP - invalid route partition should not resolve Users component.
        renderWithRouter("/dashboard/admin/users-invalid");

        expect(screen.queryByTestId("layout")).not.toBeInTheDocument();
        expect(
            screen.queryByRole("heading", { name: /All Users/i }),
        ).not.toBeInTheDocument();
    });
});
