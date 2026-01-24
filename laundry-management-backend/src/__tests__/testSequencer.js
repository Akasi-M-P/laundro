/**
 * Custom test sequencer to run unit tests before integration tests
 * This ensures unit tests run faster and integration tests have clean state
 */
class CustomSequencer {
  sort(tests) {
    const copyTests = Array.from(tests);
    return copyTests.sort((testA, testB) => {
      const testAPath = testA.path;
      const testBPath = testB.path;

      // Unit tests first (not in integration folder)
      const isUnitA = !testAPath.includes("integration");
      const isUnitB = !testBPath.includes("integration");

      if (isUnitA && !isUnitB) return -1;
      if (!isUnitA && isUnitB) return 1;

      // Alphabetical order within same type
      return testAPath.localeCompare(testBPath);
    });
  }
}

module.exports = CustomSequencer;
