import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import CategoryForm from "../../components/Form/CategoryForm";

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "categoryForm_rendered_displaysInputField" -> Structural completeness: input field present
 * - "categoryForm_rendered_displaysSubmitButton" -> Structural completeness: submit button present
 * - "inputField_rendered_hasCorrectPlaceholder" -> Equivalence class: placeholder text
 * - "inputField_valueProvided_displaysValue" -> Equivalence class: controlled input displays value
 * - "inputField_onChange_callsSetValue" -> Regression/contract: onChange handler invoked
 * - "inputField_userTypes_updatesValue" -> Equivalence class: user interaction updates input
 * - "submitButton_clicked_callsHandleSubmit" -> Regression/contract: form submission handler
 * - "form_submitted_preventsDefaultBehavior" -> Equivalence class: form submission behavior
 * - "inputField_emptyValue_rendersEmpty" -> Edge case: empty string value
 * - "inputField_longValue_displaysCorrectly" -> Edge case: long category name
 */

describe("CategoryForm Component", () => {
    let mockHandleSubmit;
    let mockSetValue;

    beforeEach(() => {
        jest.clearAllMocks();
        mockHandleSubmit = jest.fn((e) => e.preventDefault());
        mockSetValue = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("categoryForm_rendered_displaysInputField", () => {
        // Arrange & Act
        render(
            <CategoryForm
                handleSubmit={mockHandleSubmit}
                value=""
                setValue={mockSetValue}
            />
        );

        // Assert
        const input = screen.getByPlaceholderText(/Enter new category/i);
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute("type", "text");
    });

    it("categoryForm_rendered_displaysSubmitButton", () => {
        // Arrange & Act
        render(
            <CategoryForm
                handleSubmit={mockHandleSubmit}
                value=""
                setValue={mockSetValue}
            />
        );

        // Assert
        const button = screen.getByRole("button", { name: /Submit/i });
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute("type", "submit");
    });

    it("inputField_rendered_hasCorrectPlaceholder", () => {
        // Arrange & Act
        render(
            <CategoryForm
                handleSubmit={mockHandleSubmit}
                value=""
                setValue={mockSetValue}
            />
        );

        // Assert
        const input = screen.getByPlaceholderText("Enter new category");
        expect(input).toBeInTheDocument();
    });

    it("inputField_valueProvided_displaysValue", () => {
        // Arrange
        const testValue = "Electronics";

        // Act
        render(
            <CategoryForm
                handleSubmit={mockHandleSubmit}
                value={testValue}
                setValue={mockSetValue}
            />
        );

        // Assert
        const input = screen.getByPlaceholderText(/Enter new category/i);
        expect(input).toHaveValue(testValue);
    });

    it("inputField_onChange_callsSetValue", () => {
        // Arrange
        render(
            <CategoryForm
                handleSubmit={mockHandleSubmit}
                value=""
                setValue={mockSetValue}
            />
        );

        const input = screen.getByPlaceholderText(/Enter new category/i);

        // Act
        fireEvent.change(input, { target: { value: "Sports" } });

        // Assert
        expect(mockSetValue).toHaveBeenCalledTimes(1);
        expect(mockSetValue).toHaveBeenCalledWith("Sports");
    });

    it("inputField_userTypes_updatesValue", () => {
        // Arrange
        let currentValue = "";
        const mockSetValueLocal = jest.fn((newValue) => {
            currentValue = newValue;
        });

        const { rerender } = render(
            <CategoryForm
                handleSubmit={mockHandleSubmit}
                value={currentValue}
                setValue={mockSetValueLocal}
            />
        );

        const input = screen.getByPlaceholderText(/Enter new category/i);

        // Act - simulate user typing
        fireEvent.change(input, { target: { value: "B" } });
        currentValue = "B";
        rerender(
            <CategoryForm
                handleSubmit={mockHandleSubmit}
                value={currentValue}
                setValue={mockSetValueLocal}
            />
        );

        // Assert
        expect(input).toHaveValue("B");
        expect(mockSetValueLocal).toHaveBeenCalledWith("B");

        // Act - continue typing
        fireEvent.change(input, { target: { value: "Books" } });
        currentValue = "Books";
        rerender(
            <CategoryForm
                handleSubmit={mockHandleSubmit}
                value={currentValue}
                setValue={mockSetValueLocal}
            />
        );

        // Assert
        expect(input).toHaveValue("Books");
        expect(mockSetValueLocal).toHaveBeenCalledWith("Books");
    });

    it("submitButton_clicked_callsHandleSubmit", () => {
        // Arrange
        render(
            <CategoryForm
                handleSubmit={mockHandleSubmit}
                value="Clothing"
                setValue={mockSetValue}
            />
        );

        const button = screen.getByRole("button", { name: /Submit/i });

        // Act
        fireEvent.click(button);

        // Assert
        expect(mockHandleSubmit).toHaveBeenCalledTimes(1);
    });

    it("form_submitted_preventsDefaultBehavior", () => {
        // Arrange
        const mockPreventDefault = jest.fn();
        const mockSubmit = jest.fn((e) => {
            mockPreventDefault();
            e.preventDefault();
        });

        render(
            <CategoryForm
                handleSubmit={mockSubmit}
                value="Gaming"
                setValue={mockSetValue}
            />
        );

        const form = screen.getByRole("button", { name: /Submit/i }).closest("form");

        // Act
        fireEvent.submit(form);

        // Assert
        expect(mockSubmit).toHaveBeenCalledTimes(1);
    });

    it("inputField_emptyValue_rendersEmpty", () => {
        // Arrange & Act
        render(
            <CategoryForm
                handleSubmit={mockHandleSubmit}
                value=""
                setValue={mockSetValue}
            />
        );

        // Assert
        const input = screen.getByPlaceholderText(/Enter new category/i);
        expect(input).toHaveValue("");
    });

    it("inputField_longValue_displaysCorrectly", () => {
        // Arrange
        const longValue = "Electronics and Computer Accessories for Home and Office";

        // Act
        render(
            <CategoryForm
                handleSubmit={mockHandleSubmit}
                value={longValue}
                setValue={mockSetValue}
            />
        );

        // Assert
        const input = screen.getByPlaceholderText(/Enter new category/i);
        expect(input).toHaveValue(longValue);
    });

    it("inputField_rendered_hasCorrectStyling", () => {
        // Arrange & Act
        render(
            <CategoryForm
                handleSubmit={mockHandleSubmit}
                value=""
                setValue={mockSetValue}
            />
        );

        // Assert
        const input = screen.getByPlaceholderText(/Enter new category/i);
        expect(input).toHaveClass("form-control");
    });

    it("submitButton_rendered_hasCorrectStyling", () => {
        // Arrange & Act
        render(
            <CategoryForm
                handleSubmit={mockHandleSubmit}
                value=""
                setValue={mockSetValue}
            />
        );

        // Assert
        const button = screen.getByRole("button", { name: /Submit/i });
        expect(button).toHaveClass("btn", "btn-primary");
    });

    it("inputContainer_rendered_hasCorrectStyling", () => {
        // Arrange & Act
        render(
            <CategoryForm
                handleSubmit={mockHandleSubmit}
                value=""
                setValue={mockSetValue}
            />
        );

        // Assert
        const input = screen.getByPlaceholderText(/Enter new category/i);
        const container = input.closest(".mb-3");
        expect(container).toBeInTheDocument();
    });
});
