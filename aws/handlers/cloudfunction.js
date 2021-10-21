import path from "path";

import { addAwsSdk } from "../utils.js";
import { addFunctionConfig, getConfig, addProviderConfig } from "../../utils/serverless.js";

const functionDeclarationHandler = (annotation, path, state, babel) => {
  generateConfig(annotation.params, state.file.opts.filename, path.node.id.name);
  path.replaceWith(functionReplacement(path.node.id.name, path, babel.types));
}

const functionReplacement = (name, path, t) => {
  return t.expressionStatement(
    t.assignmentExpression(
      "=",
      t.memberExpression(
        t.identifier("exports"),
        t.identifier(name)
      ),
      t.ArrowFunctionExpression(
        path.node.params,
        path.node.body,
        true
      )
    )
  );
}

const variableDeclarationHandler = (annotation, path, state, babel) => {
  path.traverse(functionExpressionVisitor, { state, babel, annotation });
}

const functionExpressionVisitor = {
  "FunctionExpression|ArrowFunctionExpression"(path) {
    generateConfig(this.annotation.params, this.state.file.opts.filename, path.parent.id.name);
    path.parentPath.parentPath.replaceWith(functionReplacement(path.parent.id.name, path, this.babel.types));
  }
}

const callExpressionHandler = (path, state, babel, postFunctions) => {
  const config = getConfig();
  if (path.node.callee.name in config.functions) {
    postFunctions.push(addAwsSdk);
    postFunctions.push(addLambdaInvokeFunction);
    addProviderConfig(generateIamRoleConfig());
    path.getFunctionParent().node.async = true;
    path.replaceWith(callExpressionReplacement(path, babel.types, config));
    path.skip();
  }
}

const addLambdaInvokeFunction = (state, template, config) => {
  state.path.pushContainer('body', template.ast(`
    const invokeLambda = async (functionName, payload) => {
      const lambda = new AWS.Lambda({ region: '${config.provider.region}' });
      try {
        return (await lambda.invoke({ FunctionName: functionName, Payload: payload }).promise()).Payload;
      } catch {
        console.error("Error invoking function " + functionName);
        return "Error";
      }
    };
  `));
}

const generateIamRoleConfig = () => {
  return {
    iam: {
      role: {
        statements: [
          {
            Effect: "Allow",
            Action: [
              "lambda:InvokeFunction"

            ],
            Resource: "*"
          }
        ]
      }
    }
  }
}

const callExpressionReplacement = (path, t, config) => {
  return t.callExpression(
    t.memberExpression(
      t.identifier("JSON"),
      t.identifier("parse")
    ),
    [
      t.awaitExpression(
        t.callExpression(
          t.identifier("invokeLambda"),
          [
            t.stringLiteral(`${config.service}-${config.provider.stage}-${path.node.callee.name}`),
            t.callExpression(
              t.memberExpression(
                t.identifier("JSON"),
                t.identifier("stringify")
              ),
              path.node.arguments
            )
          ]
        )
      )
    ]
  )
}

const generateConfig = (params, fileName, functionName) => {
  addFunctionConfig(functionName, {
    handler: "out/" + path.basename(fileName, ".js") + "." + functionName,
    ...(params.memory && { memorySize: parseInt(params.memory) }),
    ...(params.timeout && { timeout: parseInt(params.timeout) })
  });
}

export { functionDeclarationHandler, variableDeclarationHandler, callExpressionHandler };
