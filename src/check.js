'use strict';
(function() {
  const VALID_TAGS = Object.freeze(['IMG', 'SVG']);

  function timeout(promise, time) {
    return Promise.race([promise, new Promise((resolve, reject) => {
      setTimeout(reject, time, 'Promise timed out');
    })]);
  }

  function is_image(node) {
    return VALID_TAGS.includes(node.tagName.toUpperCase())||getComputedStyle(node).getPropertyValue('background-image').includes('url');
  };
  function image_children(node) {
    return Array.from(node.children).filter(is_image);
  }
  function image_parent(node) {
    if (node === null) return null;
    if (VALID_TAGS.includes(node.tagName.toUpperCase())) return node;
    return image_parent(node.parentElement);
  }
  function parseUrl(url) {
    return new URL(url, window.location.href).toString();
  }
  function image_data(node) {
    const style = getComputedStyle(node);
    const bg = style.getPropertyValue('background-image');
    if (bg.startsWith('url(')) {
      return { t: 'url', d: parseUrl(bg.substr(5,bg.length-7)) };
    }
    const tag = node.tagName.toUpperCase();
    if (tag === 'SVG') {
      return { t: 'svg', d: btoa(node.outerHTML), c: {fill: style.getPropertyValue('fill'), color: style.getPropertyValue('color')} };
    }
    if (tag === 'IMG') {
      return { t: 'url', d: node.src };
    }
    return null;
  }

  const handlers = Object.freeze({
    'check': async function(message, node) {
      if (is_image(node)) return 'self';
      if (image_children(node).length > 0) return 'child';
      if (image_parent(node) !== null) return 'parent';
      return null;
    },
    'save': async function(message, node) {
      switch(message.t) {
        case 'self':
          return image_data(node);
        case 'child':
          return image_data(image_children(node)[0]);
        case 'parent':
          return image_data(image_parent(node));
      }
      return null;
    },
  });

  browser.runtime.onMessage.addListener(function(message, sender) {
    if (!message.r in handlers) return false;
    return (async function() {
      const node = browser.menus.getTargetElement(message.i);
      try {
        const r = await timeout(handlers[message.r](message, node), 100);
        console.log(`[${message.r}]`, node, '->', r);
        return r;
      } catch(e) {
        console.error(e);
        return null;
      }
    })();
  });
})();
