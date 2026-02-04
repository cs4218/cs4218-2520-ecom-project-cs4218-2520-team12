import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import Contact from "../../pages/Contact";

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "renders main content inside layout" -> Equivalence class: standard render (Layout wrapper + stable title/heading anchor)
 * - "renders the contact image with expected attributes" -> Structural completeness: expected static media present
 * - "renders contact information lines" -> Equivalence class: expected text anchors (email/phone/support)
 * - "renders icons (mocked)" -> Regression/stability: external module mocked; verifies icon placeholders are present
 * - "renders without a router wrapper" -> Edge/rare case: component has no router dependency
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

jest.mock("react-icons/bi", () => ({
    BiMailSend: () => <span data-testid="icon-mail" />,
    BiPhoneCall: () => <span data-testid="icon-phone" />,
    BiSupport: () => <span data-testid="icon-support" />,
}));

window.matchMedia =
    window.matchMedia ||
    function matchMedia() {
        return {
            matches: false,
            addListener: function () {},
            removeListener: function () {},
        };
    };

const renderWithRouter = () => {
    return render(
        <MemoryRouter initialEntries={["/contact"]}>
            <Routes>
                <Route path="/contact" element={<Contact />} />
            </Routes>
        </MemoryRouter>,
    );
};

describe("Contact Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("Contact_defaultRender_rendersLayoutTitleAndHeading", () => {
        // Arrange
        renderWithRouter();

        // Act
        // (no user action needed)

        // Assert
        expect(screen.getByTestId("layout")).toBeInTheDocument();
        expect(screen.getByTestId("layout-title")).toHaveTextContent(
            "Contact us",
        );
        expect(
            screen.getByRole("heading", { name: /contact us/i }),
        ).toBeInTheDocument();
        expect(screen.getByText(/available\s+24x7/i)).toBeInTheDocument();
    });

    it("Contact_defaultRender_rendersContactImage", () => {
        // Arrange
        renderWithRouter();

        // Act
        const image = screen.getByAltText("contactus");

        // Assert
        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute("src", "/images/contactus.jpeg");
    });

    it("Contact_defaultRender_rendersContactInformationLines", () => {
        // Arrange
        renderWithRouter();

        // Act
        const email = screen.getByText(/www\.help@ecommerceapp\.com/i);
        const phone = screen.getByText(/012-3456789/);
        const support = screen.getByText(/1800-0000-0000\s*\(toll free\)/i);

        // Assert
        expect(email).toBeInTheDocument();
        expect(phone).toBeInTheDocument();
        expect(support).toBeInTheDocument();
    });

    it("Contact_defaultRender_rendersIcons", () => {
        // Arrange
        renderWithRouter();

        // Act
        const mailIcon = screen.getByTestId("icon-mail");
        const phoneIcon = screen.getByTestId("icon-phone");
        const supportIcon = screen.getByTestId("icon-support");

        // Assert
        expect(mailIcon).toBeInTheDocument();
        expect(phoneIcon).toBeInTheDocument();
        expect(supportIcon).toBeInTheDocument();
    });

    it("Contact_withoutRouter_rendersLayoutAndTitle", () => {
        // Arrange
        render(<Contact />);

        // Act
        // (no user action needed)

        // Assert
        expect(screen.getByTestId("layout")).toBeInTheDocument();
        expect(screen.getByTestId("layout-title")).toHaveTextContent(
            "Contact us",
        );
    });
});
