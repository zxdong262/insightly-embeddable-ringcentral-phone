/**
 * content config file
 * with proper config,
 * insert `call with ringcentral` button
 * or hover some elemet show call button tooltip
 * or convert phone number text to click-to-call link
 *
 */

import _ from 'lodash'
import copy from 'json-deep-copy'
import {
  getUserId as getEmail
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
  getApiKey
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
  match,
  getByPage
} from 'ringcentral-embeddable-extension-common/src/common/db'
import initReact from './lib/react-entry'
import initInner from './lib/inner-entry'
import initInnerCallLog from './lib/call-log-entry.js'
import { resyncCheck } from './lib/auto-resync'

let {
  apiServer,
  pageSize
} = thirdPartyConfigs

function getIds (href = window.location.href) {
  let reg = /\/contact\/(\d+)/i
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
  let res = await fetchBg(url, {
    headers: {
      ...jsonHeader,
      Authorization: `Basic ${window.rc.apiKey}`
    }
  })
  return res ? formatNumbers(res) : []
}

export const insertClickToCallButton = [
  {
    // must match page url
    shouldAct: href => {
      return href.toLowerCase().includes('?blade=/details/contact')
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
      return href.toLowerCase().includes('list/Contact/')
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
      let linkElem = elem.querySelector('a[href*="/Contacts/Details/" i]')
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
      return href.toLowerCase().includes('?blade=/details/contact')
    },
    selector: '#modal-details-body .metadata-span-phone'
  }
]

export function getUserId () {
  return getEmail()
}

/**
 * thirdPartyService config
 * @param {*} serviceName
 */
export function thirdPartyServiceConfig (serviceName) {
  console.log(serviceName)
  const logTitle = `Log to ${serviceName}`
  let services = {
    name: serviceName,
    // show contacts in ringcentral widgets
    contactsPath: '/contacts',
    contactIcon: 'https://github.com/ringcentral/insightly-embeddable-ringcentral-phone/blob/master/src/insightly.png?raw=true',
    contactSearchPath: '/contacts/search',
    contactMatchPath: '/contacts/match',

    // show auth/auauth button in ringcentral widgets
    authorizationPath: '/authorize',
    authorizedTitle: 'Unauthorize',
    unauthorizedTitle: 'Authorize',
    authorized: false,

    // Enable call log sync feature
    callLoggerPath: '/callLogger',
    callLoggerTitle: logTitle,
    callLogEntityMatcherPath: '/callLogger/match',

    // show contact activities in ringcentral widgets
    activitiesPath: '/activities',
    activityPath: '/activity',

    // meeting
    meetingInvitePath: '/meeting/invite',
    meetingInviteTitle: `Schedule meeting`

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
    let { type, loggedIn, path, call, requestId, sessionIds } = data
    if (type === 'rc-login-status-notify') {
      console.log('rc logined', loggedIn)
      window.rc.rcLogined = loggedIn
    }
    if (type === 'rc-sync-log-success') {
      // response to widget
      window.rc.postMessage({
        type: 'rc-post-message-response',
        responseId: requestId,
        response: { data: 'ok' }
      })
      setTimeout(() => {
        window.rc.postMessage({
          type: 'rc-adapter-trigger-call-logger-match',
          sessionIds
        })
      }, 8000)
    }
    if (
      type === 'rc-route-changed-notify' &&
      path === '/contacts' &&
      !window.rc.local.authed
    ) {
      showAuthBtn()
    } else if (
      type === 'rc-route-changed-notify' &&
      path === '/history'
    ) {
      window.rc.postMessage({
        type: 'rc-adapter-trigger-call-logger-match',
        sessionIds
      })
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
    } else if (type === 'rc-call-end-notify') {
      const dd = copy(data)
      dd.type = 'rc-show-add-contact-panel'
      window.postMessage(dd, '*')
    }
    if (type !== 'rc-post-message-request') {
      return
    }

    let { rc } = window

    if (data.path === '/authorize') {
      if (rc.local.authed) {
        unAuth()
      } else {
        doAuth()
      }
      window.rc.postMessage({
        type: 'rc-post-message-response',
        responseId: data.requestId,
        response: { data: 'ok' }
      })
    } else if (path === '/contacts') {
      let isMannulSync = _.get(data, 'body.type') === 'manual'
      let page = _.get(data, 'body.page') || 1
      if (isMannulSync && page === 1) {
        window.postMessage({
          type: 'rc-show-sync-menu'
        }, '*')
        return window.rc.postMessage({
          type: 'rc-post-message-response',
          responseId: data.requestId,
          response: {
            data: []
          }
        })
      }
      const now = Date.now()
      window.postMessage({
        type: 'rc-transferring-data',
        transferringData: true
      }, '*')
      let contacts = await getContacts(page)
      let nextPage = contacts.count - page * pageSize > 0
        ? page + 1
        : null
      const no2 = Date.now()
      console.debug(no2 - now)
      window.postMessage({
        type: 'rc-transferring-data',
        transferringData: false
      }, '*')
      window.rc.postMessage({
        type: 'rc-post-message-response',
        responseId: data.requestId,
        response: {
          data: contacts.result,
          nextPage,
          syncTimeStamp: window.rc.syncTimeStamp
        }
      })
    } else if (path === '/contacts/search') {
      if (!window.rc.local.authed) {
        return showAuthBtn()
      }
      let contacts = []
      let keyword = _.get(data, 'body.searchString')
      if (keyword) {
        contacts = await search(keyword)
      }
      window.rc.postMessage({
        type: 'rc-post-message-response',
        responseId: data.requestId,
        response: {
          data: contacts
        }
      })
    } else if (path === '/contacts/match') {
      if (!window.rc.local.authed) {
        return showAuthBtn()
      }
      let phoneNumbers = _.get(data, 'body.phoneNumbers') || []
      let res = await match(phoneNumbers)
      window.rc.postMessage({
        type: 'rc-post-message-response',
        responseId: data.requestId,
        response: {
          data: res
        }
      })
    } else if (path === '/callLogger') {
      // add your codes here to log call to your service
      syncCallLogToThirdParty({
        ...data.body,
        requestId: data.requestId
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
      window.rc.postMessage({
        type: 'rc-post-message-response',
        responseId: data.requestId,
        response: { data: activities }
      })
    } else if (path === '/activity') {
      // response to widget
      showActivityDetail(data.body)
      window.rc.postMessage({
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
  let authed = await ls.get('authed') || null
  window.rc.local = {
    authed
  }

  // get the html ready
  upgrade()

  if (window.rc.local.authed) {
    notifyRCAuthed()
  }
  initReact()
  initInner()
  initInnerCallLog()
  getApiKey()
  const db = await getByPage(1, 1)
  resyncCheck(db && db.count)
}
