'use strict';

const init = async function() {
  const panel = await browser.devtools.panels.elements.createSidebarPane('Image saver');
  await panel.setPage('devtools-sidebar.html');
  console.log(panel);
}

init().then(null, console.error);
