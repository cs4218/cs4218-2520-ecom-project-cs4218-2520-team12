import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import AdminDashboard from "../../pages/admin/AdminDashboard";
import { useAuth } from "../../context/auth";

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "adminProfile_fullyPopulated_rendersAllFields" -> Equivalence class: complete user profile with all fields
 * - "adminProfile_rendered_showsCorrectName" -> Structural completeness: name field displayed
 * - "adminProfile_rendered_showsCorrectEmail" -> Structural completeness: email field displayed
 * - "adminProfile_rendered_showsCorrectPhone" -> Structural completeness: phone field displayed
 * - "adminProfile_missingPhone_rendersNameAndEmail" -> Edge case: partial user data (no phone)
 * - "adminProfile_missingEmail_rendersNameAndPhone" -> Edge case: partial user data (no email)
 * - "adminProfile_nullUser_rendersSafelyWithoutCrashing" -> Edge case: null user
 * - "adminProfile_undefinedUser_rendersSafelyWithoutCrashing" -> Edge case: undefined user
 * - "layout_rendered_containsAdminMenu" -> Structural completeness: AdminMenu component present
 * - "layout_rendered_containsProfileCard" -> Structural completeness: profile card container present
 */

jest.mock("../../context/auth", () => ({
    useAuth: jest.fn(),
}));

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

const renderWithRouter = (initialEntry = "/dashboard/admin") => {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
                <Route path="/dashboard/admin" element={<AdminDashboard />} />
            </Routes>
        </MemoryRouter>
    );
};

describe("AdminDashboard Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("adminProfile_fullyPopulated_rendersAllFields", () => {
        // Arrange
        const mockAuth = {
            user: {
                name: "John Admin",
                email: "john.admin@example.com",
                phone: "+1234567890",
            },
            token: "admin-token",
        };
        useAuth.mockReturnValue([mockAuth, jest.fn()]);

        // Act
        renderWithRouter();

        // Assert
        expect(screen.getByTestId("layout")).toBeInTheDocument();
        expect(screen.getByTestId("admin-menu")).toBeInTheDocument();
        expect(
            screen.getByText("Admin Name : John Admin"),
        ).toBeInTheDocument();
        expect(
            screen.getByText("Admin Email : john.admin@example.com"),
        ).toBeInTheDocument();
        expect(
            screen.getByText("Admin Contact : +1234567890"),
        ).toBeInTheDocument();
    });

    it("adminProfile_rendered_showsCorrectName", () => {
        // Arrange
        const mockAuth = {
            user: {
                name: "Alice Administrator",
                email: "alice@test.com",
                phone: "555-0123",
            },
            token: "token",
        };
        useAuth.mockReturnValue([mockAuth, jest.fn()]);

        // Act
        renderWithRouter();

        // Assert
        expect(
            screen.getByText("Admin Name : Alice Administrator"),
        ).toBeInTheDocument();
    });

    it("adminProfile_rendered_showsCorrectEmail", () => {
        // Arrange
        const mockAuth = {
            user: {
                name: "Bob Manager",
                email: "bob.manager@company.com",
                phone: "555-9999",
            },
            token: "token",
        };
        useAuth.mockReturnValue([mockAuth, jest.fn()]);

        // Act
        renderWithRouter();

        // Assert
        expect(
            screen.getByText("Admin Email : bob.manager@company.com"),
        ).toBeInTheDocument();
    });

    it("adminProfile_rendered_showsCorrectPhone", () => {
        // Arrange
        const mockAuth = {
            user: {
                name: "Carol Admin",
                email: "carol@test.com",
                phone: "+44-20-1234-5678",
            },
            token: "token",
        };
        useAuth.mockReturnValue([mockAuth, jest.fn()]);

        // Act
        renderWithRouter();

        // Assert
        expect(
            screen.getByText("Admin Contact : +44-20-1234-5678"),
        ).toBeInTheDocument();
    });

    it("adminProfile_missingPhone_rendersNameAndEmail", () => {
        // Arrange
        const mockAuth = {
            user: {
                name: "David Admin",
                email: "david@example.com",
                // phone is missing
            },
            token: "token",
        };
        useAuth.mockReturnValue([mockAuth, jest.fn()]);

        // Act
        renderWithRouter();

        // Assert
        expect(screen.getByText("Admin Name : David Admin")).toBeInTheDocument();
        expect(
            screen.getByText("Admin Email : david@example.com"),
        ).toBeInTheDocument();
        expect(screen.getByText("Admin Contact :")).toBeInTheDocument();
    });

    it("adminProfile_missingEmail_rendersNameAndPhone", () => {
        // Arrange
        const mockAuth = {
            user: {
                name: "Eve Admin",
                // email is missing
                phone: "555-1111",
            },
            token: "token",
        };
        useAuth.mockReturnValue([mockAuth, jest.fn()]);

        // Act
        renderWithRouter();

        // Assert
        expect(screen.getByText("Admin Name : Eve Admin")).toBeInTheDocument();
        expect(screen.getByText("Admin Email :")).toBeInTheDocument();
        expect(screen.getByText("Admin Contact : 555-1111")).toBeInTheDocument();
    });

    it("adminProfile_nullUser_rendersSafelyWithoutCrashing", () => {
        // Arrange
        const mockAuth = {
            user: null,
            token: "",
        };
        useAuth.mockReturnValue([mockAuth, jest.fn()]);

        // Act
        renderWithRouter();

        // Assert
        expect(screen.getByTestId("layout")).toBeInTheDocument();
        expect(screen.getByTestId("admin-menu")).toBeInTheDocument();
        expect(screen.getByText("Admin Name :")).toBeInTheDocument();
        expect(screen.getByText("Admin Email :")).toBeInTheDocument();
        expect(screen.getByText("Admin Contact :")).toBeInTheDocument();
    });

    it("adminProfile_undefinedUser_rendersSafelyWithoutCrashing", () => {
        // Arrange
        const mockAuth = {
            user: undefined,
            token: "",
        };
        useAuth.mockReturnValue([mockAuth, jest.fn()]);

        // Act
        renderWithRouter();

        // Assert
        expect(screen.getByTestId("layout")).toBeInTheDocument();
        expect(screen.getByTestId("admin-menu")).toBeInTheDocument();
        expect(screen.getByText("Admin Name :")).toBeInTheDocument();
        expect(screen.getByText("Admin Email :")).toBeInTheDocument();
        expect(screen.getByText("Admin Contact :")).toBeInTheDocument();
    });

    it("layout_rendered_containsAdminMenu", () => {
        // Arrange
        const mockAuth = {
            user: {
                name: "Frank Admin",
                email: "frank@test.com",
                phone: "555-2222",
            },
            token: "token",
        };
        useAuth.mockReturnValue([mockAuth, jest.fn()]);

        // Act
        renderWithRouter();

        // Assert
        const adminMenu = screen.getByTestId("admin-menu");
        expect(adminMenu).toBeInTheDocument();
        expect(adminMenu).toHaveTextContent("Admin Menu");
    });

    it("layout_rendered_containsProfileCard", () => {
        // Arrange
        const mockAuth = {
            user: {
                name: "Grace Admin",
                email: "grace@test.com",
                phone: "555-3333",
            },
            token: "token",
        };
        useAuth.mockReturnValue([mockAuth, jest.fn()]);

        // Act
        renderWithRouter();

        // Assert
        const profileCard = screen.getByText("Admin Name : Grace Admin").closest(".card");
        expect(profileCard).toBeInTheDocument();
        expect(profileCard).toHaveClass("w-75", "p-3");
    });
});
