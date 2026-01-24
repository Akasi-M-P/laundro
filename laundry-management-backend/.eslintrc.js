module.exports = {
  env: {
    browser: false,
    node: true,
    es2022: true,
    jest: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  rules: {
    // Possible Errors
    "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "warn",
    "no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "no-undef": "error",

    // Best Practices
    eqeqeq: ["error", "always"],
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    "no-script-url": "error",
    strict: ["error", "global"],

    // Variables
    "no-shadow": "error",
    "no-use-before-define": [
      "error",
      {
        functions: false,
        classes: true,
        variables: true,
      },
    ],

    // Stylistic Issues
    camelcase: ["error", { properties: "never" }],
    "consistent-return": "error",
    curly: ["error", "all"],
    "default-case": "error",
    "dot-notation": "error",
    "eol-last": "error",
    indent: [
      "error",
      2,
      {
        SwitchCase: 1,
        VariableDeclarator: { var: 2, let: 2, const: 3 },
        outerIIFEBody: 1,
        MemberExpression: 1,
        FunctionDeclaration: { parameters: 3, body: 1 },
        FunctionExpression: { parameters: 3, body: 1 },
        CallExpression: { arguments: "first" },
        ArrayExpression: 1,
        ObjectExpression: 1,
        ImportDeclaration: 1,
        flatTernaryExpressions: false,
        ignoreComments: false,
      },
    ],
    "linebreak-style": ["error", "unix"],
    "max-len": [
      "error",
      {
        code: 100,
        tabWidth: 2,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      },
    ],
    "new-cap": [
      "error",
      {
        newIsCap: true,
        capIsNew: false,
        properties: true,
      },
    ],
    "no-array-constructor": "error",
    "no-lonely-if": "error",
    "no-multiple-empty-lines": ["error", { max: 2, maxEOF: 1 }],
    "no-new-object": "error",
    "no-trailing-spaces": "error",
    "object-curly-spacing": ["error", "always"],
    quotes: [
      "error",
      "double",
      {
        avoidEscape: true,
        allowTemplateLiterals: true,
      },
    ],
    semi: ["error", "always"],
    "space-before-blocks": "error",
    "space-before-function-paren": [
      "error",
      {
        anonymous: "always",
        named: "never",
        asyncArrow: "always",
      },
    ],
    "space-in-parens": ["error", "never"],
    "space-infix-ops": "error",
    "space-unary-ops": "error",

    // ES6
    "arrow-spacing": "error",
    "constructor-super": "error",
    "no-class-assign": "error",
    "no-const-assign": "error",
    "no-dupe-class-members": "error",
    "no-duplicate-imports": "error",
    "no-new-symbol": "error",
    "no-this-before-super": "error",
    "no-useless-computed-key": "error",
    "no-useless-constructor": "error",
    "no-useless-rename": "error",
    "no-var": "error",
    "object-shorthand": "error",
    "prefer-arrow-callback": "error",
    "prefer-const": "error",
    "prefer-destructuring": [
      "error",
      {
        VariableDeclarator: {
          array: false,
          object: true,
        },
        AssignmentExpression: {
          array: true,
          object: false,
        },
      },
    ],
    "prefer-rest-params": "error",
    "prefer-spread": "error",
    "prefer-template": "error",
    "require-yield": "error",
    "rest-spread-spacing": "error",
    "template-curly-spacing": "error",
    "yield-star-spacing": "error",
  },
  ignorePatterns: [
    "node_modules/",
    "coverage/",
    "logs/",
    "*.min.js",
    "dist/",
    "build/",
  ],
};
