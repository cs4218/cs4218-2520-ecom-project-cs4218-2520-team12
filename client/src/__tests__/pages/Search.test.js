import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import Search from "../../pages/Search";
import { useSearch } from "../../context/search";

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "renders empty state when results is empty" -> Equivalence class: results.length < 1
 * - "renders count when results exist" -> Equivalence class: results.length >= 1 (boundary: 1)
 * - "renders a card per product with correct anchors" -> Structural completeness: name/price/description snippet + image src
 * - "handles missing context value without crashing" -> Edge/rare case: useSearch returns undefined (optional chaining paths)
 * - "passes the expected title to Layout" -> Regression/contract: verifies prop passed to wrapper
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

jest.mock("../../context/search", () => ({
    useSearch: jest.fn(),
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
        <MemoryRouter initialEntries={["/search"]}>
            <Routes>
                <Route path="/search" element={<Search />} />
            </Routes>
        </MemoryRouter>,
    );
};

describe("Search Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders empty state when results is empty", () => {
        // Arrange
        useSearch.mockReturnValue([{ keyword: "abc", results: [] }, jest.fn()]);
        renderWithRouter();

        // Act
        // (no user action needed)

        // Assert
        expect(screen.getByTestId("layout")).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: /search resuts/i }),
        ).toBeInTheDocument();
        expect(screen.getByText("No Products Found")).toBeInTheDocument();
    });

    it("renders count when results exist (boundary: 1)", () => {
        // Arrange
        useSearch.mockReturnValue([
            {
                keyword: "abc",
                results: [
                    {
                        _id: "p1",
                        name: "Product One",
                        description: "123456789012345678901234567890XYZ",
                        price: 10,
                    },
                ],
            },
            jest.fn(),
        ]);
        renderWithRouter();

        // Act
        // (no user action needed)

        // Assert
        expect(screen.getByText("Found 1")).toBeInTheDocument();
    });

    it("renders a card per product with correct anchors", () => {
        // Arrange
        useSearch.mockReturnValue([
            {
                keyword: "",
                results: [
                    {
                        _id: "p1",
                        name: "Product One",
                        description:
                            "This description is definitely longer than thirty chars",
                        price: 10,
                    },
                    {
                        _id: "p2",
                        name: "Product Two",
                        description:
                            "Another description that is also longer than thirty chars",
                        price: 20,
                    },
                ],
            },
            jest.fn(),
        ]);
        renderWithRouter();

        // Act
        const images = screen.getAllByRole("img");

        // Assert
        expect(screen.getByText("Found 2")).toBeInTheDocument();
        expect(screen.getByText("Product One")).toBeInTheDocument();
        expect(screen.getByText("Product Two")).toBeInTheDocument();
        expect(screen.getByText(/\$\s*10/)).toBeInTheDocument();
        expect(screen.getByText(/\$\s*20/)).toBeInTheDocument();

        // Description snippet behavior: substring(0, 30) + "..."
        const snippetParagraphs = screen.getAllByText((_, node) => {
            if (!node || node.tagName !== "P") return false;
            return /This description is definitely\s*\.\.\./.test(
                node.textContent || "",
            );
        });
        expect(snippetParagraphs).toHaveLength(1);

        expect(images).toHaveLength(2);
        expect(images[0]).toHaveAttribute(
            "src",
            "/api/v1/product/product-photo/p1",
        );
        expect(images[1]).toHaveAttribute(
            "src",
            "/api/v1/product/product-photo/p2",
        );
    });

    it("handles missing context value without crashing", () => {
        // Arrange
        useSearch.mockReturnValue([undefined, jest.fn()]);
        renderWithRouter();

        // Act
        // (no user action needed)

        // Assert
        expect(screen.getByTestId("layout")).toBeInTheDocument();
        // With `values` undefined, the current component renders "Found undefined"
        // because `(values?.results.length < 1)` is false when length is undefined.
        expect(screen.getByText("Found undefined")).toBeInTheDocument();
    });

    it("passes the expected title to Layout", () => {
        // Arrange
        useSearch.mockReturnValue([{ keyword: "", results: [] }, jest.fn()]);
        renderWithRouter();

        // Act
        const titleNode = screen.getByTestId("layout-title");

        // Assert
        expect(titleNode).toHaveTextContent("Search results");
    });
});
