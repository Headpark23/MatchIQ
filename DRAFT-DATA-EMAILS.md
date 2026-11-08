# Draft emails: corners and cards data for MatchIQ

Drafts only. Nothing has been sent. Fill in the [brackets] before sending.

---

## 1. football-data.org (preferred: paid, same provider the app already uses)

To: daniel@football-data.org
Subject: Statistic Add-On and public use of derived predictions

Hello Daniel,

I run MatchIQ, a [free / ad-free / paid] football predictions app at [URL]. It already uses
the football-data.org free tier for fixtures and results, with attribution in the footer
and More page. I make about 4 requests a day, well inside the 10 calls/minute limit.

I would like to add corner and card markets and I am looking at your Statistic Add-On
(EUR 15/month). Before I subscribe, could you confirm:

1. Does the Statistic Add-On need a paid base plan, or can it sit on top of the Free plan?
2. Does either plan allow a public app to show predictions derived from your data
   (for example, probabilities for match result, goals, corners and cards)?
3. Am I allowed to store historical results and statistics in a private repository
   to train and validate the model?
4. Is there any attribution wording you require?

Thank you,
[Name]
[URL]

---

## 2. football-data.co.uk (only if you want their free historical data)

To: [contact address from the site]
Subject: Permission to use historical data in a public football app

Hello,

I run MatchIQ, a football predictions app at [URL]. Your site notes that the data is for
personal and research use, so I have kept it out of the public app. I would like your
permission to use the historical match statistics (results, corners, cards, shots) to
train models whose output, probabilities only and not your raw data, is shown publicly.

1. Is that acceptable, and under what conditions?
2. Do you want attribution, and in what wording?
3. Is there a licensing option if the answer is no?

Thank you,
[Name]
[URL]

---

## 3. API-Football free-tier test (needs your key)

1. Register at https://dashboard.api-football.com/register (no card needed for the free plan).
2. Give me the key through an environment variable, not in chat or in a file in the repo.
3. I will make about 5 requests: one fixture's statistics (corners, cards) for each of
   2-3 leagues, to check which seasons the free plan allows and whether the fields exist.
4. Read https://www.api-football.com/terms for public display and storage rules first.
