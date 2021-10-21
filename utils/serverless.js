import yaml from "js-yaml";
import fs from "fs";

import { getFusionConfig } from "./config.js";

let slsConfig = {};

const getConfig = () => {
  return slsConfig;
}

const initConfig = () => {
  if (fs.existsSync("serverless.yml")) {
    fs.unlinkSync("serverless.yml");
  }
  const fusionConfig = getFusionConfig();

  slsConfig = {
    service: fusionConfig.service,
    provider: {
      name: fusionConfig.provider,
      runtime: fusionConfig.runtime,
      stage: fusionConfig.stage,
      region: fusionConfig.region,
      lambdaHashingVersion: "20201221"
    },
    functions: {},
    resources: { Resources: {} }
  };
}

const writeConfig = () => {
  fs.writeFileSync("serverless.yml", yaml.dump(slsConfig), "utf8");
}

const addFunctionConfig = (fn, props) => {
  let events;
  if (slsConfig.functions[fn] === undefined) {
    slsConfig.functions[fn] = {
      ...slsConfig.functions[fn],
      ...props
    }
    return;
  } else if (slsConfig.functions[fn].events.length > 0 && props.events === undefined) {
    events = slsConfig.functions[fn].events;
  } else if (slsConfig.functions[fn].events.length === 0 && props.events !== undefined) {
    events = props.events;
  } else if (slsConfig.functions[fn].events.length > 0 && props.events !== undefined) {
    events = [...slsConfig.functions[fn].events, ...props.events];
  }
  
  slsConfig.functions[fn] = {
    ...slsConfig.functions[fn],
    ...props,
    events: events
  }
}

const addFunctionConfigEnvironment = (fn, environment) => {
  slsConfig.functions[fn].environment = {
    ...slsConfig.functions[fn].environment,
    ...environment
  }
}

const addResources = (resources) => {
  slsConfig.resources.Resources = {
    ...slsConfig.resources.Resources,
    ...resources
  };
}

const addProviderConfig = (config) => {
  slsConfig.provider = {
    ...slsConfig.provider,
    ...config
  }
}

export { addFunctionConfig, addFunctionConfigEnvironment, initConfig, getConfig, writeConfig, addResources, addProviderConfig };
