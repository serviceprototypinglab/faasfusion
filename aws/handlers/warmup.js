import { addFunctionConfig } from "../../utils/serverless.js";

const defaults = {
  rate: 5,
  eventkey: "warmup"
}

const functionDeclarationHandler = (annotation, path, state, babel) => {
  const eventKey = annotation.params.eventkey || defaults.eventkey;
  generateConfig(annotation.params, path.node.id.name, eventKey);
  path.node.body.body.unshift(insertion(eventKey, babel.template));
}

const insertion = (eventKey, template) => {
  return template.ast(`
    if (event.${eventKey}) {
      return "Warming up...";
    }
  `);
}

const variableDeclarationHandler = (annotation, path, state, babel) => {
  path.traverse(functionExpressionVisitor, { babel, annotation });
}

const functionExpressionVisitor = {
  "FunctionExpression|ArrowFunctionExpression"(path) {
    const eventKey = this.annotation.params.eventkey || defaults.eventkey;
    generateConfig(this.annotation.params, path.parent.id.name, eventKey);
    path.node.body.body.unshift(insertion(eventKey, this.babel.template));
  }
}

const generateConfig = (params, functionName, eventKey) => {
  const rate = parseInt(params.rate) || defaults.rate;

  addFunctionConfig(functionName, {
    events: [{
      schedule: {
        rate: "rate(" + rate + " minute" + (rate > 1 ? "s" : "") + ")",
        input: { [eventKey]: true }
      }
    }]
  });
}

export { functionDeclarationHandler, variableDeclarationHandler };
