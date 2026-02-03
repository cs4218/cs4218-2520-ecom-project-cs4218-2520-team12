import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/extend-expect";
import axios from "axios";
import SearchInput from "../../components/Form/SearchInput";
import { useSearch } from "../../context/search";

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "renders search input bound to keyword" -> Equivalence class: standard render (controlled input)
 * - "typing updates keyword via setValues" -> Equivalence class: onChange updates context state
 * - "submit success calls API, sets results, navigates" -> Equivalence class: happy path side effects
 * - "submit failure logs error and does not navigate" -> Edge/failure: axios.get rejects
 */

jest.mock("axios");

jest.mock("../../context/search", () => ({
    useSearch: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
    ...jest.requireActual("react-router-dom"),
    useNavigate: () => mockNavigate,
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

const renderComponent = () => {
    return render(
        <MemoryRouter>
            <SearchInput />
        </MemoryRouter>,
    );
};

describe("SearchInput Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders search input bound to keyword", () => {
        // Arrange
        useSearch.mockReturnValue([
            { keyword: "laptop", results: [] },
            jest.fn(),
        ]);

        // Act
        renderComponent();

        // Assert
        const input = screen.getByRole("searchbox", { name: /search/i });
        expect(input).toBeInTheDocument();
        expect(input).toHaveValue("laptop");
        expect(
            screen.getByRole("button", { name: /^search$/i }),
        ).toBeInTheDocument();
    });

    it("typing updates keyword via setValues", () => {
        // Arrange
        const setValues = jest.fn();
        useSearch.mockReturnValue([{ keyword: "", results: [] }, setValues]);
        renderComponent();

        // Act
        fireEvent.change(screen.getByRole("searchbox", { name: /search/i }), {
            target: { value: "phone" },
        });

        // Assert
        expect(setValues).toHaveBeenCalledWith({
            keyword: "phone",
            results: [],
        });
    });

    it("submit success calls API, sets results, navigates", async () => {
        // Arrange
        const setValues = jest.fn();
        const values = { keyword: "iphone", results: [] };
        useSearch.mockReturnValue([values, setValues]);

        axios.get.mockResolvedValueOnce({ data: [{ _id: "p1" }] });

        renderComponent();

        // Act
        fireEvent.submit(screen.getByRole("search"));

        // Assert
        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith(
                "/api/v1/product/search/iphone",
            );
        });
        expect(setValues).toHaveBeenCalledWith({
            ...values,
            results: [{ _id: "p1" }],
        });
        expect(mockNavigate).toHaveBeenCalledWith("/search");
    });

    it("submit failure logs error and does not navigate", async () => {
        // Arrange
        const consoleSpy = jest
            .spyOn(console, "log")
            .mockImplementation(() => {});
        const setValues = jest.fn();
        const values = { keyword: "broken", results: [] };
        useSearch.mockReturnValue([values, setValues]);

        axios.get.mockRejectedValueOnce(new Error("network"));

        renderComponent();

        // Act
        fireEvent.submit(screen.getByRole("search"));

        // Assert
        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalled();
        });
        expect(setValues).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
    });
});
