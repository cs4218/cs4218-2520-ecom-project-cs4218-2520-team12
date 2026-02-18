// Amos Chee Tian Ee, A0273476U
/**
 * Test Coverage Scope:
 * This test file covers the following functions from authController.js:
 * - registerController (lines 7-64)
 * - loginController (lines 66-118)
 * - forgotPasswordController (lines 120-157)
 * 
 * Functions excluded from testing (marked with istanbul ignore in source):
 * - testController, updateProfileController, getOrdersController, getAllOrdersController, orderStatusController
 */
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

jest.mock("../../models/userModel.js");
jest.mock("../../models/orderModel.js");
jest.mock("../../helpers/authHelper.js", () => ({
    comparePassword: jest.fn(),
    hashPassword: jest.fn(),
}));
jest.mock("jsonwebtoken", () => ({
    sign: jest.fn(),
}));

const createRes = () => ({
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
});

const createReq = (body = {}) => ({
    body,
    params: {},
    user: {},
});

describe("Auth Controller", () => {
    let req;
    let res;

    beforeEach(() => {
        jest.clearAllMocks();
        req = createReq();
        res = createRes();
        jest.spyOn(console, "log").mockImplementation(() => {});
    });

    /**
     * Test-to-partition mapping (for MS1 traceability)
     * 
     * registerController:
     * - "register_missingName_returnsValidationError" -> Input validation partition: missing required name
     * - "register_missingEmail_returnsValidationError" -> Input validation partition: missing required email
     * - "register_missingPassword_returnsValidationError" -> Input validation partition: missing required password
     * - "register_missingPhone_returnsValidationError" -> Input validation partition: missing required phone
     * - "register_missingAddress_returnsValidationError" -> Input validation partition: missing required address
     * - "register_missingAnswer_returnsValidationError" -> Input validation partition: missing required answer
     * - "register_existingUser_returnsAlreadyRegistered" -> Duplicate-user partition: existing account by email
     * - "register_success_createsUserAndReturns201" -> Equivalence class: valid registration payload
     * - "register_error_returns500" -> Error handling partition: registration dependency throws
     * 
     * loginController:
     * - "login_missingCredentials_returns404" -> Input validation partition: email/password missing
     * - "login_userNotFound_returns404" -> Equivalence class: email not found
     * - "login_wrongPassword_returns200" -> Credential partition: incorrect password
     * - "login_success_returnsTokenAndUser" -> Equivalence class: valid credentials and token generation
     * - "login_error_returns500" -> Error handling partition: login dependency throws
     * 
     * forgotPasswordController:
     * - "forgotPassword_missingEmail_sends400Validation" -> Input validation partition: missing email
     * - "forgotPassword_missingAnswer_sends400Validation" -> Input validation partition: missing answer
     * - "forgotPassword_missingNewPassword_sends400Validation" -> Input validation partition: missing new password
     * - "forgotPassword_wrongEmailOrAnswer_returns404" -> Credential recovery partition: email/answer mismatch
     * - "forgotPassword_success_updatesPassword_returns200" -> Equivalence class: valid reset details
     * - "forgotPassword_error_returns500" -> Error handling partition: reset dependency throws
     * 
     * testController:
     * - "testController_returnsProtectedRoutes" -> Equivalence class: successful protected route access
     * - "testController_error_returnsError" -> Error handling partition: exception in try block
     */

    // =========== Test for registerController ===========
    describe("registerController", () => {
        test("register_missingName_returnsValidationError", async () => {
            // Arrange
            req = createReq({
                email: "u@test.com",
                password: "secret123",
                phone: "1234",
                address: "addr",
                answer: "blue",
            });

            // Act
            await registerController(req, res);

            // Assert
            expect(res.send).toHaveBeenCalledWith({ error: "Name is Required" });
            expect(userModel.findOne).not.toHaveBeenCalled();
        });

        test("register_missingEmail_returnsValidationError", async () => {
            // Arrange
            req = createReq({
                name: "Alice",
                password: "secret123",
                phone: "1234",
                address: "addr",
                answer: "blue",
            });

            // Act
            await registerController(req, res);

            // Assert
            expect(res.send).toHaveBeenCalledWith({ message: "Email is Required" });
            expect(userModel.findOne).not.toHaveBeenCalled();
        });

        test("register_missingPassword_returnsValidationError", async () => {
            // Arrange
            req = createReq({
                name: "Alice",
                email: "u@test.com",
                phone: "1234",
                address: "addr",
                answer: "blue",
            });

            // Act
            await registerController(req, res);

            // Assert
            expect(res.send).toHaveBeenCalledWith({ message: "Password is Required" });
            expect(userModel.findOne).not.toHaveBeenCalled();
        });

        test("register_missingPhone_returnsValidationError", async () => {
            // Arrange
            req = createReq({
                name: "Alice",
                email: "u@test.com",
                password: "secret123",
                address: "addr",
                answer: "blue",
            });

            // Act
            await registerController(req, res);

            // Assert
            expect(res.send).toHaveBeenCalledWith({ message: "Phone no is Required" });
            expect(userModel.findOne).not.toHaveBeenCalled();
        });

        test("register_missingAddress_returnsValidationError", async () => {
            // Arrange
            req = createReq({
                name: "Alice",
                email: "u@test.com",
                password: "secret123",
                phone: "1234",
                answer: "blue",
            });

            // Act
            await registerController(req, res);

            // Assert
            expect(res.send).toHaveBeenCalledWith({ message: "Address is Required" });
            expect(userModel.findOne).not.toHaveBeenCalled();
        });

        test("register_missingAnswer_returnsValidationError", async () => {
            // Arrange
            req = createReq({
                name: "Alice",
                email: "u@test.com",
                password: "secret123",
                phone: "1234",
                address: "addr",
            });

            // Act
            await registerController(req, res);

            // Assert
            expect(res.send).toHaveBeenCalledWith({ message: "Answer is Required" });
            expect(userModel.findOne).not.toHaveBeenCalled();
        });

        test("register_existingUser_returnsAlreadyRegistered", async () => {
            // Arrange
            req = createReq({
                name: "Alice",
                email: "u@test.com",
                password: "secret123",
                phone: "1234",
                address: "addr",
                answer: "blue",
            });
            userModel.findOne.mockResolvedValue({ _id: "existing-id" });

            // Act
            await registerController(req, res);

            // Assert
            expect(userModel.findOne).toHaveBeenCalledWith({ email: "u@test.com" });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith({
                success: false,
                message: "Already Register please login",
            });
        });

        test("register_success_createsUserAndReturns201", async () => {
            // Arrange
            req = createReq({
                name: "Alice",
                email: "u@test.com",
                password: "secret123",
                phone: "1234",
                address: "addr",
                answer: "blue",
            });

            const savedUser = {
                _id: "new-id",
                name: "Alice",
                email: "u@test.com",
            };
            const saveMock = jest.fn().mockResolvedValue(savedUser);

            userModel.findOne.mockResolvedValue(null);
            hashPassword.mockResolvedValue("hashed-secret");
            userModel.mockImplementation(() => ({
                save: saveMock,
            }));

            // Act
            await registerController(req, res);

            // Assert
            expect(hashPassword).toHaveBeenCalledWith("secret123");
            expect(userModel).toHaveBeenCalledWith({
                name: "Alice",
                email: "u@test.com",
                phone: "1234",
                address: "addr",
                password: "hashed-secret",
                answer: "blue",
            });
            expect(saveMock).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                message: "User Register Successfully",
                user: savedUser,
            });
        });

        test("register_error_returns500", async () => {
            // Arrange
            req = createReq({
                name: "Alice",
                email: "u@test.com",
                password: "secret123",
                phone: "1234",
                address: "addr",
                answer: "blue",
            });
            const dbError = new Error("db failure");
            userModel.findOne.mockRejectedValue(dbError);

            // Act
            await registerController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith({
                success: false,
                message: "Errro in Registeration",
                error: dbError,
            });
        });
    });

    // =========== Test for loginController ===========
    describe("loginController", () => {
        test("login_missingCredentials_returns404", async () => {
            // Arrange
            req = createReq({ email: "", password: "" });

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
            req = createReq({ email: "u@test.com", password: "secret123" });
            userModel.findOne.mockResolvedValue(null);

            // Act
            await loginController(req, res);

            // Assert
            expect(userModel.findOne).toHaveBeenCalledWith({ email: "u@test.com" });
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.send).toHaveBeenCalledWith({
                success: false,
                message: "Email is not registerd",
            });
        });

        test("login_wrongPassword_returns200", async () => {
            // Arrange
            req = createReq({ email: "u@test.com", password: "wrong-pass" });
            userModel.findOne.mockResolvedValue({
                _id: "u1",
                email: "u@test.com",
                password: "hashed-pass",
            });
            comparePassword.mockResolvedValue(false);

            // Act
            await loginController(req, res);

            // Assert
            expect(comparePassword).toHaveBeenCalledWith("wrong-pass", "hashed-pass");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith({
                success: false,
                message: "Invalid Password",
            });
        });

        test("login_success_returnsTokenAndUser", async () => {
            // Arrange
            req = createReq({ email: "u@test.com", password: "secret123" });
            process.env.JWT_SECRET = "test-secret";

            const foundUser = {
                _id: "u1",
                name: "Alice",
                email: "u@test.com",
                password: "hashed-pass",
                phone: "1234",
                address: "addr",
                role: 0,
            };

            userModel.findOne.mockResolvedValue(foundUser);
            comparePassword.mockResolvedValue(true);
            JWT.sign.mockReturnValue("signed-token");

            // Act
            await loginController(req, res);

            // Assert
            expect(JWT.sign).toHaveBeenCalledWith(
                { _id: "u1" },
                "test-secret",
                { expiresIn: "7d" }
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                message: "login successfully",
                user: {
                    _id: "u1",
                    name: "Alice",
                    email: "u@test.com",
                    phone: "1234",
                    address: "addr",
                    role: 0,
                },
                token: "signed-token",
            });
        });

        test("login_error_returns500", async () => {
            // Arrange
            req = createReq({ email: "u@test.com", password: "secret123" });
            const dbError = new Error("db failure");
            userModel.findOne.mockRejectedValue(dbError);

            // Act
            await loginController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith({
                success: false,
                message: "Error in login",
                error: dbError,
            });
        });
    });

    // =========== Test for forgotPasswordController ===========
    describe("forgotPasswordController", () => {
        test("forgotPassword_missingEmail_sends400Validation", async () => {
            // Arrange
            req = createReq({ answer: "blue", newPassword: "new123456" });
            userModel.findOne.mockResolvedValue(null);

            // Act
            await forgotPasswordController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.send).toHaveBeenCalledWith({ message: "Email is required" });
        });

        test("forgotPassword_missingAnswer_sends400Validation", async () => {
            // Arrange
            req = createReq({ email: "u@test.com", newPassword: "new123456" });
            userModel.findOne.mockResolvedValue(null);

            // Act
            await forgotPasswordController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.send).toHaveBeenCalledWith({ message: "Answer is required" });
        });

        test("forgotPassword_missingNewPassword_sends400Validation", async () => {
            // Arrange
            req = createReq({ email: "u@test.com", answer: "blue" });
            userModel.findOne.mockResolvedValue(null);

            // Act
            await forgotPasswordController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.send).toHaveBeenCalledWith({ message: "New Password is required" });
        });

        test("forgotPassword_wrongEmailOrAnswer_returns404", async () => {
            // Arrange
            req = createReq({
                email: "u@test.com",
                answer: "wrong",
                newPassword: "new123456",
            });
            userModel.findOne.mockResolvedValue(null);

            // Act
            await forgotPasswordController(req, res);

            // Assert
            expect(userModel.findOne).toHaveBeenCalledWith({
                email: "u@test.com",
                answer: "wrong",
            });
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.send).toHaveBeenCalledWith({
                success: false,
                message: "Wrong Email Or Answer",
            });
        });

        test("forgotPassword_success_updatesPassword_returns200", async () => {
            // Arrange
            req = createReq({
                email: "u@test.com",
                answer: "blue",
                newPassword: "new123456",
            });
            userModel.findOne.mockResolvedValue({ _id: "u1" });
            hashPassword.mockResolvedValue("new-hash");
            userModel.findByIdAndUpdate.mockResolvedValue({ _id: "u1" });

            // Act
            await forgotPasswordController(req, res);

            // Assert
            expect(hashPassword).toHaveBeenCalledWith("new123456");
            expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith("u1", {
                password: "new-hash",
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith({
                success: true,
                message: "Password Reset Successfully",
            });
        });

        test("forgotPassword_error_returns500", async () => {
            // Arrange
            req = createReq({
                email: "u@test.com",
                answer: "blue",
                newPassword: "new123456",
            });
            const dbError = new Error("db failure");
            userModel.findOne.mockRejectedValue(dbError);

            // Act
            await forgotPasswordController(req, res);

            // Assert
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith({
                success: false,
                message: "Something went wrong",
                error: dbError,
            });
        });
    });

    // =========== Test for testController ===========
    describe("testController", () => {
        test("testController_returnsProtectedRoutes", () => {
            // Arrange
            req = createReq({});
            res.send = jest.fn();

            // Act
            testController(req, res);
            
            // Assert
            expect(res.send).toHaveBeenCalledWith("Protected Routes");
        });

        test("testController_error_returnsError", () => {
            // Arrange
            req = createReq({});
            const testError = new Error("test failure");
            res.send = jest.fn()
                .mockImplementationOnce(() => { throw testError; })
                .mockImplementationOnce(() => {});

            // Act
            testController(req, res);

            // Assert
            expect(console.log).toHaveBeenCalledWith(testError);
            expect(res.send).toHaveBeenCalledTimes(2);
            expect(res.send).toHaveBeenNthCalledWith(1, "Protected Routes");
            expect(res.send).toHaveBeenNthCalledWith(2, { error: testError });
        });

    });
});
