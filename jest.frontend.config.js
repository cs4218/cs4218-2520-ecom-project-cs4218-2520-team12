module.exports = {
    // name displayed during tests
    displayName: "frontend",

    // simulates browser environment in jest
    // e.g., using document.querySelector in your tests
    testEnvironment: "jest-environment-jsdom",

    // jest does not recognise jsx files by default, so we use babel to transform any jsx files
    transform: {
        "^.+\\.jsx?$": "babel-jest",
    },

    // tells jest how to handle css/scss imports in your tests
    moduleNameMapper: {
        "\\.(css|scss)$": "identity-obj-proxy",
    },

    // ignore all node_modules except styleMock (needed for css imports)
    transformIgnorePatterns: ["/node_modules/(?!(styleMock\\.js)$)"],

    // only run these tests
    testMatch: [
        "<rootDir>/client/src/__tests__/pages/*.test.js",
        "<rootDir>/client/src/pages/**/*.test.js",
    ],

    // jest code coverage
    collectCoverage: true,
    collectCoverageFrom: [
        "client/src/pages/HomePage.js",
        "client/src/pages/CartPage.js",
        "client/src/pages/Categories.js",
        "client/src/pages/CategoryProduct.js",
        "client/src/pages/Policy.js",
        "client/src/pages/Contact.js",
    ],
    coverageThreshold: {
        global: {
            lines: 95,
            functions: 95,
        },
    },
    setupFilesAfterEnv: ["<rootDir>/client/src/setupTests.js"],
};
