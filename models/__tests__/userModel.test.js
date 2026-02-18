// Amos Chee Tian Ee, A0273476U
import userModel from "../../models/userModel.js";


/**
 * * Test-to-partition mapping (for MS1 traceability)
 * - "modelName_isUsers" -> Schema identity partition: model registration name
 * - "requiredFields_areConfigured" -> Schema constraints partition: mandatory fields
 * - "email_isUnique" -> Schema uniqueness partition: unique email index flag
 * - "role_defaultValue_isZero" -> Default-value partition: role default assignment
 * - "timestamps_areEnabled" -> Metadata partition: automatic createdAt/updatedAt support
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
});
