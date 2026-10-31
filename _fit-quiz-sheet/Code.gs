/**
 * 30A Digital Marketing: fit quiz receiver (Google Apps Script)
 *
 * What it does
 *   - Receives finished quizzes from https://30adigitalmarketing.com/fit-quiz/ and adds one row
 *     per quiz to the "Responses" tab of this Google Sheet. These rows are anonymous.
 *   - When a visitor asks for their result by email, adds a row to the "Leads" tab, emails them
 *     their result from your Google account, and sends you a short note.
 *
 * How to install it: see README.md in the same folder of the website repository.
 * This file is NOT part of the public website (folders starting with "_" are not published).
 *
 * After changing this code: Deploy > Manage deployments > pencil icon > Version: "New version" > Deploy.
 * That keeps the same web address, so the website doesn't need changing.
 */

// ---------- Settings you can change ----------
var NOTIFY_EMAIL = 'hello@30adigitalmarketing.com'; // gets a short note for each new email request
var SITE = 'https://30adigitalmarketing.com';
var SENDER_NAME = '30A Digital Marketing';
var MAX_RESPONSES_PER_MINUTE = 60; // protects the sheet if someone floods the form
var MAX_EMAILS_PER_HOUR = 30;      // protects your Gmail sending limit

// Keep these in step with OFFERS and SERVICES in assets/js/site.js ("Fit quiz").
var OFFERS = {
  compass:    { name: 'Compass (DIY SEO workflow)', price: '$5,000 setup, then $500 a month', path: '/plans/diy-seo/' },
  lantern:    { name: 'Lantern', price: '$4,000 a month', path: '/plans/' },
  beacon:     { name: 'Beacon', price: '$7,000 a month', path: '/plans/' },
  lighthouse: { name: 'Lighthouse', price: '$10,000 a month', path: '/plans/' },
  buildout:   { name: 'Website Buildout', price: '$10,000 one time', path: '/plans/website-buildout/' }
};
var SERVICES = {
  'seo':                  { name: 'Search Strategy & SEO', path: '/services/seo/' },
  'ai-search-visibility': { name: 'AI Search Visibility', path: '/services/ai-search-visibility/' },
  'digital-authority':    { name: 'Digital Authority & Reputation', path: '/services/digital-authority/' },
  'brand-strategy':       { name: 'Brand Strategy & Analysis', path: '/services/brand-strategy/' },
  'content':              { name: 'Content & Sales Assets', path: '/services/content/' },
  'ai-systems':           { name: 'AI Systems for Business', path: '/services/ai-systems/' }
};

var RESPONSE_HEADERS = [
  'Time', 'Quiz ID', 'Industry', 'Markets', 'Revenue', 'Team size', 'Goals', 'Website', 'How customers buy',
  'Who does marketing', 'Social media', 'Paid ads', 'Competition', 'Involvement', 'Monthly budget', 'Timing',
  'Best fit', 'Runner-up', 'Runner-up type', 'Services',
  'Score: Compass', 'Score: Lantern', 'Score: Beacon', 'Score: Lighthouse', 'Score: Buildout',
  'First page visited', 'Referring site', 'UTM source', 'UTM medium', 'UTM campaign', 'Device'
];
var LEAD_HEADERS = [
  'Time', 'Quiz ID', 'Email', 'Website', 'OK to follow up', 'Best fit', 'Runner-up', 'Services',
  'Industry', 'Markets', 'Monthly budget'
];

// ---------- Run this once from the editor (Run > setup) to create the tabs and grant permission ----------
function setup() {
  sheet_('Responses', RESPONSE_HEADERS);
  sheet_('Leads', LEAD_HEADERS);
  Logger.log('Tabs are ready. Next: Deploy > New deployment > Web app.');
}

// Visiting the web address in a browser shows this, which is a quick way to check the deployment works.
function doGet() {
  return ContentService.createTextOutput('The 30A fit quiz receiver is running.');
}

function doPost(e) {
  var data;
  try { data = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad' }); }
  if (!data || data.v !== 1 || !key_(data.sid)) return out_({ ok: false, error: 'bad' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return out_({ ok: false, error: 'busy' });
  try {
    if (data.type === 'response') return out_(saveResponse_(data));
    if (data.type === 'lead') return out_(saveLead_(data));
    return out_({ ok: false, error: 'bad' });
  } catch (err) {
    console.error(err);
    return out_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}

function saveResponse_(d) {
  if (!underLimit_('responses-minute', MAX_RESPONSES_PER_MINUTE, 60)) return { ok: false, error: 'limit' };
  var a = d.answers || {}, r = d.result || {}, s = r.scores || {}, c = d.context || {};
  sheet_('Responses', RESPONSE_HEADERS).appendRow([
    new Date(), key_(d.sid),
    key_(a.industry), keys_(a.markets), key_(a.revenue), key_(a.team), keys_(a.goals), key_(a.website), key_(a.buy),
    keys_(a.marketing), key_(a.social), key_(a.ads), key_(a.competition), key_(a.involve), key_(a.budget), key_(a.timing),
    key_(r.best), key_(r.runner), key_(r.runner_mode), keys_(r.services),
    num_(s.compass), num_(s.lantern), num_(s.beacon), num_(s.lighthouse), num_(s.buildout),
    text_(c.landing, 120), text_(c.referrer, 120), text_(c.utm_source, 120), text_(c.utm_medium, 120),
    text_(c.utm_campaign, 120), key_(c.device)
  ]);
  return { ok: true };
}

function saveLead_(d) {
  var email = String(d.email || '').trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'email' };
  var r = d.result || {}, a = d.answers || {};
  var best = OFFERS[key_(r.best)], runner = OFFERS[key_(r.runner)];
  if (!best) return { ok: false, error: 'bad' };

  var cache = CacheService.getScriptCache();
  var emailKey = 'sent-' + Utilities.base64EncodeWebSafe(email).slice(0, 200);
  if (cache.get(emailKey)) return { ok: false, error: 'limit' };
  if (!underLimit_('emails-hour', MAX_EMAILS_PER_HOUR, 3600)) return { ok: false, error: 'limit' };
  if (MailApp.getRemainingDailyQuota() < 2) return { ok: false, error: 'limit' };

  var services = (Array.isArray(r.services) ? r.services : []).map(key_).filter(function (k) { return SERVICES[k]; });
  var followup = d.followup === true;
  var website = text_(d.website, 200);

  sheet_('Leads', LEAD_HEADERS).appendRow([
    new Date(), key_(d.sid), text_(email, 120), website, followup ? 'Yes' : 'No',
    key_(r.best), key_(r.runner), services.join(', '), key_(a.industry), keys_(a.markets), key_(a.budget)
  ]);

  sendResult_(email, best, runner, key_(r.runner_mode), services);
  cache.put(emailKey, '1', 600);

  MailApp.sendEmail(NOTIFY_EMAIL, 'Fit quiz: ' + email + ' (' + best.name + ')',
    'Someone asked for their fit quiz result by email.\n\n' +
    'Email: ' + email + '\n' +
    'Website: ' + (website || '(not given)') + '\n' +
    'OK to follow up: ' + (followup ? 'Yes' : 'No, only send the result') + '\n' +
    'Best fit: ' + best.name + '\n' +
    'Runner-up: ' + (runner ? runner.name : '') + '\n' +
    'Services: ' + services.map(function (k) { return SERVICES[k].name; }).join(', ') + '\n' +
    'Industry: ' + key_(a.industry) + '\n' +
    'Budget: ' + key_(a.budget) + '\n\n' +
    'Full answers are in the Responses tab, under Quiz ID ' + key_(d.sid) + '.');
  return { ok: true };
}

function sendResult_(to, best, runner, runnerMode, services) {
  var runnerLabel = runnerMode === 'pair' ? 'Pairs well with it' : runnerMode === 'after' ? 'Then, or at the same time' : 'Runner-up';
  var svcText = services.map(function (k) { return '- ' + SERVICES[k].name + ': ' + SITE + SERVICES[k].path; }).join('\n');
  var svcHtml = services.map(function (k) {
    return '<li><a href="' + SITE + SERVICES[k].path + '" style="color:#1D3035">' + esc_(SERVICES[k].name) + '</a></li>';
  }).join('');

  var body =
    'Thanks for taking the 30A Digital Marketing fit quiz. Here is your result.\n\n' +
    'Best fit: ' + best.name + ' (' + best.price + ')\n' + SITE + best.path + '\n\n' +
    (runner ? runnerLabel + ': ' + runner.name + ' (' + runner.price + ')\n' + SITE + runner.path + '\n\n' : '') +
    'Services that fit you:\n' + svcText + '\n\n' +
    'Next step: book a free strategy call. Thirty minutes, with an audit of how your business shows up in search today.\n' +
    SITE + '/strategy-call/\n\n' +
    'This result is a starting point, not a quote. Every monthly plan is scoped after a full audit, and search strategies usually take six months or more to mature.\n\n' +
    '30A Digital Marketing\n' + SITE;

  var html =
    '<div style="font-family:Helvetica,Arial,sans-serif;color:#1D3035;max-width:560px;line-height:1.6">' +
      '<p style="font-size:12px;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px">Your fit quiz result</p>' +
      '<h1 style="font-family:Georgia,serif;font-weight:400;font-size:30px;margin:0 0 16px">Your best fit is ' + esc_(best.name) + '</h1>' +
      '<p style="margin:0 0 4px"><strong>' + esc_(best.name) + '</strong>, ' + esc_(best.price) + '</p>' +
      '<p style="margin:0 0 20px"><a href="' + SITE + best.path + '" style="color:#1D3035">See ' + esc_(best.name) + '</a></p>' +
      (runner ? '<p style="margin:0 0 4px">' + esc_(runnerLabel) + ': <strong>' + esc_(runner.name) + '</strong>, ' + esc_(runner.price) + '</p>' +
        '<p style="margin:0 0 20px"><a href="' + SITE + runner.path + '" style="color:#1D3035">See ' + esc_(runner.name) + '</a></p>' : '') +
      '<p style="margin:0 0 4px"><strong>Services that fit you</strong></p><ul style="margin:0 0 24px;padding-left:20px">' + svcHtml + '</ul>' +
      '<p style="margin:0 0 16px"><strong>Next step:</strong> book a free strategy call. Thirty minutes, with an audit of how your business shows up in search today.</p>' +
      '<p style="margin:0 0 28px"><a href="' + SITE + '/strategy-call/" style="display:inline-block;background:#1D3035;color:#F4F0E7;padding:14px 24px;text-decoration:none;font-size:12px;letter-spacing:2px;text-transform:uppercase">Book a Strategy Call</a></p>' +
      '<p style="margin:0 0 8px;font-size:13px;color:#44565A">This result is a starting point, not a quote. Every monthly plan is scoped after a full audit, and search strategies usually take six months or more to mature.</p>' +
      '<p style="margin:0;font-size:13px;color:#44565A">30A Digital Marketing &middot; <a href="' + SITE + '" style="color:#44565A">30adigitalmarketing.com</a></p>' +
    '</div>';

  MailApp.sendEmail({
    to: to,
    subject: 'Your fit quiz result: ' + best.name,
    body: body,
    htmlBody: html,
    name: SENDER_NAME,
    replyTo: NOTIFY_EMAIL
  });
}

// ---------- Helpers ----------
function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sh;
}
function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
// Answer codes from the quiz are short lowercase words like "4k-7k". Anything else is dropped.
function key_(v) {
  v = String(v == null ? '' : v);
  return /^[a-z0-9-]{1,40}$/.test(v) ? v : '';
}
function keys_(list) {
  return (Array.isArray(list) ? list : []).slice(0, 12).map(key_).filter(String).join(', ');
}
function num_(v) {
  var n = Number(v);
  return isFinite(n) ? Math.max(-99, Math.min(99, Math.round(n))) : '';
}
// Free text: trimmed, no control characters, and never treated as a spreadsheet formula.
function text_(v, max) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function esc_(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}
function underLimit_(name, max, seconds) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get(name) || 0);
  if (n >= max) return false;
  cache.put(name, String(n + 1), seconds);
  return true;
}
