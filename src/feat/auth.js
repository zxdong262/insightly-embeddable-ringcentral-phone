/**
 * auth related feature
 */

import {
  sendMsgToRCIframe
} from 'ringcentral-embeddable-extension-common/src/common/helpers'
import {
  fetchApiKey
} from './common'
import * as ls from 'ringcentral-embeddable-extension-common/src/common/ls'

let tokenHandler

window.rc = {
  local: {
    authed: false
  },
  apiKey: null,
  postMessage: sendMsgToRCIframe,
  currentUserId: '',
  rcLogined: false,
  cacheKey: 'contacts' + '_' + '',
  updateToken: async (newToken, type = 'authed') => {
    if (!newToken) {
      await ls.remove(type)
      window.rc.local = {
        authed: null
      }
    } else {
      window.rc.local[type] = newToken
      await ls.set(type, newToken)
    }
  }
}

/**
 * get api key from user setting page
 */
export async function getApiKey () {
  let apiKey = await fetchApiKey()
  if (!apiKey) {
    console.log('can not found apikey in user setting page')
    return unAuth()
  }
  apiKey = window.btoa(apiKey.trim())
  window.rc.apiKey = apiKey
}

export function hideAuthBtn () {
  let dom = document.querySelector('.rc-auth-button-wrap')
  dom && dom.classList.add('rc-hide-to-side')
}

export function showAuthBtn () {
  window.postMessage({
    type: 'rc-show-auth-panel'
  }, '*')
}

export async function doAuth () {
  if (window.rc.local.authed) {
    return
  }
  notifyRCAuthed()
  window.rc.updateToken('authed')
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
}
