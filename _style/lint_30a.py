#!/usr/bin/env python3
"""
lint_30a.py: lint 30A Digital Marketing page copy against the 30A style guide.

Reads the Jekyll site files directly (pages are index.md or index.html with
front matter), so there is no spreadsheet or cache step.

Usage:
    python3 lint_30a.py site  /path/to/repo            lint every page, print a summary
    python3 lint_30a.py page  /path/to/repo/about/index.md [--repo /path/to/repo]
    python3 lint_30a.py draft draft.md [--repo /path/to/repo]
        (a draft may contain front matter, or plain markdown with a first-line H1)

Options:
    --fails-only     hide REVIEW findings
    --rule NAME      show only one rule (for example OXFORD)
    --report FILE    also write the full findings as a markdown file (site mode)

Severity:
    FAIL    breaks a hard rule in the style guide. Fix before publishing.
    REVIEW  may be fine in context. A person decides.

Exit code is 1 when any FAIL exists, otherwise 0.
"""
import html
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

try:
    import yaml
except ImportError:  # the linter still works, with a simpler front matter reader
    yaml = None

TAGLINE = re.compile(r"be found\.?\s*(<br>\s*)?(<em>)?\s*be chosen", re.I)
EM_DASH = "—"
SKIP_DIRS = {".git", "_site", "assets", "images", "_fit-quiz-sheet", "node_modules"}

# --------------------------------------------------------------------- rules
# (regex, severity, note). Matched case-insensitively against prose.
PHRASES = [
    # Fluent list, kept as hard bans
    (r"it'?s recommended to", "FAIL", ""),
    (r"\bdesigned to\b", "FAIL", "Say what the work does, in active voice."),
    (r"keep in mind", "FAIL", ""),
    (r"it'?s important to (remember|note)", "FAIL", "State the fact directly."),
    (r"let'?s see|let us see", "FAIL", ""),
    (r"when it comes to", "FAIL", "Use 'for' or 'about', or restructure."),
    (r"\bthis article\b", "FAIL", ""),
    (r"fear not|don'?t fear", "FAIL", ""),
    (r"can help to", "FAIL", ""),
    (r"\bin today'?s\b", "FAIL", ""),
    (r"(^|[.!?]\s+)enter\b", "FAIL", "Do not open a sentence with 'Enter'."),
    (r"\bthe (result|reality|truth|catch|answer|problem)\?", "FAIL", "Rhetorical setup."),
    (r"but the real power comes from", "FAIL", ""),
    (r"the impact .{0,60} is profound", "FAIL", ""),
    (r"this transforms|ai transforms .{0,60} by", "FAIL", ""),
    (r"this isn'?t just about .{0,80} it'?s about", "FAIL", "False negative."),
    (r"it'?s not just .{0,80} it'?s", "FAIL", "False negative."),
    (r"it'?s not (about )?[^.]{1,80}, it'?s", "FAIL", "False negative: lead with what it is."),
    (r"\brevolutionary\b", "FAIL", ""),
    (r"\bthe future of\b", "FAIL", ""),
    (r"think of it as|picture a\b|imagine a\b", "FAIL", "Describe it concretely."),
    (r"here'?s the thing|(^|[.!?]\s+)but here'?s", "FAIL", "Throat-clearing."),
    (r"i'?ve seen (this|it) (play out|all the time|happen)|i see this constantly",
     "FAIL", "Fake-experience filler."),
    # From the Oct 31 site audit (audience: affluent, Southern, conservative)
    (r"\bambitious\b", "FAIL", "Audit voice rule."),
    (r"growth partner", "FAIL", "Audit voice rule."),
    (r"\bai[- ]era\b", "FAIL", "Audit voice rule."),
    (r"remote[- ]native", "FAIL", "Audit voice rule."),
    (r"\bsynergi[sz]e|\bsynergy\b", "FAIL", "Audit voice rule."),
    (r"\bcompounds?\b|\bcompounding\b", "FAIL", "Audit voice rule."),
    (r"is only the beginning", "FAIL", "Audit voice rule."),
    (r"starts at the solution", "FAIL", "Audit voice rule."),
    (r"\bwe (don'?t|do not|never) (do|offer|provide|run|produce) [^.]{0,40}"
     r"(video|photo|influencer)", "FAIL",
     "Never say what we do not offer. Stay silent (Oct 31 decision)."),
    # Decided as flags, not bans
    (r"\bconsider(ed|s|ing|ation)?\b", "REVIEW",
     "Fine to ask the reader to think something over. Not fine when the reader should make a choice."),
    (r"\btraditional(ly)?\b", "REVIEW", "Fine when it names a real thing, such as traditional media."),
    (r"\bshift(s|ed|ing)?\b", "REVIEW", "Fine when literal, such as an algorithm update."),
    (r"(^|[.!?]\s+)most\s", "REVIEW", "Sentence opens with 'Most'. Name who, or use a number."),
    # 30A-specific flags
    (r"\bguarantee[sd]?\b", "REVIEW", "No guarantees of rankings or AI mentions. Fine if it denies one."),
    (r"#\s?1\b|\bnumber one\b|\bbest (marketing )?agency\b|\baward[- ]winning\b", "REVIEW",
     "Competitor-style claim. Our tone is calm and evidence-led."),
    (r"\b(our|the) (local )?(office|headquarters|storefront)\b|\bvisit us\b|\bstop by\b"
     r"|\bour local team\b|\blocally owned\b|\bboots on the ground\b", "REVIEW",
     "We are remote. Never imply an office or a local presence."),
    (r"\bwebsite buildout\b(?<!Website Buildout)", "REVIEW",
     "Product name: capitalize as 'Website Buildout'."),
    (r"\b(lantern|beacon|lighthouse)\b(?= (plan|level|tier))", "REVIEW",
     "Plan names are capitalized: Lantern, Beacon, Lighthouse."),
]
# Rules that must match case-sensitively (the 'Website Buildout' and plan-name checks).
CASE_SENSITIVE = {r"\bwebsite buildout\b(?<!Website Buildout)",
                  r"\b(lantern|beacon|lighthouse)\b(?= (plan|level|tier))"}
PHRASE_RE = [(re.compile(p, 0 if p in CASE_SENSITIVE else re.I), sev, note, p)
             for p, sev, note in PHRASES]

STACCATO = re.compile(r"\b(no|more|higher|lower|less|fewer|better|faster) \w+, \1 \w+,? (and |or )?\1 \w+",
                      re.I)

# Title case (Chicago style): lowercase articles, coordinating conjunctions and all
# prepositions; capitalize everything else, plus the first and last word.
MINOR = {
    # articles
    "a", "an", "the",
    # coordinating conjunctions
    "and", "but", "or", "nor", "for", "so", "yet",
    # prepositions, any length (Chicago style), plus "as"
    "as", "at", "by", "in", "of", "off", "on", "per", "to", "up", "via", "vs",
    "about", "above", "across", "after", "against", "along", "among", "around",
    "before", "behind", "below", "beneath", "beside", "between", "beyond",
    "despite", "during", "except", "from", "inside", "into", "like", "near",
    "onto", "outside", "over", "past", "since", "through", "throughout",
    "toward", "towards", "under", "underneath", "until", "upon", "with",
    "within", "without",
}
SUBORDINATORS = {"if", "when", "after", "before", "because", "since", "while", "once",
                 "although", "though", "unless", "as", "whether", "for example",
                 "for instance", "in", "on", "at", "during", "with", "without"}

URL_RE = re.compile(r"\]\((/[^)\s]*)\)|href=\"(/[^\"#?]*)")


# ---------------------------------------------------------------- page loading
class Page:
    def __init__(self, path, rel, url, fm, body, brief, is_html):
        self.path, self.rel, self.url = path, rel, url
        self.fm, self.body, self.brief, self.is_html = fm, body, brief, is_html


def read_front_matter(text):
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n?", text, re.S)
    if not m:
        return {}, text
    raw, rest = m.group(1), text[m.end():]
    if yaml:
        try:
            return (yaml.safe_load(raw) or {}), rest
        except Exception:
            pass
    fm = {}
    for ln in raw.splitlines():
        k = re.match(r"^([A-Za-z_]+):\s*(.*)$", ln)
        if k:
            fm[k.group(1)] = k.group(2).strip().strip('"')
    return fm, rest


def page_url(rel, fm):
    if fm.get("permalink"):
        return str(fm["permalink"])
    p = rel.as_posix()
    if p in ("index.md", "index.html"):
        return "/"
    if p.endswith(("/index.md", "/index.html")):
        return "/" + p.rsplit("/", 1)[0] + "/"
    return "/" + re.sub(r"\.(md|html)$", "", p) + ("/" if not p.endswith("404.md") else ".html")


def load_page(path, repo=None):
    path = Path(path)
    text = path.read_text(encoding="utf-8", errors="ignore")
    fm, body = read_front_matter(text)
    try:
        rel = path.resolve().relative_to(Path(repo).resolve()) if repo else Path(path.name)
    except ValueError:  # a draft that lives outside the repo
        rel = Path(path.name)
    brief_m = re.search(r"\{%-?\s*comment\s*-?%\}(.*?)\{%-?\s*endcomment\s*-?%\}", body, re.S)
    brief = brief_m.group(1) if brief_m else ""
    return Page(path, rel, page_url(rel, fm), fm, body, brief, path.suffix == ".html")


def site_pages(repo):
    repo = Path(repo)
    pages = []
    for f in sorted(repo.rglob("*")):
        if f.suffix not in (".md", ".html") or f.name == "README.md":
            continue
        rel = f.relative_to(repo)
        if rel.parts[0] in SKIP_DIRS or rel.parts[0].startswith("_"):
            continue
        pg = load_page(f, repo)
        if pg.fm.get("placeholder") or pg.fm.get("sitemap") is False and pg.fm.get("placeholder"):
            continue
        pages.append(pg)
    return pages


def valid_urls(repo):
    urls = {"/"}
    for pg in site_pages(repo):
        urls.add(pg.url)
    urls.add("/404.html")
    return urls


# ---------------------------------------------------------------- text helpers
def clean_liquid(text):
    text = re.sub(r"\{%-?\s*comment\s*-?%\}.*?\{%-?\s*endcomment\s*-?%\}", "", text, flags=re.S)
    text = re.sub(r"\{%.*?%\}", "", text, flags=re.S)
    return re.sub(r"\{\{.*?\}\}", "X", text, flags=re.S)


def html_to_lines(text):
    """Turn an HTML body into markdown-like lines so one set of checks works."""
    text = re.sub(r"<(script|style)\b.*?</\1>", "", text, flags=re.S | re.I)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = re.sub(r"<h([1-6])\b[^>]*>(.*?)</h\1>",
                  lambda m: "\n" + "#" * int(m.group(1)) + " " + re.sub(r"<[^>]+>", "", m.group(2)) + "\n",
                  text, flags=re.S | re.I)
    text = re.sub(r"<(a)\b[^>]*href=\"([^\"]*)\"[^>]*>(.*?)</a>",
                  lambda m: "[" + re.sub(r"<[^>]+>", "", m.group(3)) + "](" + m.group(2) + ")",
                  text, flags=re.S | re.I)
    text = re.sub(r"</(p|li|div|section|header|footer|tr|ul|ol|label|button|summary|details)>|<br\s*/?>",
                  "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return html.unescape(text)


def body_lines(pg):
    text = pg.body
    if pg.is_html:
        text = html_to_lines(clean_liquid(text))
    else:
        text = clean_liquid(text)
        text = re.sub(r"</?(div|section|span|p)\b[^>]*>", "", text)
    text = text.replace("’", "'").replace("‘", "'")
    return text.splitlines()


def plain(line):
    line = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", line)
    line = re.sub(r"https?://\S+", " ", line)
    line = re.sub(r"<[^>]+>", "", line)
    return re.sub(r"[*_`]", "", line).replace("’", "'")


def is_prose(ln):
    s = ln.strip()
    return bool(s) and not s.startswith(("#", "|", "---", "<", ">", "!["))


# ---------------------------------------------------------------- checks
class Findings:
    def __init__(self, page):
        self.page, self.items = page, []

    def add(self, sev, rule, where, msg):
        self.items.append((sev, rule, where, msg))


def check_text(F, where, text, allow_tagline=True, structural=True):
    """Phrase-level rules for one piece of text."""
    t = plain(text)
    if not t.strip():
        return
    tagline_hit = allow_tagline and TAGLINE.search(t)
    for rx, sev, note, _ in PHRASE_RE:
        m = rx.search(t)
        if m and "guarantee" in m.group(0).lower():
            sent = next((x for x in re.split(r"(?<=[.!?])\s+", t) if m.group(0) in x), t)
            if re.search(r"\b(no|not|never|cannot|without|nor)\b|n't", sent, re.I):
                m = None  # a denial, such as "we don't guarantee rankings"
        if m:
            F.add(sev, "PHRASE", where, f"'{m.group(0).strip(' .!?')}'" + (f" ({note})" if note else ""))
    if EM_DASH in t:
        F.add("FAIL", "EM DASH", where, t.strip()[:80])
    if re.search(r"\s-\s", t) and not t.strip().startswith(("-", "|")):
        F.add("REVIEW", "DASH", where, "Spaced hyphen used as a dash. Rewrite or use a colon or comma.")
    if re.search(r"(?<![\w$])\d[\d,]*-\d", t) and not re.search(r"\d{3}-\d{3,4}|\d{4}-\d{2}", t):
        F.add("REVIEW", "RANGE", where, "Number range with a hyphen. Use an en dash (3–5).")
    if re.search(r"\$\d{4,}\b(?!,)", t):
        F.add("FAIL", "MONEY", where, "Use a comma in amounts of $1,000 or more.")
    if re.search(r"\$\d+(\.\d+)?k\b", t, re.I):
        F.add("REVIEW", "MONEY", where, "Write out the amount ($4,000), not $4k.")
    if structural and not tagline_hit and STACCATO.search(t):
        F.add("REVIEW", "STACCATO", where, "Repeated three-beat opening (anaphora or staccato).")
    if structural:
        check_oxford(F, where, t)


def oxford_hits(text):
    """Yield (prev, last, conj, tail) for each list that lacks an Oxford comma."""
    text = re.sub(r"(?<=\d),(?=\d{3})", "\u2063", text)  # keep $7,000 in one piece
    for sent in re.split(r"(?<=[.!?])\s+", text):
        for m in re.finditer(r" (and|or) ", sent):
            before = sent[:m.start()]
            if before.rstrip().endswith(","):
                continue  # already has the Oxford comma
            segs = [x.strip() for x in before.split(",")]
            if len(segs) < 2:  # a list needs at least two items before the 'and'
                continue
            last, prev = segs[-1], segs[-2]
            tail = re.split(r"[,;:.()]", sent[m.end():])[0].strip()
            prev_max = 14 if len(segs) == 2 else 6  # first item may carry a lead-in clause
            if (len(last.split()) > 6 or len(prev.split()) > prev_max
                    or len(tail.split()) > 6 or not tail):
                continue
            if " and " in last or " or " in last or " and " in prev or " or " in prev:
                continue
            first_word = segs[0].split()[0].lower() if segs[0].split() else ""
            lead = " ".join(segs[0].split()[:2]).lower()
            if first_word in SUBORDINATORS or lead in SUBORDINATORS:
                continue
            clean = lambda x: x.replace("\u2063", ",")
            yield clean(prev), clean(last), m.group(1), clean(tail)
            break  # one finding per sentence is enough


def check_oxford(F, where, text):
    for prev, last, conj, tail in oxford_hits(text):
        F.add("REVIEW", "OXFORD", where,
              f"Possible missing Oxford comma: '...{prev}, {last} {conj} {tail}'")


def title_case_problems(text):
    """Return a list of words that break AP-style title case."""
    text = plain(text).strip().rstrip(".")
    if not text or "X" == text.strip() or TAGLINE.search(text):
        return []  # empty, Liquid-only, or the brand tagline
    problems = []
    words = text.split()
    new_clause = True
    for i, raw in enumerate(words):
        core = re.sub(r"^[^\w$]+|[^\w']+$", "", raw)
        if not core or core == "X" or "@" in core or "/" in core or "." in core:
            new_clause = raw.endswith((":", "|", "?"))
            continue
        first_or_last = i == 0 or i == len(words) - 1
        parts = core.split("-")
        for pi, part in enumerate(parts):
            if not part or not part[0].isalpha():
                continue
            low = part.lower()
            mixed = any(c.isupper() for c in part[1:])  # SEO, ChatGPT, iPhone
            must_cap = (not low in MINOR) or ((first_or_last or new_clause) and pi == 0)
            if mixed:
                continue
            if must_cap and part[0].islower():
                problems.append(f"{part}")
            elif not must_cap and part[0].isupper() and pi == 0 and len(parts) == 1:
                problems.append(f"{part} (lowercase)")
        new_clause = raw.endswith((":", "|", "?", "!"))
    return problems


def check_headings(F, pg, lines):
    for n, ln in enumerate(lines, 1):
        m = re.match(r"^(#{1,6})\s+(.*)$", ln)
        if m:
            probs = title_case_problems(m.group(2))
            if probs:
                F.add("REVIEW", "TITLE CASE", f"line {n}",
                      f"{len(probs)} word(s) off ({', '.join(probs[:4])}{'...' if len(probs) > 4 else ''}) in: {plain(m.group(2))[:60]}")
            check_text(F, f"line {n}", m.group(2), structural=False)
    for key in ("h1", "title", "seo_title"):
        v = pg.fm.get(key)
        if isinstance(v, str):
            probs = title_case_problems(v)
            if probs:
                F.add("REVIEW", "TITLE CASE", key,
                      f"{len(probs)} word(s) off ({', '.join(probs[:4])}) in: {v[:60]}")


def check_front_matter(F, pg):
    fm = pg.fm
    if not fm:
        F.add("REVIEW", "FRONT MATTER", "-", "No front matter found.")
        return
    seo = str(fm.get("seo_title") or "")
    if seo and len(seo) > 65:
        F.add("FAIL", "TITLE LENGTH", "seo_title", f"{len(seo)} characters (max about 65): {seo}")
    if not seo and not pg.is_html and not fm.get("noindex"):
        F.add("REVIEW", "TITLE LENGTH", "seo_title", "No seo_title set.")
    d = str(fm.get("description") or "")
    if d and len(d) > 160:
        F.add("FAIL", "META LENGTH", "description", f"{len(d)} characters (max 160)")
    elif d and len(d) < 110:
        F.add("REVIEW", "META LENGTH", "description", f"{len(d)} characters (short; target 110–160)")
    if not d and not fm.get("noindex"):
        F.add("REVIEW", "META LENGTH", "description", "No meta description.")
    for key in ("description", "lede", "blurb", "hero_alt", "card_alt", "eyebrow"):
        v = fm.get(key)
        if isinstance(v, str):
            check_text(F, key, v, structural=key in ("description", "lede", "blurb"))


def check_links(F, pg, lines, valid):
    raw = "\n".join(lines)
    urls = [u or v for u, v in URL_RE.findall(raw)]
    in_text = []
    for n, ln in enumerate(lines, 1):
        for u, v in URL_RE.findall(ln):
            url = (u or v).split("#")[0].split("?")[0]
            if not url or url.startswith(("/assets", "/images")):
                continue
            norm = url if url.endswith("/") or "." in url.rsplit("/", 1)[-1] else url + "/"
            if norm not in valid:
                F.add("FAIL", "BROKEN LINK", f"line {n}", f"{url} is not a page on the site")
            in_text.append((n, norm))
    for u in pg.fm.get("related") or []:
        if u not in valid:
            F.add("FAIL", "BROKEN LINK", "related", f"{u} is not a page on the site")


def faq_items(lines):
    """Yield (line number, question, answer) for bold-question FAQ paragraphs."""
    start = None
    for i, ln in enumerate(lines):
        if re.match(r"^##\s+.*(questions|faq)", ln, re.I):
            start = i
            break
    if start is None:
        return
    for i in range(start + 1, len(lines)):
        ln = lines[i]
        if re.match(r"^##\s+", ln):
            break
        m = re.match(r"^\*\*(.+?\?)\*\*\s*(.*)$", ln.strip())
        if m:
            yield i + 1, m.group(1), m.group(2)


def check_faq(F, lines):
    for n, q, a in faq_items(lines):
        words = len(plain(a).split())
        if words and not (15 <= words <= 75):
            F.add("REVIEW", "FAQ LENGTH", f"line {n}", f"{words} words in answer to '{q[:50]}' (target 15–75)")


def check_primary_keyword(F, pg, lines):
    m = re.search(r"Primary keyword:\s*(.+)", pg.brief)
    if not m:
        return
    kw = m.group(1).strip().lower()
    if kw.startswith("(") or "conversion page" in kw or "not applicable" in kw:
        return
    seo = str(pg.fm.get("seo_title") or pg.fm.get("title") or "").lower()
    h1 = str(pg.fm.get("h1") or pg.fm.get("title") or "").lower()
    first = next((plain(ln).lower() for ln in lines if is_prose(ln) and len(ln.split()) > 8), "")
    first = re.split(r"(?<=[.!?])\s", first)[0] if first else ""
    h2s = " ".join(plain(ln).lower() for ln in lines if re.match(r"^##\s", ln))
    qs = " ".join(q.lower() for _, q, _ in faq_items(lines))
    for label, hay in (("title tag", seo), ("H1", h1), ("first sentence", first),
                       ("an H2", h2s), ("an FAQ question", qs)):
        if hay and kw not in hay:
            F.add("REVIEW", "KEYWORD", label, f"primary keyword '{kw}' not found")
        if not hay and label in ("title tag", "H1", "first sentence"):
            F.add("REVIEW", "KEYWORD", label, f"could not read {label}")


def check_questions(F, lines):
    for n, ln in enumerate(lines, 1):
        if not is_prose(ln) or ln.strip().startswith("**"):
            continue
        for sent in re.split(r"(?<=[.!])\s+", plain(ln)):
            if sent.strip().endswith("?") and 0 < len(sent.split()) <= 6:
                F.add("REVIEW", "RHETORICAL?", f"line {n}", f"Short question in prose: {sent.strip()[:60]}")


def lint_page(pg, valid):
    F = Findings(pg)
    lines = body_lines(pg)
    check_front_matter(F, pg)
    check_headings(F, pg, lines)
    for n, ln in enumerate(lines, 1):
        if ln.strip() and not re.match(r"^#{1,6}\s", ln):
            check_text(F, f"line {n}", ln)
    check_links(F, pg, lines, valid)
    check_faq(F, lines)
    check_primary_keyword(F, pg, lines)
    check_questions(F, lines)
    F.items.sort(key=lambda x: (0 if x[0] == "FAIL" else 1, x[1], str(x[2])))
    return F


# ---------------------------------------------------------------- output
def show(F, fails_only=False, rule=None, quiet_clean=False):
    items = [i for i in F.items if (not fails_only or i[0] == "FAIL") and (not rule or i[1] == rule)]
    if not items:
        if not quiet_clean:
            print(f"{F.page.url}  CLEAN")
        return 0
    print(f"\n{F.page.url}  ({F.page.rel})")
    for sev, r, where, msg in items:
        print(f"  {sev:<6} | {r:<14} | {str(where):<10} | {msg}")
    return sum(1 for i in items if i[0] == "FAIL")


def summarize(all_findings, report=None):
    by_rule = Counter()
    fails = Counter()
    pages_hit = defaultdict(set)
    for F in all_findings:
        for sev, r, where, msg in F.items:
            by_rule[(r, sev)] += 1
            pages_hit[(r, sev)].add(F.page.url)
    print("\n" + "=" * 70)
    print(f"Pages checked: {len(all_findings)}")
    print(f"{'Rule':<16}{'Severity':<9}{'Findings':>9}{'Pages':>7}")
    for (r, sev), n in sorted(by_rule.items(), key=lambda x: (x[0][1] != "FAIL", -x[1])):
        print(f"{r:<16}{sev:<9}{n:>9}{len(pages_hit[(r, sev)]):>7}")
    if report:
        out = ["# 30A style baseline\n", f"Pages checked: {len(all_findings)}\n",
               "| Rule | Severity | Findings | Pages |", "|---|---|---|---|"]
        for (r, sev), n in sorted(by_rule.items(), key=lambda x: (x[0][1] != "FAIL", -x[1])):
            out.append(f"| {r} | {sev} | {n} | {len(pages_hit[(r, sev)])} |")
        out.append("\n## Findings by page\n")
        for F in all_findings:
            if F.items:
                out.append(f"### {F.page.url}\n")
                for sev, r, where, msg in F.items:
                    out.append(f"- **{sev}** {r} ({where}): {msg}")
                out.append("")
        Path(report).write_text("\n".join(out), encoding="utf-8")
        print(f"\nFull findings written to {report}")


def main(argv):
    args = [a for a in argv[1:]]
    opts = {"fails_only": "--fails-only" in args, "rule": None, "repo": None, "report": None}
    for flag, key in (("--rule", "rule"), ("--repo", "repo"), ("--report", "report")):
        if flag in args:
            i = args.index(flag)
            opts[key] = args[i + 1]
            del args[i:i + 2]
    args = [a for a in args if a != "--fails-only"]
    if len(args) != 2 or args[0] not in ("site", "page", "draft"):
        print(__doc__)
        return 2
    mode, target = args
    if mode == "site":
        repo = Path(target)
        valid = valid_urls(repo)
        results = [lint_page(pg, valid) for pg in site_pages(repo)]
        fails = sum(show(F, opts["fails_only"], opts["rule"], quiet_clean=True) for F in results)
        summarize(results, opts["report"])
        return 1 if fails else 0
    repo = Path(opts["repo"]) if opts["repo"] else None
    valid = valid_urls(repo) if repo else None
    path = Path(target)
    if mode == "draft":
        text = path.read_text(encoding="utf-8", errors="ignore")
        if not text.startswith("---"):
            m = re.match(r"#\s+(.*)\n", text)
            text = f"---\nh1: \"{m.group(1) if m else ''}\"\n---\n" + text
            tmp = path.with_suffix(".linttmp.md")
            tmp.write_text(text, encoding="utf-8")
            path = tmp
    pg = load_page(path, repo) if repo else load_page(path)
    if valid is None:
        valid = None
    F = lint_page(pg, valid if valid is not None else _AnyUrl())
    rc = show(F, opts["fails_only"], opts["rule"])
    if mode == "draft" and path.name.endswith(".linttmp.md"):
        path.unlink()
    return 1 if rc else 0


class _AnyUrl(set):
    """Accept every internal link when no repo is given (links are not verified)."""
    def __contains__(self, item):
        return True


if __name__ == "__main__":
    sys.exit(main(sys.argv))
