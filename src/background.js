import initBackground from 'ringcentral-embeddable-extension-common/src/spa/background'
import { thirdPartyConfigs } from 'ringcentral-embeddable-extension-common/src/common/app-config'
import _ from 'lodash'

/**
 * for background.js, check current tab is extension target tab or not
 * @param {object} tab
 */
function checkTab (tab) {
  return tab &&
    tab.url &&
    tab.url.startsWith('https://') &&
    tab.url.includes('insightly.com') &&
    !tab.url.startsWith('https://www.insightly.com') &&
    !tab.url.startsWith('https://login.insightly.com') &&
    !tab.url.startsWith('https://api.insightly.com') &&
    !tab.url.startsWith('https://support.insightly.com') &&
    !tab.url.startsWith('https://www.insight.ly') &&
    !tab.url.startsWith('https://login.insight.ly') &&
    !tab.url.startsWith('https://api.insight.ly') &&
    !tab.url.startsWith('https://support.insight.ly')
}
let list = [
  /https:\/\/.+\.insightly\.com\/.+/
]
if (thirdPartyConfigs.upgradeServer) {
  list.push(
    new RegExp(
      '^' +
      _.escapeRegExp(thirdPartyConfigs.upgradeServer)
    )
  )
}

initBackground(checkTab, list)
