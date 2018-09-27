/**
 * config content config file
 * with proper config, insert `call with ringcentral` button or hover some elemet show call button tooltip can be easily done
 * but it is not a required, you can just write your own code, ignore this
 */
import {RCBTNCLS2, checkPhoneNumber} from './helpers'
export const insertClickToCallButton = [
  {
    // must match page url
    urlCheck: href => {
      return href.includes('?blade=/details/contact')
    },

    // define in the page how to get phone number,
    // if can not get phone number, will not insert the call button
    getContactPhoneNumber: () => {
      let phoneInput = document.querySelector('#phone-PHONE')
      if (!phoneInput) {
        return false
      }
      let value = phoneInput.textContent.trim()
      let isNumber = checkPhoneNumber(value)
      return isNumber ? value : false
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

//hover contact node to show click to dial tooltip
export const hoverShowClickToCallButton = [
  //config example
  {
    // must match url
    urlCheck: href => {
      return href.includes('list/Contact/')
    },

    //elemment selector
    selector: '#entity-list table tbody tr',

    // element should inclues phone number element
    getPhoneElemFromElem: elem => {
      return elem.querySelector('td.PHONE')
    }
  }
]

