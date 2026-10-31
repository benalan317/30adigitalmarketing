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

// Free audit page (/free-audit/): "Mark done" ticks, the sticky step tracker, and the "Copy the prompt" button.
// Every word on that page is plain HTML; this only adds the interactive parts. Ticks are remembered in this
// browser only (localStorage) and the page works the same if that storage is blocked.
(function () {
  var wrap = document.getElementById('audit-steps');
  if (!wrap) return;

  var KEY = 'fa-free-audit-steps';
  var steps = Array.prototype.slice.call(wrap.querySelectorAll('.audit-step'));
  var buttons = Array.prototype.slice.call(wrap.querySelectorAll('[data-done]'));
  var links = Array.prototype.slice.call(wrap.querySelectorAll('[data-step-link]'));
  var countEl = wrap.querySelector('[data-done-count]');
  var finish = wrap.querySelector('[data-finish]');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var done = {};

  try {
    var saved = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    if (Array.isArray(saved)) saved.forEach(function (n) { done[String(n)] = true; });
  } catch (e) { /* storage blocked: start fresh */ }

  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(Object.keys(done))); } catch (e) { /* ignore */ }
  }

  function render() {
    var count = 0;
    buttons.forEach(function (btn) {
      var n = btn.getAttribute('data-done');
      var isDone = !!done[n];
      if (isDone) count++;
      btn.setAttribute('aria-pressed', isDone ? 'true' : 'false');
      var label = btn.querySelector('.audit-done-text');
      if (label) label.textContent = isDone ? 'Step ' + n + ' done' : 'Mark step ' + n + ' done';
    });
    steps.forEach(function (s) { s.classList.toggle('is-done', !!done[s.getAttribute('data-step')]); });
    links.forEach(function (a) {
      var isDone = !!done[a.getAttribute('data-step-link')];
      a.classList.toggle('is-done', isDone);
      var hint = a.querySelector('.visually-hidden');
      if (!hint) { hint = document.createElement('span'); hint.className = 'visually-hidden'; a.appendChild(hint); }
      hint.textContent = isDone ? ' (done)' : '';
    });
    if (countEl) countEl.textContent = String(count);
    if (finish) finish.hidden = count < steps.length;
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var n = btn.getAttribute('data-done');
      var nowDone = !done[n];
      if (nowDone) done[n] = true; else delete done[n];
      save();
      render();
      // After ticking a step, glide to the next one that isn't done yet.
      if (nowDone) {
        var next = steps.filter(function (s) {
          return Number(s.getAttribute('data-step')) > Number(n) && !done[s.getAttribute('data-step')];
        })[0];
        if (next) {
          window.setTimeout(function () {
            next.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
          }, 280);
        }
      }
    });
  });

  // Highlight the step on screen in the tracker.
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var n = entry.target.getAttribute('data-step');
        links.forEach(function (a) {
          var on = a.getAttribute('data-step-link') === n;
          a.classList.toggle('is-current', on);
          if (on) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    steps.forEach(function (s) { io.observe(s); });
  }

  render();

  // The prompt: copy button and "Show the full prompt".
  var box = document.getElementById('audit-prompt-box');
  if (!box) return;
  var pre = document.getElementById('audit-prompt');
  var copyBtn = box.querySelector('.prompt-copy');
  var expandBtn = box.querySelector('.prompt-expand');
  var status = box.querySelector('.prompt-status');
  var resetTimer;

  function selectPrompt() {
    var range = document.createRange();
    range.selectNodeContents(pre);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function copied(ok) {
    window.clearTimeout(resetTimer);
    if (ok) {
      copyBtn.classList.add('is-copied');
      copyBtn.lastChild.textContent = 'Copied';
      status.textContent = 'Copied. Paste it into ChatGPT or Claude, with your reports attached.';
      resetTimer = window.setTimeout(function () {
        copyBtn.classList.remove('is-copied');
        copyBtn.lastChild.textContent = 'Copy the prompt';
      }, 2600);
    } else {
      setExpanded(true);
      selectPrompt();
      status.textContent = 'The prompt is selected. Press Ctrl+C (or Cmd+C on a Mac) to copy it.';
    }
  }

  function fallbackCopy() {
    try {
      selectPrompt();
      var ok = document.execCommand('copy');
      window.getSelection().removeAllRanges();
      copied(ok);
    } catch (e) { copied(false); }
  }

  if (copyBtn && pre) {
    copyBtn.addEventListener('click', function () {
      var text = pre.textContent.replace(/\s+$/, '') + '\n';
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { copied(true); }, fallbackCopy);
      } else {
        fallbackCopy();
      }
    });
  }

  function setExpanded(open) {
    box.classList.toggle('is-expanded', open);
    if (expandBtn) {
      expandBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      expandBtn.textContent = open ? 'Show less' : 'Show the full prompt';
    }
  }

  if (expandBtn) {
    expandBtn.addEventListener('click', function () {
      var open = !box.classList.contains('is-expanded');
      setExpanded(open);
      if (!open) box.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  }
})();
