// Opens and closes the menu on phones, and the small lists under Services, Plans and About.
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

  // Dropdown lists: the small arrow next to a menu word opens or closes its list.
  var items = Array.prototype.slice.call(header.querySelectorAll('.has-submenu'));

  function setItemOpen(item, open) {
    item.classList.toggle('is-open', open);
    var btn = item.querySelector('.submenu-toggle');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function closeAll(except) {
    items.forEach(function (item) {
      if (item !== except) setItemOpen(item, false);
    });
  }

  items.forEach(function (item) {
    var btn = item.querySelector('.submenu-toggle');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var willOpen = !item.classList.contains('is-open');
      closeAll(item);
      setItemOpen(item, willOpen);
    });
  });

  document.addEventListener('click', function (e) {
    if (!header.contains(e.target)) closeAll(null);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      setOpen(false);
      closeAll(null);
    }
  });
})();
