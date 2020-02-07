const os = require('os')
const extend = require('recursive-assign')
let config = {

  // dev related
  devCPUCount: os.cpus().length,
  devPort: 8020,

  // build options
  minimize: false,

  // congfigs to build app

  // ringcentral config
  ringCentralConfigs: {
    // your ringCentral app's Client ID
    clientID: '',
    clientSecret: '',
    // your ringCentral app's Auth Server URL
    appServer: 'https://platform.ringcentral.com'
  },

  // for third party related
  thirdPartyConfigs: {
    apiServer: 'https://api.insightly.com/v3.0',
    showCallLogSyncForm: true,
    serviceName: 'Insightly',
    pageSize: 10000
  }

}

try {
  extend(config, require('./config.js'))
} catch (e) {
  if (e.stack.includes('Cannot find module \'./config.js\'')) {
    console.warn('no custom config file, it is ok, but you can use "cp config.sample.js config.js" to create one')
  } else {
    console.log(e)
  }
}
module.exports = config
