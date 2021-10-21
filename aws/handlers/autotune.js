import path from "path";

import { addAwsSdk } from "../utils.js";
import { addFunctionConfig, addFunctionConfigEnvironment, addResources } from "../../utils/serverless.js";

const autotuneId = "autotune";

const defaults = {
  minmemory: 128,
  maxmemory: 2048,
  lowerthreshold: 0.4,
  upperthreshold: 0.9
}

const metrics = {
  memorySize: "MemorySize",
  maxMemoryUsed: "MaxMemoryUsed"
};

const filterPattern = `[type=\"REPORT\", RequestId_Label=\"RequestId:\", RequestId, Duration_Label=\"Duration:\", Duration, Duration_Unit, BilledDuration_Label_1=\"Billed\", BilledDuration_Label_2=\"Duration:\", BilledDuration, BilledDuration_Unit, MemorySize_Label_1=\"Memory\", MemorySize_Label_2=\"Size:\", ${metrics.memorySize}, MemorySize_Unit, MaxMemoryUsed_Label_1=\"Max\", MaxMemoryUsed_Label_2=\"Memory\", MaxMemoryUsed_Label_3=\"Used:\", ${metrics.maxMemoryUsed}, MaxMemoryUsed_Unit, ...]`;

const getAlarms = (annotation) => {
  return {
    lowMemory: {
      name: "LowMemory",
      threshold: parseFloat(annotation.params.lowerthreshold) || defaults.lowerthreshold,
      comparisonOperator: "LessThanThreshold"
    },
    highMemory: {
      name: "HighMemory",
      threshold: parseFloat(annotation.params.upperthreshold) || defaults.upperthreshold,
      comparisonOperator: "GreaterThanThreshold"
    }
  }
}

const functionDeclarationHandler = (annotation, path, state, babel, postFunctions) => {
  const functionName = path.node.id.name;

  addAutotuneResources(functionName, annotation);

  postFunctions.push(addAwsSdk);
  postFunctions.push(addAutotuneFunction);

  generateAutotuneConfig(annotation.params, state.file.opts.filename, functionName);
}

const variableDeclarationHandler = (annotation, path, state, babel, postFunctions) => {
  path.traverse(functionExpressionVisitor, { state, postFunctions, annotation });
}

const functionExpressionVisitor = {
  "FunctionExpression|ArrowFunctionExpression"(path) {
    const functionName = path.parent.id.name;

    addAutotuneResources(functionName, this.annotation);

    this.postFunctions.push(addAwsSdk);
    this.postFunctions.push(addAutotuneFunction);

    generateAutotuneConfig(this.annotation.params, this.state.file.opts.filename, functionName);
  }
}

const capitalize = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

const generateCloudwatchMetricFilterResource = (functionName, metric, filterPattern) => {
  return {
    [capitalize(functionName) + metric + "MetricFilter"]: {
      "Type": "AWS::Logs::MetricFilter",
      "DependsOn": capitalize(functionName) + "LogGroup",
      "Properties": {
        "FilterPattern": filterPattern,
        "LogGroupName": { "Ref": capitalize(functionName) + "LogGroup" },
        "MetricTransformations": [
          {
            "MetricName": functionName + "-" + metric,
            "MetricNamespace": "${self:service}-${self:provider.stage}",
            "MetricValue": "$" + metric
          }
        ]
      }
    }
  }
}

const generateCloudwatchAlarmResource = (functionName, metrics, alarm) => {
  return {
    [capitalize(functionName) + alarm.name + "Alarm"]: {
      "Type": "AWS::CloudWatch::Alarm",
      "Properties": {
        "AlarmName": "${self:service}-${self:provider.stage}-" + functionName + "-" + alarm.name,
        "ActionsEnabled": true,
        "AlarmActions": [{
          "Ref": "SNSTopic" + capitalize(autotuneId) + "Alarm"
        }],
        "EvaluationPeriods": 1,
        "DatapointsToAlarm": 1,
        "Threshold": alarm.threshold,
        "ComparisonOperator": alarm.comparisonOperator,
        "Metrics": [
          {
            "Id": "e1",
            "Label": "MemoryUtilization",
            "ReturnData": true,
            "Expression": "m1/m2"
          },
          {
            "Id": "m1",
            "ReturnData": false,
            "MetricStat": {
              "Metric": {
                "Namespace": "${self:service}-${self:provider.stage}",
                "MetricName": functionName + "-" + metrics.maxMemoryUsed
              },
              "Period": 60,
              "Stat": "Maximum"
            }
          },
          {
            "Id": "m2",
            "ReturnData": false,
            "MetricStat": {
              "Metric": {
                "Namespace": "${self:service}-${self:provider.stage}",
                "MetricName": functionName + "-" + metrics.memorySize
              },
              "Period": 60,
              "Stat": "Average"
            }
          }
        ]
      }
    }
  }
}

const generateAutotuneIAMRoleResource = () => {
  return {
    [capitalize(autotuneId) + "Role"]: {
      "Type": "AWS::IAM::Role",
      "Properties": {
        "AssumeRolePolicyDocument": {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Principal": {
                "Service": [
                  "lambda.amazonaws.com"
                ]
              },
              "Action": [
                "sts:AssumeRole"
              ]
            }
          ]
        },
        "Policies": [
          {
            "PolicyName": "${self:service}-${self:provider.stage}-" + autotuneId,
            "PolicyDocument": {
              "Version": "2012-10-17",
              "Statement": [
                {
                  "Effect": "Allow",
                  "Action": [
                    "logs:CreateLogStream",
                    "logs:CreateLogGroup"
                  ],
                  "Resource": [
                    {
                      "Fn::Sub": "arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${self:service}-${self:provider.stage}*:*"
                    }
                  ]
                },
                {
                  "Effect": "Allow",
                  "Action": [
                    "logs:PutLogEvents"
                  ],
                  "Resource": [
                    {
                      "Fn::Sub": "arn:${AWS::Partition}:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/${self:service}-${self:provider.stage}*:*:*"
                    }
                  ]
                },
                {
                  "Effect": "Allow",
                  "Action": [
                    "lambda:GetFunctionConfiguration",
                    "lambda:UpdateFunctionConfiguration",

                  ],
                  "Resource": "*"
                }
              ]
            }
          }
        ],
        "Path": "/",
        "RoleName": "${self:service}-${self:provider.stage}-" + autotuneId + "Role"
      }
    }
  }
}

const addAutotuneResources = (functionName, annotation) => {
  const alarms = getAlarms(annotation);

  addResources({
    ...generateCloudwatchMetricFilterResource(functionName, metrics.memorySize, filterPattern),
    ...generateCloudwatchMetricFilterResource(functionName, metrics.maxMemoryUsed, filterPattern),
    ...generateCloudwatchAlarmResource(functionName, metrics, alarms.highMemory),
    ...generateCloudwatchAlarmResource(functionName, metrics, alarms.lowMemory),
    ...generateAutotuneIAMRoleResource()
  });
}

const addAutotuneFunction = (state, template) => {
  state.path.pushContainer('body', template.ast(`
    exports.${autotuneId} = async (event) => {
      const lambda = new AWS.Lambda();
      const alarmName = JSON.parse(event.Records[0].Sns.Message).AlarmName;
      const lambdaName = alarmName.replace(/-\\w+$/g, '');
      const functionName = lambdaName.match(/\\w+$/g)[0];
      const alarmType = alarmName.match(/\\w+$/g)[0];
      const minMemory = parseInt(process.env[functionName + "minMemory"]);
      const maxMemory = parseInt(process.env[functionName + "maxMemory"]);
      let currentMemory;
      try {
        currentMemory = (await lambda.getFunctionConfiguration({ FunctionName: lambdaName }).promise()).MemorySize;
      } catch {
        console.error("Unable to get current function configuration for function " + lambdaName);
        return "Error";
      }
      let newMemory;
      if (alarmType === "HighMemory") {
        newMemory = currentMemory * 2 > maxMemory ? maxMemory : currentMemory * 2;
      } else if (alarmType === "LowMemory") {
        newMemory = currentMemory / 2 < minMemory ? minMemory : currentMemory / 2;
      }
      if (newMemory === currentMemory) {
        console.log("Memory already reached its min/max config");
        return "Error";
      }
      try {
        await lambda.updateFunctionConfiguration({ FunctionName: lambdaName, MemorySize: newMemory }).promise();
      } catch {
        console.error("Unable to update function configuration for function " + lambdaName);
        return "Error";
      }
      return "Successfully tuned function " + lambdaName;
    }
  `));
}

const generateAutotuneConfig = (params, fileName, functionName) => {
  addFunctionConfig(autotuneId, {
    handler: "out/" + path.basename(fileName, ".js") + "." + autotuneId,
    events: [{
      sns: capitalize(autotuneId) + "Alarm"
    }],
    role: capitalize(autotuneId) + "Role"
  });
  addFunctionConfigEnvironment(autotuneId, {
    [functionName + "minMemory"]: parseInt(params.minmemory) || defaults.minmemory,
    [functionName + "maxMemory"]: parseInt(params.maxmemory) || defaults.maxmemory
  });
}

export { functionDeclarationHandler, variableDeclarationHandler };
