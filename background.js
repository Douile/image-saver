'use strict';
if (!browser) {
  throw new Error('Browser API not found');
}

var PATH_DELIM = '/';
browser.runtime.getPlatformInfo().then((info) => {
  if (info.os === 'win') PATH_DELIM = '\\';
}).catch(console.error);
const VALID_TAGS = ['IMG','SVG'];
const VERBOOSE = true;
const MENUS = ['image_save_button','image_dataurl_button'];
const JS_PARSEURL = `function parseURL(url) {var u=new URL(url,window.location.href);return u.toString();};`;
const JS_SAVE = function(action) {
  return `function save_image(node) {var bg=getComputedStyle(node).getPropertyValue('background-image');var tag=node.tagName.toUpperCase();if(bg.includes('url')) {var url=parseURL(bg.substr(5,bg.length-7));browser.runtime.sendMessage({'type':'${action}','target':'url','data':url})} else if (tag==='SVG') {browser.runtime.sendMessage({'type':'${action}','target':'base64','data':btoa(node.outerHTML)})} else if (tag==='IMG') {var url=parseURL(node.src);browser.runtime.sendMessage({'type':'${action}','target':'url','data':url});} else {return false;};return true;};`
}
const JS_CHECK = `function is_image(node) {return ${JSON.stringify(VALID_TAGS)}.includes(node.tagName.toUpperCase())||getComputedStyle(node).getPropertyValue('background-image').includes('url')};`;
const JS_CHILDREN = `function image_children(node) {return Array.from(node.children).filter(is_image);};`

var LAST_DOWNLOAD_DIR = '.';

var activeDownloads = new Map();

const showMenuItems = function(items, visible) {
  return new Promise((resolve,reject) => {
    items.forEach((id) => {
      browser.menus.update(
        id,
        {'visible':visible}
      ).then(() => {
        browser.menus.refresh().then(() => {
          if (VERBOOSE) console.log(`${visible ? 'Show' : 'Hide'} ${id}`);
        }).catch(reject);
      }).catch(reject);
    });
    resolve();
  })
}

const downloadImage = function(message) {
  switch(message.target) {
    case "base64":
    var blob = new Blob([atob(message.data)],{'type':'image/svg'});
    var url = URL.createObjectURL(blob);
    console.log(`${LAST_DOWNLOAD_DIR}${PATH_DELIM}image.svg`);
    browser.downloads.download({
      'filename': `${LAST_DOWNLOAD_DIR}${PATH_DELIM}image.svg`,
      'saveAs': true,
      'url': url,
    }).then((id) => {
      activeDownloads.set(id,url);
      if (VERBOOSE) console.log(`Started download ${id}`);
    }).catch(function() {
      URL.revokeObjectURL(url);
      console.error.apply(this,arguments);
    });
    break;
    case "url":
    browser.downloads.download({
      'method': 'GET',
      'saveAs': true,
      'url': message.data,
    }).then((id) => {
      if (VERBOOSE) console.log(`Started download ${id}`);
    }).catch(console.error);
    break;
  }
}

const dataURLImage = function(message) {
  switch(message.target) {
    case "base64":
    let svg;
    try {
      svg = cleanSVG(atob(message.data));
    } catch(e) {
      console.warn(e);
      svg = atob(message.data);
    }
    var url = `data:image/svg+xml;base64,${btoa(svg)}`;
    previewDataURL(url);
    console.log(url);
    break;
    case "url":
    fetch(message.data, {mode:'cors'}).then((res) => {
      console.log(res);
      res.blob().then((blob) => {
        var reader = new FileReader();
        reader.onloadend = () => {
          let url = reader.result;
          previewDataURL(url);
          console.log(url);
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
      let message = (tab,url) => {
        if (tab.status === 'complete') {
          browser.tabs.sendMessage(tab.id, {type:'preview-dataurl',data:url}).then(null).catch(function() {
            setTimeout(message, 10, tab, url);
            if (VERBOOSE) console.warn.apply(null,arguments);
          });
        } else {
          setTimeout(message, 10, tab, url);
        }
      }
      message(tab, url);
    }
  }).catch(console.error);
}

browser.menus.onClicked.addListener((info,tab) => {
  if (VERBOOSE) console.log(info);
  let action = info.menuItemId === 'image_dataurl_button' ? 'dataurl' : 'download';
  browser.tabs.executeScript(tab.id,{
    'frameId': info.frameId,
    'code': `${JS_PARSEURL}${JS_SAVE(action)}${JS_CHECK}${JS_CHILDREN}var node=browser.menus.getTargetElement(${info.targetElementId});if (!save_image(node)) {image_children(node).forEach(save_image)};`
  })
});
browser.menus.onShown.addListener((info,tab) => {
  if (VERBOOSE) console.log(info);
  browser.tabs.executeScript(tab.id,{
    'frameId': info.frameId,
    'code': `${JS_CHECK}${JS_CHILDREN}var node=browser.menus.getTargetElement(${info.targetElementId});browser.runtime.sendMessage({'type':(!is_image(node)&&image_children(node).length===0)? 'hide':'show','data':${JSON.stringify(MENUS)}});${VERBOOSE ? 'console.log(node.tagName);' : ''}`
  })
})
browser.menus.onHidden.addListener(() => {
  browser.menus.update('image_save_button',{'visible':false});
})
browser.runtime.onMessage.addListener((message,sender) => {
  if (VERBOOSE) console.log(message);
  switch(message.type) {
    case 'hide':
    case 'show':
    showMenuItems(message.data, message.type === 'show');
    break;
    case 'download':
    downloadImage(message);
    break;
    case 'dataurl':
    dataURLImage(message);
    break;
  }
})
browser.downloads.onCreated.addListener((downloadItem) => {
  if (VERBOOSE) console.log(downloadItem);
  if (downloadItem.filename) {
    LAST_DOWNLOAD_DIR = downloadItem.filename.split(/[/\\]/).slice(0,-1).join(PATH_DELIM);
  }
})
browser.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state.current === 'complete' || downloadDelta.error.current !== undefined) {
    if (activeDownloads.has(downloadDelta.id)) {
      URL.revokeObjectURL(activeDownloads.get(downloadDelta.id));
      activeDownloads.delete(downloadDelta.id);
    }
    if (VERBOOSE) console.log(`Finished download ${downloadDelta.id}`);
  }
})

browser.menus.create({
  'contexts': ['all'],
  'id': 'image_save_button',
  'title': 'Save image',
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
  'title': 'Create image dataurl',
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
