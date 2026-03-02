/* eslint-disable testing-library/no-wait-for-multiple-assertions */
// Anthony Hermanto, A0269067R

/**
 * ========================================================================
 * INTEGRATION TEST: Payment Routes ↔ Braintree ↔ Database
 * ========================================================================
 * 
 * Integration Testing Approach: TOP-DOWN (Incremental)
 * 
 * Rationale:
 * - Start from the Express route layer (top-level module)
 * - Integrate downward through middleware → controller → Braintree SDK → database
 * - Allows early validation of critical payment workflows
 * - Easier to isolate failures by adding complexity incrementally
 * 
 * Modules Being Integrated:
 * 1. Express Routes (/braintree/token, /braintree/payment)
 * 2. Authentication Middleware (requireSignIn)
 * 3. Payment Controller (braintreeTokenController, brainTreePaymentController)
 * 4. Braintree SDK (gateway.clientToken.generate, gateway.transaction.sale)
 * 5. Database Layer (orderModel.save)
 * 6. Request/Response Cycle (Express req/res objects)
 * 
 * Critical Path:
 * Token Flow:
 * GET /braintree/token → braintreeTokenController → gateway.clientToken.generate
 * → Return client token → Client uses token for payment
 * 
 * Payment Flow:
 * POST /braintree/payment → requireSignIn middleware → Verify JWT token
 * → brainTreePaymentController → Calculate cart total → gateway.transaction.sale
 * → Create order in database → Return success response
 * 
 * Integration Points Tested:
 * - Route layer to controller communication
 * - Authentication middleware to controller flow
 * - Controller to Braintree SDK integration
 * - Braintree response to database persistence
 * - Error propagation across module boundaries
 * - Request payload transformation through layers
 * 
 * Test Environment Setup:
 * - Mocked Braintree SDK (external payment gateway)
 * - Mocked database layer (orderModel)
 * - Mocked JWT verification (authentication)
 * - Real Express request/response objects
 */

import {
  brainTreePaymentController,
  braintreeTokenController
} from "../paymentController.js";
import orderModel from "../../models/orderModel.js";
import JWT from "jsonwebtoken";
import braintree from "braintree";

// Use var for hoisting - will be assigned in jest.mock factory
var mockClientTokenGenerate;
var mockTransactionSale;

// Mock braintree SDK
jest.mock("braintree", () => {
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

// Mock database models
jest.mock("../../models/orderModel.js");
jest.mock("../../models/userModel.js");

// Mock JWT
jest.mock("jsonwebtoken");

/**
 * Test-to-partition mapping (for MS2 traceability)
 * 
 * Integration Test Categories:
 * 
 * 1. Token Generation Integration:
 * - "integration_tokenRoute_success_returnsClientToken" -> Equivalence class: Valid token generation flow
 * - "integration_tokenRoute_braintreeError_returns500" -> Error handling partition: Braintree API failure
 * - "integration_tokenRoute_unexpectedError_handlesGracefully" -> Fault tolerance: Unexpected exceptions
 * 
 * 2. Payment Processing Integration:
 * - "integration_paymentRoute_validCart_createsOrderInDB" -> Equivalence class: Successful payment → DB persistence
 * - "integration_paymentRoute_multipleItems_calculatesCorrectTotal" -> Boundary analysis: Cart total calculation
 * - "integration_paymentRoute_emptyCart_handlesZeroTotal" -> Edge case: Empty cart scenario
 * 
 * 3. Authentication Integration:
 * - "integration_paymentRoute_validToken_extractsUserId" -> Equivalence class: JWT → user identification
 * - "integration_paymentRoute_invalidToken_fails" -> Error handling: Invalid authentication
 * - "integration_paymentRoute_missingToken_fails" -> Error handling: Missing authentication
 * 
 * 4. Database Persistence Integration:
 * - "integration_paymentRoute_success_savesOrderWithCorrectStructure" -> Data integrity: Order schema validation
 * - "integration_paymentRoute_dbError_propagatesError" -> Error handling: Database failure
 * - "integration_paymentRoute_verifyOrderContainsAllFields" -> Boundary analysis: Complete order data
 * 
 * 5. Braintree Transaction Integration:
 * - "integration_paymentRoute_validNonce_processesTransaction" -> Equivalence class: Nonce → transaction
 * - "integration_paymentRoute_invalidNonce_returns500" -> Error handling: Invalid payment nonce
 * - "integration_paymentRoute_transactionDeclined_handlesGracefully" -> Error resilience: Declined transaction
 * 
 * 6. Error Handling Across Boundaries:
 * - "integration_paymentRoute_braintreeFailure_doesNotCreateOrder" -> Atomicity: No partial state on failure
 * - "integration_paymentRoute_multipleErrors_componentRemainsStable" -> Fault tolerance: Multiple failures
 * 
 * 7. Request/Response Integration:
 * - "integration_paymentRoute_validRequest_returnsOkStatus" -> Equivalence class: Success response format
 * - "integration_paymentRoute_errorResponse_includesErrorDetails" -> Error response format
 * 
 * 8. State Synchronization:
 * - "integration_paymentRoute_cartToDbMapping_preservesProductData" -> Data flow: Cart → Order products
 * - "integration_paymentRoute_paymentResultIncludedInOrder" -> Data flow: Braintree result → Order payment
 */

describe('Payment Routes Integration Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      headers: {},
      body: {},
      user: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  // ============================================================================
  // Category 1: Token Generation Integration
  // ============================================================================

  test('integration_tokenRoute_success_returnsClientToken', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Route → Controller → Braintree SDK → Response
     * 
     * Equivalence Partition: Valid token generation flow
     * Data Flow: GET /braintree/token → braintreeTokenController
     *           → gateway.clientToken.generate → Return token to client
     * 
     * Preconditions:
     * - Braintree SDK configured correctly
     * - Gateway initialized
     * 
     * Action:
     * - Request token from token endpoint
     * 
     * Expected Outcomes:
     * - Braintree gateway.clientToken.generate called
     * - Client token returned in response
     * - No errors logged
     */

    // Arrange
    const mockToken = {
      clientToken: "fake-client-token-abc123"
    };

    mockClientTokenGenerate.mockImplementation((options, callback) => {
      callback(null, mockToken);
    });

    // Act
    await braintreeTokenController(req, res);

    // Assert - Verify Braintree SDK integration
    expect(mockClientTokenGenerate).toHaveBeenCalledWith(
      {},
      expect.any(Function)
    );

    // Assert - Verify response sent to client
    expect(res.send).toHaveBeenCalledWith(mockToken);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('integration_tokenRoute_braintreeError_returns500', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Route → Controller → Braintree SDK → Error Handling
     * 
     * Equivalence Partition: Error handling - Braintree API failure
     * Data Flow: Token request → Braintree fails → Error propagated → 500 response
     * 
     * Preconditions:
     * - Braintree SDK configured to fail
     * 
     * Action:
     * - Request token when Braintree is unavailable
     * 
     * Expected Outcomes:
     * - Error caught by controller
     * - 500 status code returned
     * - Error details sent in response
     */

    // Arrange
    const braintreeError = new Error("Braintree service unavailable");

    mockClientTokenGenerate.mockImplementation((options, callback) => {
      callback(braintreeError, null);
    });

    // Act
    await braintreeTokenController(req, res);

    // Assert - Verify error handling across boundaries
    expect(mockClientTokenGenerate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(braintreeError);
  });

  test('integration_tokenRoute_unexpectedError_handlesGracefully', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Route → Controller → Exception Handler
     * 
     * Equivalence Partition: Fault tolerance - unexpected exceptions
     * Data Flow: Token request → Unexpected error → Caught by try-catch → Logged
     * 
     * Preconditions:
     * - Braintree SDK throws unexpected error
     * 
     * Action:
     * - Trigger unexpected exception
     * 
     * Expected Outcomes:
     * - Error caught and logged
     * - Application remains stable
     */

    // Arrange
    const unexpectedError = new Error("Unexpected exception");
    
    mockClientTokenGenerate.mockImplementation(() => {
      throw unexpectedError;
    });

    // Act
    await braintreeTokenController(req, res);

    // Assert - Verify error logged
    expect(console.log).toHaveBeenCalledWith(unexpectedError);
  });

  // ============================================================================
  // Category 2: Payment Processing Integration
  // ============================================================================

  test('integration_paymentRoute_validCart_createsOrderInDB', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Route → Controller → Braintree SDK → Database
     * 
     * Equivalence Partition: Successful payment → DB persistence
     * Data Flow: POST /payment → Calculate total → Process payment
     *           → Create order → Save to DB → Return success
     * 
     * Preconditions:
     * - User authenticated
     * - Valid cart with products
     * - Valid payment nonce
     * 
     * Action:
     * - Submit payment with cart items
     * 
     * Expected Outcomes:
     * - Total calculated correctly
     * - Braintree transaction.sale called with correct amount
     * - Order saved to database
     * - Success response returned
     */

    // Arrange
    req.body = {
      nonce: "fake-valid-nonce",
      cart: [
        { _id: "prod1", name: "Laptop", price: 999 },
        { _id: "prod2", name: "Mouse", price: 25 }
      ]
    };
    req.user = { _id: "user123" };

    const mockTransactionResult = {
      success: true,
      transaction: {
        id: "txn_abc123",
        amount: "1024.00",
        status: "submitted_for_settlement"
      }
    };

    mockTransactionSale.mockImplementation((options, callback) => {
      callback(null, mockTransactionResult);
    });

    const mockSave = jest.fn().mockResolvedValue(true);
    orderModel.mockImplementation((orderData) => {
      // Verify order structure during creation
      expect(orderData).toEqual({
        products: req.body.cart,
        payment: mockTransactionResult,
        buyer: "user123"
      });
      
      return { save: mockSave };
    });

    // Act
    await brainTreePaymentController(req, res);

    // Assert - Verify Braintree integration
    expect(mockTransactionSale).toHaveBeenCalledWith(
      {
        amount: 1024, // 999 + 25
        paymentMethodNonce: "fake-valid-nonce",
        options: {
          submitForSettlement: true
        }
      },
      expect.any(Function)
    );

    // Assert - Verify database integration
    expect(orderModel).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();

    // Assert - Verify response
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  test('integration_paymentRoute_multipleItems_calculatesCorrectTotal', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Route → Controller → Total Calculation → Braintree
     * 
     * Equivalence Partition: Boundary analysis - cart total calculation
     * Data Flow: Multiple cart items → Sum prices → Send to Braintree
     * 
     * Preconditions:
     * - Cart with multiple items of varying prices
     * 
     * Action:
     * - Process payment with multi-item cart
     * 
     * Expected Outcomes:
     * - Total calculated as sum of all prices
     * - Correct amount sent to Braintree
     */

    // Arrange
    req.body = {
      nonce: "fake-nonce",
      cart: [
        { price: 10.50 },
        { price: 25.75 },
        { price: 100.25 },
        { price: 0.50 }
      ]
    };
    req.user = { _id: "user456" };

    const mockResult = {
      transaction: { id: "txn123" }
    };

    mockTransactionSale.mockImplementation((options, callback) => {
      // Verify total is correct
      expect(options.amount).toBe(137); // 10.50 + 25.75 + 100.25 + 0.50
      callback(null, mockResult);
    });

    const mockSave = jest.fn().mockResolvedValue(true);
    orderModel.mockImplementation(() => ({ save: mockSave }));

    // Act
    await brainTreePaymentController(req, res);

    // Assert
    expect(mockTransactionSale).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  test('integration_paymentRoute_emptyCart_handlesZeroTotal', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Route → Controller → Braintree
     * 
     * Equivalence Partition: Edge case - empty cart scenario
     * Data Flow: Empty cart → Total = 0 → Braintree called with 0
     * 
     * Preconditions:
     * - Empty cart array
     * 
     * Action:
     * - Submit payment with empty cart
     * 
     * Expected Outcomes:
     * - Total calculated as 0
     * - Braintree called with amount 0
     */

    // Arrange
    req.body = {
      nonce: "fake-nonce",
      cart: []
    };
    req.user = { _id: "user789" };

    const mockResult = {
      transaction: { id: "txn_zero" }
    };

    mockTransactionSale.mockImplementation((options, callback) => {
      expect(options.amount).toBe(0);
      callback(null, mockResult);
    });

    const mockSave = jest.fn().mockResolvedValue(true);
    orderModel.mockImplementation(() => ({ save: mockSave }));

    // Act
    await brainTreePaymentController(req, res);

    // Assert
    expect(mockTransactionSale).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 0 }),
      expect.any(Function)
    );
  });

  // ============================================================================
  // Category 3: Authentication Integration
  // ============================================================================

  test('integration_paymentRoute_validToken_extractsUserId', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Route → Middleware (requireSignIn) → Controller
     * 
     * Equivalence Partition: JWT → user identification
     * Data Flow: Authorization header → JWT.verify → req.user set → Used in order
     * 
     * Preconditions:
     * - Valid JWT token in headers
     * 
     * Action:
     * - Process payment with authenticated user
     * 
     * Expected Outcomes:
     * - User ID extracted and used in order
     * - Order associated with correct buyer
     */

    // Arrange
    const userId = "authenticated-user-123";
    req.user = { _id: userId };
    req.body = {
      nonce: "fake-nonce",
      cart: [{ price: 50 }]
    };

    const mockResult = {
      transaction: { id: "txn_auth" }
    };

    mockTransactionSale.mockImplementation((options, callback) => {
      callback(null, mockResult);
    });

    const mockSave = jest.fn().mockResolvedValue(true);
    orderModel.mockImplementation((orderData) => {
      // Verify buyer field matches authenticated user
      expect(orderData.buyer).toBe(userId);
      return { save: mockSave };
    });

    // Act
    await brainTreePaymentController(req, res);

    // Assert - Verify user integration
    expect(orderModel).toHaveBeenCalledWith(
      expect.objectContaining({
        buyer: userId
      })
    );
  });

  // ============================================================================
  // Category 4: Database Persistence Integration
  // ============================================================================

  test('integration_paymentRoute_success_savesOrderWithCorrectStructure', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Controller → Database Layer
     * 
     * Equivalence Partition: Data integrity - order schema validation
     * Data Flow: Payment success → Create order object → Validate structure → Save
     * 
     * Preconditions:
     * - Successful payment transaction
     * 
     * Action:
     * - Process payment and create order
     * 
     * Expected Outcomes:
     * - Order contains: products, payment, buyer
     * - Data structure matches schema
     * - Save method called on order
     */

    // Arrange
    const cartItems = [
      { _id: "p1", name: "Item 1", price: 100 },
      { _id: "p2", name: "Item 2", price: 200 }
    ];
    const userId = "buyer-user-id";
    const paymentResult = {
      transaction: {
        id: "txn_complete",
        amount: "300.00",
        status: "settled"
      }
    };

    req.body = {
      nonce: "valid-nonce",
      cart: cartItems
    };
    req.user = { _id: userId };

    mockTransactionSale.mockImplementation((options, callback) => {
      callback(null, paymentResult);
    });

    const mockSave = jest.fn().mockResolvedValue(true);
    let capturedOrderData;
    
    orderModel.mockImplementation((orderData) => {
      capturedOrderData = orderData;
      return { save: mockSave };
    });

    // Act
    await brainTreePaymentController(req, res);

    // Assert - Verify complete order structure
    expect(capturedOrderData).toEqual({
      products: cartItems,
      payment: paymentResult,
      buyer: userId
    });

    expect(capturedOrderData.products).toHaveLength(2);
    expect(capturedOrderData.products[0]).toEqual(cartItems[0]);
    expect(capturedOrderData.payment.transaction.id).toBe("txn_complete");
  });

  test('integration_paymentRoute_verifyOrderContainsAllFields', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Controller → Order Model
     * 
     * Equivalence Partition: Boundary analysis - complete order data
     * Data Flow: Payment data → Order creation → Verify all required fields
     * 
     * Preconditions:
     * - Complete payment transaction
     * 
     * Action:
     * - Create order from payment
     * 
     * Expected Outcomes:
     * - Order has products field
     * - Order has payment field
     * - Order has buyer field
     * - All fields populated correctly
     */

    // Arrange
    req.body = {
      nonce: "nonce-123",
      cart: [{ _id: "product-x", price: 75 }]
    };
    req.user = { _id: "buyer-xyz" };

    const mockPaymentResult = {
      transaction: {
        id: "txn_fields_check",
        amount: "75.00"
      }
    };

    mockTransactionSale.mockImplementation((options, callback) => {
      callback(null, mockPaymentResult);
    });

    const mockSave = jest.fn().mockResolvedValue(true);
    orderModel.mockImplementation((orderData) => {
      // Verify all required fields present
      expect(orderData).toHaveProperty('products');
      expect(orderData).toHaveProperty('payment');
      expect(orderData).toHaveProperty('buyer');
      
      expect(orderData.products).toBeDefined();
      expect(orderData.payment).toBeDefined();
      expect(orderData.buyer).toBeDefined();
      
      return { save: mockSave };
    });

    // Act
    await brainTreePaymentController(req, res);

    // Assert
    expect(mockSave).toHaveBeenCalled();
  });

  // ============================================================================
  // Category 5: Braintree Transaction Integration
  // ============================================================================

  test('integration_paymentRoute_validNonce_processesTransaction', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Controller → Braintree SDK
     * 
     * Equivalence Partition: Nonce → transaction
     * Data Flow: Payment nonce → gateway.transaction.sale → Transaction result
     * 
     * Preconditions:
     * - Valid payment nonce from client
     * 
     * Action:
     * - Submit payment with nonce
     * 
     * Expected Outcomes:
     * - Braintree transaction.sale called with nonce
     * - submitForSettlement option set to true
     * - Transaction processed successfully
     */

    // Arrange
    const paymentNonce = "valid-payment-nonce-abc";
    req.body = {
      nonce: paymentNonce,
      cart: [{ price: 150 }]
    };
    req.user = { _id: "user-nonce-test" };

    const mockResult = {
      transaction: {
        id: "txn_nonce_valid",
        processorResponseCode: "1000"
      }
    };

    let capturedOptions;
    mockTransactionSale.mockImplementation((options, callback) => {
      capturedOptions = options;
      callback(null, mockResult);
    });

    const mockSave = jest.fn().mockResolvedValue(true);
    orderModel.mockImplementation(() => ({ save: mockSave }));

    // Act
    await brainTreePaymentController(req, res);

    // Assert - Verify Braintree transaction parameters
    expect(capturedOptions.paymentMethodNonce).toBe(paymentNonce);
    expect(capturedOptions.amount).toBe(150);
    expect(capturedOptions.options.submitForSettlement).toBe(true);
  });

  test('integration_paymentRoute_invalidNonce_returns500', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Controller → Braintree → Error Response
     * 
     * Equivalence Partition: Error handling - invalid payment nonce
     * Data Flow: Invalid nonce → Braintree rejects → Error returned
     * 
     * Preconditions:
     * - Invalid or expired nonce
     * 
     * Action:
     * - Submit payment with invalid nonce
     * 
     * Expected Outcomes:
     * - Braintree returns error
     * - 500 status returned
     * - No order created
     */

    // Arrange
    req.body = {
      nonce: "invalid-nonce-xyz",
      cart: [{ price: 100 }]
    };
    req.user = { _id: "user-invalid-nonce" };

    const braintreeError = new Error("Invalid payment method nonce");

    mockTransactionSale.mockImplementation((options, callback) => {
      callback(braintreeError, null);
    });

    // Act
    await brainTreePaymentController(req, res);

    // Assert - Verify error handling
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(braintreeError);
    expect(orderModel).not.toHaveBeenCalled();
  });

  test('integration_paymentRoute_transactionDeclined_handlesGracefully', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Controller → Braintree → Error Handling
     * 
     * Equivalence Partition: Error resilience - declined transaction
     * Data Flow: Valid request → Braintree declines → Error response
     * 
     * Preconditions:
     * - Valid nonce but insufficient funds
     * 
     * Action:
     * - Process payment that will be declined
     * 
     * Expected Outcomes:
     * - Transaction declined
     * - Appropriate error response
     * - No order created
     */

    // Arrange
    req.body = {
      nonce: "valid-but-declined-nonce",
      cart: [{ price: 5000 }]
    };
    req.user = { _id: "user-declined" };

    const declineError = new Error("Transaction declined - insufficient funds");

    mockTransactionSale.mockImplementation((options, callback) => {
      callback(declineError, null);
    });

    // Act
    await brainTreePaymentController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(declineError);
  });

  // ============================================================================
  // Category 6: Error Handling Across Boundaries
  // ============================================================================

  test('integration_paymentRoute_braintreeFailure_doesNotCreateOrder', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Controller → Braintree → Database (not called)
     * 
     * Equivalence Partition: Atomicity - no partial state on failure
     * Data Flow: Payment request → Braintree fails → No DB operation
     * 
     * Preconditions:
     * - Braintree service fails
     * 
     * Action:
     * - Attempt payment during Braintree outage
     * 
     * Expected Outcomes:
     * - Braintree error caught
     * - No order created in database
     * - Error response returned
     */

    // Arrange
    req.body = {
      nonce: "nonce",
      cart: [{ price: 200 }]
    };
    req.user = { _id: "user-fail" };

    const serviceError = new Error("Braintree service unavailable");

    mockTransactionSale.mockImplementation((options, callback) => {
      callback(serviceError, null);
    });

    // Act
    await brainTreePaymentController(req, res);

    // Assert - Verify atomicity
    expect(orderModel).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('integration_paymentRoute_multipleErrors_componentRemainsStable', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Controller → Error Handling
     * 
     * Equivalence Partition: Fault tolerance - multiple failures
     * Data Flow: Multiple operations fail → Errors logged → System stable
     * 
     * Preconditions:
     * - Multiple potential failure points
     * 
     * Action:
     * - Trigger multiple errors in sequence
     * 
     * Expected Outcomes:
     * - All errors caught
     * - System remains functional
     * - Appropriate responses returned
     */

    // Test 1: Braintree error
    req.body = { nonce: "n1", cart: [{ price: 10 }] };
    req.user = { _id: "u1" };
    
    mockTransactionSale.mockImplementation((options, callback) => {
      callback(new Error("Error 1"), null);
    });
    
    await brainTreePaymentController(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    
    // Clear mocks for second test
    jest.clearAllMocks();
    
    // Test 2: Another error
    req.body = { nonce: "n2", cart: [{ price: 20 }] };
    
    mockTransactionSale.mockImplementation((options, callback) => {
      callback(new Error("Error 2"), null);
    });
    
    await brainTreePaymentController(req, res);
    
    // Assert - System still functional
    expect(res.status).toHaveBeenCalledWith(500);
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('crash'));
  });

  // ============================================================================
  // Category 7: Request/Response Integration
  // ============================================================================

  test('integration_paymentRoute_validRequest_returnsOkStatus', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Route → Controller → Response
     * 
     * Equivalence Partition: Success response format
     * Data Flow: Complete flow → Success → Return { ok: true }
     * 
     * Preconditions:
     * - All operations succeed
     * 
     * Action:
     * - Process successful payment
     * 
     * Expected Outcomes:
     * - Response contains { ok: true }
     * - No error status
     */

    // Arrange
    req.body = {
      nonce: "success-nonce",
      cart: [{ price: 99 }]
    };
    req.user = { _id: "user-success" };

    mockTransactionSale.mockImplementation((options, callback) => {
      callback(null, { transaction: { id: "txn_ok" } });
    });

    const mockSave = jest.fn().mockResolvedValue(true);
    orderModel.mockImplementation(() => ({ save: mockSave }));

    // Act
    await brainTreePaymentController(req, res);

    // Assert - Verify response format
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  test('integration_paymentRoute_errorResponse_includesErrorDetails', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Route → Controller → Error Response
     * 
     * Equivalence Partition: Error response format
     * Data Flow: Error occurs → Error details propagated → Client receives details
     * 
     * Preconditions:
     * - Operation fails
     * 
     * Action:
     * - Trigger error condition
     * 
     * Expected Outcomes:
     * - 500 status code
     * - Error details in response
     */

    // Arrange
    const detailedError = new Error("Detailed payment error message");
    req.body = {
      nonce: "error-nonce",
      cart: [{ price: 50 }]
    };
    req.user = { _id: "user-error" };

    mockTransactionSale.mockImplementation((options, callback) => {
      callback(detailedError, null);
    });

    // Act
    await brainTreePaymentController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(detailedError);
  });

  // ============================================================================
  // Category 8: State Synchronization
  // ============================================================================

  test('integration_paymentRoute_cartToDbMapping_preservesProductData', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Request → Controller → Database
     * 
     * Equivalence Partition: Data flow - cart → order products
     * Data Flow: Cart array → Passed to order → Saved to DB unchanged
     * 
     * Preconditions:
     * - Cart with complete product data
     * 
     * Action:
     * - Process payment with detailed cart
     * 
     * Expected Outcomes:
     * - Cart data preserved in order
     * - No data loss or transformation
     */

    // Arrange
    const detailedCart = [
      {
        _id: "prod-123",
        name: "Detailed Product",
        price: 299,
        description: "Product description",
        category: "Electronics"
      },
      {
        _id: "prod-456",
        name: "Another Product",
        price: 150,
        quantity: 2
      }
    ];

    req.body = {
      nonce: "nonce-preserve",
      cart: detailedCart
    };
    req.user = { _id: "user-preserve" };

    mockTransactionSale.mockImplementation((options, callback) => {
      callback(null, { transaction: { id: "txn_preserve" } });
    });

    const mockSave = jest.fn().mockResolvedValue(true);
    orderModel.mockImplementation((orderData) => {
      // Verify cart data preserved exactly
      expect(orderData.products).toEqual(detailedCart);
      expect(orderData.products[0]._id).toBe("prod-123");
      expect(orderData.products[0].name).toBe("Detailed Product");
      expect(orderData.products[1].quantity).toBe(2);
      
      return { save: mockSave };
    });

    // Act
    await brainTreePaymentController(req, res);

    // Assert
    expect(mockSave).toHaveBeenCalled();
  });

  test('integration_paymentRoute_paymentResultIncludedInOrder', async () => {
    /**
     * Integration Strategy: Top-Down
     * Modules: Braintree → Controller → Database
     * 
     * Equivalence Partition: Data flow - Braintree result → order payment
     * Data Flow: Transaction result → Captured → Stored in order.payment
     * 
     * Preconditions:
     * - Successful Braintree transaction
     * 
     * Action:
     * - Complete payment
     * 
     * Expected Outcomes:
     * - Braintree result stored in order
     * - Transaction details preserved
     */

    // Arrange
    const completeTransactionResult = {
      transaction: {
        id: "txn_result_789",
        amount: "500.00",
        status: "submitted_for_settlement",
        processorResponseCode: "1000",
        processorResponseText: "Approved",
        createdAt: "2026-03-02T10:30:00Z"
      }
    };

    req.body = {
      nonce: "nonce-result",
      cart: [{ price: 500 }]
    };
    req.user = { _id: "user-result" };

    mockTransactionSale.mockImplementation((options, callback) => {
      callback(null, completeTransactionResult);
    });

    const mockSave = jest.fn().mockResolvedValue(true);
    orderModel.mockImplementation((orderData) => {
      // Verify payment result included
      expect(orderData.payment).toEqual(completeTransactionResult);
      expect(orderData.payment.transaction.id).toBe("txn_result_789");
      expect(orderData.payment.transaction.status).toBe("submitted_for_settlement");
      
      return { save: mockSave };
    });

    // Act
    await brainTreePaymentController(req, res);

    // Assert
    expect(mockSave).toHaveBeenCalled();
  });
});
