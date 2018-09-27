# insightly embeddable ringcentral phone
Add RingCentral Embeddable Voice widgets to insghtly.com

## Features
- Click to call button
- Popup caller/callee info panel when call inbound
- build with custom app config

## Build and Use

1. build `content.js`
```bash
git clone https://github.com/zxdong262/insightly-embeddable-ringcentral-phone.git
cd insightly-embeddable-ringcentral-phone
npm i
cp config.sample.js config.js
# edit config.js, fill the required thirdPartyConfigs.clientIDHS and thirdPartyConfigs.clientSecretHS
# you can get the ID/Secret from https://app.insightly.com/developer, register and create an app,
# make sure you have Scopes: Basic OAuth functionality, and Read from and write to my: Contacts checked.

# then run it
npm start
# edit src/*.js, webpack will auto-rebuild
```

2. Go to Chrome extensions page.
3. Open developer mode
4. Load `insightly-embeddable-ringcentral-phone/dist` as unpacked package.
5. Go to `https://crm.*.insightly.com` to check

## Build with custom RingCentral clientID/appServer

- Create an app from https://developer.ringcentral.com/, make sure you choose a browser based app, and set all permissions, and add `https://ringcentral.github.io/ringcentral-embeddable/redirect.html` to your redirect URI list, Edit `config.js`,
- Fill your RingCentral app's clientID and appServer in `config.js`
```js

  ringCentralConfigs: {
    // your ringCentral app's Client ID
    clientID: 'your-clientID',

    // your ringCentral app's Auth Server URL
    appServer: 'your ringCentral app Auth Server URL'
  },
```

## License
MIT



