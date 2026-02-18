// Wong An Wei, A0273528X

import { updateProfileController } from "../authController.js";

import userModel from "../../models/userModel.js";
import { hashPassword } from "../../helpers/authHelper.js";

jest.mock("../../models/userModel.js");
jest.mock("../../models/orderModel.js");
jest.mock("../../helpers/authHelper.js", () => ({
  comparePassword: jest.fn(),
  hashPassword: jest.fn(),
}));

describe("updateProfileController", () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { _id: "user123" },
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("passwordTooShort_boundary_returnsJsonError_andDoesNotUpdate", async () => {
    // Strategy: BVA + Basis Path - Boundary at length 5 (<6) triggers early return.

    // Arrange
    req.body = { password: "12345" };
    userModel.findById = jest.fn();
    userModel.findByIdAndUpdate = jest.fn();

    // Act
    await updateProfileController(req, res);

    // Assert
    expect(res.json).toHaveBeenCalledWith({
      error: "Passsword is required and 6 character long",
    });
    expect(userModel.findById).toHaveBeenCalledWith("user123");
    expect(hashPassword).not.toHaveBeenCalled();
    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test("noPassword_equivalence_updatesWithExistingPassword", async () => {
    // Strategy: EP + Basis Path - Valid EC: password missing => hashedPassword undefined => uses existing user.password.

    // Arrange
    req.body = {
      name: "New Name",
      email: "ignored@test.com",
      phone: "888",
      address: "New Address",
    };

    const existingUser = {
      _id: "user123",
      name: "Old Name",
      password: "old-hash",
      phone: "999",
      address: "Old Address",
    };

    const updatedUser = {
      _id: "user123",
      name: "New Name",
      password: "old-hash",
      phone: "888",
      address: "New Address",
    };

    userModel.findById = jest.fn().mockResolvedValue(existingUser);
    userModel.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedUser);

    // Act
    await updateProfileController(req, res);

    // Assert
    expect(userModel.findById).toHaveBeenCalledWith("user123");
    expect(hashPassword).not.toHaveBeenCalled();

    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "user123",
      {
        name: "New Name",
        password: "old-hash",
        phone: "888",
        address: "New Address",
      },
      { new: true },
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "Profile Updated SUccessfully",
      updatedUser,
    });
  });

  test("passwordLength6_boundary_hashesAndUpdates", async () => {
    // Strategy: BVA + Basis Path - Boundary at length 6 is valid => hash + update uses hashedPassword.

    // Arrange
    req.body = {
      name: "New Name",
      password: "123456",
      phone: "888",
      address: "New Address",
    };

    const existingUser = {
      _id: "user123",
      name: "Old Name",
      password: "old-hash",
      phone: "999",
      address: "Old Address",
    };

    const updatedUser = {
      _id: "user123",
      name: "New Name",
      password: "new-hash",
      phone: "888",
      address: "New Address",
    };

    userModel.findById = jest.fn().mockResolvedValue(existingUser);
    hashPassword.mockResolvedValue("new-hash");
    userModel.findByIdAndUpdate = jest.fn().mockResolvedValue(updatedUser);

    // Act
    await updateProfileController(req, res);

    // Assert
    expect(hashPassword).toHaveBeenCalledWith("123456");
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "user123",
      {
        name: "New Name",
        password: "new-hash",
        phone: "888",
        address: "New Address",
      },
      { new: true },
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "Profile Updated SUccessfully",
      updatedUser,
    });
  });

  test("dbFailure_basisPath_returns400", async () => {
    // Strategy: Basis Path - try/catch error path: userModel.findById throws => 400 response.

    // Arrange
    const err = new Error("db");
    userModel.findById = jest.fn().mockRejectedValue(err);

    // Act
    await updateProfileController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Error WHile Update profile",
      error: err,
    });
  });
});
