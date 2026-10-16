// Opens and closes the menu on phones.
(function () {
  var header = document.getElementById('site-header');
  var toggle = document.querySelector('.menu-toggle');
  if (!header || !toggle) return;

  function setOpen(open) {
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  toggle.addEventListener('click', function () {
    setOpen(!header.classList.contains('is-open'));
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });
})();
