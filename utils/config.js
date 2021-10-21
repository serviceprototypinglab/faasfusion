import fs from "fs";

const requiredKeys = ["service", "provider", "runtime", "stage", "region"];

const getFusionConfig = () => {
  if (!fs.existsSync("fusion.config.json")) {
    console.error("fusion.config.json not found");
    process.exit(1);
  } else {
    const config = JSON.parse(fs.readFileSync("fusion.config.json", "utf8"));
    if (!requiredKeys.every(key => key in config)) {
      console.error("fusion.config.json does not contain all required properties (Required: " + requiredKeys + ")");
      process.exit(1);
    }
    return config;
  }
}

export { getFusionConfig };
