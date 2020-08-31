'use strict';

console.log(window);

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
  return {
    tagName: await inspectedEval('$0.tagName', null),
    src: await inspectedEval('$0.getAttribute("src")', null),
    background: await inspectedEval('getComputedStyle($0).getPropertyValue("background-image")', null)
  }
}

async function updateImages() {
  const activeElement = await evaluateActive();
  console.log(activeElement);
  Elements['.image-src input'].value = activeElement.src;
  Elements['.image-src img'].src = activeElement.src;
  Elements['.image-background input'].value = activeElement.background;
  Elements['.image-background img'].src = activeElement.background;
  Elements['.image-svg input'].value = '';
  URL.revokeObjectURL(Elements['.image-svg img'].src);
  Elements['.image-svg img'].src = '';

  if (activeElement.tagName === 'svg') {
    const svgContent = cleanSVG(await inspectedEval('$0.outerHTML'));
    Elements['.image-svg input'].value = svgContent;
    Elements['.image-svg img'].src = URL.createObjectURL(new Blob([svgContent], { type: 'image/svg+xml' }));
  }
}

updateTheme();
updateImages().then(null, console.error);

browser.devtools.panels.onThemeChanged.addListener(function() {
  updateTheme();
})

browser.devtools.panels.elements.onSelectionChanged.addListener(function() {
  updateImages().then(null, console.error);
})
