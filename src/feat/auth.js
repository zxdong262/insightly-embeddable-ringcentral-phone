/**
 * auth related feature
 */

import { thirdPartyConfigs } from 'ringcentral-embeddable-extension-common/src/common/app-config'
import logo from 'ringcentral-embeddable-extension-common/src/common/rc-logo'
import {
  createElementFromHTML,
  findParentBySel,
  sendMsgToRCIframe
} from 'ringcentral-embeddable-extension-common/src/common/helpers'
import {
  lsKeys,
  fetchApiKey
} from './common'
import _ from 'lodash'
import * as ls from 'ringcentral-embeddable-extension-common/src/common/ls'
import { hideRefreshContacts } from './contacts'

let tokenHandler
let {
  serviceName
} = thirdPartyConfigs

window.rc = {
  local: {
    apiKey: null
  },
  postMessage: sendMsgToRCIframe,
  currentUserId: '',
  rcLogined: false,
  cacheKey: 'contacts' + '_' + '',
  updateToken: async (newToken, type = 'apiKey') => {
    if (!newToken) {
      await ls.clear()
      window.rc.local = {
        apiKey: null
      }
    } else if (_.isString(newToken)) {
      window.rc.local[type] = newToken
      let key = lsKeys[`${type}LSKey`]
      await ls.set(key, newToken)
    } else {
      Object.assign(window.rc.local, newToken)
      let ext = Object.keys(newToken)
        .reduce((prev, key) => {
          prev[lsKeys[`${key}LSKey`]] = newToken[key]
          return prev
        }, {})
      await ls.set(ext)
    }
  }
}

export function hideAuthBtn () {
  let dom = document.querySelector('.rc-auth-button-wrap')
  dom && dom.classList.add('rc-hide-to-side')
}

export function showAuthBtn () {
  let dom = document.querySelector('.rc-auth-button-wrap')
  dom && dom.classList.remove('rc-hide-to-side')
}

function handleAuthClick (e) {
  let { target } = e
  let { classList } = target
  if (findParentBySel(target, '.rc-auth-btn')) {
    doAuth()
  } else if (classList.contains('rc-dismiss-auth')) {
    hideAuthBtn()
  }
}

export function hideAuthPanel () {
  let frameWrap = document.getElementById('rc-auth-hs')
  frameWrap && frameWrap.classList.add('rc-hide-to-side')
}

/**
 * get api key from user setting page
 */
async function getApiKey () {
  let apiKey = await fetchApiKey()
  hideAuthPanel()
  if (!apiKey) {
    console.log('can not found apikey in user setting page')
    return unAuth()
  }
  apiKey = window.btoa(apiKey.trim())
  window.rc.updateToken(apiKey)
  notifyRCAuthed()
}

export async function doAuth () {
  if (window.rc.local.apiToken) {
    return
  }
  hideAuthBtn()
  let frameWrap = document.getElementById('rc-auth-hs')
  frameWrap && frameWrap.classList.remove('rc-hide-to-side')
  await getApiKey()
}

export function notifyRCAuthed (authorized = true) {
  window.rc.postMessage({
    type: 'rc-adapter-update-authorization-status',
    authorized
  })
}

export async function unAuth () {
  await window.rc.updateToken(null)
  clearTimeout(tokenHandler)
  notifyRCAuthed(false)
  hideRefreshContacts()
}

export function renderAuthButton () {
  let btn = createElementFromHTML(
    `
      <div class="rc-auth-button-wrap animate rc-hide-to-side">
        <span class="rc-auth-btn">
          <span class="rc-iblock">Auth</span>
          <img class="rc-iblock" src="${logo}" />
          <span class="rc-iblock">access ${serviceName} data</span>
        </span>
        <div class="rc-auth-desc rc-pd1t">
          After auth, you can access ${serviceName} contacts from RingCentral phone's contacts list. You can revoke access from RingCentral phone's setting.
        </div>
        <div class="rc-pd1t">
          <span class="rc-dismiss-auth" title="dismiss">&times;</span>
        </div>
      </div>
    `
  )
  btn.onclick = handleAuthClick
  if (
    !document.querySelector('.rc-auth-button-wrap')
  ) {
    document.body.appendChild(btn)
  }
}

export function renderAuthPanel () {
  let pop = createElementFromHTML(
    `
    <div id="rc-auth-hs" class="animate rc-auth-wrap rc-hide-to-side" draggable="false">
      Authing...
    </div>
    `
  )
  if (
    !document.getElementById('rc-auth-hs')
  ) {
    document.body.appendChild(pop)
  }
}
