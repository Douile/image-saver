'use strict';

let activeImages = {
  src: null,
  background: null,
  svg: null
};

function createElementsObject() {
  let cache = {};
  return new Proxy(cache, {
    get: function(target, prop, proxy) {
      if (prop in target) {
        return target[prop];
      }
      return target[prop] = document.querySelector(prop);
    }
  })
}

const Elements = createElementsObject();

// Update document theme
function updateTheme() {
  document.documentElement.setAttribute('class', `theme-${browser.devtools.panels.themeName}`);
}

function inspectedEval(evalString, defaultValue) {
  return new Promise((resolve, reject) => {
    browser.devtools.inspectedWindow.eval(evalString).then((res) => {
      if (res[1] === undefined) {
        return resolve(res[0]);
      }
      if (defaultValue !== undefined) {
        console.warn(res[1]);
        return resolve(defaultValue);
      }
      return reject(res[1]);
    }).catch(reject);
  })
}

async function evaluateActive() {
  let res = {
    tagName: await inspectedEval('$0.tagName', null),
    src: await inspectedEval('$0.getAttribute("src")', null),
    background: await inspectedEval('getComputedStyle($0).getPropertyValue("background-image")', null)
  };
  if (res.background !== null) {
    if (res.background === 'none') {
      res.background = null;
    } else {
      const match = res.background.match(/url\(["']?([^)"']+)["']?\)/);
      if (match !== null) {
        res.background = match[1];
      }
    }
  }

  return res;
}

async function updateImages() {
  const activeElement = await evaluateActive();

  Elements['.image-src input'].value = activeElement.src;
  Elements['.image-src img'].src = activeElement.src;
  Elements['.image-background input'].value = activeElement.background;
  Elements['.image-background img'].src = activeElement.background;
  Elements['.image-svg input'].value = '';
  URL.revokeObjectURL(Elements['.image-svg img'].src);
  Elements['.image-svg img'].src = '';

  let svgContent = null;
  if (activeElement.tagName === 'svg') {
    svgContent = (await cleanSVG(await inspectedEval('$0.outerHTML'))).text;
    Elements['.image-svg input'].value = svgContent;
    Elements['.image-svg img'].src = URL.createObjectURL(new Blob([svgContent], { type: 'image/svg+xml' }));
  }

  activeImages = {
    src: activeElement.src,
    background: activeElement.background,
    svg: svgContent
  };
}

updateTheme();
updateImages().then(null, console.error);

browser.devtools.panels.onThemeChanged.addListener(function() {
  updateTheme();
});

browser.devtools.panels.elements.onSelectionChanged.addListener(function() {
  updateImages().then(null, console.error);
});

window.addEventListener('click', function(e) {
  if (!e.target) return;
  for (let className of e.target.classList) {
    switch (className) {
      case 'image-src--save':
      browser.runtime.sendMessage({ type: 'download', target: 'url', data: activeImages.src });
      break;
      case 'image-background--save':
      browser.runtime.sendMessage({ type: 'download', target: 'url', data: activeImages.background });
      break;
      case 'image-svg--save':
      browser.runtime.sendMessage({ type: 'download', target: 'base64', data: btoa(activeImages.svg) });
      break;
    }
  }
})
