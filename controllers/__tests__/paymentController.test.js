// Anthony Hermanto, A0269067R

import {
  brainTreePaymentController,
  braintreeTokenController
} from "../paymentController.js";
import orderModel from "../../models/orderModel.js";
import fs from "fs";
import braintree from "braintree";

// Use var for hoisting - will be assigned in jest.mock factory
var mockClientTokenGenerate;
var mockTransactionSale;

// Mock braintree - create mocks inside factory to avoid hoisting issues
jest.mock("braintree", () => {
  // Initialize mocks inside the factory
  mockClientTokenGenerate = jest.fn();
  mockTransactionSale = jest.fn();
  
  return {
    BraintreeGateway: jest.fn(function() {
      return {
        clientToken: {
          generate: mockClientTokenGenerate,
        },
        transaction: {
          sale: mockTransactionSale,
        },
      };
    }),
    Environment: {
      Sandbox: "sandbox",
    },
  };
});

// Mock other dependencies
jest.mock("../../models/productModel.js");
jest.mock("../../models/categoryModel.js");
jest.mock("../../models/orderModel.js");
jest.mock("fs");

/**
 * Test-to-partition mapping (for MS1 traceability)
 * - "getToken_success_returnsToken" -> Payment integration partition: Braintree token generation
 * - "getToken_error_returns500" -> Error handling partition: Braintree token failure
 * - "getToken_catchBlockError_logsError" -> Error handling partition: unexpected Braintree error
 * - "processPayment_success_createsOrder" -> Payment integration partition: successful transaction
 * - "processPayment_error_returns500" -> Error handling partition: payment processing failure
 * - "processPayment_catchBlockError_logsError" -> Error handling partition: unexpected payment error
 */


describe("Payment Controller", () => {
    let req, res;

    beforeEach(() => {
        req = {
        fields: {},
        files: {},
        params: {},
        body: {},
        user: { _id: "user123" },
        };
        res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {})
    });


    describe("braintreeTokenController", () => {
      test("getToken_success_returnsToken", async () => {
        // Arrange
        const mockResponse = { clientToken: "test-token-123" };
        mockClientTokenGenerate.mockImplementation((options, callback) => {
          callback(null, mockResponse);
        });

        // Act
        await braintreeTokenController(req, res);

        // Assert
        expect(mockClientTokenGenerate).toHaveBeenCalled();
        expect(res.send).toHaveBeenCalledWith(mockResponse);
      });

      test("getToken_error_returns500", async () => {
        // Arrange
        const mockError = new Error("Braintree error");
        mockClientTokenGenerate.mockImplementation((options, callback) => {
          callback(mockError, null);
        });

        // Act
        await braintreeTokenController(req, res);

        // Assert
        expect(mockClientTokenGenerate).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.send).toHaveBeenCalledWith(mockError);
      });

      test("getToken_catchBlockError_logsError", async () => {
        // Arrange
        const mockError = new Error("Unexpected error");
        const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
        mockClientTokenGenerate.mockImplementation(() => {
          throw mockError;
        });

        // Act
        await braintreeTokenController(req, res);

        // Assert
        expect(consoleLogSpy).toHaveBeenCalledWith(mockError);
        consoleLogSpy.mockRestore();
      });
    });

  describe("brainTreePaymentController", () => {
    test("processPayment_success_createsOrder", async () => {
      // Arrange
      req.body = {
        nonce: "test-nonce",
        cart: [
          { price: 100, name: "Product 1" },
          { price: 200, name: "Product 2" },
        ],
      };

      const mockTransactionResult = {
        success: true,
        transaction: { id: "txn123" },
      };

      mockTransactionSale.mockImplementation((options, callback) => {
        callback(null, mockTransactionResult);
      });

      const mockOrder = {
        save: jest.fn().mockResolvedValue(true),
      };
      orderModel.mockImplementation(() => mockOrder);

      // Act
      await brainTreePaymentController(req, res);

      // Assert
      expect(mockTransactionSale).toHaveBeenCalledWith(
        {
          amount: 300,
          paymentMethodNonce: "test-nonce",
          options: {
            submitForSettlement: true,
          },
        },
        expect.any(Function)
      );
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("processPayment_error_returns500", async () => {
      // Arrange
      req.body = {
        nonce: "test-nonce",
        cart: [{ price: 100 }],
      };

      const mockError = new Error("Payment failed");
      mockTransactionSale.mockImplementation((options, callback) => {
        callback(mockError, null);
      });

      // Act
      await brainTreePaymentController(req, res);

      // Assert
      expect(mockTransactionSale).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(mockError);
    });

    test("processPayment_catchBlockError_logsError", async () => {
      // Arrange
      req.body = {
        nonce: "test-nonce",
        cart: [{ price: 100 }],
      };

      const mockError = new Error("Unexpected error");
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
      mockTransactionSale.mockImplementation(() => {
        throw mockError;
      });

      // Act
      await brainTreePaymentController(req, res);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(mockError);
      consoleLogSpy.mockRestore();
    });
  });
});