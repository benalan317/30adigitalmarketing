# Fit quiz: saving answers to a Google Sheet

The fit quiz at `/fit-quiz/` works on its own. This folder turns on two extras:

1. **Anonymous answers.** Every finished quiz adds one row to a Google Sheet: the answers, the result, the first page the visitor landed on, the site that sent them, any campaign tags and their device type. No names, emails or IP addresses.
2. **Results by email.** Visitors can type their email to get their result. They get an email from your Google account, you get a short note, and the address goes in a separate "Leads" tab with whether they said you may follow up.

This folder starts with an underscore, so it is **not** published on the website.

## Set it up (about 10 minutes, all point and click)

1. **Make the sheet.** Sign in to Google with the hello@30adigitalmarketing.com account. Go to sheets.new. Name the sheet "30A Fit Quiz Answers".
2. **Open the script editor.** In the sheet, click Extensions, then Apps Script. A new tab opens with a file called `Code.gs`.
3. **Paste the code.** Delete everything in `Code.gs`. Open `Code.gs` from this folder on GitHub, click the copy icon ("Copy raw file"), and paste it in. Click the disk icon to save. Name the project "Fit quiz receiver".
4. **Create the tabs.** At the top, pick `setup` from the function menu and click Run. Google asks for permission: click Review permissions, pick your account, then Allow. If you see "Google hasn't verified this app", click Advanced, then "Go to Fit quiz receiver". It's your own script. Your sheet now has "Responses" and "Leads" tabs.
5. **Publish it as a web app.** Click Deploy, then New deployment. Click the gear icon and choose Web app. Set **Execute as: Me** and **Who has access: Anyone**. Click Deploy, then copy the **Web app URL** (it ends in `/exec`).
6. **Connect the website.** Send the URL to Claude, or paste it into `_config.yml` on the line `fit_quiz_endpoint: ""`, between the quotes, and commit.

To check it worked: open the Web app URL in your browser. It should say "The 30A fit quiz receiver is running." Then take the quiz on the live site and look for a new row in "Responses".

## Changing the code later

Edit `Code.gs` in the Apps Script editor, save, then Deploy, Manage deployments, the pencil icon, Version: **New version**, Deploy. The web address stays the same.

## Good to know

- If prices or services change, update `OFFERS` and `SERVICES` here and in `assets/js/site.js`.
- Emails go out from the Google account that deployed the script, with replies going to hello@. Google limits how many emails a script can send each day; the script stops sending well before that.
- The script limits how fast rows can be added and how many emails go out each hour, so a flood of fake submissions can't fill the sheet or use up your email limit.
- Answers are stored as short codes (for example `4k-7k` for a $4,000 to $7,000 budget). The question each code belongs to is in the column header, and the matching words are in `fit-quiz/index.html`.
