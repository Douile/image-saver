'use strict';

let VERBOSE = false;

if (!browser) {
  throw new Error('Browser API not found');
}

const MENUS = ['image_save_button','image_dataurl_button'];
// TODO: Match multiple background images
// TODO: allow choosing between images if multiple are found
let activeDownloads = new Map();

const downloadImage = async function(message, pageURL) {
  switch(message.t) {
    case "svg": {
      const data = atob(message.d);
      let svg;
      try {
        svg = (await cleanSVG(data, pageURL, message.c, VERBOSE)).text;
      } catch(e) {
        svg = data;
      }
      var blob = new Blob([svg],{'type':'image/svg'});
      var url = URL.createObjectURL(blob);
      browser.downloads.download({
        'filename': 'image.svg',
        'saveAs': true,
        'url': url,
      }).then((id) => {
        activeDownloads.set(id,url);
        if (VERBOSE) console.log(`Started download ${id}`);
      }).catch(function() {
        URL.revokeObjectURL(url);
        console.error.apply(this,arguments);
      });
      break;
    }

    case "url":
    browser.downloads.download({
      'method': 'GET',
      'saveAs': true,
      'url': message.d,
    }).then((id) => {
      if (VERBOSE) console.log(`Started download ${id}`);
    }).catch(console.error);
    break;
  }
}

const dataURLImage = async function(message, pageURL) {
  switch(message.t) {
    case "svg": {
      const data = atob(message.d);
      if (VERBOSE) console.log('Attempting to clean and dataURL', data);
      let svg;
      try {
        svg = (await cleanSVG(data, pageURL, message.c, VERBOSE)).text;
      } catch(e) {
        console.warn(e);
        svg = data;
      }
      var url = `data:image/svg+xml;base64,${btoa(svg)}`;
      previewDataURL(url);
      break;
    }
    case "url":
    fetch(message.d, {mode:'cors'}).then((res) => {
      console.log(res);
      res.blob().then((blob) => {
        var reader = new FileReader();
        reader.onloadend = () => {
          let url = reader.result;
          previewDataURL(url);
        }
        reader.onerror = console.error;
        reader.readAsDataURL(blob);
      }).catch(console.error);
    }).catch(console.error);
    break;
  }
}

const previewDataURL = function(url) {
  browser.windows.create({ type: 'panel', url: browser.runtime.getURL('svg_preview.html') }).then((window) => {
    for (let tab of window.tabs) {
      /* This is jank */
      let message = (tab,url) => {
        if (tab.status === 'complete') {
          browser.tabs.sendMessage(tab.id, {type:'preview-dataurl',data:url}).then(null).catch(function() {
            setTimeout(message, 10, tab, url);
            if (VERBOSE) console.warn.apply(null,arguments);
          });
        } else {
          setTimeout(message, 10, tab, url);
        }
      }
      message(tab, url);
    }
  }).catch(console.error);
}

let nextMenuInstanceId = 1;
let lastMenuInstanceId = 0; 
let lastImageType;

browser.menus.onClicked.addListener(async function(info,tab) {
  if (VERBOSE) console.log(info);
  const action = info.menuItemId === 'image_dataurl_button' ? 'dataurl' : 'download';

  const res = await browser.tabs.sendMessage(tab.id, {
    r: 'save',
    i: info.targetElementId,
    t: lastImageType,
  });

  console.log('Save image', res);
  switch(info.menuItemId) {
    case 'image_dataurl_button':
      await dataURLImage (res, tab.url);
      break;
    case 'image_save_button':
      await downloadImage(res, tab.url);
      break;
  }
});

browser.menus.onShown.addListener(async function(info,tab) {
  let menuInstanceId = nextMenuInstanceId++;
  lastMenuInstanceId = menuInstanceId;

  lastImageType = await browser.tabs.sendMessage(tab.id, {
    r: 'check',
    i: info.targetElementId,
  });
  const is_image = lastImageType !== null;
  if (VERBOSE) console.log(info, lastImageType, is_image);

  if (menuInstanceId !== lastMenuInstanceId) return console.warn('Menu closed and re-opened during check');

  await Promise.all(MENUS.map(item => browser.menus.update(item, { visible: is_image })));
  await browser.menus.refresh();
  if (VERBOSE) console.log('Menu update completed...');
})

browser.menus.onHidden.addListener(async function() {
  await Promise.all(MENUS.map(item => brow.sermenus.update(item, { visible: false })));
})

browser.downloads.onCreated.addListener((downloadItem) => {
  if (VERBOSE) console.log(downloadItem);
})

browser.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state.current === 'complete' || downloadDelta.error.current !== undefined) {
    if (activeDownloads.has(downloadDelta.id)) {
      URL.revokeObjectURL(activeDownloads.get(downloadDelta.id));
      activeDownloads.delete(downloadDelta.id);
    }
    if (VERBOSE) console.log(`Finished download ${downloadDelta.id}`);
  }
})

browser.menus.create({
  'contexts': ['all'],
  'id': 'image_save_button',
  'title': browser.i18n.getMessage('menuSaveImage'),
  'type': 'normal',
  'visible': false,
  'enabled': true,
  'documentUrlPatterns': ['*://*/*'],
  'icons': {
    '16': '/assets/logo.svg',
    '32': '/assets/logo.svg'
  }
},() => {
  if (browser.runtime.lastError) {
    console.error('Error creating contextMenu');
  }
})

browser.menus.create({
  'contexts': ['all'],
  'id': 'image_dataurl_button',
  'title': browser.i18n.getMessage('menuUrlImage'),
  'type': 'normal',
  'visible': false,
  'enabled': true,
  'documentUrlPatterns': ['*://*/*'],
  'icons': {
    '16': '/assets/logo.svg',
    '32': '/assets/logo.svg'
  }
},() => {
  if (browser.runtime.lastError) {
    console.error('Error creating contextMenu');
  }
})
