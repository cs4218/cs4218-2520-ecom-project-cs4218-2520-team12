// Wong An Wei, A0273528X

import {
  getOrdersController,
  getAllOrdersController,
  orderStatusController,
} from "../authController.js";

import orderModel from "../../models/orderModel.js";
import userModel from "../../models/userModel.js";

jest.mock("../../models/orderModel.js");
jest.mock("../../models/userModel.js");
jest.mock("../../helpers/authHelper.js", () => ({
  comparePassword: jest.fn(),
  hashPassword: jest.fn(),
}));

describe("Order Controllers (getOrdersController / getAllOrdersController / orderStatusController)", () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { _id: "user123" },
      params: {},
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});

    // Explicitly ensure mocked models are not accidentally used for real DB calls
    userModel.findOne = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getOrdersController", () => {
    test("getOrders_validUser_returnsOrders", async () => {
      // Strategy: EP + Basis Path - Valid EC (req.user._id exists) => find+populate+populate success path.

      // Arrange
      const mockOrders = [
        {
          _id: "order1",
          status: "Processing",
          buyer: { name: "John" },
          products: [{ _id: "p1" }],
        },
      ];

      const query = {
        populate: jest.fn().mockReturnThis(),
        maxTimeMS: jest.fn().mockReturnThis(),
        then: (resolve, reject) => Promise.resolve(mockOrders).then(resolve, reject),
      };

      orderModel.find = jest.fn().mockReturnValue(query);

      // Act
      await getOrdersController(req, res);

      // Assert
      expect(orderModel.find).toHaveBeenCalledWith({ buyer: "user123" });
      expect(query.populate).toHaveBeenCalledWith("products", "-photo");
      expect(query.populate).toHaveBeenCalledWith("buyer", "name");
      expect(res.json).toHaveBeenCalledWith(mockOrders);
    });

    test("getOrders_dbError_returns500", async () => {
      // Strategy: Basis Path - try/catch error path: model find rejects => 500 response.

      // Arrange
      const err = new Error("db");
      const query = {
        populate: jest.fn().mockReturnThis(),
        maxTimeMS: jest.fn().mockReturnThis(),
        then: (resolve, reject) => Promise.reject(err).then(resolve, reject),
      };
      orderModel.find = jest.fn().mockReturnValue(query);

      // Act
      await getOrdersController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Error WHile Geting Orders",
        error: err,
      });
    });
  });

  describe("getAllOrdersController", () => {
    test("getAllOrders_success_returnsSortedOrders", async () => {
      // Strategy: EP + Basis Path - Valid EC => find+populate+populate+sort success path.

      // Arrange
      const mockOrders = [{ _id: "order1" }, { _id: "order2" }];

      const query = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        then: (resolve, reject) => Promise.resolve(mockOrders).then(resolve, reject),
      };

      orderModel.find = jest.fn().mockReturnValue(query);

      // Act
      await getAllOrdersController(req, res);

      // Assert
      expect(orderModel.find).toHaveBeenCalledWith({});
      expect(query.populate).toHaveBeenCalledWith("products", "-photo");
      expect(query.populate).toHaveBeenCalledWith("buyer", "name");
      expect(query.sort).toHaveBeenCalledWith({ createdAt: "-1" });
      expect(res.json).toHaveBeenCalledWith(mockOrders);
    });

    test("getAllOrders_dbError_returns500", async () => {
      // Strategy: Basis Path - try/catch error path: model find rejects => 500 response.

      // Arrange
      const err = new Error("db");
      const query = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        then: (resolve, reject) => Promise.reject(err).then(resolve, reject),
      };
      orderModel.find = jest.fn().mockReturnValue(query);

      // Act
      await getAllOrdersController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Error WHile Geting Orders",
        error: err,
      });
    });
  });

  describe("orderStatusController", () => {
    test("orderStatus_validStatus_updatesOrder", async () => {
      // Strategy: EP + Basis Path - Valid EC (orderId + valid status) => findByIdAndUpdate success.

      // Arrange
      req.params = { orderId: "order123" };
      req.body = { status: "Shipped" };

      const updated = { _id: "order123", status: "Shipped" };
      orderModel.findByIdAndUpdate = jest.fn().mockResolvedValue(updated);

      // Act
      await orderStatusController(req, res);

      // Assert
      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "order123",
        { status: "Shipped" },
        { new: true },
      );
      expect(res.json).toHaveBeenCalledWith(updated);
    });

    test("orderStatus_emptyStatus_boundaryValue_stillPassesToUpdate", async () => {
      // Strategy: BVA - Boundary at empty string status => controller still forwards status to model.

      // Arrange
      req.params = { orderId: "order123" };
      req.body = { status: "" };

      const updated = { _id: "order123", status: "" };
      orderModel.findByIdAndUpdate = jest.fn().mockResolvedValue(updated);

      // Act
      await orderStatusController(req, res);

      // Assert
      expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "order123",
        { status: "" },
        { new: true },
      );
      expect(res.json).toHaveBeenCalledWith(updated);
    });

    test("orderStatus_dbError_returns500", async () => {
      // Strategy: Basis Path - try/catch error path: model update rejects => 500 response.

      // Arrange
      req.params = { orderId: "order123" };
      req.body = { status: "Processing" };

      const err = new Error("db");
      orderModel.findByIdAndUpdate = jest.fn().mockRejectedValue(err);

      // Act
      await orderStatusController(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({
        success: false,
        message: "Error While Updateing Order",
        error: err,
      });
    });
  });
});
