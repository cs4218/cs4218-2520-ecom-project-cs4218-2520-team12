export default {
    // display name
    displayName: "backend",

    // when testing backend
    testEnvironment: "node",

    // which test to run
    testMatch: [
        "<rootDir>/controllers/__tests__/*.test.js",
        "<rootDir>/models/__tests__/*.test.js",
    ],

    // jest code coverage
    collectCoverage: true,
    collectCoverageFrom: [
        "controllers/**",
        "models/**",
    ],
    coverageThreshold: {
        global: {
            lines: 95,
            functions: 95,
        },
    },
};
