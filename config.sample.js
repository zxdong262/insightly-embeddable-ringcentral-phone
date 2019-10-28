/**
 * config sample file
 * use `cp config.sample.js config.js` to create a config
 *
 */
module.exports = {

  // dev related
  // devCPUCount: os.cpus().length,
  // devPort: 8020,

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
