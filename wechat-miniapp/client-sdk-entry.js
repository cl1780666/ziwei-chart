// Use the SDK's shipped Mini Program builds, which exclude Node-only modules.
const cloudbase = require('./node_modules/@cloudbase/js-sdk/miniprogram_dist/app/index.js').default
const { registerAuth } = require('./node_modules/@cloudbase/js-sdk/miniprogram_dist/auth/index.js')
const { registerFunctions } = require('./node_modules/@cloudbase/js-sdk/miniprogram_dist/functions/index.js')

registerAuth(cloudbase)
registerFunctions(cloudbase)

module.exports = cloudbase
