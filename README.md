# FaaS Fusion

FaaS Fusion can be used to leverage cloud function annotations in your serverless application JavaScript code.
These annotations encapsulate complex runtime patterns that have emerged over the years as best practices in serverless architectures.
It runs as a plugin to the Babel JS Compiler for transpilation and builds on the Serverless Framework for deployment.

## Usage

### Prerequisites

#### Babel

Install the needed Babel packages with the following command:

```bash
npm install --save-dev @babel/core @babel/cli
```

#### Serverless Framework

Install according to: https://www.serverless.com/framework/docs/getting-started/

### Installation

Clone this repository and install the Fusion plugin with the following command into your project using the path where you cloned this repo to:

```bash
npm install --save-dev path/to/cloned/fusion/repository
```

### Configuration

Add a Babel configuration file (e.g. `babel.config.json`) to your project and reference the Fusion plugin as follows:

```json
{
  "plugins": ["fusion"]
}
```

Add a Fusion configuration file (`fusion.config.json`) to your project and fill it with your desired values:

```json
{
  "service": "example",
  "provider": "aws",
  "runtime": "nodejs12.x",
  "stage": "dev",
  "region": "us-east-1"
}
```

### Build

Run Babel in your project to build:

```bash
npx babel src -d out
```

### Deployment

Run Serverless in your project to deploy:

```bash
serverless deploy
```

## Annotations

This section lists the available annotations and how these can be used.

### @CloudFunction

`@CloudFunction` can be used to mark individual functions as FaaS deployments.

#### Parameters

| Name | Type | Required | Default |
| ---- | ---- | -------- | ------- |
| `Memory` | Integer (128-10240) | No | 1024 |
| `Timeout` | Integer (1-900) | No | 6 |

* `Memory`: The memory size in megabytes to be configured for the function.
* `Timeout`: The maximum runtime allowed for the function in seconds.

#### Example

```javascript
// @CloudFunction(Memory = 512)
function cloudFunction(event) {
  return "I'm a cloud function with 512 MB of memory!";
}
```

### @Warmup

`@Warmup` can be used to call functions periodically to avoid cold starts and thus optimize response times.
`@Warmup` can only be used in conjunction with `@CloudFunction`.

#### Parameters

| Name | Type | Required | Default |
| ---- | ---- | -------- | ------- |
| `Rate` | Integer (positive) | No | 5 |
| `EventKey` | String | No | warmup |

* `Rate`: The interval in minutes at which the function is to be called.
* `EventKey`: The name of the key in the `event` object, which is used to detect automated warmup pings.

#### Example

```javascript
// @CloudFunction
// @Warmup(Rate = 7)
function keepMeWarm(event) {
  return "I'm freezing, please keep me warm!";
}
```

### @Autotune

 can be used to scale the memory size of a function continuously and automatically based on the effective memory consumption.
`@Autotune` can only be used in conjunction with `@CloudFunction`.

#### Parameters

| Name | Type | Required | Default |
| ---- | ---- | -------- | ------- |
| `MinMemory` | Integer (128-10240) | No | 128 |
| `MaxMemory` | Integer (128-10240) | No | 2048 |
| `LowerThreshold` | Decimal (0-1) | No | 0.4 |
| `UpperThreshold` | Decimal (0-1) | No | 0.9 |

* `MinMemory`: The minimum memory size in megabytes to which the function may be scaled. Must be smaller than `MaxMemory`.
* `MaxMemory`: The maximum memory size in megabytes to which the function may be scaled. Must be greater than `MinMemory`.
* `LowerThreshold`: The lower threshold of the allowed memory consumption from which the memory size of the function should be scaled down. Must be smaller than `UpperThreshold`.
* `UpperThreshold`: The upper threshold of the allowed memory consumption from which the memory size of the function is to be scaled up. Must be greater than `LowerThreshold`.

#### Example

```javascript
// @CloudFunction
// @Autotune(MinMemory = 512)
function tuneMe(event) {
  return "Help me to get the best memory allocation!";
}
```

### @HttpApi

Currently undocumented. Look it up in the code (`aws/handlers/httpapi.js`).

## Credits and Publications

Implementation by Raffael Klingler and Nemanja Trifunovic.

Published at 7th International Workshop on Serverless Computing (WoSC) at MIDDLEWARE 2021:
R. Klingler, N. Trifunovic, J. Spillner: *Beyond @CloudFunction: Powerful Code Annotations to Capture Serverless Runtime Patterns*
