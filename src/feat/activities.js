/**
 * third party activies related feature
 */

import _ from 'lodash'
import {
  notify,
  host
} from 'ringcentral-embeddable-extension-common/src/common/helpers'
import fetch, { jsonHeader } from 'ringcentral-embeddable-extension-common/src/common/fetch'
import extLinkSvg from 'ringcentral-embeddable-extension-common/src/common/link-external.svg'
import {
  getCustomVerifyHeaderToken
} from './common'

export function showActivityDetail (body) {
  let { activity = {} } = body
  let {
    subject,
    url
  } = activity
  let msg = `
    <div>
      <div class="rc-pd1b">
        <a href="${url}">
          <b>
            Subject: ${subject}
            <img width=16 height=16 src="${extLinkSvg}" />
          </b>
        </a>
      </div>
    </div>
  `
  notify(msg, 'info', 8000)
}

function formatEngagements (arr, contact) {
  return arr.map(item => {
    return {
      id: item.ACTIVITY_ID,
      url: item.TypeDetailsUrl,
      subject: item.NAME,
      time: +new Date(item.CALENDAR_START_DATE_UTC),
      body: item.DETAILS,
      contact
    }
  })
    .sort((a, b) => {
      return b.time - a.time
    })
  /*
    [
      {
        id: '123',
        subject: 'Title',
        time: 1528854702472
      }
    ]
  */
}

export async function getActivities (body) {
  // https://crm.na1.insightly.com/Metadata/GetDetailActivityGridData?gridType=Past&readDb=False
  // {"type":"Contact","viewId":"271723768","page":1}
  let id = _.get(body, 'contact.id')
  if (!id || id.startsWith('LEAD_')) {
    return []
  }
  let token = getCustomVerifyHeaderToken()
  let conf = {
    headers: {
      ...jsonHeader,
      RequestVerificationToken: token
    }
  }
  // https://crm.na1.insightly.com/Metadata/GetDetailActivityGridData?gridType=Past&readDb=True
  let url = `${host}/Metadata/GetDetailActivityGridData?gridType=Past&readDb=False`
  let data = {
    type: 'Contact',
    viewId: id,
    page: 1
  }
  let res = await fetch.post(url, data, conf)
  if (res && res.Items) {
    return formatEngagements(JSON.parse(res.Items), body.contact)
  } else {
    console.log('fetch events error')
    console.log(res)
  }
  return []
}
