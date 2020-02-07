/**
 * call log sync feature
 */

import dayjs from 'dayjs'
import { thirdPartyConfigs } from 'ringcentral-embeddable-extension-common/src/common/app-config'
import { createForm, getContactInfo } from './call-log-sync-form'
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
  getVerifyToken
} from './common'
import fetch, { jsonHeader } from 'ringcentral-embeddable-extension-common/src/common/fetch'

let formatDate = 'DD-MMM-YYYY hh:mm A'
let {
  showCallLogSyncForm,
  serviceName
} = thirdPartyConfigs

export function notifySyncSuccess ({
  id
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
  if (!window.rc.local.apiKey) {
    return isManuallySync ? showAuthBtn() : null
  }
  if (showCallLogSyncForm && isManuallySync) {
    let contactRelated = await getContactInfo(body, serviceName)
    if (
      !contactRelated ||
      (!contactRelated.froms && !contactRelated.tos)
    ) {
      return notify('No related contact')
    }
    return createForm(
      body,
      serviceName,
      (formData) => doSync(body, formData)
    )
  } else {
    doSync(body, {})
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
    let nf = _.get(body, 'to.phoneNumber') ||
      _.get(body, 'call.to.phoneNumber')
    let nt = _.get(body, 'from.phoneNumber') ||
      _.get(body.call, 'from.phoneNumber')
    all = [nt, nf]
  } else {
    all = [
      _.get(body, 'conversation.self.phoneNumber'),
      ...body.conversation.correspondents.map(d => d.phoneNumber)
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
async function doSync (body, formData) {
  let contacts = await getSyncContacts(body)
  if (!contacts.length) {
    return notify('No related contacts')
  }
  console.log(contacts, 'contacts')
  for (let contact of contacts) {
    await doSyncOne(contact, body, formData)
  }
}

async function doSyncOne (contact, body, formData) {
  let contactId = contact.id
  if (contactId && contactId.startsWith('LEAD_')) {
    return
  }
  if (!contactId) {
    return notify('no related contact', 'warn')
  }
  let toNumber = _.get(body, 'call.to.phoneNumber')
  let fromNumber = _.get(body, 'call.from.phoneNumber')
  let { duration } = body.call
  let details = `
    Call from ${fromNumber} to ${toNumber}, duration: ${duration} seconds.
    ${formData.description || ''}
  `
  let start = dayjs(body.call.startTime).format(formatDate)
  let end = dayjs(body.call.startTime + duration * 1000).format(formatDate)
  let token = await getVerifyToken(contactId)
  let data = {
    EntityType: 'Event',
    'Fields[LookupField_10393]': formData.title || 'Call Log',
    'Fields[LookupField_10394]': '',
    'Fields[LookupField_10395]': start,
    'Fields[LookupField_10396]': end,
    'Fields[LookupField_10439]': false,
    'Fields[LookupField_10440]': details,
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
    notifySyncSuccess({ id: res.id })
  } else {
    notify('call log sync to insightly failed', 'warn')
    console.log('post /Metadata/Create error')
    console.log(res)
  }
}
