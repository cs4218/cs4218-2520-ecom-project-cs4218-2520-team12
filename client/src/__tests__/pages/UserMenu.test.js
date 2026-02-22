// Amos Chee Tian Ee, A0273476U
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom/extend-expect';
import UserMenu from '../../components/UserMenu';

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "usermenu_rendersDashboardHeading" -> Structural completeness: Dashboard heading present
 * - "usermenu_rendersProfileLink" -> Equivalence class: Profile link renders
 * - "usermenu_rendersOrdersLink" -> Equivalence class: Orders link renders
 * - "usermenu_profileLinkPointsToCorrectRoute" -> Equivalence class: Profile link points to /dashboard/user/profile
 * - "usermenu_ordersLinkPointsToCorrectRoute" -> Equivalence class: Orders link points to /dashboard/user/orders
 * - "usermenu_linksHaveCorrectCssClass" -> Structural completeness: Bootstrap classes applied
 * - "usermenu_containerHasTextCenter" -> Structural completeness: text-center styling
 * - "usermenu_listGroupContainer" -> Structural completeness: list-group container
 * - "usermenu_linksAreNavigationElements" -> Equivalence class: NavLink accessibility
 * - "usermenu_dashboardHeadingPresent" -> Equivalence class: h4 heading element renders
 */

const renderUserMenu = () => {
  return render(
    <BrowserRouter>
      <UserMenu />
    </BrowserRouter>
  );
};

describe('UserMenu Component', () => {
  describe('Component Rendering', () => {
    test('usermenu_rendersDashboardHeading', () => {
      // Arrange & Act
      renderUserMenu();

      // Assert
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    test('usermenu_rendersProfileLink', () => {
      // Arrange & Act
      renderUserMenu();

      // Assert
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    test('usermenu_rendersOrdersLink', () => {
      // Arrange & Act
      renderUserMenu();

      // Assert
      expect(screen.getByText('Orders')).toBeInTheDocument();
    });
  });

  describe('Navigation Links', () => {
    test('usermenu_profileLinkPointsToCorrectRoute', () => {
      // Arrange & Act
      renderUserMenu();
      const profileLink = screen.getByText('Profile');

      // Assert
      expect(profileLink).toHaveAttribute('href', '/dashboard/user/profile');
    });

    test('usermenu_ordersLinkPointsToCorrectRoute', () => {
      // Arrange & Act
      renderUserMenu();
      const ordersLink = screen.getByText('Orders');

      // Assert
      expect(ordersLink).toHaveAttribute('href', '/dashboard/user/orders');
    });
  });

  describe('Styling and CSS Classes', () => {
    test('usermenu_linksHaveCorrectCssClass', () => {
      // Arrange & Act
      renderUserMenu();
      const profileLink = screen.getByText('Profile');
      const ordersLink = screen.getByText('Orders');

      // Assert
      expect(profileLink).toHaveClass('list-group-item');
      expect(profileLink).toHaveClass('list-group-item-action');
      expect(ordersLink).toHaveClass('list-group-item');
      expect(ordersLink).toHaveClass('list-group-item-action');
    });

    test('usermenu_containerHasTextCenter', () => {
      // Arrange & Act
      const { container } = renderUserMenu();

      // Assert
      const textCenterDiv = container.querySelector('.text-center');
      expect(textCenterDiv).toBeInTheDocument();
    });

    test('usermenu_listGroupContainer', () => {
      // Arrange & Act
      const { container } = renderUserMenu();

      // Assert
      const listGroup = container.querySelector('.list-group');
      expect(listGroup).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('usermenu_linksAreNavigationElements', () => {
      // Arrange & Act
      renderUserMenu();

      // Assert
      const links = screen.getAllByRole('link');
      expect(links.length).toBe(2);
      expect(links[0]).toHaveTextContent('Profile');
      expect(links[1]).toHaveTextContent('Orders');
    });

    test('usermenu_dashboardHeadingPresent', () => {
      // Arrange & Act
      renderUserMenu();

      // Assert
      const heading = screen.getByRole('heading', { level: 4 });
      expect(heading).toHaveTextContent('Dashboard');
    });
  });
});
