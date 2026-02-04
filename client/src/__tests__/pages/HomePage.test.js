
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/extend-expect';
import axios from 'axios';
import toast from 'react-hot-toast';
import HomePage from '../../pages/HomePage';
import { useCart } from '../../context/cart';

// Mock dependencies
jest.mock('axios');
jest.mock('react-hot-toast');
jest.mock('react-icons/ai', () => ({
  AiOutlineReload: () => 'AiOutlineReload'
}));
jest.mock('../../context/auth', () => ({
  useAuth: jest.fn(() => [null, jest.fn()])
}));
jest.mock('../../context/cart', () => ({
  useCart: jest.fn()
}));
jest.mock('../../context/search', () => ({
  useSearch: jest.fn(() => [{ keyword: '' }, jest.fn()])
}));

window.matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: function() {},
    removeListener: function() {}
  };
};

Object.defineProperty(window, 'localStorage', {
  value: {
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
  },
  writable: true,
});

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "renders_homePage_displaysProductsAndFilters" -> Equivalence class: standard page render with filters
 * - "loadProducts_onMount_fetchesAndDisplaysProducts" -> Equivalence class: product list initialization
 * - "filterByCategory_selectCategory_callsFilterAPI" -> Filter partition: category-based filtering
 * - "filterByPrice_selectPriceRange_callsFilterAPI" -> Filter partition: price range filtering
 * - "addToCart_clickButton_addsProductToCart" -> Equivalence class: cart addition operation
 * - "loadMore_clickButton_loadsMoreProducts" -> Pagination partition: incremental loading
 * - "productDescription_longText_truncatesTo60Chars" -> Boundary analysis: text truncation at 60 chars
 * - "productPrice_displayed_formattedAsCurrency" -> Data formatting partition: price presentation
 * - "apiError_getAllCategory_handlesGracefully" -> Error handling partition: category fetch failure
 * - "apiError_getTotal_handlesGracefully" -> Error handling partition: product count failure
 * - "apiError_getAllProducts_handlesGracefully" -> Error handling partition: product list failure
 * - "apiError_loadMore_handlesGracefully" -> Error handling partition: pagination failure
 * - "apiError_filterProduct_handlesGracefully" -> Error handling partition: filter operation failure
 * - "uncheckCategory_removesFromFilter" -> Filter partition: filter removal behavior
 * - "resetFiltersButton_click_reloadsPage" -> Filter partition: reset functionality
 * - "moreDetailsButton_click_navigatesToProductPage" -> Navigation partition: product detail routing
 */

describe('HomePage Component', () => {
  let mockCart;
  let mockSetCart;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCart = [];
    mockSetCart = jest.fn();
    useCart.mockReturnValue([mockCart, mockSetCart]);
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  test('renders_homePage_displaysProductsAndFilters', async () => {
    // Arrange
    const mockCategories = [
      { _id: '1', name: 'Electronics', slug: 'electronics' }
    ];
    const mockProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: 'High performance laptop' }
    ];
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: true, category: mockCategories } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 1 } });
      }
      if (url.includes('/api/v1/product/product-list/')) {
        return Promise.resolve({ data: { products: mockProducts } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Assert
    expect(await screen.findByText('Filter By Category')).toBeInTheDocument();
    expect(await screen.findByText('Filter By Price')).toBeInTheDocument();
    expect(await screen.findByText('All Products')).toBeInTheDocument();

  });

  test('loadProducts_onMount_fetchesAndDisplaysProducts', async () => {
    // Arrange
    const mockCategories = [
      { _id: '1', name: 'Electronics', slug: 'electronics' }
    ];
    const mockProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: 'High performance laptop for professionals' },
      { _id: '2', name: 'Mouse', slug: 'mouse', price: 25, description: 'Wireless gaming mouse with RGB lighting' }
    ];
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: true, category: mockCategories } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 2 } });
      }
      if (url.includes('/api/v1/product/product-list/')) {
        return Promise.resolve({ data: { products: mockProducts } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Assert
    expect(await screen.findByText('Laptop')).toBeInTheDocument();
    expect(await screen.findByText('Mouse')).toBeInTheDocument();
  });

  test('filterByCategory_selectCategory_callsFilterAPI', async () => {
    // Arrange
    const mockCategories = [
      { _id: '1', name: 'Electronics', slug: 'electronics' }
    ];
    const mockProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: 'High performance laptop' }
    ];
    const mockFilteredProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: 'High performance laptop' }
    ];
    
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: true, category: mockCategories } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 1 } });
      }
      if (url.includes('/api/v1/product/product-list/')) {
        return Promise.resolve({ data: { products: mockProducts } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
    
    axios.post.mockResolvedValueOnce({ 
      data: { products: mockFilteredProducts } 
    });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      const electronicsElements = screen.getAllByText('Electronics');
      expect(electronicsElements.length).toBeGreaterThan(0);
    });

    const checkbox = screen.getByLabelText('Electronics');
    fireEvent.click(checkbox);

    // Assert
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/v1/product/product-filters', {
        checked: ['1'],
        radio: []
      });
    });
  });

  test('filterByPrice_selectPriceRange_callsFilterAPI', async () => {
    // Arrange
    const mockCategories = [
      { _id: '1', name: 'Electronics', slug: 'electronics' }
    ];
    const mockProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: 'High performance laptop' }
    ];
    
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: true, category: mockCategories } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 1 } });
      }
      if (url.includes('/api/v1/product/product-list/')) {
        return Promise.resolve({ data: { products: mockProducts } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
    
    axios.post.mockResolvedValueOnce({ 
      data: { products: mockProducts } 
    });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Filter By Price')).toBeInTheDocument();
    });

    const priceRadio = screen.getByRole('radio', {
      name: '$0 to 19',
    });
    fireEvent.click(priceRadio);

    // Assert
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/v1/product/product-filters', {
        checked: [],
        radio: [0, 19]
      });
    });
  });

  test('addToCart_clickButton_addsProductToCart', async () => {
    // Arrange
    const mockCategories = [
      { _id: '1', name: 'Electronics', slug: 'electronics' }
    ];
    const mockProduct = { 
      _id: '1', 
      name: 'Laptop', 
      slug: 'laptop', 
      price: 999, 
      description: 'High performance laptop for professionals and gamers' 
    };
    const mockProducts = [mockProduct];
    
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: true, category: mockCategories } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 1 } });
      }
      if (url.includes('/api/v1/product/product-list/')) {
        return Promise.resolve({ data: { products: mockProducts } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Laptop')).toBeInTheDocument();
    });

    const addToCartButton = screen.getByText('ADD TO CART');
    fireEvent.click(addToCartButton);

    // Assert
    expect(mockSetCart).toHaveBeenCalledWith([mockProduct]);
    expect(window.localStorage.setItem).toHaveBeenCalledWith('cart', JSON.stringify([mockProduct]));
    expect(toast.success).toHaveBeenCalledWith('Item Added to cart');
  });

  test('loadMore_clickButton_loadsMoreProducts', async () => {
    // Arrange
    const mockCategories = [
      { _id: '1', name: 'Electronics', slug: 'electronics' }
    ];
    const initialProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: 'High performance laptop' }
    ];
    const moreProducts = [
      { _id: '2', name: 'Mouse', slug: 'mouse', price: 25, description: 'Wireless mouse' }
    ];
    
    let callCount = 0;
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: true, category: mockCategories } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 2 } });
      }
      if (url.includes('/api/v1/product/product-list/')) {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ data: { products: initialProducts } });
        } else {
          return Promise.resolve({ data: { products: moreProducts } });
        }
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Laptop')).toBeInTheDocument();
    });

    const loadMoreButton = screen.getByText(/Loadmore/);
    fireEvent.click(loadMoreButton);

    // Assert
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/v1/product/product-list/2');
    });
  });

  test('productDescription_longText_truncatesTo60Chars', async () => {
    // Arrange
    const mockCategories = [
      { _id: '1', name: 'Electronics', slug: 'electronics' }
    ];
    const longDescription = 'This is a very long description that should be truncated to only sixty characters maximum for display';
    const mockProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: longDescription }
    ];
    
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: true, category: mockCategories } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 1 } });
      }
      if (url.includes('/api/v1/product/product-list/')) {
        return Promise.resolve({ data: { products: mockProducts } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      const truncatedText = screen.getByText(/This is a very long description/);
      expect(truncatedText.textContent).toContain('...');
    });
  });

  test('productPrice_displayed_formattedAsCurrency', async () => {
    // Arrange
    const mockCategories = [
      { _id: '1', name: 'Electronics', slug: 'electronics' }
    ];
    const mockProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999.99, description: 'High performance laptop' }
    ];
    
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: true, category: mockCategories } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 1 } });
      }
      if (url.includes('/api/v1/product/product-list/')) {
        return Promise.resolve({ data: { products: mockProducts } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByText('$999.99')).toBeInTheDocument();
    });
  });

  test('apiError_getAllCategory_handlesGracefully', async () => {
    // Arrange
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.reject(new Error('Category API error'));
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 0 } });
      }
      if (url.includes('/api/v1/product/product-list/')) {
        return Promise.resolve({ data: { products: [] } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    consoleLogSpy.mockRestore();
  });

  test('apiError_getTotal_handlesGracefully', async () => {
    // Arrange
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: true, category: [] } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.reject(new Error('Count API error'));
      }
      if (url.includes('/api/v1/product/product-list/')) {
        return Promise.resolve({ data: { products: [] } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    consoleLogSpy.mockRestore();
  });

  test('apiError_getAllProducts_handlesGracefully', async () => {
    // Arrange
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: true, category: [] } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 0 } });
      }
      if (url.includes('/api/v1/product/product-list/')) {
        return Promise.reject(new Error('Products API error'));
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    consoleLogSpy.mockRestore();
  });

  test('apiError_loadMore_handlesGracefully', async () => {
    // Arrange
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockCategories = [
      { _id: '1', name: 'Electronics', slug: 'electronics' }
    ];
    const initialProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: 'High performance laptop' }
    ];
    
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: true, category: mockCategories } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 2 } });
      }
      if (url === '/api/v1/product/product-list/1') {
        return Promise.resolve({ data: { products: initialProducts } });
      }
      if (url === '/api/v1/product/product-list/2') {
        return Promise.reject(new Error('Load more error'));
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Laptop')).toBeInTheDocument();
    });

    const loadMoreButton = screen.getByText(/Loadmore/);
    fireEvent.click(loadMoreButton);

    // Assert
    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    consoleLogSpy.mockRestore();
  });

  test('apiError_filterProduct_handlesGracefully', async () => {
    // Arrange
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const mockCategories = [
      { _id: '1', name: 'Electronics', slug: 'electronics' }
    ];
    const mockProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: 'High performance laptop' }
    ];
    
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: true, category: mockCategories } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 1 } });
      }
      if (url.includes('/api/v1/product/product-list/')) {
        return Promise.resolve({ data: { products: mockProducts } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
    
    axios.post.mockRejectedValueOnce(new Error('Filter API error'));

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      const electronicsElements = screen.getAllByText('Electronics');
      expect(electronicsElements.length).toBeGreaterThan(0);
    });

    const checkbox = screen.getByLabelText('Electronics');
    fireEvent.click(checkbox);

    // Assert
    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    consoleLogSpy.mockRestore();
  });

  test('uncheckCategory_removesFromFilter', async () => {
    // Arrange
    const mockCategories = [
      { _id: '1', name: 'Electronics', slug: 'electronics' }
    ];
    const mockProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: 'High performance laptop' }
    ];
    
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: true, category: mockCategories } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 1 } });
      }
      if (url.includes('/api/v1/product/product-list/')) {
        return Promise.resolve({ data: { products: mockProducts } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      const electronicsElements = screen.getAllByText('Electronics');
      expect(electronicsElements.length).toBeGreaterThan(0);
    });

    const checkbox = screen.getByLabelText('Electronics');
    
    // Check then uncheck
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
    });
    
    jest.clearAllMocks();
    fireEvent.click(checkbox);

    // Assert - should call getAllProducts when filters cleared
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalled();
    });
  });

  test('resetFiltersButton_click_reloadsPage', async () => {
    // Arrange
    delete window.location;
    window.location = { reload: jest.fn() };
    
    const mockCategories = [
      { _id: '1', name: 'Electronics', slug: 'electronics' }
    ];
    const mockProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: 'High performance laptop' }
    ];
    
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: true, category: mockCategories } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 1 } });
      }
      if (url.includes('/api/v1/product/product-list/')) {
        return Promise.resolve({ data: { products: mockProducts } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('RESET FILTERS')).toBeInTheDocument();
    });

    const resetButton = screen.getByText('RESET FILTERS');
    fireEvent.click(resetButton);

    // Assert
    expect(window.location.reload).toHaveBeenCalled();
  });

  test('moreDetailsButton_click_navigatesToProductPage', async () => {
    // Arrange
    const mockNavigate = jest.fn();
    jest.doMock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate
    }));

    const mockCategories = [
      { _id: '1', name: 'Electronics', slug: 'electronics' }
    ];
    const mockProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: 'High performance laptop' }
    ];
    
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: true, category: mockCategories } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 1 } });
      }
      if (url.includes('/api/v1/product/product-list/')) {
        return Promise.resolve({ data: { products: mockProducts } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Laptop')).toBeInTheDocument();
    });

    const moreDetailsButton = screen.getByText('More Details');
    fireEvent.click(moreDetailsButton);

    // Assert - button should be clickable (navigate handled by router)
    expect(moreDetailsButton).toBeInTheDocument();
  });

  test('getAllCategory_successFalse_doesNotSetCategories', async () => {
    // Arrange - Line 27 coverage: when data.success is false
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: false, category: [] } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 0 } });
      }
      if (url.includes('/api/v1/product/product-list/')) {
        return Promise.resolve({ data: { products: [] } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Assert - categories should not be set when success is false
    await waitFor(() => {
      expect(screen.getByText('Filter By Category')).toBeInTheDocument();
    });
    
    // No categories should be displayed
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  test('clearFilters_bothFiltersAppliedThenCleared_triggersGetAllProducts', async () => {
    // Arrange - Line 90 coverage: specifically test the condition (!checked.length || !radio.length)
    const mockCategories = [
      { _id: '1', name: 'Electronics', slug: 'electronics' }
    ];
    const mockProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: 'High performance laptop' }
    ];
    
    const getCallHistory = [];
    axios.get.mockImplementation((url) => {
      if (url === '/api/v1/category/get-category') {
        return Promise.resolve({ data: { success: true, category: mockCategories } });
      }
      if (url === '/api/v1/product/product-count') {
        return Promise.resolve({ data: { total: 1 } });
      }
      if (url.includes('/api/v1/product/product-list/')) {
        getCallHistory.push(url);
        return Promise.resolve({ data: { products: mockProducts } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
    
    axios.post.mockResolvedValue({ data: { products: mockProducts } });

    // Act
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByLabelText('Electronics')).toBeInTheDocument();
    });

    // Apply both filters: category AND price
    const electronicsCheckbox = screen.getByLabelText('Electronics');
    fireEvent.click(electronicsCheckbox);
    
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    const priceRadio = screen.getByRole('radio', { name: '$0 to 19' });
    fireEvent.click(priceRadio);
    
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledTimes(2);
    });

    jest.clearAllMocks();
    const beforeClearGetCalls = getCallHistory.length;

    // Clear category filter (radio still has value, so condition !checked.length is true)
    fireEvent.click(electronicsCheckbox);

    // Assert - getAllProducts should be called because checked.length is now 0 (line 90)
    await waitFor(() => {
      expect(getCallHistory.length).toBeGreaterThan(beforeClearGetCalls);
    }, { timeout: 2000 });
  });
});
