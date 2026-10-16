# 30adigitalmarketing.com: site files

This folder is the whole website. GitHub Pages builds it automatically each time it is pushed.

## Where things live
- `_includes/header.html`: the top menu. Change it once, every page updates.
- `_includes/footer.html`: the footer. Its service and industry lists build themselves from the pages.
- `_layouts/`: the page templates (`default.html` is the outer shell, `page.html` is for inner pages).
- `assets/css/style.css`: all colours and fonts. The top of the file has the settings.
- `index.html`: the homepage.
- Every other page is a folder with an `index.md` inside, for example `services/seo/index.md`.
- `images/`: photos. `CNAME`, `robots.txt`: domain and search-crawler settings.

## Placeholder pages
Pages that still need real copy have `placeholder: true` and `sitemap: false` at the top.
Those two lines hide the page from Google (it is marked "noindex" and left out of sitemap.xml).
**When a page's real copy is ready, delete both lines** so the page can be found.

Each page also has a "PAGE BRIEF" note (primary keyword, related keywords, purpose).
It is invisible on the website.
