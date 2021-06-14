browser.runtime.onMessage.addListener((message,sender) => {
  if (message.type === 'preview-dataurl') {
    let img = document.getElementById('image'),
    a = document.getElementById('link'),
    input = document.getElementById('input');
    img.src = message.data;
    a.href = message.data;
    a.innerText = message.data;
    input.value = message.data;
    img.scrollIntoView({block: 'center'});
  }
})
window.addEventListener('click',(e) => {
  if (e.target.tagName === 'A') {
    e.preventDefault();
    document.getElementById('input').select();
    document.execCommand('copy');
    alert(browser.i18n.getMessage('copied'));
  }
})
