// Amos Chee Tian Ee, A0273476U
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom/extend-expect';
import Dashboard from '../../pages/user/Dashboard';

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "dashboard_rendersLayoutComponent" -> Structural completeness: Layout wrapper renders
 * - "dashboard_rendersUserMenuComponent" -> Structural completeness: UserMenu renders in sidebar
 * - "dashboard_displaysUserName" -> Equivalence class: display user name
 * - "dashboard_displaysUserEmail" -> Equivalence class: display user email
 * - "dashboard_displaysUserAddress" -> Equivalence class: display user address
 * - "dashboard_rendersAllUserInfoTogether" -> Structural completeness: all user info in card
 * - "dashboard_usesCorrectLayoutTitle" -> Equivalence class: correct page title
 * - "dashboard_containerStructure" -> Structural completeness: Bootstrap grid layout
 * - "dashboard_userCardStyling" -> Structural completeness: card styling classes applied
 * - "dashboard_handlesNullAuthData" -> Edge case: missing authentication data
 * - "dashboard_displaysDifferentUserData" -> Equivalence class: dynamic user data rendering
 * - "dashboard_handlePartialUserData" -> Edge case: incomplete user information
 * - "dashboard_handlesUndefinedUserFields" -> Edge case: undefined user fields
 * - "dashboard_userInfoHeadings" -> Structural completeness: heading elements present
 * - "dashboard_userInfoDisplayedAsHeadings" -> Equivalence class: info displayed in h3 tags
 */

jest.mock('../../components/Layout', () => {
  return function MockLayout({ title, children }) {
    return (
      <div data-testid="layout" data-title={title}>
        {children}
      </div>
    );
  };
});

jest.mock('../../components/UserMenu', () => {
  return function MockUserMenu() {
    return <div data-testid="user-menu">User Menu</div>;
  };
});

jest.mock('../../context/auth', () => ({
  useAuth: jest.fn(),
}));

const { useAuth } = require('../../context/auth');

const mockAuthUser = {
  name: 'John Doe',
  email: 'john@example.com',
  address: '123 Main Street',
};

const renderDashboard = (authData) => {
  useAuth.mockReturnValue([authData || { user: mockAuthUser }, jest.fn()]);
  return render(
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>
  );
};

describe('User Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    test('dashboard_rendersLayoutComponent', () => {
      // Arrange & Act
      renderDashboard();

      // Assert
      expect(screen.getByTestId('layout')).toBeInTheDocument();
    });

    test('dashboard_rendersUserMenuComponent', () => {
      // Arrange & Act
      renderDashboard();

      // Assert
      expect(screen.getByTestId('user-menu')).toBeInTheDocument();
    });

    test('dashboard_usesCorrectLayoutTitle', () => {
      // Arrange & Act
      renderDashboard();

      // Assert
      const layout = screen.getByTestId('layout');
      expect(layout).toHaveAttribute(
        'data-title',
        'Dashboard - Ecommerce App'
      );
    });
  });

  describe('User Information Display', () => {
    test('dashboard_displaysUserName', () => {
      // Arrange & Act
      renderDashboard();

      // Assert
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    test('dashboard_displaysUserEmail', () => {
      // Arrange & Act
      renderDashboard();

      // Assert
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    test('dashboard_displaysUserAddress', () => {
      // Arrange & Act
      renderDashboard();

      // Assert
      expect(screen.getByText('123 Main Street')).toBeInTheDocument();
    });

    test('dashboard_rendersAllUserInfoTogether', () => {
      // Arrange & Act
      const { container } = renderDashboard();

      // Assert
      const card = container.querySelector('.card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent('John Doe');
      expect(card).toHaveTextContent('john@example.com');
      expect(card).toHaveTextContent('123 Main Street');
    });

    test('dashboard_displaysDifferentUserData', () => {
      // Arrange
      const differentUser = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        address: '456 Oak Avenue',
      };

      // Act
      renderDashboard({ user: differentUser });

      // Assert
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
      expect(screen.getByText('456 Oak Avenue')).toBeInTheDocument();
    });
  });

  describe('Layout and Structure', () => {
    test('dashboard_containerStructure', () => {
      // Arrange & Act
      const { container } = renderDashboard();

      // Assert
      expect(container.querySelector('.container-flui')).toBeInTheDocument();
      expect(container.querySelector('.row')).toBeInTheDocument();
      expect(container.querySelector('.col-md-3')).toBeInTheDocument();
      expect(container.querySelector('.col-md-9')).toBeInTheDocument();
    });

    test('dashboard_userCardStyling', () => {
      // Arrange & Act
      const { container } = renderDashboard();

      // Assert
      const card = container.querySelector('.card');
      expect(card).toHaveClass('w-75');
      expect(card).toHaveClass('p-3');
    });

    test('dashboard_marginAndPaddingClasses', () => {
      // Arrange & Act
      const { container } = renderDashboard();

      // Assert
      const dashboardDiv = container.querySelector('.dashboard');
      expect(dashboardDiv).toHaveClass('m-3');
      expect(dashboardDiv).toHaveClass('p-3');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('dashboard_handlesNullAuthData', () => {
      // Arrange & Act
      useAuth.mockReturnValue([{}, jest.fn()]);
      const { container } = renderDashboard({});

      // Assert - Should render without crashing
      expect(screen.getByTestId('layout')).toBeInTheDocument();
      expect(screen.getByTestId('user-menu')).toBeInTheDocument();
    });

    test('dashboard_handlesPartialUserData', () => {
      // Arrange & Act
      const partialUser = { name: 'Partial User' };
      renderDashboard({ user: partialUser });

      // Assert
      expect(screen.getByText('Partial User')).toBeInTheDocument();
    });

    test('dashboard_handlesUndefinedUserFields', () => {
      // Arrange & Act
      const userWithUndefinedFields = {
        name: undefined,
        email: 'test@example.com',
        address: undefined,
      };

      // Act & Assert - Should not crash
      expect(() => {
        renderDashboard({ user: userWithUndefinedFields });
      }).not.toThrow();
    });
  });

  describe('Heading Elements', () => {
    test('dashboard_userInfoHeadings', () => {
      // Arrange & Act
      const { container } = renderDashboard();

      // Assert
      const h3Tags = container.querySelectorAll('h3');
      // Should have 3 h3 tags for name, email, and address
      expect(h3Tags.length).toBeGreaterThanOrEqual(3);
    });

    test('dashboard_userInfoDisplayedAsHeadings', () => {
      // Arrange & Act
      const { container } = renderDashboard();

      // Assert
      const headings = Array.from(container.querySelectorAll('h3'));
      expect(headings.some((h) => h.textContent === 'John Doe')).toBe(true);
    });
  });
});
