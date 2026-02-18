// Amos Chee Tian Ee, A0273476U
import React from 'react';
import { render, waitFor, screen } from '@testing-library/react';
import axios from 'axios';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import '@testing-library/jest-dom/extend-expect';
import PrivateRoute from '../../components/Routes/Private';
import Spinner from '../../components/Spinner';

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "private_rendersSpinnerInitially" -> Equivalence class: pending auth check state
 * - "private_rendersOutletOnAuthSuccess" -> Equivalence class: successful authentication
 * - "private_rendersSpinnerOnAuthFailure" -> Equivalence class: failed authentication
 * - "private_authCheckCalledWithValidToken" -> Equivalence class: token validation API call
 * - "private_authCheckNotCalledWithoutToken" -> Edge case: missing authentication token
 * - "private_setsOkTrueOnValidResponse" -> Equivalence class: valid auth response handling
 * - "private_setsOkFalseOnInvalidResponse" -> Equivalence class: invalid auth response handling
 * - "private_authCheckRetriggerOnTokenChange" -> Equivalence class: token update triggers re-check
 */

jest.mock('axios');
jest.mock('../../components/Spinner', () => {
  return function MockSpinner() {
    return <div>Loading...</div>;
  };
});

jest.mock('../../context/auth', () => ({
  useAuth: jest.fn(),
}));

const { useAuth } = require('../../context/auth');

const ProtectedComponent = () => <div>Protected Content</div>;

const renderPrivateRoute = (authValue) => {
  useAuth.mockReturnValue([authValue || { token: null }, jest.fn()]);
  return render(
    <BrowserRouter>
      <Routes>
        <Route element={<PrivateRoute />}>
          <Route path="/" element={<ProtectedComponent />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

describe('PrivateRoute Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockClear();
  });

  describe('Component Rendering', () => {
    test('private_rendersSpinnerInitially', () => {
      // Arrange
      useAuth.mockReturnValue([{ token: 'someToken' }, jest.fn()]);
      axios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      // Act
      render(
        <BrowserRouter>
          <Routes>
            <Route element={<PrivateRoute />}>
              <Route path="/" element={<ProtectedComponent />} />
            </Route>
          </Routes>
        </BrowserRouter>
      );

      // Assert
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    test('private_rendersOutletOnAuthSuccess', async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: { ok: true } });
      useAuth.mockReturnValue([{ token: 'validToken' }, jest.fn()]);

      // Act
      render(
        <BrowserRouter>
          <Routes>
            <Route element={<PrivateRoute />}>
              <Route path="/" element={<ProtectedComponent />} />
            </Route>
          </Routes>
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });

    test('private_rendersSpinnerOnAuthFailure', async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: { ok: false } });
      useAuth.mockReturnValue([{ token: 'invalidToken' }, jest.fn()]);

      // Act
      render(
        <BrowserRouter>
          <Routes>
            <Route element={<PrivateRoute />}>
              <Route path="/" element={<ProtectedComponent />} />
            </Route>
          </Routes>
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });
    });
  });

  describe('Authentication Check', () => {
    test('private_authCheckCalledWithValidToken', async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: { ok: true } });
      useAuth.mockReturnValue([{ token: 'validToken' }, jest.fn()]);

      // Act
      render(
        <BrowserRouter>
          <Routes>
            <Route element={<PrivateRoute />}>
              <Route path="/" element={<ProtectedComponent />} />
            </Route>
          </Routes>
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith('/api/v1/auth/user-auth');
      });
    });

    test('private_authCheckNotCalledWithoutToken', () => {
      // Arrange
      useAuth.mockReturnValue([{ token: null }, jest.fn()]);

      // Act
      render(
        <BrowserRouter>
          <Routes>
            <Route element={<PrivateRoute />}>
              <Route path="/" element={<ProtectedComponent />} />
            </Route>
          </Routes>
        </BrowserRouter>
      );

      // Assert
      expect(axios.get).not.toHaveBeenCalled();
    });

    test('private_setsOkTrueOnValidResponse', async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: { ok: true } });
      useAuth.mockReturnValue([{ token: 'validToken' }, jest.fn()]);

      // Act
      render(
        <BrowserRouter>
          <Routes>
            <Route element={<PrivateRoute />}>
              <Route path="/" element={<ProtectedComponent />} />
            </Route>
          </Routes>
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });

    test('private_setsOkFalseOnInvalidResponse', async () => {
      // Arrange
      axios.get.mockResolvedValueOnce({ data: { ok: false } });
      useAuth.mockReturnValue([{ token: 'expiredToken' }, jest.fn()]);

      // Act
      render(
        <BrowserRouter>
          <Routes>
            <Route element={<PrivateRoute />}>
              <Route path="/" element={<ProtectedComponent />} />
            </Route>
          </Routes>
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      });
    });
  });

  describe('Token Change Detection', () => {
    test('private_authCheckRetriggerOnTokenChange', async () => {
      // Arrange
      axios.get.mockResolvedValue({ data: { ok: true } });
      const { rerender } = render(
        <BrowserRouter>
          <Routes>
            <Route
              element={
                (() => {
                  useAuth.mockReturnValue([{ token: 'token1' }, jest.fn()]);
                  return <PrivateRoute />;
                })()
              }
            >
              <Route path="/" element={<ProtectedComponent />} />
            </Route>
          </Routes>
        </BrowserRouter>
      );

      // Act - Simulate token change by re-rendering with different token
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      // Change token and re-render
      useAuth.mockReturnValue([{ token: 'token2' }, jest.fn()]);
      rerender(
        <BrowserRouter>
          <Routes>
            <Route element={<PrivateRoute />}>
              <Route path="/" element={<ProtectedComponent />} />
            </Route>
          </Routes>
        </BrowserRouter>
      );

      // Assert
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });
    });
  });
});
