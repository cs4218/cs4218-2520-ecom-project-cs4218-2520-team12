import {
  registerController,
  loginController,
  forgotPasswordController,
  testController,
  updateProfileController,
  getOrdersController,
  getAllOrdersController,
  orderStatusController,
} from "../authController.js";
import userModel from "../../models/userModel.js";
import orderModel from "../../models/orderModel.js";
import { comparePassword, hashPassword } from "../../helpers/authHelper.js";
import JWT from "jsonwebtoken";

// Mock dependencies
jest.mock("../../models/userModel.js");
jest.mock("../../models/orderModel.js");
jest.mock("../../helpers/authHelper.js");
jest.mock("jsonwebtoken");

describe("Auth Controller", () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      user: { _id: "user123" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {})
  });

  // ============ registerController Tests ============
  describe("registerController", () => {
    test("register_success_returns201", async () => {
      // Arrange
      req.body = {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
        phone: "1234567890",
        address: "123 Main St",
        answer: "blue",
      };

      userModel.findOne = jest.fn().mockResolvedValue(null);
      hashPassword.mockResolvedValue("hashed-password");

      const mockUser = {
        ...req.body,
        password: "hashed-password",
        save: jest.fn().mockResolvedValue(true),
      };
      userModel.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(mockUser),
      }));

      // Act
      await registerController(req, res);

      // Assert
      expect(hashPassword).toHaveBeenCalledWith("password123");
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "User Register Successfully",
        user: mockUser,
      });
    });

    test("register_missingName_sendsError", async () => {
      // Arrange
      req.body = {
        email: "john@example.com",
        password: "password123",
        phone: "1234567890",
        address: "123 Main St",
        answer: "blue",
      };

      // Act
      await registerController(req, res);

      // Assert
      expect(res.send).toHaveBeenCalledWith({ error: "Name is Required" });
    });

    test("register_missingEmail_sendsError", async () => {
      // Arrange
      req.body = {
        name: "John Doe",
        password: "password123",
        phone: "1234567890",
        address: "123 Main St",
        answer: "blue",
      };

      // Act
      await registerController(req, res);

      // Assert
      expect(res.send).toHaveBeenCalledWith({ message: "Email is Required" });
    });

    test("register_missingPassword_sendsError", async () => {
      // Arrange
      req.body = {
        name: "John Doe",
        email: "john@example.com",
        phone: "1234567890",
        address: "123 Main St",
        answer: "blue",
      };

      // Act
      await registerController(req, res);

      // Assert
      expect(res.send).toHaveBeenCalledWith({ message: "Password is Required" });
    });

    test("register_missingPhone_sendsError", async () => {
      // Arrange
      req.body = {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
        address: "123 Main St",
        answer: "blue",
      };

      // Act
      await registerController(req, res);

      // Assert
      expect(res.send).toHaveBeenCalledWith({ message: "Phone no is Required" });
    });

    test("register_missingAddress_sendsError", async () => {
      // Arrange
      req.body = {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
        phone: "1234567890",
        answer: "blue",
      };

      // Act
      await registerController(req, res);

      // Assert
      expect(res.send).toHaveBeenCalledWith({ message: "Address is Required" });
    });

    test("register_missingAnswer_sendsError", async () => {
      // Arrange
      req.body = {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
        phone: "1234567890",
        address: "123 Main St",
      };

      // Act
      await registerController(req, res);

      // Assert
      expect(res.send).toHaveBeenCalledWith({ message: "Answer is Required" });
    });

    test("register_existingUser_returns200", async () => {
      // Arrange
      req.body = {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
        phone: "1234567890",
        address: "123 Main St",
        answer: "blue",
      };

      userModel.findOne = jest.fn().mockResolvedValue({ email: "john@example.com" });

      // Act
      await registerController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Already Register please login",
      });
    });

    test("register_error_returns500", async () => {
      // Arrange
      req.body = {
        name: "John Doe",
        email: "john@example.com",
        password: "password123",
        phone: "1234567890",
        address: "123 Main St",
        answer: "blue",
      };

      const mockError = new Error("Database error");
      userModel.findOne = jest.fn().mockRejectedValue(mockError);

      // Act
      await registerController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Errro in Registeration",
        error: mockError,
      });
    });
  });

  // ============ loginController Tests ============
  describe("loginController", () => {
    test("login_success_returns200WithToken", async () => {
      // Arrange
      req.body = {
        email: "john@example.com",
        password: "password123",
      };

      const mockUser = {
        _id: "user123",
        name: "John Doe",
        email: "john@example.com",
        phone: "1234567890",
        address: "123 Main St",
        password: "hashed-password",
        role: 0,
      };

      userModel.findOne = jest.fn().mockResolvedValue(mockUser);
      comparePassword.mockResolvedValue(true);
      JWT.sign = jest.fn().mockResolvedValue("test-token");

      // Act
      await loginController(req, res);

      // Assert
      expect(userModel.findOne).toHaveBeenCalledWith({ email: "john@example.com" });
      expect(comparePassword).toHaveBeenCalledWith("password123", "hashed-password");
      expect(JWT.sign).toHaveBeenCalledWith({ _id: "user123" }, "test-secret", { expiresIn: "7d" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "login successfully",
        user: {
          _id: "user123",
          name: "John Doe",
          email: "john@example.com",
          phone: "1234567890",
          address: "123 Main St",
          role: 0,
        },
        token: "test-token",
      });
    });

    test("login_missingCredentials_returns404", async () => {
      // Arrange
      req.body = {
        email: "john@example.com",
      };

      // Act
      await loginController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Invalid email or password",
      });
    });

    test("login_userNotFound_returns404", async () => {
      // Arrange
      req.body = {
        email: "john@example.com",
        password: "password123",
      };

      userModel.findOne = jest.fn().mockResolvedValue(null);

      // Act
      await loginController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Email is not registerd",
      });
    });

    test("login_invalidPassword_returns200", async () => {
      // Arrange
      req.body = {
        email: "john@example.com",
        password: "wrongpassword",
      };

      const mockUser = {
        _id: "user123",
        email: "john@example.com",
        password: "hashed-password",
      };

      userModel.findOne = jest.fn().mockResolvedValue(mockUser);
      comparePassword.mockResolvedValue(false);

      // Act
      await loginController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Invalid Password",
      });
    });

    test("login_error_returns500", async () => {
      // Arrange
      req.body = {
        email: "john@example.com",
        password: "password123",
      };

      const mockError = new Error("Database error");
      userModel.findOne = jest.fn().mockRejectedValue(mockError);

      // Act
      await loginController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Error in login",
        error: mockError,
      });
    });
  });

  // ============ forgotPasswordController Tests ============
  describe("forgotPasswordController", () => {
    test("forgotPassword_success_returns200", async () => {
      // Arrange
      req.body = {
        email: "john@example.com",
        answer: "blue",
        newPassword: "newpassword123",
      };

      const mockUser = {
        _id: "user123",
        email: "john@example.com",
        answer: "blue",
      };

      userModel.findOne = jest.fn().mockResolvedValue(mockUser);
      hashPassword.mockResolvedValue("new-hashed-password");
      userModel.findByIdAndUpdate = jest.fn().mockResolvedValue(true);

      // Act
      await forgotPasswordController(req, res);

      // Assert
      expect(userModel.findOne).toHaveBeenCalledWith({ email: "john@example.com", answer: "blue" });
      expect(hashPassword).toHaveBeenCalledWith("newpassword123");
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith("user123", { password: "new-hashed-password" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Password Reset Successfully",
      });
    });

    test("forgotPassword_missingEmail_returns400", async () => {
      // Arrange
      req.body = {
        answer: "blue",
        newPassword: "newpassword123",
      };

      // Act
      await forgotPasswordController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ message: "Emai is required" });
    });

    test("forgotPassword_missingAnswer_returns400", async () => {
      // Arrange
      req.body = {
        email: "john@example.com",
        newPassword: "newpassword123",
      };

      // Act
      await forgotPasswordController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ message: "answer is required" });
    });

    test("forgotPassword_missingNewPassword_returns400", async () => {
      // Arrange
      req.body = {
        email: "john@example.com",
        answer: "blue",
      };

      // Act
      await forgotPasswordController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ message: "New Password is required" });
    });

    test("forgotPassword_userNotFound_returns404", async () => {
      // Arrange
      req.body = {
        email: "john@example.com",
        answer: "wrong",
        newPassword: "newpassword123",
      };

      userModel.findOne = jest.fn().mockResolvedValue(null);

      // Act
      await forgotPasswordController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Wrong Email Or Answer",
      });
    });

    test("forgotPassword_error_returns500", async () => {
      // Arrange
      req.body = {
        email: "john@example.com",
        answer: "blue",
        newPassword: "newpassword123",
      };

      const mockError = new Error("Database error");
      userModel.findOne = jest.fn().mockRejectedValue(mockError);

      // Act
      await forgotPasswordController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Something went wrong",
        error: mockError,
      });
    });
  });

  // ============ testController Tests ============
  describe("testController", () => {
    test("test_success_sendsProtectedRoutes", () => {
      // Act
      testController(req, res);

      // Assert
      expect(res.send).toHaveBeenCalledWith("Protected Routes");
    });

    test("test_catchBlockError_sendsError", () => {
      // Arrange
      const mockError = new Error("Test error");
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
      
      // Mock res.send to throw error
      res.send = jest.fn().mockImplementationOnce(() => {
        throw mockError;
      }).mockReturnThis();

      // Act
      testController(req, res);

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith(mockError);
      expect(res.send).toHaveBeenCalledWith({ error: mockError });
      consoleLogSpy.mockRestore();
    });
  });

  // ============ updateProfileController Tests ============
  describe("updateProfileController", () => {
    test("updateProfile_success_returns200", async () => {
      // Arrange
      req.body = {
        name: "Jane Doe",
        email: "jane@example.com",
        password: "newpassword123",
        phone: "0987654321",
        address: "456 Oak St",
      };

      const mockUser = {
        _id: "user123",
        name: "John Doe",
        password: "old-hashed-password",
        phone: "1234567890",
        address: "123 Main St",
      };

      const updatedUser = {
        _id: "user123",
        name: "Jane Doe",
        password: "new-hashed-password",
        phone: "0987654321",
        address: "456 Oak St",
      };

      userModel.findById = jest.fn().mockResolvedValue(mockUser);
      hashPassword.mockResolvedValue("new-hashed-password");
      userModel.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedUser);

      // Act
      await updateProfileController(req, res);

      // Assert
      expect(userModel.findById).toHaveBeenCalledWith("user123");
      expect(hashPassword).toHaveBeenCalledWith("newpassword123");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({
        success: true,
        message: "Profile Updated SUccessfully",
        updatedUser,
      });
    });

    test("updateProfile_passwordTooShort_returnsError", async () => {
      // Arrange
      req.body = {
        password: "123",
      };

      const mockUser = {
        _id: "user123",
        name: "John Doe",
      };

      userModel.findById = jest.fn().mockResolvedValue(mockUser);

      // Act
      await updateProfileController(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith({ error: "Passsword is required and 6 character long" });
    });

    test("updateProfile_error_returns400", async () => {
      // Arrange
      req.body = {
        name: "Jane Doe",
      };

      const mockError = new Error("Database error");
      userModel.findById = jest.fn().mockRejectedValue(mockError);

      // Act
      await updateProfileController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Error WHile Update profile",
        error: mockError,
      });
    });
  });

  // ============ getOrdersController Tests ============
  describe("getOrdersController", () => {
    test("getOrders_success_returnsOrders", async () => {
      // Arrange
      const mockOrders = [
        { _id: "order1", buyer: "user123", products: [] },
        { _id: "order2", buyer: "user123", products: [] },
      ];

      orderModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockOrders),
      });

      // Mock the final populate to return the orders
      orderModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockOrders),
        }),
      });

      // Act
      await getOrdersController(req, res);

      // Assert
      expect(orderModel.find).toHaveBeenCalledWith({ buyer: "user123" });
      expect(res.json).toHaveBeenCalledWith(mockOrders);
    });

    test("getOrders_error_returns500", async () => {
      // Arrange
      const mockError = new Error("Database error");
      orderModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(mockError),
      });

      orderModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockRejectedValue(mockError),
        }),
      });

      // Act
      await getOrdersController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Error WHile Geting Orders",
        error: mockError,
      });
    });
  });

  // ============ getAllOrdersController Tests ============
  describe("getAllOrdersController", () => {
    test("getAllOrders_success_returnsAllOrders", async () => {
      // Arrange
      const mockOrders = [
        { _id: "order1", buyer: "user123", products: [] },
        { _id: "order2", buyer: "user456", products: [] },
      ];

      orderModel.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockOrders),
      });

      orderModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue(mockOrders),
          }),
        }),
      });

      // Act
      await getAllOrdersController(req, res);

      // Assert
      expect(orderModel.find).toHaveBeenCalledWith({});
      expect(res.json).toHaveBeenCalledWith(mockOrders);
    });

    test("getAllOrders_error_returns500", async () => {
      // Arrange
      const mockError = new Error("Database error");
      
      orderModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockRejectedValue(mockError),
          }),
        }),
      });

      // Act
      await getAllOrdersController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Error WHile Geting Orders",
        error: mockError,
      });
    });
  });

  // ============ orderStatusController Tests ============
  describe("orderStatusController", () => {
    test("orderStatus_success_returnsUpdatedOrder", async () => {
      // Arrange
      req.params = { orderId: "order123" };
      req.body = { status: "Delivered" };

      const updatedOrder = {
        _id: "order123",
        status: "Delivered",
        products: [],
      };

      orderModel.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedOrder);

      // Act
      await orderStatusController(req, res);

      // Assert
      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "order123",
        { status: "Delivered" },
        { new: true }
      );
      expect(res.json).toHaveBeenCalledWith(updatedOrder);
    });

    test("orderStatus_error_returns500", async () => {
      // Arrange
      req.params = { orderId: "order123" };
      req.body = { status: "Delivered" };

      const mockError = new Error("Database error");
      orderModel.findByIdAndUpdate = jest.fn().mockRejectedValue(mockError);

      // Act
      await orderStatusController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Error While Updateing Order",
        error: mockError,
      });
    });
  });
});
