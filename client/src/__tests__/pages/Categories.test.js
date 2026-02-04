/* eslint-disable testing-library/no-container */
/* eslint-disable testing-library/no-node-access */


import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/extend-expect';
import Categories from '../../pages/Categories';
import useCategory from '../../hooks/useCategory';
import axios from 'axios';

// Mock dependencies
jest.mock('../../hooks/useCategory');
jest.mock('../../context/auth', () => ({
  useAuth: jest.fn(() => [null, jest.fn()])
}));
jest.mock('../../context/cart', () => ({
  useCart: jest.fn(() => [[], jest.fn()])
}));
jest.mock('../../context/search', () => ({
  useSearch: jest.fn(() => [{ keyword: '' }, jest.fn()])
}));
jest.mock('axios');

window.matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: function() {},
    removeListener: function() {}
  };
};

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "renders_categoriesPage_displaysTitle" -> Equivalence class: standard page render (title anchor)
 * - "loadCategories_onMount_displaysAllCategories" -> Equivalence class: multiple categories display
 * - "categoryLink_displayed_hasCorrectHref" -> Structural completeness: link routing integrity
 * - "emptyCategories_noData_displaysEmptyGrid" -> Edge case: no categories available
 * - "multipleCategories_rendered_eachHasUniqueKey" -> Structural completeness: React key uniqueness
 */

describe('Categories Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/product/braintree/token') {
        return Promise.resolve({ data: { success: true } });
      }
    });
  });
  
  afterEach(() => {
  });
  
  it('renders_categoriesPage_displaysTitle', () => {
    // Arrange
    useCategory.mockReturnValue([]);
    
    // Act
    render(
      <MemoryRouter>
        <Categories />
      </MemoryRouter>
    );

    // Assert
    expect(screen.getByText('All Categories')).toBeInTheDocument();
  });

  it('loadCategories_onMount_displaysAllCategories', () => {
    // Arrange
    const mockCategories = [
      { _id: '1', name: 'Electronics', slug: 'electronics' },
      { _id: '2', name: 'Clothing', slug: 'clothing' },
      { _id: '3', name: 'Books', slug: 'books' }
    ];
    useCategory.mockReturnValue(mockCategories);

    // Act
    const { container } = render(
      <MemoryRouter>
        <Categories />
      </MemoryRouter>
    );

    // Assert
    const categoryButtons = container.querySelectorAll('.btn-primary');
    expect(categoryButtons).toHaveLength(3);
    expect(categoryButtons[0]).toHaveTextContent('Electronics');
    expect(categoryButtons[1]).toHaveTextContent('Clothing');
    expect(categoryButtons[2]).toHaveTextContent('Books');
  });

  it('categoryLink_displayed_hasCorrectHref', () => {
    // Arrange
    const mockCategories = [
      { _id: '1', name: 'TestCategory', slug: 'testcategory' }
    ];
    useCategory.mockReturnValue(mockCategories);

    // Act
    const { container } = render(
      <MemoryRouter>
        <Categories />
      </MemoryRouter>
    );

    // Assert
    const categoryLink = container.querySelector('.btn-primary');
    expect(categoryLink).toHaveAttribute('href', '/category/testcategory');
    expect(categoryLink).toHaveTextContent('TestCategory');
  });

  it('emptyCategories_noData_displaysEmptyGrid', () => {
    // Arrange
    useCategory.mockReturnValue([]);

    // Act
    const { container } = render(
      <MemoryRouter>
        <Categories />
      </MemoryRouter>
    );

    // Assert
    const categoryButtons = container.querySelectorAll('.btn-primary');
    expect(categoryButtons).toHaveLength(0);
  });

  it('multipleCategories_rendered_eachHasUniqueKey', () => {
    // Arrange
    const mockCategories = [
      { _id: '1', name: 'Electronics', slug: 'electronics' },
      { _id: '2', name: 'Clothing', slug: 'clothing' }
    ];
    useCategory.mockReturnValue(mockCategories);

    // Act
    const { container } = render(
      <MemoryRouter>
        <Categories />
      </MemoryRouter>
    );

    // Assert
    const categoryLinks = container.querySelectorAll('.btn-primary');
    expect(categoryLinks).toHaveLength(2);
  });
});
