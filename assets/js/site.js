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

// Where this visit started (every page). Kept in this browser tab only (sessionStorage), and sent only if the
// visitor finishes the fit quiz while saving is switched on: the first page they landed on, the site that sent
// them (its domain only) and any campaign tags (utm_...) in that first address. No names, no IP addresses.
(function () {
  try {
    var KEY = 'fa-visit';
    if (window.sessionStorage.getItem(KEY)) return;
    var ref = '';
    if (document.referrer) {
      var r = new URL(document.referrer);
      if (r.host !== window.location.host) ref = r.host;
    }
    var q = new URLSearchParams(window.location.search);
    var cut = function (v) { return (v || '').slice(0, 120); };
    window.sessionStorage.setItem(KEY, JSON.stringify({
      landing: cut(window.location.pathname),
      referrer: cut(ref),
      utm_source: cut(q.get('utm_source')),
      utm_medium: cut(q.get('utm_medium')),
      utm_campaign: cut(q.get('utm_campaign'))
    }));
  } catch (e) { /* storage blocked: nothing to record */ }
})();

// Fit quiz (/fit-quiz/): one question per screen, scoring, and the result.
// Every question and answer is plain HTML on the page; this script only adds the steps and builds the result.
// Answers are remembered in this browser (localStorage), so a visitor can come back to their result.
// If the form has a data-endpoint (set by fit_quiz_endpoint in _config.yml), a finished quiz is saved
// anonymously to the Google Sheet, and the visitor can ask for their result by email. Without one, nothing is sent.
(function () {
  var form = document.getElementById('fit-quiz');
  if (!form) return;

  var resultEl = document.querySelector('[data-quiz-result]');
  var endpoint = (form.getAttribute('data-endpoint') || '').trim();
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var KEY = 'fa-fit-quiz';
  var VERSION = 1;

  // ---------- The offers and services the result can point to. Update prices here if they change. ----------
  var OFFERS = {
    compass: { name: 'Compass', price: '$5,000 setup, then $500 a month', url: '/plans/diy-seo/', img: '30a-plan-compass',
      line: 'A DIY SEO workflow we build around your brand, so you can run your own content with confidence.' },
    lantern: { name: 'Lantern', price: '$4,000 a month', url: '/plans/', img: '30a-plan-lantern',
      line: 'Our entry-level monthly plan: the foundations done right, so search engines and AI tools understand what you offer.' },
    beacon: { name: 'Beacon', price: '$7,000 a month', url: '/plans/', img: '30a-plan-beacon',
      line: 'The pace to compete: more content, off-site authority building, and visibility in AI answers as well as search.' },
    lighthouse: { name: 'Lighthouse', price: '$10,000 a month', url: '/plans/', img: '30a-plan-lighthouse',
      line: 'The full program across search, AI visibility, digital PR and reputation, for businesses that want to lead their market.' },
    buildout: { name: 'Website Buildout', price: '$10,000 one time', url: '/plans/website-buildout/', img: '30a-plan-website-buildout',
      line: 'A new or redesigned site built to bring in inquiries, with 10 optimized pages and your business accounts set up properly.' }
  };
  var OFFER_ORDER = ['compass', 'lantern', 'beacon', 'lighthouse', 'buildout'];
  var SERVICES = {
    'seo': { name: 'Search Strategy & SEO', url: '/services/seo/' },
    'ai-search-visibility': { name: 'AI Search Visibility', url: '/services/ai-search-visibility/' },
    'digital-authority': { name: 'Digital Authority & Reputation', url: '/services/digital-authority/' },
    'brand-strategy': { name: 'Brand Strategy & Analysis', url: '/services/brand-strategy/' },
    'content': { name: 'Content & Sales Assets', url: '/services/content/' },
    'ai-systems': { name: 'AI Systems for Business', url: '/services/ai-systems/' },
    'paid-advertising': { name: 'Paid Advertising', url: '/services/paid-advertising/' },
    'graphic-design-animation': { name: 'Graphic Design & Animation', url: '/services/graphic-design-animation/' }
  };
  var INDUSTRIES = {
    'vacation-rentals': 'vacation rentals and property management',
    'luxury-real-estate': 'luxury real estate and developers',
    'hotels-resorts': 'boutique hotels, inns and resorts',
    'wedding-venues': 'wedding and event venues',
    'golf-courses': 'golf courses and clubs',
    'family-entertainment': 'family entertainment and attractions',
    'lifestyle-brands': 'lifestyle and experience brands',
    'wellness-aesthetics': 'health, wellness and aesthetics',
    'professional-services': 'professional services',
    'home-services': 'home services and contractors'
  };
  var MARKETS = {
    '30a-south-walton': '30A and South Walton',
    'destin-miramar-beach': 'Destin and Miramar Beach',
    'panama-city-beach': 'Panama City Beach',
    'pensacola-perdido-key': 'Pensacola and Perdido Key',
    'gulf-shores-orange-beach': 'Gulf Shores and Orange Beach',
    'fort-walton-beach-navarre': 'Fort Walton Beach and Navarre',
    'forgotten-coast': 'the Forgotten Coast'
  };

  // ---------- Page parts ----------
  var steps = Array.prototype.slice.call(form.querySelectorAll('.quiz-step'));
  var startWrap = form.querySelector('[data-quiz-start-wrap]');
  var startBtn = form.querySelector('[data-quiz-start]');
  var resumeBtn = form.querySelector('[data-quiz-resume]');
  var progress = form.querySelector('[data-quiz-progress]');
  var backBtn = form.querySelector('[data-quiz-back]');
  var countEl = form.querySelector('[data-quiz-count]');
  var fillEl = form.querySelector('[data-quiz-fill]');
  var sunEl = form.querySelector('[data-quiz-sun]');
  var nav = form.querySelector('[data-quiz-nav]');
  var nextBtn = form.querySelector('[data-quiz-next]');
  var hintEl = form.querySelector('[data-quiz-hint]');
  var intro = form.querySelector('[data-quiz-intro]');
  var current = -1;
  var advanceTimer;
  var state = { v: VERSION, sid: newId(), answers: {}, step: -1, done: false, sent: false };

  function newId() {
    var a = new Uint8Array(8);
    try { window.crypto.getRandomValues(a); } catch (e) { for (var i = 0; i < 8; i++) a[i] = Math.floor(Math.random() * 256); }
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ }
  }
  function load() {
    try {
      var s = JSON.parse(window.localStorage.getItem(KEY) || 'null');
      if (s && s.v === VERSION && s.answers) return s;
    } catch (e) { /* ignore */ }
    return null;
  }

  // ---------- Reading and writing answers ----------
  function names(step) {
    var seen = {};
    return Array.prototype.slice.call(step.querySelectorAll('input')).map(function (i) { return i.name; })
      .filter(function (n) { if (seen[n]) return false; seen[n] = true; return true; });
  }
  function readAnswers() {
    var a = {};
    steps.forEach(function (step) {
      names(step).forEach(function (n) {
        var inputs = Array.prototype.slice.call(form.querySelectorAll('input[name="' + n + '"]'));
        if (inputs[0].type === 'checkbox') {
          a[n] = inputs.filter(function (i) { return i.checked; }).map(function (i) { return i.value; });
        } else {
          var c = inputs.filter(function (i) { return i.checked; })[0];
          a[n] = c ? c.value : '';
        }
      });
    });
    return a;
  }
  function writeAnswers(a) {
    Object.keys(a).forEach(function (n) {
      var v = a[n];
      Array.prototype.forEach.call(form.querySelectorAll('input[name="' + n + '"]'), function (i) {
        i.checked = Array.isArray(v) ? v.indexOf(i.value) > -1 : v === i.value;
      });
    });
    steps.forEach(applyLimits);
  }
  function stepDone(step) {
    var a = readAnswers();
    return names(step).every(function (n) {
      var v = a[n];
      return Array.isArray(v) ? v.length > 0 : !!v;
    });
  }

  // "Pick up to three" and "Nobody, really" (which clears the other choices).
  function applyLimits(step) {
    var max = Number(step.getAttribute('data-max') || 0);
    if (!max) return;
    var boxes = Array.prototype.slice.call(step.querySelectorAll('input[type="checkbox"]'));
    var count = boxes.filter(function (b) { return b.checked; }).length;
    boxes.forEach(function (b) {
      var off = count >= max && !b.checked;
      b.disabled = off;
      b.closest('.quiz-option').classList.toggle('is-off', off);
    });
    var msg = step.querySelector('[data-quiz-limit]');
    if (msg) msg.textContent = count >= max ? 'That’s three. Untick one to pick a different goal.' : '';
  }

  // ---------- Moving between questions ----------
  function show(i, opts) {
    opts = opts || {};
    window.clearTimeout(advanceTimer);
    current = i;
    state.step = i;
    save();
    intro.hidden = true;
    resultEl.hidden = true;
    progress.hidden = false;
    nav.hidden = false;
    steps.forEach(function (s, n) {
      var on = n === i;
      s.hidden = !on;
      s.classList.toggle('is-current', on);
      if (on && !reduceMotion) {
        s.classList.remove('is-entering', 'is-entering-back');
        void s.offsetWidth;
        s.classList.add(opts.back ? 'is-entering-back' : 'is-entering');
      }
    });
    var pct = Math.round((i / steps.length) * 100);
    fillEl.style.width = pct + '%';
    sunEl.style.left = pct + '%';
    countEl.textContent = 'Question ' + (i + 1) + ' of ' + steps.length;
    backBtn.textContent = i === 0 ? 'Intro' : 'Back';
    nextBtn.textContent = i === steps.length - 1 ? 'See my result' : 'Next';
    hintEl.textContent = '';
    syncNext();
    if (opts.focus !== false) {
      var q = steps[i].querySelector('.quiz-q');
      q.setAttribute('tabindex', '-1');
      q.focus({ preventScroll: true });
      var top = form.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.4) {
        form.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    }
  }
  function syncNext() {
    if (current < 0) return;
    var ok = stepDone(steps[current]);
    nextBtn.setAttribute('aria-disabled', ok ? 'false' : 'true');
    nextBtn.classList.toggle('is-ready', ok);
  }
  function next() {
    if (current < 0) return;
    if (!stepDone(steps[current])) {
      var kind = steps[current].getAttribute('data-kind');
      hintEl.textContent = kind === 'pair' ? 'Choose an answer in both lists to carry on.'
        : kind === 'multi' ? 'Choose at least one answer to carry on.' : 'Choose an answer to carry on.';
      return;
    }
    if (current < steps.length - 1) show(current + 1);
    else finish();
  }
  function back() {
    if (current > 0) show(current - 1, { back: true });
    else showIntro();
  }
  function showIntro() {
    window.clearTimeout(advanceTimer);
    current = -1;
    steps.forEach(function (s) { s.hidden = true; });
    progress.hidden = true;
    nav.hidden = true;
    resultEl.hidden = true;
    intro.hidden = false;
    var partial = steps.some(stepDone);
    startBtn.textContent = state.done ? 'Take it again' : partial ? 'Carry on where you left off' : 'Start the quiz';
    resumeBtn.hidden = !state.done && !partial;
    resumeBtn.textContent = state.done ? 'See my last result' : 'Start over';
    resumeBtn.setAttribute('data-mode', state.done ? 'result' : 'reset');
  }
  function firstOpen() {
    for (var i = 0; i < steps.length; i++) if (!stepDone(steps[i])) return i;
    return 0;
  }
  function reset() {
    form.reset();
    steps.forEach(applyLimits);
    state = { v: VERSION, sid: newId(), answers: {}, step: -1, done: false, sent: false };
    save();
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); next(); });
  nextBtn.addEventListener('click', next);
  backBtn.addEventListener('click', back);
  startBtn.addEventListener('click', function () {
    if (state.done) { reset(); show(0); } else show(firstOpen());
  });
  resumeBtn.addEventListener('click', function () {
    if (resumeBtn.getAttribute('data-mode') === 'result') finish({ revisit: true });
    else { reset(); show(0); }
  });

  form.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'INPUT') return;
    var step = t.closest('.quiz-step');
    if (t.type === 'checkbox' && t.checked) {
      var group = form.querySelectorAll('input[name="' + t.name + '"]');
      Array.prototype.forEach.call(group, function (o) {
        if (o === t) return;
        if (t.hasAttribute('data-exclusive') || o.hasAttribute('data-exclusive')) o.checked = false;
      });
    }
    if (step) applyLimits(step);
    state.answers = readAnswers();
    state.done = false;
    state.sent = false;
    save();
    syncNext();
    if (hintEl.textContent && stepDone(steps[current])) hintEl.textContent = '';
  });

  // A tap or click on a one-answer question moves on by itself. Keyboard users press Enter or Next,
  // so moving through the choices with the arrow keys never skips ahead.
  form.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'INPUT' || t.type !== 'radio' || e.detail === 0) return;
    var step = t.closest('.quiz-step');
    var kind = step && step.getAttribute('data-kind');
    if (step !== steps[current] || (kind !== 'single' && kind !== 'pair')) return;
    window.clearTimeout(advanceTimer);
    advanceTimer = window.setTimeout(function () {
      if (step === steps[current] && stepDone(step)) next();
    }, reduceMotion ? 150 : 420);
  });

  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); next(); }
  });

  // ---------- Scoring ----------
  // Each offer and service collects points from the answers. The reasons with the most points are shown to the visitor.
  function score(a) {
    var has = function (list, v) { return (list || []).indexOf(v) > -1; };
    var g = function (v) { return has(a.goals, v); };
    var mk = function (v) { return has(a.marketing, v); };
    var R = { 'u250k': 0, '250k-1m': 1, '1m-3m': 2, '3m-10m': 3, '10m-plus': 4 }[a.revenue];
    var T = { '1': 0, '2-10': 1, '11-50': 2, '51-200': 3, '200-plus': 4 }[a.team];
    var B = { 'u1k': 0, '1k-4k': 1, '4k-7k': 2, '7k-10k': 3, '10k-plus': 4 }[a.budget];
    var budgetGuessed = B === undefined;
    if (budgetGuessed) B = R !== undefined ? R : (T !== undefined ? Math.min(T, 3) : 2);
    var C = { low: 0, medium: 1, high: 2, unsure: 1 }[a.competition];
    if (C === undefined) C = 1;
    var markets = a.markets || [];
    var national = has(markets, 'national');
    var reach = markets.filter(function (m) { return m !== 'national'; }).length + (national ? 2 : 0);
    var nGoals = (a.goals || []).length;
    var hasSite = !!a.website && a.website !== 'none';
    var hasPeople = mk('owner') || mk('in-house') || mk('team');

    var O = {};
    OFFER_ORDER.forEach(function (k) { O[k] = { s: 0, why: [] }; });
    function add(k, pts, why) { O[k].s += pts; if (why && pts > 0) O[k].why.push({ p: pts, t: why }); }

    // Compass: DIY, smaller budgets, needs an existing website.
    if (a.involve === 'diy') add('compass', 5, 'You’d like to run your own SEO, with the right setup and guidance.');
    else if (a.involve === 'together') add('compass', 1);
    else if (a.involve === 'handoff') add('compass', -3);
    if (B === 0) add('compass', 4, 'After the setup, $500 a month fits a budget under $1,000.');
    else if (B === 1) add('compass', 3, 'After the setup, $500 a month sits comfortably inside your budget.');
    else if (B === 3) add('compass', -2);
    else if (B === 4) add('compass', -3);
    if (R === 0 || R === 1) add('compass', 1, 'It suits smaller businesses that win customers through content.');
    if (R !== undefined && R >= 3) add('compass', -1);
    if (hasPeople) add('compass', 1, 'You have someone who can review and publish content each week.');
    else add('compass', -1);
    if (!hasSite) add('compass', -8);
    if (C === 2) add('compass', -1);
    if (g('website')) add('compass', -1);
    if (!['google', 'leads', 'bookings', 'sales', 'ai'].some(g)) add('compass', -2); // Compass is a content and search tool

    // Lantern: entry-level monthly plan.
    if (B === 0) add('lantern', -2);
    else if (B === 1) add('lantern', 2, 'It’s our entry-level monthly plan, the closest step to your budget.');
    else if (B === 2) add('lantern', 5, 'Your budget matches Lantern at $4,000 a month.');
    else if (B === 3) add('lantern', 1);
    else if (B === 4) add('lantern', -1);
    if (a.involve === 'handoff') add('lantern', 2, 'You’d rather hand the work to experts and get regular reports.');
    else if (a.involve === 'together') add('lantern', 2, 'You want an expert to lead, with your team helping.');
    else if (a.involve === 'diy') add('lantern', -2);
    if (R === 1 || R === 2) add('lantern', 2, 'It’s built for newer and smaller businesses getting the foundations right.');
    else if (R === 4) add('lantern', -2);
    if (C <= 1) add('lantern', 1, 'In a market that isn’t too crowded, strong foundations go a long way.');
    else add('lantern', -1);
    if (reach <= 1) add('lantern', 1);
    if (nGoals <= 2) add('lantern', 1);

    // Beacon: ready to compete.
    if (B <= 1) add('beacon', -3);
    else if (B === 2) add('beacon', 1);
    else if (B === 3) add('beacon', 5, 'Your budget matches Beacon at $7,000 a month.');
    else if (B === 4) add('beacon', 2);
    if (R === 2 || R === 3) add('beacon', 2, 'Your size suits a business that’s ready to compete.');
    else if (R === 4) add('beacon', 1);
    else if (R === 0) add('beacon', -2);
    if (C === 1) add('beacon', 1, 'With several competitors in the mix, steady content and authority work can pull you ahead.');
    else if (C === 2) add('beacon', 2, 'A crowded market needs more content and some off-site authority building.');
    if (g('ai')) add('beacon', 1, 'Beacon adds visibility in AI answers as well as search results.');
    if (g('reputation')) add('beacon', 1);
    if (reach >= 2) add('beacon', 1, 'You want customers in more than one market.');
    if (nGoals >= 3) add('beacon', 1);
    if (a.involve === 'diy') add('beacon', -2);
    else if (a.involve) add('beacon', 1);
    if (T !== undefined && T >= 2) add('beacon', 1);

    // Lighthouse: lead the market.
    if (B <= 1) add('lighthouse', -4);
    else if (B === 2) add('lighthouse', -1);
    else if (B === 3) add('lighthouse', 2);
    else if (B === 4) add('lighthouse', 5, 'Your budget matches Lighthouse at $10,000 a month.');
    if (R === 4) add('lighthouse', 3, 'Businesses your size usually need the full program.');
    else if (R === 3) add('lighthouse', 2, 'Your revenue supports a faster pace and more strategy time.');
    else if (R !== undefined && R <= 1) add('lighthouse', -2);
    if (T !== undefined && T >= 3) add('lighthouse', 1);
    if (C === 2) add('lighthouse', 2, 'Leading a crowded market takes the full program, at a faster pace.');
    if (reach >= 3) add('lighthouse', 2, 'You want to win several markets at once.');
    else if (reach === 2) add('lighthouse', 1);
    if (nGoals >= 3) add('lighthouse', 1, 'You have several goals to work on at the same time.');
    if (g('reputation')) add('lighthouse', 1, 'Lighthouse includes digital PR and reputation work.');
    if (a.timing === 'now') add('lighthouse', 1);
    if (a.involve === 'diy') add('lighthouse', -3);

    // Website Buildout: no site or an outdated one, customers who call or ask for quotes.
    if (a.website === 'none') add('buildout', 7, 'You don’t have a website yet, and the buildout starts from scratch.');
    else if (a.website === 'outdated') add('buildout', 5, 'Your site is outdated or hard to update, and the buildout replaces it.');
    else if (a.website === 'underperforming') add('buildout', 2, 'A redesign built around inquiries can turn your site into a source of leads.');
    else if (a.website === 'strong') add('buildout', -5);
    if (g('website')) add('buildout', 4, 'A new or better website is one of your goals.');
    if (a.buy === 'quote') add('buildout', 3, 'Customers reach you by calling or asking for a quote, which is what the buildout is designed for.');
    else if (a.buy === 'visit' || a.buy === 'mix') add('buildout', 1);
    else if (a.buy === 'shop') add('buildout', -2);
    if (['home-services', 'professional-services', 'wellness-aesthetics', 'luxury-real-estate'].indexOf(a.industry) > -1) add('buildout', 1);
    if (R === 0 && B === 0) add('buildout', -1);

    // Ranking. Ties go to the earlier offer in this list.
    var TIE = ['lantern', 'beacon', 'compass', 'buildout', 'lighthouse'];
    var order = OFFER_ORDER.slice().sort(function (x, y) { return (O[y].s - O[x].s) || (TIE.indexOf(x) - TIE.indexOf(y)); });
    var best = order[0];
    var runner, runnerMode;
    if (best === 'buildout') { runner = order[1]; runnerMode = 'after'; }
    else if (O.buildout.s >= 6) { runner = 'buildout'; runnerMode = 'pair'; }
    else { runner = order[1]; runnerMode = 'alt'; }

    // Services.
    var S = {};
    Object.keys(SERVICES).forEach(function (k) { S[k] = { s: 0, why: [] }; });
    function sv(k, pts, why) { S[k].s += pts; if (why && pts > 0) S[k].why.push({ p: pts, t: why }); }

    sv('seo', 2, 'Every plan starts with search foundations: a site search engines can read and trust.');
    if (g('google')) sv('seo', 4, 'You want to rank higher on Google.');
    if (g('leads')) sv('seo', 2, 'More inquiries usually start with being found in search.');
    if (g('bookings')) sv('seo', 2, 'Direct bookings grow when guests find your own site, not only the booking platforms.');
    if (g('sales')) sv('seo', 2, 'Online sales depend on shoppers finding your products in search.');
    if (a.website === 'underperforming') sv('seo', 2, 'Your site looks fine but doesn’t bring in much, which is often a search problem.');
    if (C === 2) sv('seo', 1);
    if (best === 'buildout') sv('seo', 1);

    sv('ai-search-visibility', 1);
    if (g('ai')) sv('ai-search-visibility', 5, 'You want to show up in AI answers.');
    if (national) sv('ai-search-visibility', 1, 'Customers far away often research online before they ever visit.');
    if (['vacation-rentals', 'hotels-resorts', 'wedding-venues', 'luxury-real-estate', 'wellness-aesthetics', 'professional-services'].indexOf(a.industry) > -1) {
      sv('ai-search-visibility', 2, 'Customers in your industry compare options carefully, and AI answers are becoming part of that research.');
    }
    if (C === 2) sv('ai-search-visibility', 1);

    if (g('reputation')) sv('digital-authority', 5, 'You want more reviews and a stronger reputation.');
    if (C === 2) sv('digital-authority', 2, 'In a crowded market, reviews, mentions and links help you stand out.');
    else if (C === 1) sv('digital-authority', 1);
    if (['home-services', 'wellness-aesthetics', 'hotels-resorts', 'family-entertainment', 'golf-courses', 'wedding-venues'].indexOf(a.industry) > -1) {
      sv('digital-authority', 2, 'Reviews weigh heavily when customers choose a business like yours.');
    }
    if (g('google')) sv('digital-authority', 1);

    if (g('brand')) sv('brand-strategy', 5, 'You want a clearer brand and message.');
    if (a.website === 'none' || a.website === 'outdated' || g('website')) sv('brand-strategy', 1, 'A new website is a good moment to sharpen your message.');
    if (C === 2) sv('brand-strategy', 1, 'When competitors look alike, a clear position sets you apart.');

    if (g('leads')) sv('content', 1);
    if (g('sales')) sv('content', 1);
    if (g('ai')) sv('content', 1, 'AI tools quote clear, useful content, so content and AI visibility work together.');
    if (['professional-services', 'luxury-real-estate', 'wedding-venues', 'lifestyle-brands', 'vacation-rentals'].indexOf(a.industry) > -1) {
      sv('content', 2, 'Your customers read before they decide, so useful content and sales materials carry weight.');
    }
    if (a.social === 'regular' || a.social === 'engaged') sv('content', 2, 'You already post regularly, so new content can work across your site and social channels.');
    if (mk('in-house') || mk('team')) sv('content', 1, 'Your marketing team can put new content and sales materials to work.');
    if (best === 'compass') sv('content', -2);

    if (g('ai-ops')) sv('ai-systems', 6, 'You want to use AI to work smarter inside the business.');
    if (T !== undefined && T >= 2) sv('ai-systems', 1, 'With a larger team, AI that organizes company knowledge helps everyone answer faster.');
    if (T !== undefined && T >= 3) sv('ai-systems', 1);

    // Paid advertising (priced separately) and graphic design and animation (scoped per project).
    if (a.ads === 'ongoing') sv('paid-advertising', 4, 'You already run ads with a real budget, and careful tracking and testing can make that spend work harder.');
    else if (a.ads === 'small') sv('paid-advertising', 3, 'You run small campaigns now, and a clear setup with proper tracking can show what is worth scaling.');
    else if (a.ads === 'stopped') sv('paid-advertising', 3, 'You tried ads and stopped, and tracking set up properly shows what went wrong and what is worth another try.');
    if (g('leads')) sv('paid-advertising', 1, 'Ads can bring in inquiries while your search rankings build.');
    if (g('bookings')) sv('paid-advertising', 1, 'Ads can send guests straight to your own booking page.');
    if (g('sales')) sv('paid-advertising', 1, 'Ads can reach shoppers who are not searching for you yet.');
    if (['professional-services', 'luxury-real-estate', 'wellness-aesthetics', 'hotels-resorts', 'wedding-venues'].indexOf(a.industry) > -1) {
      sv('paid-advertising', 1, 'LinkedIn and Meta ads can reach affluent customers.');
    }

    if (g('brand')) sv('graphic-design-animation', 3, 'A clearer brand needs visuals that match it.');
    if (a.social === 'regular' || a.social === 'engaged') sv('graphic-design-animation', 2, 'You post regularly, so graphics and short animations help you stand out in the feed.');
    if (a.website === 'none' || a.website === 'outdated' || g('website')) sv('graphic-design-animation', 1, 'A new site needs strong graphics and visuals.');
    if (a.ads === 'ongoing' || a.ads === 'small') sv('graphic-design-animation', 1, 'Fresh ad creative gives your campaigns more to test.');

    var svcOrder = Object.keys(S).sort(function (x, y) { return S[y].s - S[x].s; });
    var services = svcOrder.filter(function (k) { return S[k].s >= 4; });
    if (services.length < 2) services = svcOrder.slice(0, 2);

    return {
      best: best, runner: runner, runnerMode: runnerMode, order: order, offers: O,
      services: services, svc: S, budgetGuessed: budgetGuessed, B: B, C: C, hasSite: hasSite
    };
  }

  function topWhy(list, n) {
    return list.slice().sort(function (x, y) { return y.p - x.p; }).slice(0, n).map(function (w) { return w.t; });
  }

  // ---------- The result ----------
  function render(a, r) {
    var best = OFFERS[r.best];
    var run = OFFERS[r.runner];
    var bestWhy = topWhy(r.offers[r.best].why, 3);
    if (!bestWhy.length) bestWhy = [best.line];
    var runWhy = topWhy(r.offers[r.runner].why, 1)[0];
    var runKicker = r.runnerMode === 'pair' ? 'Pairs well with it' : r.runnerMode === 'after' ? 'Then, or at the same time' : 'Runner-up';
    var runText = r.runnerMode === 'pair'
      ? 'Your website needs work too. The buildout can run alongside ' + best.name + ' or come first. ' + (runWhy || '')
      : r.runnerMode === 'after'
        ? 'Once your new site is live, ' + run.name + ' keeps it growing. ' + (runWhy || run.line)
        : (runWhy ? runWhy + ' ' : '') + run.line;

    var hi = Math.max.apply(null, OFFER_ORDER.map(function (k) { return r.offers[k].s; }));
    var lo = Math.min.apply(null, OFFER_ORDER.map(function (k) { return r.offers[k].s; }));
    var meter = r.order.map(function (k) {
      var s = r.offers[k].s;
      var w = Math.round(10 + 90 * (s - lo) / ((hi - lo) || 1));
      var label = k === r.best ? 'Best fit' : k === r.runner ? (r.runnerMode === 'alt' ? 'Runner-up' : 'Pairs well') : s >= 3 ? 'Possible' : 'Less likely';
      return '<li class="qr-meter-row' + (k === r.best ? ' is-best' : '') + '">' +
        '<a class="qr-meter-name" href="' + OFFERS[k].url + '">' + esc(OFFERS[k].name) + '</a>' +
        '<span class="qr-meter-track" aria-hidden="true"><span class="qr-meter-bar" data-w="' + w + '"></span></span>' +
        '<span class="qr-meter-label">' + label + '</span></li>';
    }).join('');

    var notes = [];
    if (r.budgetGuessed) notes.push('You weren’t sure about budget, so we used the size of your business as a guide.');
    if (r.B === 0 && r.best !== 'compass' && r.best !== 'buildout') notes.push('Our monthly plans start at $4,000 a month. If that’s more than you planned, <a href="/plans/diy-seo/">Compass</a> or the <a href="/free-audit/">free SEO audit</a> are good places to start.');
    if (r.best === 'compass' && r.C === 2) notes.push('In a very crowded market, DIY content alone may take longer to show results. A monthly plan adds authority work alongside it.');
    if (a.timing === 'research') notes.push('No rush. The free SEO audit and the ROI calculator are useful while you research.');
    notes.push('Search strategies usually take six months or more to mature, and every monthly plan is scoped after a full audit. Treat this as a starting point, not a quote.');

    var svcCards = r.services.map(function (k) {
      var s = r.svc[k];
      var why = topWhy(s.why, 1)[0] || 'It supports the rest of your plan.';
      return '<a class="path-card qr-svc" href="' + SERVICES[k].url + '">' +
        '<span class="path-card-kicker">' + (s.s >= 6 ? 'Strong fit' : 'Good fit') + '</span>' +
        '<span class="path-card-title">' + esc(SERVICES[k].name) + '</span>' +
        '<span class="path-card-text">' + esc(why) + '</span>' +
        '<span class="path-card-more">Read about it</span></a>';
    }).join('');

    var nextLinks = [];
    var ind = a.industry && a.industry !== 'other' ? a.industry : '';
    nextLinks.push('<li><a href="/roi-calculator/#' + (ind || 'other') + '">' +
      (r.best === 'compass' ? 'See what marketing needs to bring in to pay for itself' : 'See what ' + esc(best.name) + ' needs to bring in to pay for itself') +
      '</a><span>The ROI calculator, opened on your industry.</span></li>');
    if (r.hasSite) nextLinks.push('<li><a href="/free-audit/">Run a free SEO audit of your site</a><span>About an hour, with three free tools and one AI prompt.</span></li>');
    if (ind) nextLinks.push('<li><a href="/industries/' + ind + '/">How we work with ' + esc(INDUSTRIES[ind]) + '</a><span>What matters most in your industry.</span></li>');
    (a.markets || []).filter(function (m) { return MARKETS[m]; }).slice(0, 2).forEach(function (m) {
      nextLinks.push('<li><a href="/markets/' + m + '/">Marketing in ' + esc(MARKETS[m]) + '</a><span>How people search there, and what’s different.</span></li>');
    });

    var email = endpoint ? (
      '<form class="qr-email" data-qr-email novalidate>' +
        '<h3>Email me my result</h3>' +
        '<p>We’ll send this result to your inbox so you can share it or keep it for later.</p>' +
        '<div class="qr-email-fields">' +
          '<div class="qr-field"><label for="qr-email">Email address</label><input id="qr-email" name="email" type="email" autocomplete="email" required maxlength="120"></div>' +
          '<div class="qr-field"><label for="qr-site">Your website <span>(optional)</span></label><input id="qr-site" name="website" type="text" inputmode="url" autocomplete="url" maxlength="200" placeholder="yourbusiness.com"></div>' +
        '</div>' +
        '<label class="qr-check"><input type="checkbox" name="followup"> <span>You may contact me about a free strategy call</span></label>' +
        '<div class="qr-hp" aria-hidden="true"><label>Leave this empty <input type="text" name="company_fax" tabindex="-1" autocomplete="off"></label></div>' +
        '<button class="btn-solid" type="submit">Email my result</button>' +
        '<p class="qr-status" role="status" aria-live="polite"></p>' +
        '<p class="qr-small">We use your email to send this result and, only if you tick the box, to follow up. See our <a href="/privacy/">privacy policy</a>.</p>' +
      '</form>') : '';

    resultEl.innerHTML =
      '<div class="qr">' +
        '<header class="qr-head">' +
          '<span class="eyebrow">Your result</span>' +
          '<h2 id="qr-title" tabindex="-1">Your best fit is ' + esc(best.name) + '</h2>' +
          '<p class="qr-lede">' + esc(best.line) + '</p>' +
        '</header>' +
        '<div class="qr-picks">' +
          '<article class="qr-pick qr-pick-best" aria-labelledby="qr-best-name">' +
            '<img src="/images/plans/' + best.img + '-4x3-640.webp" width="640" height="480" alt="">' +
            '<div class="qr-pick-body">' +
              '<span class="qr-pick-kicker">Best fit</span>' +
              '<h3 id="qr-best-name">' + esc(best.name) + '</h3>' +
              '<span class="qr-pick-price">' + esc(best.price) + '</span>' +
              '<p class="qr-why-title">Why it fits</p>' +
              '<ul class="qr-why">' + bestWhy.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' +
              '<a class="btn-solid" href="' + best.url + '">See ' + esc(best.name) + '</a>' +
            '</div>' +
          '</article>' +
          '<article class="qr-pick qr-pick-runner" aria-labelledby="qr-run-name">' +
            '<img src="/images/plans/' + run.img + '-4x3-640.webp" width="640" height="480" alt="">' +
            '<div class="qr-pick-body">' +
              '<span class="qr-pick-kicker">' + runKicker + '</span>' +
              '<h3 id="qr-run-name">' + esc(run.name) + '</h3>' +
              '<span class="qr-pick-price">' + esc(run.price) + '</span>' +
              '<p>' + esc(runText) + '</p>' +
              '<a class="link-caps" href="' + run.url + '">See ' + esc(run.name) + '</a>' +
            '</div>' +
          '</article>' +
        '</div>' +
        '<section class="qr-meter" aria-labelledby="qr-meter-title">' +
          '<h3 id="qr-meter-title">How each offer fits you</h3>' +
          '<ol class="qr-meter-list">' + meter + '</ol>' +
        '</section>' +
        '<div class="qr-notes">' + notes.map(function (n) { return '<p>' + n + '</p>'; }).join('') + '</div>' +
        '<section class="qr-services" aria-labelledby="qr-svc-title">' +
          '<h3 id="qr-svc-title">Services that fit you</h3>' +
          '<p>Every monthly plan spreads its effort across the services that will do the most for you. These are the ones your answers point to.</p>' +
          '<div class="path-cards qr-svc-grid">' + svcCards + '</div>' +
        '</section>' +
        '<section class="qr-next" aria-labelledby="qr-next-title">' +
          '<h3 id="qr-next-title">Your next step</h3>' +
          '<div class="qr-call">' +
            '<p><strong>Book a free strategy call.</strong> Thirty minutes, with an audit of how your business shows up in search today. Mention your result, ' + esc(best.name) + ', and we’ll start from there.</p>' +
            '<a class="btn-solid" href="/strategy-call/">Book a Strategy Call</a>' +
          '</div>' +
          '<ul class="qr-links">' + nextLinks.join('') + '</ul>' +
        '</section>' +
        email +
        '<div class="qr-actions">' +
          '<button class="link-caps" type="button" data-qr-edit>Change my answers</button>' +
          '<button class="link-caps" type="button" data-qr-restart>Start over</button>' +
        '</div>' +
      '</div>';

    resultEl.querySelector('[data-qr-edit]').addEventListener('click', function () { show(0); });
    resultEl.querySelector('[data-qr-restart]').addEventListener('click', function () { reset(); show(0); });
    var emailForm = resultEl.querySelector('[data-qr-email]');
    if (emailForm) emailForm.addEventListener('submit', function (e) { e.preventDefault(); sendEmail(emailForm, a, r); });
  }

  function animateMeter() {
    var bars = resultEl.querySelectorAll('.qr-meter-bar');
    Array.prototype.forEach.call(bars, function (b) { b.style.width = reduceMotion ? b.getAttribute('data-w') + '%' : '0%'; });
    if (reduceMotion) return;
    window.requestAnimationFrame(function () {
      window.setTimeout(function () {
        Array.prototype.forEach.call(bars, function (b, i) {
          b.style.transitionDelay = (i * 90) + 'ms';
          b.style.width = b.getAttribute('data-w') + '%';
        });
      }, 120);
    });
  }

  function finish(opts) {
    opts = opts || {};
    window.clearTimeout(advanceTimer);
    var a = readAnswers();
    var r = score(a);
    state.answers = a;
    state.done = true;
    state.step = steps.length;
    current = -1;
    steps.forEach(function (s) { s.hidden = true; });
    progress.hidden = true;
    nav.hidden = true;
    intro.hidden = true;
    render(a, r);
    resultEl.hidden = false;
    animateMeter();
    var title = document.getElementById('qr-title');
    if (title) title.focus({ preventScroll: true });
    resultEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    if (!opts.revisit && !state.sent) {
      state.sent = sendResponse(a, r);
      if (typeof window.gtag === 'function') {
        try { window.gtag('event', 'fit_quiz_complete', { best_fit: r.best, runner_up: r.runner, industry: a.industry || '' }); } catch (e) { /* ignore */ }
      }
    }
    save();
  }

  // ---------- Saving to the Google Sheet (only when an endpoint is set) ----------
  function visit() {
    try { return JSON.parse(window.sessionStorage.getItem('fa-visit') || '{}') || {}; } catch (e) { return {}; }
  }
  function device() {
    var w = window.innerWidth || 1024;
    return w < 720 ? 'phone' : w < 1100 ? 'tablet' : 'desktop';
  }
  function scores(r) {
    var o = {};
    OFFER_ORDER.forEach(function (k) { o[k] = r.offers[k].s; });
    return o;
  }
  function post(payload) {
    return window.fetch(endpoint, { method: 'POST', body: JSON.stringify(payload), keepalive: true });
  }
  function sendResponse(a, r) {
    if (!endpoint || !window.fetch) return false;
    var v = visit();
    try {
      post({
        type: 'response', v: VERSION, sid: state.sid, answers: a,
        result: { best: r.best, runner: r.runner, runner_mode: r.runnerMode, services: r.services, scores: scores(r) },
        context: { landing: v.landing || '', referrer: v.referrer || '', utm_source: v.utm_source || '', utm_medium: v.utm_medium || '',
          utm_campaign: v.utm_campaign || '', device: device() }
      }).catch(function () { /* the visitor still sees their result */ });
      return true;
    } catch (e) { return false; }
  }
  function sendEmail(f, a, r) {
    var status = f.querySelector('.qr-status');
    var btn = f.querySelector('button[type="submit"]');
    var emailIn = f.querySelector('input[name="email"]');
    var email = emailIn.value.trim();
    if (f.querySelector('input[name="company_fax"]').value) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      status.textContent = 'Please check your email address.';
      emailIn.setAttribute('aria-invalid', 'true');
      emailIn.focus();
      return;
    }
    emailIn.removeAttribute('aria-invalid');
    btn.disabled = true;
    status.textContent = 'Sending…';
    post({
      type: 'lead', v: VERSION, sid: state.sid, email: email,
      website: f.querySelector('input[name="website"]').value.trim(),
      followup: f.querySelector('input[name="followup"]').checked,
      answers: { industry: a.industry, budget: a.budget, markets: a.markets },
      result: { best: r.best, runner: r.runner, runner_mode: r.runnerMode, services: r.services }
    }).then(function (res) { return res.json(); }).then(function (data) {
      if (data && data.ok) {
        status.textContent = 'Sent. Check your inbox in a few minutes, and your spam folder if it doesn’t arrive.';
        f.classList.add('is-sent');
      } else {
        btn.disabled = false;
        status.textContent = (data && data.error === 'limit')
          ? 'We’ve already sent a result to that address recently. Please try again later.'
          : 'Something went wrong. Please try again, or email hello@30adigitalmarketing.com.';
      }
    }).catch(function () {
      btn.disabled = false;
      status.textContent = 'We couldn’t confirm that it sent. If nothing arrives in a few minutes, email hello@30adigitalmarketing.com.';
    });
  }

  // ---------- Start ----------
  form.classList.add('is-enhanced');
  var saved = load();
  if (saved) {
    state = saved;
    if (!state.sid) state.sid = newId();
    writeAnswers(state.answers || {});
  }
  // Arriving from the homepage quiz starter (/fit-quiz/?industry=...): start a fresh quiz with the industry
  // already answered and open question 2. The address is then cleaned so a page refresh keeps their progress.
  var preset = '';
  try { preset = new URLSearchParams(window.location.search).get('industry') || ''; } catch (e) { /* old browser */ }
  var presetInput = null;
  Array.prototype.forEach.call(form.querySelectorAll('input[name="industry"]'), function (i) { if (i.value === preset) presetInput = i; });
  if (presetInput) {
    reset();
    presetInput.checked = true;
    state.answers = readAnswers();
    save();
    try { window.history.replaceState(null, '', window.location.pathname + window.location.hash); } catch (e) { /* ignore */ }
  }
  startWrap.hidden = false;
  showIntro();
  if (presetInput) show(1);
  else if (window.location.hash === '#quiz-result' && state.done) finish({ revisit: true });
})();

// Click and section tracking (Google Analytics). Any link or button with data-track="event_name" sends that event
// when clicked, with its data-loc (where on the page) and data-label (which one). A <details> with data-track sends
// its event when opened. Sections with data-track-view="name" send "view_name" once, the first time half of the section
// is on screen. Nothing is sent when Google Analytics is off (no gtag on the page).
(function () {
  function send(name, params) {
    if (typeof window.gtag !== 'function' || !name) return;
    params = params || {};
    params.transport_type = 'beacon';
    try { window.gtag('event', name, params); } catch (e) { /* ignore */ }
  }
  function info(el) {
    return { location: el.getAttribute('data-loc') || '', label: el.getAttribute('data-label') || '', page_path: window.location.pathname };
  }
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-track]') : null;
    if (!el || el.tagName === 'DETAILS') return;
    var p = info(el);
    if (el.getAttribute('href')) p.link_url = el.getAttribute('href');
    send(el.getAttribute('data-track'), p);
  });
  // "toggle" doesn't bubble, so listen during the capture phase.
  document.addEventListener('toggle', function (e) {
    var el = e.target;
    if (el && el.tagName === 'DETAILS' && el.open && el.hasAttribute('data-track')) send(el.getAttribute('data-track'), info(el));
  }, true);

  var views = document.querySelectorAll('[data-track-view]');
  if (!views.length || !('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var name = en.target.getAttribute('data-track-view');
      send('view_' + name.replace(/-/g, '_'), { section: name, page_path: window.location.pathname });
      io.unobserve(en.target);
    });
  }, { threshold: 0.5 });
  Array.prototype.forEach.call(views, function (v) { io.observe(v); });
})();

// Homepage industries and markets: turns the two lists into tabs. Without scripts both lists show, each with a label.
(function () {
  var strip = document.querySelector('[data-tabs]');
  if (!strip) return;
  var list = strip.querySelector('[role="tablist"]');
  var tabs = Array.prototype.slice.call(strip.querySelectorAll('[role="tab"]'));
  if (!list || tabs.length < 2) return;
  function select(i, focus) {
    tabs.forEach(function (t, n) {
      var on = n === i;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    if (focus) tabs[i].focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(i, false); });
    t.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = tabs.length - 1;
      if (n !== null) { e.preventDefault(); select(n, true); }
    });
  });
  strip.classList.add('is-tabbed');
  list.hidden = false;
  select(0, false);
})();
