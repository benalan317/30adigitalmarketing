/* Point Washington visitor guide (/insights/point-washington-wildlife-management-area/)
   Loaded only on that page (front matter: page_script: "point-washington").
   Every word the reader needs is in the page HTML; this file only adds:
   1. Map: loads a Google Maps embed when the reader asks, and switches trailheads.
   2. Trail chooser: moves matching trails to the top with a one-line reason.
   3. Habitat dots: highlight one habitat in the list below the drawing.
   4. Checklists: remember ticks in this browser, print, and clear. */
(function () {
  'use strict';

  /* ---------- 1. Map ---------- */
  var map = document.querySelector('[data-pw-map]');
  if (map) {
    var frame = map.querySelector('.pw-map-frame');
    var tabs = map.querySelectorAll('.pw-map-tabs button');
    var current = tabs.length ? tabs[0].getAttribute('data-q') : 'Point Washington State Forest';
    var iframe = null;
    var src = function (q) { return 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&z=13&output=embed'; };
    var openMap = function () {
      if (iframe) return;
      iframe = document.createElement('iframe');
      iframe.title = 'Google map of Point Washington State Forest trailheads';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.src = src(current);
      frame.innerHTML = '';
      frame.appendChild(iframe);
    };
    var openBtn = map.querySelector('[data-pw-map-open]');
    if (openBtn) openBtn.addEventListener('click', openMap);
    Array.prototype.forEach.call(tabs, function (b) {
      b.setAttribute('aria-pressed', b.classList.contains('is-active') ? 'true' : 'false');
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(tabs, function (t) { t.classList.remove('is-active'); t.setAttribute('aria-pressed', 'false'); });
        b.classList.add('is-active');
        b.setAttribute('aria-pressed', 'true');
        current = b.getAttribute('data-q');
        if (iframe) { iframe.src = src(current); } else { openMap(); }
      });
    });
  }

  /* ---------- 2. Trail chooser ---------- */
  // Miles are for one visit: there-and-back for the 30A Trail, a loop for the others,
  // and one out-and-back stretch (or the full 8 miles one way) for the Greenway.
  var TRAILS = {
    '30a':      { miles: 1.5, modes: ['walk', 'bike'], who: ['kids', 'dog', 'solo'], note: '1.5 miles there and back' },
    'el-short': { miles: 3.5, modes: ['walk', 'bike'], who: ['kids', 'dog', 'birds', 'solo'], note: '3.5-mile loop' },
    'el-mid':   { miles: 6,   modes: ['walk', 'bike'], who: ['dog', 'birds', 'solo'], note: '6-mile loop' },
    'el-full':  { miles: 11,  modes: ['walk', 'bike'], who: ['dog', 'solo'], note: '11-mile loop' },
    'greenway': { miles: 5,   modes: ['walk', 'bike'], who: ['dog', 'solo', 'birds'], note: 'one stretch out and back, about 4.5 to 6.5 miles', flex: [4.5, 16] },
    'mcquage':  { miles: 4,   modes: ['horse', 'walk', 'bike'], who: ['dog', 'solo'], note: '3- or 5-mile loop', flex: [3, 5] }
  };
  var SPEED = { walk: 2, bike: 6, horse: 3 }; // miles an hour on sand: our estimate
  var BANDS = { short: [0, 1], mid: [1, 3], long: [3, 99] }; // hours
  var WHO_TEXT = { kids: 'good for kids', dog: 'leashed dogs welcome', birds: 'good birding', solo: 'fits a solo outing' };

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

    var update = function () {
      var time = val('pw-time'), mode = val('pw-mode'), who = val('pw-who');
      if (!time && !mode && !who) return;
      var scored = items.map(function (li) {
        var t = TRAILS[li.getAttribute('data-trail')];
        var score = 0, reasons = [], ok = true;
        var m = mode || 'walk';
        if (mode) {
          if (t.modes.indexOf(mode) === -1) { ok = false; }
          else { score += 2; if (mode !== 'walk') reasons.push(mode === 'horse' ? 'open to horses' : 'open to bikes'); }
          if (mode === 'horse' && t.modes.indexOf('horse') !== -1) score += 2;
        }
        var miles = t.miles;
        if (time && t.flex) {
          var band = BANDS[time];
          var fit = Math.min(Math.max(band[1] * SPEED[m] * 0.8, t.flex[0]), t.flex[1]);
          miles = fit;
        }
        var hours = miles / SPEED[m];
        if (time) {
          var b = BANDS[time];
          if (hours >= b[0] * 0.75 && hours <= b[1] * 1.15) { score += 2; reasons.push(hoursText(hours) + ' ' + (m === 'bike' ? 'by bike' : (m === 'horse' ? 'on horseback' : 'on foot'))); }
          else { score -= 1; }
        }
        if (who) {
          if (t.who.indexOf(who) !== -1) { score += 1; reasons.push(WHO_TEXT[who]); }
          else if (who === 'kids') { score -= 1; }
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
        if (isMatch) {
          matches++;
          tag.hidden = false;
          tag.textContent = 'Good fit: ' + s.reasons.join(', ') + '.';
        } else {
          tag.hidden = true;
          tag.textContent = '';
        }
      });
      result.textContent = matches
        ? (matches === 1 ? '1 trail fits best. It is at the top of the list below.' : matches + ' trails fit best. They are at the top of the list below.')
        : 'No trail fits every answer. Try a different time or way of getting around.';
    };
    chooser.addEventListener('change', update);
  }

  /* ---------- 3. Habitat dots ---------- */
  var habitat = document.querySelector('[data-pw-habitat]');
  var zones = document.querySelector('.pw-zones');
  if (habitat && zones) {
    var dots = habitat.querySelectorAll('.pw-dot');
    Array.prototype.forEach.call(dots, function (dot) {
      dot.setAttribute('aria-pressed', 'false');
      dot.setAttribute('aria-controls', 'zone-' + dot.getAttribute('data-zone'));
      dot.addEventListener('click', function () {
        var z = dot.getAttribute('data-zone');
        Array.prototype.forEach.call(dots, function (d) { d.classList.toggle('is-active', d === dot); d.setAttribute('aria-pressed', d === dot ? 'true' : 'false'); });
        Array.prototype.forEach.call(zones.children, function (li) { li.classList.toggle('is-active', li.getAttribute('data-zone') === z); });
      });
    });
  }

  /* ---------- 4. Checklists ---------- */
  var store = {
    get: function (k) { try { return JSON.parse(window.localStorage.getItem(k) || '[]'); } catch (e) { return []; } },
    set: function (k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage off: checks just won't be remembered */ } }
  };
  Array.prototype.forEach.call(document.querySelectorAll('[data-pw-checklist]'), function (box) {
    var key = 'pw-checklist-' + box.getAttribute('data-pw-checklist');
    var inputs = box.querySelectorAll('input[type="checkbox"]');
    var saved = store.get(key);
    Array.prototype.forEach.call(inputs, function (input, i) {
      input.checked = saved.indexOf(i) !== -1;
      input.addEventListener('change', function () {
        var on = [];
        Array.prototype.forEach.call(inputs, function (x, j) { if (x.checked) on.push(j); });
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
        Array.prototype.forEach.call(inputs, function (x) { x.checked = false; });
        store.set(key, []);
      });
    }
  });
})();
