import _ from 'lodash'
import fetch from 'ringcentral-embeddable-extension-common/src/common/fetch'
import {
  host, formatPhone
} from 'ringcentral-embeddable-extension-common/src/common/helpers'
export const APIKEYLS = 'third-party-api-token'
export const lsKeys = {
  apiKeyLSKey: APIKEYLS
}
/**
 * get api key from user setting page
 */
export async function fetchApiKey () {
  let { host, protocol } = window.location
  let url = `${protocol}//${host}/users/usersettings`
  let res = await fetch.get(url, {
    headers: {
      Accept: 'text/html'
    }
  })
  let reg = /id="apikey">([^<]+)</
  let arr = (res || '').match(reg)
  let apiKey = _.get(arr, '[1]')
  return apiKey
}

export async function getVerifyToken (id) {
  // https://crm.na1.insightly.com/Metadata/CreateFor/?EntityType=Event&RelatedEntityType=Contact&RelatedEntityId=273196913&InModal=1&createRedirectType=ActivityReload
  let url = `${host}/Metadata/CreateFor/?EntityType=Event&RelatedEntityType=Contact&RelatedEntityId=${id}&InModal=1&createRedirectType=ActivityReload`
  let res = await fetch.get(url, {
    headers: {
      Accept: 'text/html'
    }
  })
  if (!res) {
    return ''
  }
  let arr = res.match(/name="__RequestVerificationToken" type="hidden" value="([^"]+)"/)
  if (!arr) {
    return ''
  }
  return arr[1] || ''
}

export function safeParseJSON (str) {
  try {
    return JSON.parse(str)
  } catch (e) {
    console.log(e)
    return null
  }
}

export function getCustomVerifyHeaderToken () {
  let arr = document.cookie.match(/__CustomRequestVerificationToken_RequestHeader=([^=;]+)/)
  if (!arr) {
    return ''
  }
  return decodeURIComponent(arr[1] || '')
}

export function formatPhoneLocal (number) {
  return formatPhone(number, undefined, 'formatNational')
}