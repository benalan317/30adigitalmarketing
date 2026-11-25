/* Best marketing channels by industry (/insights/best-marketing-channels-by-industry/)
   1. Channel Finder: reads the industry table (data-mc-industries) and the buying-mode table (data-mc-modes).
      Edit the tables in the page, not this script. Without JavaScript the full table shows instead.
   2. Season Planner: shifts the three timeline months to match the reader's busy season.
   3. Checklist: saves ticks in this browser (same behavior as the Grayton Beach checklist). */
(function () {
  'use strict';
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------- 1. Channel Finder ---------- */
  var finder = document.querySelector('[data-mc-finder]');
  var table = document.querySelector('[data-mc-industries]');
  var modeTable = document.querySelector('[data-mc-modes]');
  if (finder && table) {
    var LABELS = ['How customers buy', 'Start with', 'Add when ready', 'Spend less when', 'Measure', 'Evidence'];
    var industries = [];
    each(table.querySelectorAll('tbody tr'), function (tr) {
      var cells = tr.querySelectorAll('td');
      var link = cells[0].querySelector('a');
      industries.push({
        id: tr.getAttribute('data-id'),
        name: cells[0].textContent.trim(),
        href: link ? link.getAttribute('href') : null,
        roi: tr.getAttribute('data-roi'),
        modes: (tr.getAttribute('data-modes') || '').split(' '),
        cells: Array.prototype.slice.call(cells, 1).map(function (td) { return td.innerHTML; })
      });
    });
    var modes = [];
    if (modeTable) {
      each(modeTable.querySelectorAll('tbody tr'), function (tr) {
        var c = tr.querySelectorAll('td');
        modes.push({ id: tr.getAttribute('data-mode'), name: c[0].textContent.trim(), examples: c[1].textContent.trim(), channels: c[2].textContent.trim(), failure: c[3].textContent.trim() });
      });
    }

    var panelInd = finder.querySelector('[data-mc-panel="industry"]');
    var panelMode = finder.querySelector('[data-mc-panel="mode"]');
    var result = finder.querySelector('[data-mc-result]');
    var tabs = finder.querySelectorAll('[data-mc-tab]');

    var pickButton = function (label, attr, value) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mc-pick';
      b.setAttribute(attr, value);
      b.setAttribute('aria-pressed', 'false');
      b.textContent = label;
      return b;
    };
    var setPressed = function (panel, btn) {
      each(panel.querySelectorAll('.mc-pick'), function (x) { x.setAttribute('aria-pressed', x === btn ? 'true' : 'false'); });
    };

    var renderIndustry = function (ind, lead) {
      var rows = LABELS.map(function (label, i) {
        return '<div><dt>' + label + '</dt><dd>' + ind.cells[i] + '</dd></div>';
      }).join('');
      var links = '';
      if (ind.href) links += '<a class="link-caps" href="' + esc(ind.href) + '">Our marketing for this industry</a>';
      if (ind.roi) links += '<a class="link-caps" href="/roi-calculator/#' + esc(ind.roi) + '">Run your numbers in the ROI calculator</a>';
      result.innerHTML = (lead || '') + '<div class="mc-card"><p class="mc-card-name">' + esc(ind.name) + '</p><dl>' + rows + '</dl>' +
        (links ? '<p class="mc-card-links">' + links + '</p>' : '') + '</div>';
    };

    industries.forEach(function (ind) {
      var b = pickButton(ind.name, 'data-mc-pick', ind.id);
      b.addEventListener('click', function () { setPressed(panelInd, b); renderIndustry(ind); });
      panelInd.appendChild(b);
    });

    var renderMode = function (m) {
      var matches = industries.filter(function (ind) { return ind.modes.indexOf(m.id) !== -1; });
      var html = '<div class="mc-card mc-mode-card"><p class="mc-card-name">' + esc(m.name) + '</p><dl>' +
        '<div><dt>Examples</dt><dd>' + esc(m.examples) + '</dd></div>' +
        '<div><dt>Channels to consider</dt><dd>' + esc(m.channels) + '</dd></div>' +
        '<div><dt>Common failure</dt><dd>' + esc(m.failure) + '</dd></div></dl>' +
        '<p class="mc-match-title">Industries that often sell this way</p><div class="mc-matches"></div></div>';
      result.innerHTML = html;
      var box = result.querySelector('.mc-matches');
      matches.forEach(function (ind) {
        var b = pickButton(ind.name, 'data-mc-pick', ind.id);
        b.addEventListener('click', function () {
          renderIndustry(ind, '<p class="mc-back"><button type="button" class="mc-back-btn">Back to ' + esc(m.name.toLowerCase()) + '</button></p>');
          var back = result.querySelector('.mc-back-btn');
          if (back) back.addEventListener('click', function () { renderMode(m); });
        });
        box.appendChild(b);
      });
    };

    modes.forEach(function (m) {
      var b = pickButton(m.name, 'data-mc-mode', m.id);
      b.addEventListener('click', function () { setPressed(panelMode, b); renderMode(m); });
      panelMode.appendChild(b);
    });

    var PROMPT = { industry: 'Pick an industry to see where to start.', mode: 'Pick how your customers buy to see channels that fit.' };
    var showTab = function (name) {
      each(tabs, function (t) {
        var on = t.getAttribute('data-mc-tab') === name;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.setAttribute('tabindex', on ? '0' : '-1');
      });
      panelInd.hidden = name !== 'industry';
      panelMode.hidden = name !== 'mode';
      setPressed(panelInd, null);
      setPressed(panelMode, null);
      result.innerHTML = '<p class="pw-chooser-result">' + PROMPT[name] + '</p>';
    };
    each(tabs, function (t, i) {
      t.addEventListener('click', function () { showTab(t.getAttribute('data-mc-tab')); });
      t.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        next.focus();
        showTab(next.getAttribute('data-mc-tab'));
      });
    });
    showTab('industry');

    finder.hidden = false;
    var all = document.querySelector('[data-mc-all]');
    if (all) all.open = false;
  }

  /* ---------- 2. Season Planner ---------- */
  var season = document.querySelector('[data-mc-season]');
  if (season) {
    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var select = season.querySelector('[data-mc-peak]');
    var pickRow = season.querySelector('.mc-season-pick');
    var note = season.querySelector('[data-mc-season-note]');
    var update = function () {
      var peak = parseInt(select.value, 10);
      each(season.querySelectorAll('.mc-timeline li'), function (li) {
        var m = (peak + parseInt(li.getAttribute('data-offset'), 10) + 24) % 12;
        li.querySelector('[data-mc-when]').textContent = MONTHS[m];
      });
      if (note) note.textContent = 'Dates for a ' + MONTHS[peak] + ' season. They are rough targets based on Walton County’s average planning window, not a rule.';
    };
    if (select && pickRow) {
      pickRow.hidden = false;
      select.addEventListener('change', update);
      update();
    }
  }

  /* ---------- 3. Checklist ---------- */
  var store = {
    get: function (k) { try { return JSON.parse(window.localStorage.getItem(k) || '[]'); } catch (e) { return []; } },
    set: function (k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage off: checks just won't be remembered */ } }
  };
  each(document.querySelectorAll('[data-pw-checklist]'), function (box) {
    var key = 'pw-checklist-' + box.getAttribute('data-pw-checklist');
    var inputs = box.querySelectorAll('input[type="checkbox"]');
    var saved = store.get(key);
    each(inputs, function (input, i) {
      input.checked = saved.indexOf(i) !== -1;
      input.addEventListener('change', function () {
        var on = [];
        each(inputs, function (x, j) { if (x.checked) on.push(j); });
        store.set(key, on);
      });
    });
    var actions = box.querySelector('.pw-checklist-actions');
    if (actions) {
      actions.hidden = false;
      var printBtn = box.querySelector('[data-pw-print]');
      var clearBtn = box.querySelector('[data-pw-clear]');
      if (printBtn) printBtn.addEventListener('click', function () {
        document.body.classList.add('pw-print-checklist');
        box.classList.add('is-printing');
        var done = function () { document.body.classList.remove('pw-print-checklist'); box.classList.remove('is-printing'); window.removeEventListener('afterprint', done); };
        window.addEventListener('afterprint', done);
        window.print();
      });
      if (clearBtn) clearBtn.addEventListener('click', function () {
        each(inputs, function (x) { x.checked = false; });
        store.set(key, []);
      });
    }
  });
})();
