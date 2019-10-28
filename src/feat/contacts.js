/**
 * third party contacts related feature
 */

import _ from 'lodash'
import {
  showAuthBtn
} from './auth'
import {
  popup,
  host,
  createElementFromHTML,
  notify,
  formatPhone
} from 'ringcentral-embeddable-extension-common/src/common/helpers'
import { thirdPartyConfigs } from 'ringcentral-embeddable-extension-common/src/common/app-config'
import fetch, { jsonHeader } from 'ringcentral-embeddable-extension-common/src/common/fetch'
import {
  getCustomVerifyHeaderToken,
  safeParseJSON
} from './common'

import {
  remove,
  insert,
  getByPage,
  match
} from 'ringcentral-embeddable-extension-common/src/common/db'

let {
  serviceName
} = thirdPartyConfigs

const types = [
  'Contact',
  'Lead'
]

/**
 * click contact info panel event handler
 * @param {Event} e
 */
function onClickContactPanel (e) {
  let { target } = e
  let { classList } = target
  if (classList.contains('rc-close-contact')) {
    document
      .querySelector('.rc-contact-panel')
      .classList.add('rc-hide-to-side')
  }
}

function onloadIframe () {
  let dom = document
    .querySelector('.rc-contact-panel')
  dom && dom.classList.add('rc-contact-panel-loaded')
}

/**
 * build name from contact info
 * @param {object} contact
 * @return {string}
 */
function buildName (contact) {
  let firstname = _.get(
    contact,
    'FIRST_NAME'
  ) || 'noname'
  let lastname = _.get(
    contact,
    'LAST_NAME'
  ) || 'noname'
  let n = firstname + ' ' + lastname
  if (contact.LEAD_ID) {
    n = `[LEAD] ${n}`
  }
  return n
}

/**
 * build phone numbers from contact info
 * @param {object} contact
 * @return {array}
 */
function buildPhone (contact) {
  let res = Object.keys(contact)
    .filter(k => k.startsWith('PHONE'))
    .reduce((p, k) => {
      if (contact[k]) {
        p.phoneNumbers.push({
          phoneNumber: contact[k],
          phoneType: 'directPhone'
        })
      }
      return p
    }, {
      phoneNumbers: []
    })
  res.phoneNumbersForSearch = res
    .phoneNumbers.map(d => formatPhone(d.phoneNumber)).join(',')
  return res
}

/**
 * convert third party contacts to ringcentral contacts
 * @param {array} contacts
 * @return {array}
 */
function formatContacts (contacts) {
  return contacts.map(contact => {
    let {
      CONTACT_ID,
      LEAD_ID
    } = contact
    let id = CONTACT_ID
      ? '' + CONTACT_ID
      : `LEAD_${LEAD_ID}`
    return {
      id,
      name: buildName(contact),
      type: serviceName,
      emails: contact.EMAIL_ADDRESS
        ? [contact.EMAIL_ADDRESS]
        : [],
      ...buildPhone(contact)
    }
  })
}

/**
 * --
 * @param {string} type Contact or Lead
 * @param {int} page
 */
async function getContactByType (type, page) {
  let url = `${host}/MetadataListView/GetList`
  let token = getCustomVerifyHeaderToken()
  let conf = {
    headers: {
      ...jsonHeader,
      RequestVerificationToken: token
    }
  }
  let res = await fetch.post(url, {
    indexLoaded: 'True',
    page,
    readDb: true,
    sort: [],
    type,
    viewId: 'ALL'
  }, conf)
  if (!res) {
    console.log(`fetch ${type} error`)
    return console.log(res)
  }
  let arr = safeParseJSON(
    _.get(res, 'Items')
  ) || []
  return {
    result: formatContacts(arr),
    count: _.get(res, 'TotalCount') || 0
  }
}

async function fetchContacts (page, drained = {}) {
  let res = {}
  for (let type of types) {
    let r = drained[type]
      ? {
        result: [],
        count: 0
      }
      : await getContactByType(type, page)
    res[type] = r || {
      result: [],
      count: 0
    }
  }
  return res
}

export async function fetchAllContacts () {
  if (!window.rc.local.apiKey) {
    showAuthBtn()
    return
  }
  if (window.rc.isFetchingContacts) {
    return
  }
  window.rc.isFetchingContacts = true
  loadingContacts()
  let drained = types.reduce((p, t) => {
    return {
      ...p,
      [t]: false
    }
  }, {})
  let page = 1
  await remove()
  while (!drained.Contact || !drained.Lead) {
    let r = await fetchContacts(page)
    if (!r.Contact.result.length) {
      drained.Contact = true
    }
    if (!r.Lead.result.length) {
      drained.Lead = true
    }
    let arr = [
      ...r.Contact.result,
      ...r.Lead.result
    ]
    await insert(arr)
    notifyReSyncContacts()
    page = page + 1
  }
  stopLoadingContacts()
  window.rc.isFetchingContacts = false
  notifyReSyncContacts()
  notify('Syncing contacts done', 'info', 1000)
}

/**
 * get contact lists
 */
export const getContacts = async function (page = 1) {
  if (!window.rc.rcLogined) {
    return []
  }
  if (!window.rc.local.apiKey) {
    showAuthBtn()
    return []
  }
  let cached = await getByPage(page).catch(console.log)
  if (cached && cached.result && cached.result.length) {
    console.log('use cache')
    return cached
  }
  loadingContacts()
  window.rc.isFetchingContacts = true
  let res = await fetchContacts(page)
  stopLoadingContacts()
  window.rc.isFetchingContacts = false
  fetchAllContacts()
  let count = window.rc.isFetchingContacts
    ? 0
    : res.Contact.count + res.Lead.count
  return {
    result: [
      ...res.Contact.result,
      ...res.Lead.result
    ],
    count
  }
}

export function hideContactInfoPanel () {
  let dom = document
    .querySelector('.rc-contact-panel')
  dom && dom.classList.add('rc-hide-to-side')
}

/**
 * show caller/callee info
 * @param {Object} call
 */
export async function showContactInfoPanel (call) {
  if (
    !call ||
    call.telephonyStatus !== 'Ringing' ||
    call.direction === 'Outbound'
  ) {
    return
  }
  popup()
  let phone = _.get(call, 'from.phoneNumber') || _.get(call, 'from')
  if (!phone) {
    return
  }
  phone = formatPhone(phone)
  let contacts = await match([phone])
  let contact = _.get(contacts, `${phone}[0]`)
  if (!contact) {
    return
  }
  // let contactTrLinkElem = canShowNativeContact(contact)
  // if (contactTrLinkElem) {
  //   return showNativeContact(contact, contactTrLinkElem)
  // }
  let { host, protocol } = window.location
  let url = `${protocol}//${host}/details/contact/${contact.id}`
  let elem = createElementFromHTML(
    `
    <div class="animate rc-contact-panel" draggable="false">
      <div class="rc-close-box">
        <div class="rc-fix rc-pd2x">
          <span class="rc-fleft">Contact</span>
          <span class="rc-fright">
            <span class="rc-close-contact">&times;</span>
          </span>
        </div>
      </div>
      <div class="rc-contact-frame-box">
        <iframe class="rc-contact-frame" sandbox="allow-same-origin allow-scripts allow-forms allow-popups" allow="microphone" src="${url}" id="rc-contact-frame">
        </iframe>
      </div>
      <div class="rc-loading">loading...</div>
    </div>
    `
  )
  elem.onclick = onClickContactPanel
  elem.querySelector('iframe').onload = onloadIframe
  let old = document
    .querySelector('.rc-contact-panel')
  old && old.remove()

  document.body.appendChild(elem)
  popup()
}

export function hideRefreshContacts () {
  let refreshContactsBtn = document.getElementById('rc-reload-contacts')
  if (refreshContactsBtn) {
    refreshContactsBtn.remove()
  }
}

function loadingContacts () {
  let loadingContactsBtn = document.getElementById('rc-reloading-contacts')
  if (loadingContactsBtn) {
    return
  }
  let elem = createElementFromHTML(
    `
    <span
      class="rc-reloading-contacts"
      id="rc-reloading-contacts"
      title="Reload contacts"
    />Syncing contacts</span>
    `
  )
  document.body.appendChild(elem)
}

function stopLoadingContacts () {
  let loadingContactsBtn = document.getElementById('rc-reloading-contacts')
  if (loadingContactsBtn) {
    loadingContactsBtn.remove()
  }
}

function notifyReSyncContacts () {
  window.rc.postMessage({
    type: 'rc-adapter-sync-third-party-contacts'
  })
}
