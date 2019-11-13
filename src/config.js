/**
 * content config file
 * with proper config,
 * insert `call with ringcentral` button
 * or hover some elemet show call button tooltip
 * or convert phone number text to click-to-call link
 *
 */

import _ from 'lodash'
import {
  fetchApiKey,
  APIKEYLS,
  lsKeys
} from './feat/common'
import {
  RCBTNCLS2,
  checkPhoneNumber
} from 'ringcentral-embeddable-extension-common/src/common/helpers'
import { upgrade } from 'ringcentral-embeddable-extension-common/src/feat/upgrade-notification'
import * as ls from 'ringcentral-embeddable-extension-common/src/common/ls'
import { thirdPartyConfigs } from 'ringcentral-embeddable-extension-common/src/common/app-config'
import { jsonHeader } from 'ringcentral-embeddable-extension-common/src/common/fetch'
import fetchBg from 'ringcentral-embeddable-extension-common/src/common/fetch-with-background'
import {
  showActivityDetail,
  getActivities
} from './feat/activities'
import {
  showAuthBtn,
  doAuth,
  notifyRCAuthed,
  unAuth,
  renderAuthButton,
  renderAuthPanel
} from './feat/auth'
import {
  syncCallLogToThirdParty
} from './feat/call-log-sync.js'
import {
  fetchAllContacts,
  getContacts,
  showContactInfoPanel
} from './feat/contacts.js'

import {
  search,
  match
} from 'ringcentral-embeddable-extension-common/src/common/db'

let {
  apiServer,
  pageSize
} = thirdPartyConfigs

function getIds (href = window.location.href) {
  let reg = /\/contact\/(\d+)/
  let arr = href.match(reg) || []
  let vid = arr[1]
  if (!vid) {
    return null
  }
  return {
    vid
  }
}

function formatNumbers (res) {
  return Object.keys(res).reduce((prev, k) => {
    let v = res[k] || ''
    if (!k.startsWith('PHONE') || !v) {
      return prev
    }
    return [
      ...prev,
      {
        id: k,
        title: k.replace('_', ' '),
        number: v
      }
    ]
  }, [])
    .filter(o => checkPhoneNumber(o.number))
}

async function getNumbers (ids = getIds()) {
  if (!ids) {
    return []
  }
  let {
    vid
  } = ids
  let url = `${apiServer}/Contacts/${vid}`
  let apiKey = await ls.get(APIKEYLS)
  if (!apiKey) {
    apiKey = await fetchApiKey()
    if (!apiKey) {
      return []
    }
    apiKey = window.btoa(apiKey)
  }

  let res = await fetchBg(url, {
    headers: {
      ...jsonHeader,
      Authorization: `Basic ${apiKey}`
    }
  })
  return res ? formatNumbers(res) : []
}

export const insertClickToCallButton = [
  {
    // must match page url
    shouldAct: href => {
      return href.includes('?blade=/details/contact')
    },

    // define in the page how to get phone number,
    // if can not get phone number, will not insert the call button
    getContactPhoneNumbers: () => {
      let phones = document.querySelectorAll('.contact [data-display-type="PHONE"]')
      return Array.from(phones)
        .reduce((prev, node) => {
          let titleWrap = node.querySelector('.metadata-row-title')
          let title = titleWrap
            ? titleWrap.textContent.trim()
            : 'Phone Number'
          let numberWrap = node.querySelector('.metadata-row-viewer-phone')
          let number = numberWrap
            ? numberWrap.textContent.trim()
            : ''
          if (number) {
            prev.push({
              id: title,
              title,
              number
            })
          }
          return prev
        }, [])
    },

    // parent dom to insert call button
    // can be multiple condition
    // the first one matches, rest the array will be ignored
    parentsToInsertButton: [
      {
        getElem: () => {
          return document.querySelector('#modal-details-body header .btn-toolbar')
        },
        insertMethod: 'insertBefore',
        shouldInsert: () => {
          return !document.querySelector('#modal-details-body header .btn-toolbar .' + RCBTNCLS2)
        }
      }
    ]
  }
]

// hover contact node to show click to dial tooltip
export const hoverShowClickToCallButton = [
  // config example
  {
    // must match url
    shouldAct: href => {
      return href.includes('list/Contact/')
    },

    // elemment selector
    selector: '#entity-list table tbody tr, #contact-list table tbody tr',

    // function to get phone numbers, suport async function
    getContactPhoneNumbers: async elem => {
      let phoneNode = elem.querySelector('td.PHONE')
      let txt = phoneNode
        ? phoneNode.textContent.trim()
        : ''
      if (checkPhoneNumber(txt)) {
        return [{
          id: '',
          title: 'phone number',
          number: txt
        }]
      }
      let linkElem = elem.querySelector('a[href*="/Contacts/Details/"]')
      let href = linkElem
        ? linkElem.getAttribute('href')
        : ''
      let ids = getIds(href)
      return getNumbers(ids)
    }
  }
]

// modify phone number text to click-to-call link
export const phoneNumberSelectors = [
  {
    shouldAct: (href) => {
      return href.includes('?blade=/details/contact')
    },
    selector: '#modal-details-body .metadata-span-phone'
  }
]

export function getUserId () {
  let arr = document.body.textContent.match(/email: '(.+)'/)
  return arr ? arr[1] || '' : ''
}

/**
 * thirdPartyService config
 * @param {*} serviceName
 */
export function thirdPartyServiceConfig (serviceName) {
  console.log(serviceName)

  let services = {
    name: serviceName,
    // show contacts in ringcentral widgets
    contactsPath: '/contacts',
    contactSearchPath: '/contacts/search',
    contactMatchPath: '/contacts/match',

    // show auth/auauth button in ringcentral widgets
    authorizationPath: '/authorize',
    authorizedTitle: 'Unauthorize',
    unauthorizedTitle: 'Authorize',
    authorized: false,

    // Enable call log sync feature
    callLoggerPath: '/callLogger',
    callLoggerTitle: `Log to ${serviceName}`,

    // show contact activities in ringcentral widgets
    activitiesPath: '/activities',
    activityPath: '/activity'
  }

  // handle ringcentral event
  // check https://github.com/zxdong262/pipedrive-embeddable-ringcentral-phone-spa/blob/master/src/config.js
  // as example
  // read our document about third party features https://github.com/ringcentral/ringcentral-embeddable/blob/master/docs/third-party-service-in-widget.md
  let handleRCEvents = async e => {
    let { data } = e
    if (!data) {
      return
    }
    console.debug('event data', data)
    let { type, loggedIn, path, call } = data
    if (type === 'rc-login-status-notify') {
      console.log('rc logined', loggedIn)
      window.rc.rcLogined = loggedIn
    }
    if (
      type === 'rc-route-changed-notify' &&
      path === '/contacts' &&
      !window.rc.local.apiKey
    ) {
      showAuthBtn()
    } else if (
      type === 'rc-active-call-notify'
    ) {
      showContactInfoPanel(call)
    } else if (type === 'rc-region-settings-notify') {
      const prevCountryCode = window.rc.countryCode || 'US'
      console.log('prev country code:', prevCountryCode)
      const newCountryCode = data.countryCode
      console.log('new country code:', newCountryCode)
      if (prevCountryCode !== newCountryCode) {
        fetchAllContacts()
      }
      window.rc.countryCode = newCountryCode
      ls.set('rc-country-code', newCountryCode)
    }
    if (type !== 'rc-post-message-request') {
      return
    }

    let { rc } = window

    if (data.path === '/authorize') {
      if (rc.local.apiKey) {
        unAuth()
      } else {
        doAuth()
      }
      rc.postMessage({
        type: 'rc-post-message-response',
        responseId: data.requestId,
        response: { data: 'ok' }
      })
    } else if (path === '/contacts') {
      let isMannulSync = _.get(data, 'body.type') === 'manual'
      if (isMannulSync) {
        fetchAllContacts()
        rc.postMessage({
          type: 'rc-post-message-response',
          responseId: data.requestId,
          response: {
            data: []
          }
        })
        return
      }
      let page = _.get(data, 'body.page') || 1
      let contacts = await getContacts(page)
      let nextPage = contacts.count - page * pageSize > 0
        ? page + 1
        : null
      let syncTimestamp = _.get(data, 'body.syncTimestamp')
      if (syncTimestamp && syncTimestamp === window.rc.syncTimestamp) {
        nextPage = null
      }
      console.log(pageSize, contacts.count, page)
      rc.postMessage({
        type: 'rc-post-message-response',
        responseId: data.requestId,
        response: {
          data: contacts.result,
          nextPage,
          syncTimestamp: window.rc.syncTimestamp || null
        }
      })
    } else if (path === '/contacts/search') {
      if (!window.rc.local.apiKey) {
        return showAuthBtn()
      }
      let contacts = []
      let keyword = _.get(data, 'body.searchString')
      if (keyword) {
        contacts = await search(keyword)
      }
      rc.postMessage({
        type: 'rc-post-message-response',
        responseId: data.requestId,
        response: {
          data: contacts
        }
      })
    } else if (path === '/contacts/match') {
      if (!window.rc.local.apiKey) {
        return showAuthBtn()
      }
      let phoneNumbers = _.get(data, 'body.phoneNumbers') || []
      let res = await match(phoneNumbers)
      rc.postMessage({
        type: 'rc-post-message-response',
        responseId: data.requestId,
        response: {
          data: res
        }
      })
    } else if (path === '/callLogger') {
      // add your codes here to log call to your service
      syncCallLogToThirdParty(data.body)
      // response to widget
      rc.postMessage({
        type: 'rc-post-message-response',
        responseId: data.requestId,
        response: { data: 'ok' }
      })
    } else if (path === '/activities') {
      const activities = await getActivities(data.body)
      /*
      [
        {
          id: '123',
          subject: 'Title',
          time: 1528854702472
        }
      ]
      */
      // response to widget
      rc.postMessage({
        type: 'rc-post-message-response',
        responseId: data.requestId,
        response: { data: activities }
      })
    } else if (path === '/activity') {
      // response to widget
      showActivityDetail(data.body)
      rc.postMessage({
        type: 'rc-post-message-response',
        responseId: data.requestId,
        response: { data: 'ok' }
      })
    }
  }
  return {
    services,
    handleRCEvents
  }
}

/**
 * init third party
 * could init dom insert etc here
 */
export async function initThirdParty () {
  // hanlde contacts events
  let userId = getUserId()
  window.rc.currentUserId = userId
  window.rc.cacheKey = 'contacts' + '_' + userId
  window.rc.countryCode = await ls.get('rc-country-code') || undefined
  console.log('rc.countryCode:', window.rc.countryCode)
  // hanlde contacts events
  window.rc.syncTimestamp = await ls.get('syncTimestamp') || null
  let apiKey = await ls.get(lsKeys.apiKeyLSKey) || null
  window.rc.local = {
    apiKey
  }

  // get the html ready
  renderAuthPanel()
  renderAuthButton()
  upgrade()

  if (window.rc.local.apiKey) {
    notifyRCAuthed()
  }
}
