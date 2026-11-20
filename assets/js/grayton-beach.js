/* Grayton Beach State Park visitor guide (/insights/grayton-beach-state-park/)
   Loaded only on that page (front matter: page_script: "grayton-beach").
   Every word the reader needs is in the page HTML; this file only adds:
   1. Map: loads a Google Maps embed when the reader asks, and switches places.
   2. Visit planner: moves the best-fitting plan to the top and highlights the note for the group.
   3. Trail chooser: moves matching trails to the top with a one-line reason.
   4. Habitat dots: highlight one habitat in the list below the drawing.
   5. Checklist: remembers ticks in this browser, prints, and clears.
   Styles: the pw- guide components in style.css, plus the gb- additions. */
(function () {
  'use strict';
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };

  /* ---------- 1. Map ---------- */
  var map = document.querySelector('[data-pw-map]');
  if (map) {
    var frame = map.querySelector('.pw-map-frame');
    var tabs = map.querySelectorAll('.pw-map-tabs button');
    var current = tabs.length ? tabs[0].getAttribute('data-q') : 'Grayton Beach State Park';
    var iframe = null;
    var src = function (q) { return 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&z=14&output=embed'; };
    var openMap = function () {
      if (iframe) return;
      iframe = document.createElement('iframe');
      iframe.title = 'Google map of Grayton Beach State Park';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.src = src(current);
      frame.innerHTML = '';
      frame.appendChild(iframe);
    };
    var openBtn = map.querySelector('[data-pw-map-open]');
    if (openBtn) openBtn.addEventListener('click', openMap);
    each(tabs, function (b) {
      b.setAttribute('aria-pressed', b.classList.contains('is-active') ? 'true' : 'false');
      b.addEventListener('click', function () {
        each(tabs, function (t) { t.classList.remove('is-active'); t.setAttribute('aria-pressed', 'false'); });
        b.classList.add('is-active');
        b.setAttribute('aria-pressed', 'true');
        current = b.getAttribute('data-q');
        if (iframe) { iframe.src = src(current); } else { openMap(); }
      });
    });
  }

  /* ---------- 2. Visit planner ---------- */
  var TIME_TEXT = { two: 'fits about 2 hours', half: 'fits half a day', full: 'fills a full day' };
  var WANT_TEXT = { beach: 'beach time', paddle: 'paddling', trails: 'a trail walk or ride', wildlife: 'birds and photos' };
  var planner = document.querySelector('[data-gb-planner]');
  var plans = document.querySelector('[data-gb-plans]');
  var notes = document.querySelector('[data-gb-notes]');
  if (planner && plans) {
    planner.hidden = false;
    var planItems = Array.prototype.slice.call(plans.children);
    var noteItems = notes ? Array.prototype.slice.call(notes.children) : [];
    planItems.forEach(function (li, i) { li.setAttribute('data-order', i); });
    noteItems.forEach(function (li, i) { li.setAttribute('data-order', i); });
    var planResult = planner.querySelector('.pw-chooser-result');
    var pick = function (name) { var c = planner.querySelector('input[name="' + name + '"]:checked'); return c ? c.value : null; };

    planner.addEventListener('change', function () {
      var time = pick('gb-time'), want = pick('gb-want'), who = pick('gb-who');
      var scored = planItems.map(function (li) {
        var tags = (li.getAttribute('data-tags') || '').split(' ');
        var score = 0, reasons = [];
        if (time && li.getAttribute('data-plan') === time) { score += 3; reasons.push(TIME_TEXT[time]); }
        if (want && tags.indexOf(want) !== -1) { score += 1; reasons.push('includes ' + WANT_TEXT[want]); }
        return { li: li, score: score, reasons: reasons };
      });
      scored.sort(function (a, b) { return (b.score - a.score) || (a.li.getAttribute('data-order') - b.li.getAttribute('data-order')); });
      var best = scored[0].score;
      scored.forEach(function (s) {
        plans.appendChild(s.li);
        var tag = s.li.querySelector('.pw-trail-match');
        var isMatch = best > 0 && s.score === best;
        s.li.classList.toggle('is-match', isMatch);
        s.li.classList.toggle('is-dim', best > 0 && !isMatch);
        tag.hidden = !isMatch;
        tag.textContent = isMatch ? 'Good fit: ' + s.reasons.join(', ') + '.' : '';
      });

      // Notes: the group's note (and the birds-and-photos note) move to the top.
      noteItems.forEach(function (li) {
        var on = (who && li.getAttribute('data-who') === who) || (want && li.getAttribute('data-want') === want);
        li.classList.toggle('is-active', !!on);
      });
      noteItems.slice().sort(function (a, b) {
        return (b.classList.contains('is-active') - a.classList.contains('is-active')) || (a.getAttribute('data-order') - b.getAttribute('data-order'));
      }).forEach(function (li) { notes.appendChild(li); });

      var msg = 'The plan that fits best is at the top of the list below.';
      if (time && want) {
        var chosen = planItems.filter(function (li) { return li.getAttribute('data-plan') === time; })[0];
        if (chosen && (chosen.getAttribute('data-tags') || '').split(' ').indexOf(want) === -1) {
          var others = planItems.filter(function (li) { return (li.getAttribute('data-tags') || '').split(' ').indexOf(want) !== -1; })
            .map(function (li) { return li.querySelector('h3').textContent; });
          msg = 'Your time fits the plan at the top. For ' + WANT_TEXT[want] + ', try the ' + others.join(' or ') + ' plan.';
        }
      }
      if (who && who !== 'adults') msg += ' A note for your group is highlighted under the plans.';
      planResult.textContent = msg;
    });
  }

  /* ---------- 3. Trail chooser ---------- */
  // Miles are for one visit. The Timpoochee Trail is a long regional path, so the chooser
  // sizes an out-and-back stretch to the time picked. The Shortcut Trail is a connector only.
  var TRAILS = {
    'dune':       { miles: 1.0,  modes: ['walk'], note: '1-mile loop' },
    'lakeloop':   { miles: 0.7,  modes: ['walk'], note: '0.7-mile loop' },
    'flatwoods':  { miles: 4.0,  modes: ['walk', 'bike'], note: '4 miles' },
    'shortcut':   { miles: 0.35, modes: ['walk'], connector: true },
    'timpoochee': { miles: 4,    modes: ['walk', 'bike'], paved: true, flex: [2, 37] }
  };
  var SPEED = { walk: 2, bike: 6 };        // miles an hour on sand and unpaved trail: our estimate
  var PAVED = { walk: 3, bike: 10 };       // miles an hour on the paved path: our estimate
  var BANDS = { short: [0, 1], mid: [1, 3], long: [2, 8] }; // hours
  var FLEX_CAP = { walk: 8, bike: 37 }; // longest out-and-back we suggest on the paved path, in miles

  var chooser = document.querySelector('[data-pw-chooser]');
  var list = document.querySelector('[data-pw-trails]');
  if (chooser && list) {
    chooser.hidden = false;
    var items = Array.prototype.slice.call(list.children);
    items.forEach(function (li, i) { li.setAttribute('data-order', i); });
    var result = chooser.querySelector('.pw-chooser-result');
    var val = function (name) { var c = chooser.querySelector('input[name="' + name + '"]:checked'); return c ? c.value : null; };
    var hoursText = function (h) {
      if (h < 1) return 'about ' + Math.max(15, Math.round(h * 60 / 5) * 5) + ' minutes';
      var r = Math.round(h * 2) / 2;
      return 'about ' + r + (r === 1 ? ' hour' : ' hours');
    };

    chooser.addEventListener('change', function () {
      var time = val('pw-time'), mode = val('pw-mode');
      if (!time && !mode) return;
      var m = mode || 'walk';
      var scored = items.map(function (li) {
        var t = TRAILS[li.getAttribute('data-trail')];
        var score = 0, reasons = [], ok = !t.connector;
        if (mode) {
          if (t.modes.indexOf(mode) === -1) { ok = false; }
          else { score += 2; if (mode === 'bike') reasons.push('open to bikes'); }
        }
        var speed = (t.paved ? PAVED : SPEED)[m];
        var miles = t.miles;
        if (time && t.flex) {
          var band = BANDS[time];
          miles = Math.min(Math.max(band[1] * speed * 0.8, t.flex[0]), t.flex[1], FLEX_CAP[m]);
          reasons.push((m === 'bike' ? 'ride' : 'walk') + ' about ' + Math.round(miles) + ' miles out and back');
        }
        var hours = miles / speed;
        if (time) {
          var b = BANDS[time];
          if (hours >= b[0] * 0.75 && hours <= b[1] * 1.15) { score += 2; reasons.push(hoursText(hours) + (m === 'bike' ? ' by bike' : ' on foot')); }
          else { score -= 1; }
        }
        return { li: li, score: ok ? score : -99, reasons: reasons, ok: ok };
      });
      scored.sort(function (a, b) { return (b.score - a.score) || (a.li.getAttribute('data-order') - b.li.getAttribute('data-order')); });
      var best = scored[0].score;
      var matches = 0;
      scored.forEach(function (s) {
        list.appendChild(s.li);
        var tag = s.li.querySelector('.pw-trail-match');
        var isMatch = s.ok && s.score >= Math.max(1, best - 1);
        s.li.classList.toggle('is-match', isMatch);
        s.li.classList.toggle('is-dim', !isMatch);
        if (isMatch) { matches++; tag.hidden = false; tag.textContent = 'Good fit: ' + s.reasons.join(', ') + '.'; }
        else { tag.hidden = true; tag.textContent = ''; }
      });
      result.textContent = matches
        ? (matches === 1 ? '1 trail fits best. It is at the top of the list below.' : matches + ' trails fit best. They are at the top of the list below.')
        : 'No trail fits every answer. Try a different time or way of getting around.';
    });
  }

  /* ---------- 4. Habitat dots ---------- */
  var habitat = document.querySelector('[data-pw-habitat]');
  var zones = document.querySelector('.pw-zones');
  if (habitat && zones) {
    var dots = habitat.querySelectorAll('.pw-dot');
    each(dots, function (dot) {
      dot.setAttribute('aria-pressed', 'false');
      dot.setAttribute('aria-controls', 'zone-' + dot.getAttribute('data-zone'));
      dot.addEventListener('click', function () {
        var z = dot.getAttribute('data-zone');
        each(dots, function (d) { d.classList.toggle('is-active', d === dot); d.setAttribute('aria-pressed', d === dot ? 'true' : 'false'); });
        each(zones.children, function (li) { li.classList.toggle('is-active', li.getAttribute('data-zone') === z); });
      });
    });
  }

  /* ---------- 5. Checklist ---------- */
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
