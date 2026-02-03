import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import Policy from "../../pages/Policy";

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "renders main content inside layout" -> Equivalence class: standard render (Layout wrapper + at least one stable text anchor)
 * - "renders the policy image with expected attributes" -> Structural completeness: expected static media present
 * - "renders exactly 7 policy paragraphs" -> Boundary/structural check: repeated static content count
 * - "passes the expected title to Layout" -> Regression/contract: verifies prop passed to wrapper component
 * - "renders without a router wrapper" -> Edge/rare case: no router context needed (Policy has no router hooks)
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
        <MemoryRouter initialEntries={["/policy"]}>
            <Routes>
                <Route path="/policy" element={<Policy />} />
            </Routes>
        </MemoryRouter>,
    );
};

describe("Policy Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("Policy_defaultRender_rendersLayoutAndContent", () => {
        // Arrange
        renderWithRouter();

        // Act
        // (no user action needed)

        // Assert
        expect(screen.getByTestId("layout")).toBeInTheDocument();
        expect(
            screen.getAllByText("add privacy policy").length,
        ).toBeGreaterThan(0);
    });

    it("Policy_defaultRender_rendersPolicyImage", () => {
        // Arrange
        renderWithRouter();

        // Act
        const image = screen.getByAltText("contactus");

        // Assert
        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute("src", "/images/contactus.jpeg");
    });

    it("Policy_defaultRender_rendersSevenPolicyParagraphs", () => {
        // Arrange
        renderWithRouter();

        // Act
        const paragraphs = screen.getAllByText("add privacy policy");

        // Assert
        expect(paragraphs).toHaveLength(7);
    });

    it("Layout_defaultRender_receivesPrivacyPolicyTitle", () => {
        // Arrange
        renderWithRouter();

        // Act
        const titleNode = screen.getByTestId("layout-title");

        // Assert
        expect(titleNode).toHaveTextContent("Privacy Policy");
    });

    it("Policy_withoutRouter_rendersLayoutAndTitle", () => {
        // Arrange
        render(<Policy />);

        // Act
        // (no user action needed)

        // Assert
        expect(screen.getByTestId("layout")).toBeInTheDocument();
        expect(screen.getByTestId("layout-title")).toHaveTextContent(
            "Privacy Policy",
        );
    });
});
