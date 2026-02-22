// Amos Chee Tian Ee, A0273476U
import userModel from "../../models/userModel.js";


/**
 * * Test-to-partition mapping (for MS1 traceability)
 * - "modelName_isUsers" -> Schema identity partition: model registration name
 * - "requiredFields_areConfigured" -> Schema constraints partition: mandatory fields
 * - "email_isUnique" -> Schema uniqueness partition: unique email index flag
 * - "role_defaultValue_isZero" -> Default-value partition: role default assignment
 * - "timestamps_areEnabled" -> Metadata partition: automatic createdAt/updatedAt support
 * - "validation_validUser_passes" -> Equivalence class: all required fields present
 * - "validation_missingName_throwsError" -> Input validation partition: missing required name
 * - "validation_missingEmail_throwsError" -> Input validation partition: missing required email
 * - "validation_missingPassword_throwsError" -> Input validation partition: missing required password
 * - "validation_missingPhone_throwsError" -> Input validation partition: missing required phone
 * - "validation_missingAddress_throwsError" -> Input validation partition: missing required address
 * - "validation_missingAnswer_throwsError" -> Input validation partition: missing required answer
 * - "defaults_roleNotProvided_setsToZero" -> Default-value partition: role auto-assignment
 */

describe("User Model", () => {

    test("modelName_isUsers", () => {
        // Arrange
        // No setup required; model is imported once.

        // Act
        const modelName = userModel.modelName;

        // Assert
        expect(modelName).toBe("users");
    });

    test("requiredFields_areConfigured", () => {
        // Arrange
        const schema = userModel.schema;

        // Act
        const nameRequired = schema.path("name").isRequired;
        const emailRequired = schema.path("email").isRequired;
        const passwordRequired = schema.path("password").isRequired;
        const phoneRequired = schema.path("phone").isRequired;
        const addressRequired = schema.path("address").isRequired;
        const answerRequired = schema.path("answer").isRequired;

        // Assert
        expect(nameRequired).toBeTruthy();
        expect(emailRequired).toBeTruthy();
        expect(passwordRequired).toBeTruthy();
        expect(phoneRequired).toBeTruthy();
        expect(addressRequired).toBeTruthy();
        expect(answerRequired).toBeTruthy();
    });

    test("email_isUnique", () => {
        // Arrange
        const emailPath = userModel.schema.path("email");

        // Act
        const isUnique = emailPath.options.unique;

        // Assert
        expect(isUnique).toBe(true);
    });

    test("role_defaultValue_isZero", () => {
        // Arrange
        const rolePath = userModel.schema.path("role");

        // Act
        const roleDefault = rolePath.defaultValue;

        // Assert
        expect(roleDefault).toBe(0);
    });

    test("timestamps_areEnabled", () => {
        // Arrange
        const schemaOptions = userModel.schema.options;

        // Act
        const timestampsEnabled = schemaOptions.timestamps;

        // Assert
        expect(timestampsEnabled).toBe(true);
    });

    test("validation_validUser_passes", () => {
        // Arrange
        const validUserData = {
            name: "Alice",
            email: "alice@test.com",
            password: "hashed-password",
            phone: "1234567890",
            address: { street: "123 Main St", city: "City" },
            answer: "blue",
        };

        // Act
        const user = new userModel(validUserData);
        const error = user.validateSync();

        // Assert
        expect(error).toBeUndefined();
        expect(user.name).toBe("Alice");
        expect(user.email).toBe("alice@test.com");
        expect(user.role).toBe(0); // Default value
    });

    test("validation_missingName_throwsError", () => {
        // Arrange
        const userData = {
            email: "alice@test.com",
            password: "hashed-password",
            phone: "1234567890",
            address: { street: "123 Main St" },
            answer: "blue",
        };

        // Act
        const user = new userModel(userData);
        const error = user.validateSync();

        // Assert
        expect(error).toBeDefined();
        expect(error.errors.name).toBeDefined();
        expect(error.errors.name.kind).toBe("required");
    });

    test("validation_missingEmail_throwsError", () => {
        // Arrange
        const userData = {
            name: "Alice",
            password: "hashed-password",
            phone: "1234567890",
            address: { street: "123 Main St" },
            answer: "blue",
        };

        // Act
        const user = new userModel(userData);
        const error = user.validateSync();

        // Assert
        expect(error).toBeDefined();
        expect(error.errors.email).toBeDefined();
        expect(error.errors.email.kind).toBe("required");
    });

    test("validation_missingPassword_throwsError", () => {
        // Arrange
        const userData = {
            name: "Alice",
            email: "alice@test.com",
            phone: "1234567890",
            address: { street: "123 Main St" },
            answer: "blue",
        };

        // Act
        const user = new userModel(userData);
        const error = user.validateSync();

        // Assert
        expect(error).toBeDefined();
        expect(error.errors.password).toBeDefined();
        expect(error.errors.password.kind).toBe("required");
    });

    test("validation_missingPhone_throwsError", () => {
        // Arrange
        const userData = {
            name: "Alice",
            email: "alice@test.com",
            password: "hashed-password",
            address: { street: "123 Main St" },
            answer: "blue",
        };

        // Act
        const user = new userModel(userData);
        const error = user.validateSync();

        // Assert
        expect(error).toBeDefined();
        expect(error.errors.phone).toBeDefined();
        expect(error.errors.phone.kind).toBe("required");
    });

    test("validation_missingAddress_throwsError", () => {
        // Arrange
        const userData = {
            name: "Alice",
            email: "alice@test.com",
            password: "hashed-password",
            phone: "1234567890",
            answer: "blue",
        };

        // Act
        const user = new userModel(userData);
        const error = user.validateSync();

        // Assert
        expect(error).toBeDefined();
        expect(error.errors.address).toBeDefined();
        expect(error.errors.address.kind).toBe("required");
    });

    test("validation_missingAnswer_throwsError", () => {
        // Arrange
        const userData = {
            name: "Alice",
            email: "alice@test.com",
            password: "hashed-password",
            phone: "1234567890",
            address: { street: "123 Main St" },
        };

        // Act
        const user = new userModel(userData);
        const error = user.validateSync();

        // Assert
        expect(error).toBeDefined();
        expect(error.errors.answer).toBeDefined();
        expect(error.errors.answer.kind).toBe("required");
    });

    test("defaults_roleNotProvided_setsToZero", () => {
        // Arrange
        const userData = {
            name: "Alice",
            email: "alice@test.com",
            password: "hashed-password",
            phone: "1234567890",
            address: { street: "123 Main St" },
            answer: "blue",
            // role intentionally omitted
        };

        // Act
        const user = new userModel(userData);

        // Assert
        expect(user.role).toBe(0);
    });
});
