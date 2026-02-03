import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom/extend-expect';
import axios from 'axios';
import CategoryProduct from '../../pages/CategoryProduct';

// Mock dependencies
jest.mock('axios');
jest.mock('../../hooks/useCategory', () => ({
  __esModule: true,
  default: jest.fn(() => [])
}));
jest.mock('../../context/auth', () => ({
  useAuth: jest.fn(() => [null, jest.fn()])
}));
jest.mock('../../context/cart', () => ({
  useCart: jest.fn(() => [[], jest.fn()])
}));
jest.mock('../../context/search', () => ({
  useSearch: jest.fn(() => [{ keyword: '' }, jest.fn()])
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

window.matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: function() {},
    removeListener: function() {}
  };
};


describe('CategoryProduct Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {})
  });

  test('renders_categoryProductPage_displaysLoading', () => {
    // Arrange
    axios.get.mockImplementation(() => new Promise(() => {}));

    // Act
    render(
      <MemoryRouter initialEntries={['/category/electronics']}>
        <Routes>
          <Route path="/category/:slug" element={<CategoryProduct />} />
        </Routes>
      </MemoryRouter>
    );

    // Assert
    expect(screen.getByText('Category -')).toBeInTheDocument();
  });

  test('fetchProducts_onMount_callsAPIWithSlug', async () => {
    // Arrange
    const mockData = {
      success: true,
      category: { _id: '1', name: 'Electronics', slug: 'electronics' },
      products: []
    };
    axios.get.mockResolvedValueOnce({ data: mockData });

    // Act
    render(
      <MemoryRouter initialEntries={['/category/electronics']}>
        <Routes>
          <Route path="/category/:slug" element={<CategoryProduct />} />
        </Routes>
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/api/v1/product/product-category/electronics');
    });
  });

  test('displayProducts_validData_showsProductCards', async () => {
    // Arrange
    const mockProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: 'High performance laptop' },
      { _id: '2', name: 'Mouse', slug: 'mouse', price: 25, description: 'Wireless mouse' },
      { _id: '3', name: 'Keyboard', slug: 'keyboard', price: 75, description: 'Mechanical keyboard' }
    ];
    const mockData = {
      success: true,
      category: { _id: '1', name: 'Electronics', slug: 'electronics' },
      products: mockProducts
    };
    axios.get.mockResolvedValueOnce({ data: mockData });

    // Act
    render(
      <MemoryRouter initialEntries={['/category/electronics']}>
        <Routes>
          <Route path="/category/:slug" element={<CategoryProduct />} />
        </Routes>
      </MemoryRouter>
    );

    // Assert
    expect(await screen.findByText('Category - Electronics')).toBeInTheDocument();
    expect(await screen.findByText('3 result found')).toBeInTheDocument();
    expect(await screen.findByText('Laptop')).toBeInTheDocument();
    expect(await screen.findByText('Mouse')).toBeInTheDocument();
    expect(await screen.findByText('Keyboard')).toBeInTheDocument();
  });

  test('displayCategory_validData_showsCategoryName', async () => {
    // Arrange
    const mockData = {
      success: true,
      category: { _id: '1', name: 'Electronics', slug: 'electronics' },
      products: []
    };
    axios.get.mockResolvedValueOnce({ data: mockData });

    // Act
    render(
      <MemoryRouter initialEntries={['/category/electronics']}>
        <Routes>
          <Route path="/category/:slug" element={<CategoryProduct />} />
        </Routes>
      </MemoryRouter>
    );

    // Assert
    expect(await screen.findByText('Category - Electronics')).toBeInTheDocument();
    expect(await screen.findByText('0 result found')).toBeInTheDocument();
  });

  test('productPrice_displayed_formattedAsCurrency', async () => {
    // Arrange
    const mockProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999.99, description: 'High performance laptop' }
    ];
    const mockData = {
      success: true,
      category: { _id: '1', name: 'Electronics', slug: 'electronics' },
      products: mockProducts
    };
    axios.get.mockResolvedValueOnce({ data: mockData });

    // Act
    render(
      <MemoryRouter initialEntries={['/category/electronics']}>
        <Routes>
          <Route path="/category/:slug" element={<CategoryProduct />} />
        </Routes>
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByText('$999.99')).toBeInTheDocument();
    });
  });

  test('productDescription_longText_truncatesTo60Chars', async () => {
    // Arrange
    const longDescription = 'This is a very long description that should be truncated to only sixty characters maximum';
    const mockProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: longDescription }
    ];
    const mockData = {
      success: true,
      category: { _id: '1', name: 'Electronics', slug: 'electronics' },
      products: mockProducts
    };
    axios.get.mockResolvedValueOnce({ data: mockData });

    // Act
    render(
      <MemoryRouter initialEntries={['/category/electronics']}>
        <Routes>
          <Route path="/category/:slug" element={<CategoryProduct />} />
        </Routes>
      </MemoryRouter>
    );

    // Assert
    const truncatedText = await screen.findByText(
  /This is a very long description that should be truncated/);

    expect(truncatedText).toHaveTextContent('...');
    expect(truncatedText.textContent.length).toBeLessThanOrEqual(64);
   
  });

  test('apiError_failedRequest_handlesGracefully', async () => {
    // Arrange
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    axios.get.mockRejectedValueOnce(new Error('Network error'));

    // Act
    render(
      <MemoryRouter initialEntries={['/category/electronics']}>
        <Routes>
          <Route path="/category/:slug" element={<CategoryProduct />} />
        </Routes>
      </MemoryRouter>
    );

    // Assert
    await waitFor(() => {
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    consoleLogSpy.mockRestore();
  });

  test('moreDetailsButton_hasCorrectClass', async () => {
    // Arrange
    const mockProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: 'High performance laptop' }
    ];
    const mockData = {
      success: true,
      category: { _id: '1', name: 'Electronics', slug: 'electronics' },
      products: mockProducts
    };
    axios.get.mockResolvedValueOnce({ data: mockData });

    // Act
    render(
      <MemoryRouter initialEntries={['/category/electronics']}>
        <Routes>
          <Route path="/category/:slug" element={<CategoryProduct />} />
        </Routes>
      </MemoryRouter>
    );

    // Assert
    const button = await screen.findByRole('button', {
    name: 'More Details',
  });

  expect(button).toBeInTheDocument();
  expect(button).toHaveClass('btn', 'btn-info');
  });

  test('noSlug_skipsAPICall', () => {
    // Arrange
    axios.get.mockClear();

    // Act
    render(
      <MemoryRouter initialEntries={['/category/']}>
        <Routes>
          <Route path="/category/:slug?" element={<CategoryProduct />} />
        </Routes>
      </MemoryRouter>
    );

    // Assert - Should not call API when no slug
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('moreDetailsButton_click_navigatesToProductDetails', async () => {
    // Arrange
    const mockProducts = [
      { _id: '1', name: 'Laptop', slug: 'laptop', price: 999, description: 'High performance laptop' }
    ];
    const mockData = {
      success: true,
      category: { _id: '1', name: 'Electronics', slug: 'electronics' },
      products: mockProducts
    };
    axios.get.mockResolvedValueOnce({ data: mockData });

    // Act
    render(
      <MemoryRouter initialEntries={['/category/electronics']}>
        <Routes>
          <Route path="/category/:slug" element={<CategoryProduct />} />
        </Routes>
      </MemoryRouter>
    );

    const button = await screen.findByRole('button', {
      name: 'More Details',
    });

    fireEvent.click(button);

    // Assert
    expect(mockNavigate).toHaveBeenCalledWith('/product/laptop');
  });
});
