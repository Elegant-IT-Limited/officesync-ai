module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testRegex: ".*\\.spec\\.ts$",
  setupFiles: ["reflect-metadata"],
  setupFilesAfterEnv: ["<rootDir>/test/support/teardown.ts"],
  transform: { "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
};
