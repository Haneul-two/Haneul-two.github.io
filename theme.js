// <head>에서 동기로 돈다: 첫 그림 전에 저장된 테마(밤/낮)를 걸고, JS가 있다는 표시(html.js)를 붙인다.
// 기본값과 저장 키는 빌드가 <html data-theme data-theme-key> 로 넣는다(src/config.mjs).
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  try {
    var saved = localStorage.getItem(root.getAttribute('data-theme-key'));
    if (saved === 'night' || saved === 'day') root.setAttribute('data-theme', saved);
  } catch (e) { /* 저장소를 못 쓰면 기본 테마 */ }
})();
