/**
 *
EntityType: Contact
Fields[LookupField_10084]: XX
Fields[LookupField_10085]: Test
Fields[LookupField_10080]:
Fields[LookupField_10456]:
Fields[LookupField_10489]:
Fields[LookupField_10154]: xx1@xx.xx
Fields[LookupField_10148]: +16504377931
Fields[LookupField_10149]:
Fields[LookupField_10150]:
Fields[LookupField_10151]:
Fields[LookupField_10152]:
Fields[LookupField_10155]:
Fields[LookupField_10153]:
Fields[LookupField_10144]:
Fields[LookupField_10145]:
Fields[LookupField_10146]:
Fields[LookupField_10156]:
Fields[LookupField_10157]:
Fields[LookupField_10158]:
Fields[LookupField_10159]:
Fields[LookupField_10160]:
Fields[LookupField_10163]:
Fields[LookupField_10164]:
Fields[LookupField_10165]:
Fields[LookupField_10166]:
Fields[LookupField_10167]:
Fields[LookupField_10334]: []
Fields[LookupField_10147]:
Fields[LookupField_10087]:
Fields[LookupField_10248]:
Fields[LookupField_10088]: EVERYONE
Fields[LookupField_10092]:
EntityId:
RelatedEntityType:
RelatedEntityId:
InModal: true
bulkCommand:
isBulkCommand: false
__RequestVerificationToken: B-uLpFxyWJMJEL5AJ1qm20VxomkNaz51mi9y7kD50RmnEdQf6T1yS7113M-zSKniWx23cJ6_vDotGyge6O3uaYVBXZdCRXN0XGYKnhyw7vwZA7yA5SMRzmu02LoHlrQKucz_iw2
RedirectType:
PreviousEntityFormGuid:
 */

import fetchBg from 'ringcentral-embeddable-extension-common/src/common/fetch-with-background'
import { jsonHeader } from 'ringcentral-embeddable-extension-common/src/common/fetch'
import { thirdPartyConfigs } from 'ringcentral-embeddable-extension-common/src/common/app-config'

let {
  apiServer
} = thirdPartyConfigs

async function addContact (i) {
  console.log(i)
  let body = {
    FIRST_NAME: 'XXx' + i,
    LAST_NAME: 'Test',
    EMAIL_ADDRESS: `xxx${i}@xx.xx`,
    PHONE: `+${16504378935 + i}`
  }
  let conf = {
    headers: {
      Authorization: `Basic ${window.rc.local.apiKey}`,
      ...jsonHeader
    },
    method: 'post',
    body
  }
  let url = `${apiServer}/Contacts`
  let res = await fetchBg(url, conf)
  console.log(res)
}

function wait (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function addContacts (all = 1500) {
  for (let i = 0; i < all; i++) {
    await addContact(i)
    await wait(500)
  }
}

setTimeout(addContacts, 5000)
