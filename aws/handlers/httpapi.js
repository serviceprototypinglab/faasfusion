import { addFunctionConfig } from "../../utils/serverless.js";

const functionDeclarationHandler = (annotation, path, state, babel) => {
  generateConfig(annotation.params, path.node.id.name);
}

const variableDeclarationHandler = (annotation, path, state, babel) => {
  path.traverse(functionExpressionVisitor, { annotation });
}

const functionExpressionVisitor = {
  "FunctionExpression|ArrowFunctionExpression"(path) {
    generateConfig(this.annotation.params, path.parent.id.name);
  }
}

const generateConfig = (params, functionName) => {
  addFunctionConfig(functionName, {
    events: [{
      httpApi: {
        method: params.method,
        path: params.path
      }
    }]
  });
}

export { functionDeclarationHandler, variableDeclarationHandler };
