import awsAnnotations from "./aws/annotations.js";
import { initConfig, writeConfig, getConfig } from "./utils/serverless.js";

let postFunctions = [];

const buildVisitor = (babel, annotations) => {
  const visitor = {};

  [...new Set(annotations.filter(a => a.handlers !== undefined).map(a => Object.keys(a.handlers)).flat())].map(visitorMethod => {
    visitor[visitorMethod] = (path, state) => {
      if (path.node.leadingComments) {
        // parse annotations
        const parsedAnnotations = parseAnnotations(path.node.leadingComments);
        if (parsedAnnotations.length !== 0) {
          // process parsed annotations
          annotations.filter(a => parsedAnnotations.map(pa => pa.name).includes(a.name) && Object.keys(a.handlers).includes(visitorMethod)).map(annotation => {
            // check dependencies
            if (annotation.dependsOn && !(parsedAnnotations.filter(a => a.name === annotation.dependsOn)[0])) {
              console.warn(`(${state.file.opts.filename}, ${path.node.loc.start.line}:${path.node.loc.start.column}) ${annotation.name} depends on ${annotation.dependsOn}, which is not defined. ${annotation.name} will be skipped.`);
              return;
            }
            // call handler
            const parsedAnnotation = parsedAnnotations.filter(a => a.name === annotation.name)[0];
            annotation.handlers[visitorMethod](parsedAnnotation, path, state, babel, postFunctions);
          });
        }
      }
    }
  });

  [...new Set(annotations.filter(a => a.genericHandlers !== undefined).map(a => Object.keys(a.genericHandlers)).flat())].map(visitorMethod => {
    if (Object.keys(visitor).includes(visitorMethod)) {
      console.warn(`Visitor method "${visitorMethod}" has already been declared as an annotation-specific visitor method. Generic handler functions associated with this visitor method will be skipped.`);
    } else {
      visitor[visitorMethod] = (path, state) => {
        annotations.filter(a => a.genericHandlers !== undefined && Object.keys(a.genericHandlers).includes(visitorMethod)).map(annotation => {
          annotation.genericHandlers[visitorMethod](path, state, babel, postFunctions);
        });
      }
    }
  });

  return visitor;
}

const plugin = (babel) => {
  initConfig();
  const config = getConfig();

  let visitor = {}
  switch (config.provider.name) {
    case "aws":
      visitor = buildVisitor(babel, awsAnnotations);
      break;
    default:
      visitor = buildVisitor(babel, awsAnnotations);
      break;
  }

  return {
    pre() {
      postFunctions = [];
    },
    visitor,
    post(state) {
      [...new Set(postFunctions)].map(f => f(state, babel.template, config));
      writeConfig();
    }
  };
}

const parseAnnotations = (comments) => {
  const regex = /\@\w+(\(( *\w+ *\= *\S+ *)?(\, *\w+ *\= *\S+ *)*\))?/g
  const rawAnnotations = comments.map(comment => comment.value).join(' ').match(regex);
  let annotations = [];
  if (rawAnnotations !== null) {
    rawAnnotations.map(rawAnnotation => {
      let params = {};
      const name = rawAnnotation.substring(0, rawAnnotation.indexOf('(') !== -1 ? rawAnnotation.indexOf('(') : rawAnnotation.length).toLowerCase();
      const rawParams = rawAnnotation.substring(rawAnnotation.indexOf('(') + 1, rawAnnotation.indexOf(')'));
      if (rawParams) {
        rawParams.split(',').map(rawParam => {
          rawParam = rawParam.split('=');
          params = { ...params, [rawParam[0].trim().toLowerCase()]: rawParam[1].trim() };
        });
      }
      annotations.push({ name: name, params: params });
    });
  }
  return annotations;
}

export default plugin;
