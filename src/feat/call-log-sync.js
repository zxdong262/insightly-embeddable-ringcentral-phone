/**
 * call log sync feature
 */

import dayjs from 'dayjs'
import { thirdPartyConfigs } from 'ringcentral-embeddable-extension-common/src/common/app-config'
import * as ls from 'ringcentral-embeddable-extension-common/src/common/ls'
import { getContactInfo } from './call-log-sync-form'
import extLinkSvg from 'ringcentral-embeddable-extension-common/src/common/link-external.svg'
import {
  showAuthBtn
} from './auth'
import _ from 'lodash'
import {
  match
} from 'ringcentral-embeddable-extension-common/src/common/db'
import {
  notify,
  formatPhone,
  host
} from 'ringcentral-embeddable-extension-common/src/common/helpers'
import {
  getVerifyToken,
  getFullNumber,
  autoLogPrefix,
  formatPhoneLocal,
  getUserId
} from './common'
import copy from 'json-deep-copy'
import fetch, { jsonHeader } from 'ringcentral-embeddable-extension-common/src/common/fetch'

let formatDate = 'DD-MMM-YYYY hh:mm A'
let {
  showCallLogSyncForm,
  serviceName
} = thirdPartyConfigs

export function notifySyncSuccess ({
  id,
  requestId,
  sessionIds
}) {
  let type = 'success'
  let url = `${host}/details/Event/${id}`
  let msg = `
    <div>
      <div class="rc-pd1b">
        Call log synced to insightly!
      </div>
      <div class="rc-pd1b">
        <a href="${url}" target="_blank">
          <img src="${extLinkSvg}" width=16 height=16 class="rc-iblock rc-mg1r" />
          <span class="rc-iblock">
            Check Event Detail
          </span>
        </a>
      </div>
    </div>
  `
  notify(msg, type, 9000)
  window.postMessage({
    type: 'rc-sync-log-success',
    requestId,
    sessionIds
  }, '*')
}

let prev = {
  time: Date.now(),
  sessionId: '',
  body: {}
}

function checkMerge (body) {
  const maxDiff = 100
  const now = Date.now()
  const sid = _.get(body, 'conversation.conversationId')
  const type = _.get(body, 'conversation.type')
  if (type !== 'SMS') {
    return body
  }
  if (prev.sessionId === sid && prev.time - now < maxDiff) {
    let msgs = [
      ...body.conversation.messages,
      ...prev.body.conversation.messages
    ]
    msgs = _.uniqBy(msgs, (e) => e.id)
    body.conversation.messages = msgs
    prev.body = copy(body)
    return body
  } else {
    prev.time = now
    prev.sessionId = sid
    prev.body = copy(body)
    return body
  }
}

function buildId (body) {
  return body.id ||
  _.get(body, 'call.sessionId') ||
  _.get(body, 'conversation.conversationLogId')
}

export async function syncCallLogToThirdParty (body) {
  // let result = _.get(body, 'call.result')
  // if (result !== 'Call connected') {
  //   return notify('You can only log connected call')
  // }
  let isManuallySync = !body.triggerType || body.triggerType === 'manual'
  let isAutoSync = body.triggerType === 'callLogSync' || body.triggerType === 'auto'
  if (!isAutoSync && !isManuallySync) {
    return
  }
  if (_.get(body, 'sessionIds')) {
    // todo: support voicemail
    return
  }
  if (!window.rc.local.authed) {
    return isManuallySync ? showAuthBtn() : null
  }
  const id = buildId(body)
  if (showCallLogSyncForm && isManuallySync) {
    body = checkMerge(body)
    let contactRelated = await getContactInfo(body, serviceName)
    if (
      !contactRelated ||
      (!contactRelated.froms && !contactRelated.tos)
    ) {
      const b = copy(body)
      b.type = 'rc-show-add-contact-panel'
      return window.postMessage(b, '*')
    }
    window.postMessage({
      type: 'rc-init-call-log-form',
      isManuallySync,
      callLogProps: {
        id,
        isManuallySync,
        body
      }
    }, '*')
  } else {
    window.postMessage({
      type: 'rc-init-call-log-form',
      isManuallySync,
      callLogProps: {
        id,
        isManuallySync,
        body
      }
    }, '*')
  }
}

async function getSyncContacts (body) {
  // let objs = _.filter(
  //   [
  //     ..._.get(body, 'call.toMatches') || [],
  //     ..._.get(body, 'call.fromMatches') || [],
  //     ...(_.get(body, 'correspondentEntity') ? [_.get(body, 'correspondentEntity')] : [])
  //   ],
  //   m => m.type === serviceName
  // )
  // if (objs.length) {
  //   return objs
  // }
  let all = []
  if (body.call) {
    let nf = getFullNumber(_.get(body, 'to')) ||
      getFullNumber(_.get(body, 'call.to'))
    let nt = getFullNumber(_.get(body, 'from')) ||
      getFullNumber(_.get(body.call, 'from'))
    all = [nt, nf]
  } else {
    all = [
      getFullNumber(_.get(body, 'conversation.self')),
      ...body.conversation.correspondents.map(d => getFullNumber(d))
    ]
  }
  all = all.map(s => formatPhone(s))
  let contacts = await match(all)
  let arr = Object.keys(contacts).reduce((p, k) => {
    return [
      ...p,
      ...contacts[k]
    ]
  }, [])
  return _.uniqBy(arr, d => d.id)
}

function buildFormData (data) {
  return Object.keys(data)
    .reduce((prev, k, i) => {
      let v = data[k]
      return prev +
        (i ? '&' : '') +
        encodeURIComponent(k) +
        '=' +
        encodeURIComponent(v)
    }, '')
}

/**
 * sync call log action
 * todo: need you find out how to do the sync
 * you may check the CRM site to find the right api to do it
 * @param {*} body
 * @param {*} formData
 */
export async function doSync (body, formData, isManuallySync) {
  let contacts = await getSyncContacts(body)
  if (!contacts.length) {
    return notify('No related contacts')
  }
  for (let contact of contacts) {
    await doSyncOne(contact, body, formData, isManuallySync)
  }
}

function buildMsgs (body) {
  let msgs = _.get(body, 'conversation.messages')
  const arr = []
  for (const m of msgs) {
    const fromN = getFullNumber(_.get(m, 'from')) ||
      getFullNumber(_.get(m, 'from[0]')) || ''
    const fromName = _.get(m, 'from.name') ||
      (_.get(m, 'from') || []).map(d => d.name).join(', ') || ''
    const toN = getFullNumber(_.get(m, 'to')) ||
      getFullNumber(_.get(m, 'to[0]')) || ''
    const toName = _.get(m, 'to.name') ||
      (_.get(m, 'to') || []).map(d => d.name).join(', ') || ''
    const from = fromN +
      (fromName ? `(${fromName})` : '')
    const to = toN +
      (toName ? `(${toName})` : '')
    arr.push({
      body: `<p>SMS: <b>${m.subject}</b> - from <b>${from}</b> to <b>${to}</b> - ${dayjs(m.creationTime).format('MMM DD, YYYY HH:mm')}</p>`,
      id: m.id
    })
  }
  return arr
}

function buildVoiceMailMsgs (body) {
  let msgs = _.get(body, 'conversation.messages')
  const arr = []
  for (const m of msgs) {
    let isOut = m.direction === 'Outbound'
    let desc = isOut
      ? 'to'
      : 'from'
    let n = isOut
      ? m.to
      : [m.from]
    n = n.map(m => formatPhoneLocal(getFullNumber(m))).join(', ')
    let links = m.attachments.map(t => t.link).join(', ')
    arr.push({
      body: `<p>Voice mail: ${links} - ${n ? desc : ''} <b>${n}</b> ${dayjs(m.creationTime).format('MMM DD, YYYY HH:mm')}</p>`,
      id: m.id
    })
  }
  return arr
}

function buildKey (id, cid, email) {
  return `rc-log-${email}-${cid}-${id}`
}

async function saveLog (id, cid, email, engageId) {
  const key = buildKey(id, cid, email)
  await ls.set(key, engageId)
}

async function filterLoggered (arr, email) {
  const res = []
  for (const m of arr) {
    const key = buildKey(m.id, m.contactId, email)
    const ig = await ls.get(key)
    if (!ig) {
      res.push(m)
    }
  }
  return res
}

async function doSyncOne (contact, body, formData, isManuallySync) {
  let contactId = contact.id
  if (contactId && contactId.startsWith('LEAD_')) {
    return
  }
  if (!contactId) {
    return notify('no related contact', 'warn')
  }
  let desc = formData.description
  const sid = _.get(body, 'call.telephonySessionId') || 'not-exist'
  const sessid = autoLogPrefix + sid
  if (!isManuallySync) {
    desc = await ls.get(sessid) || ''
  }
  let toNumber = _.get(body, 'call.to.phoneNumber')
  let fromNumber = _.get(body, 'call.from.phoneNumber')
  let { duration } = body.call
  let start = dayjs(body.call.startTime).format(formatDate)
  let end = dayjs(body.call.startTime + duration * 1000).format(formatDate)
  let token = await getVerifyToken(contactId)
  let externalId = buildId(body)
  let recording = _.get(body, 'call.recording')
    ? `<p>Recording link: ${body.call.recording.link}</p>`
    : ''
  let mainBody = ''
  let ctype = _.get(body, 'conversation.type')
  let isVoiceMail = ctype === 'VoiceMail'
  let logType = body.call || isVoiceMail ? 'Call' : ctype
  if (body.call) {
    mainBody = `${start}: [${_.get(body, 'call.direction')} ${_.get(body, 'call.result')}] CALL from <b>${body.call.fromMatches.map(d => d.name).join(', ')}</b>(<b>${formatPhoneLocal(fromNumber)}</b>) to <b>${body.call.toMatches.map(d => d.name).join(', ')}</b>(<b>${formatPhoneLocal(toNumber)}</b>)`
  } else if (ctype === 'SMS') {
    mainBody = buildMsgs(body)
  } else if (isVoiceMail) {
    mainBody = buildVoiceMailMsgs(body)
  }
  if (!_.isArray(mainBody)) {
    mainBody = [{
      body: mainBody,
      id: externalId,
      contactId
    }]
  }
  const email = getUserId()
  if (!(isManuallySync && logType === 'Call')) {
    mainBody = await filterLoggered(mainBody, email)
  }
  const descFormatted = (desc || '')
    .split('\n')
    .map(d => `<p>${d}</p>`)
    .join('')
  let bodyAll = mainBody.map(mm => {
    return {
      id: mm.id,
      body: `<div>${descFormatted}</div><p>${mm.body}</p>${recording}`
    }
  })
  for (const uit of bodyAll) {
    let data = {
      EntityType: 'Event',
      'Fields[LookupField_10393]': formData.title || 'Call Log',
      'Fields[LookupField_10394]': '',
      'Fields[LookupField_10395]': start,
      'Fields[LookupField_10396]': end,
      'Fields[LookupField_10439]': false,
      'Fields[LookupField_10440]': uit.body,
      'Fields[LookupField_10446]': true,
      EntityId: '',
      RelatedEntityType: 'Contact',
      RelatedEntityId: contactId,
      InModal: true,
      bulkCommand: '',
      isBulkCommand: false,
      __RequestVerificationToken: token
    }
    /*
  EntityType: Event
  Fields[LookupField_10393]: TA
  Fields[LookupField_10394]:
  Fields[LookupField_10395]: 14-Oct-2018 08:00 PM
  Fields[LookupField_10396]: 14-Oct-2018 09:00 PM
  Fields[LookupField_10439]: false
  Fields[LookupField_10440]: WHAT
  Fields[LookupField_10446]: true
  EntityId:
  RelatedEntityType: Contact
  RelatedEntityId: 273196913
  InModal: true
  bulkCommand:
  isBulkCommand: false
  __RequestVerificationToken: h480cvYO_JTDnFF4KR2fczcDH1x2QdqhpjFRXOs12Abv265WhHNhT7Whamn4zNYSUmbJh-133di9qqBHgPy1aTP93n2KXCf6WhaGscBY84D9RbFlG298UtHSaZNEDHU6lG2dpQ2
  RedirectType: ActivityReload
    */
    // https://crm.na1.insightly.com/Metadata/Create
    let url = `${host}/Metadata/Create`
    let res = await fetch.post(url, {}, {
      headers: {
        ...jsonHeader,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: buildFormData(data)
    })
    if (res && res.id) {
      await saveLog(uit.id, contactId, email, res.id)
      notifySyncSuccess({
        id: res.id,
        requestId: body.requestId,
        sessionIds: bodyAll.map(t => t.id)
      })
    } else {
      notify('call log sync to insightly failed', 'warn')
      console.log('post /Metadata/Create error')
      console.log(res)
    }
  }
}
