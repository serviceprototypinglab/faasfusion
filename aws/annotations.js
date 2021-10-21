import * as dummy from "./handlers/dummy.js"
import * as autotune from "./handlers/autotune.js"
import * as warmup from "./handlers/warmup.js"
import * as httpapi from "./handlers/httpapi.js"
import * as cloudfunction from "./handlers/cloudfunction.js"

const annotations = [
  {
    name: "@dummy",
    handlers: {
      VariableDeclaration: dummy.handler
    }
  },
  {
    name: "@autotune",
    dependsOn: "@cloudfunction",
    handlers: {
      FunctionDeclaration: autotune.functionDeclarationHandler,
      VariableDeclaration: autotune.variableDeclarationHandler
    }
  },
  {
    name: "@warmup",
    dependsOn: "@cloudfunction",
    handlers: {
      FunctionDeclaration: warmup.functionDeclarationHandler,
      VariableDeclaration: warmup.variableDeclarationHandler
    }
  },
  {
    name: "@httpapi",
    dependsOn: "@cloudfunction",
    handlers: {
      FunctionDeclaration: httpapi.functionDeclarationHandler,
      VariableDeclaration: httpapi.variableDeclarationHandler
    }
  },
  {
    name: "@cloudfunction",
    handlers: {
      FunctionDeclaration: cloudfunction.functionDeclarationHandler,
      VariableDeclaration: cloudfunction.variableDeclarationHandler
    },
    genericHandlers: {
      CallExpression: cloudfunction.callExpressionHandler
    }
  }
];

export default annotations;
