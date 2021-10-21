const addAwsSdk = (state, template) => {
  state.path.unshiftContainer('body', template.ast(`const AWS = require("aws-sdk");`));
}

export { addAwsSdk }