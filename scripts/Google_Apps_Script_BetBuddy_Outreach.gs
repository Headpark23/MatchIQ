/**
 * BET BUDDY - AUTONOMOUS OUTREACH & INBOX MONITOR (2026 EDITION)
 * Account: octopigardens@gmail.com
 * Founders: Martin White & Chris Faulds
 *
 * COMMERCIAL FOCUS:
 * Position Bet Buddy to UK bookmakers as a high-margin recreational turnover engine:
 * 1. Target-Profit Acca Builder (25-35% operator margin products)
 * 2. 6-Tier Geographic & Custom Buddy Leagues (Option A odds-weighted points incentivize long-odds accas)
 * 3. Multi-Sport Toggle (mix football, tennis, darts, golf & rugby for 365-day engagement)
 *
 * HOW TO RUN:
 * 1. Open script.google.com signed in as octopigardens@gmail.com
 * 2. Create New Project, paste this code, click Save.
 * 3. Run 'sendOutreachBatch()' to send the high-margin pitch emails.
 * 4. Run 'setupTriggerTwiceDaily()' to automate 12-hour reply monitoring and drafting.
 */

const TARGETS = [
  {
    name: 'bet365 Partnerships & Affiliates',
    email: 'partnerships@bet365.com',
    altEmail: 'support@affiliates365.com',
    subject: 'Bet Buddy partnership: Driving high-margin Acca & multi-sport turnover',
    body: 'Hi bet365 Partnerships Team,\n\n' +
      'My name is Martin, co-founder of Bet Buddy (https://betbuddyuk.uk), a new UK mobile betting intelligence app and cross-sport accumulator engine.\n\n' +
      'As an operator, you know accumulators carry your highest gross margin (25%–35%+). Bet Buddy is specifically built around this behavior:\n\n' +
      '1. Target-Profit Acca Engine: Punters enter a target return (£20–£500 across 2 to 6 legs), and our Poisson/Dixon-Coles models instantly construct the optimal accumulator.\n' +
      '2. Cross-Sport Mixing: Users toggle Football, Tennis, Golf, Darts, and Rugby with one tap, creating multi-sport weekend parlays and sustaining action even outside the football season.\n' +
      '3. 6-Tier Silverware & Buddy Leagues: Players compete on hometown, regional, national, and world ladders—where points are weighted by odds length. Longer accumulator winners score the highest silverware points, directly rewarding longer-odds slips.\n\n' +
      'We have integrated 1-tap bookmaker placement links on all match cards and accumulator slips, and we want to feature bet365 as our primary placement partner.\n\n' +
      'We are ready to onboard on standard revenue share (25%–30% NGR) or starter hybrid terms with zero upfront fees.\n\n' +
      'Could you let me know the direct contact or publisher signup route to fast-track our tracking ID integration?\n\n' +
      'Kind regards,\nMartin White & Chris Faulds\nCo-Founders, Bet Buddy\noctopigardens@gmail.com\nhttps://betbuddyuk.uk'
  },
  {
    name: 'Entain Partners (Ladbrokes & Coral)',
    email: 'affiliates@ladbrokescoral.com',
    altEmail: 'affiliates@entaingroup.com',
    subject: 'Bet Buddy partnership: Gamified accumulator engine & Ladbrokes/Coral integration',
    body: 'Hi Entain Partnerships Team,\n\n' +
      'I am Martin, co-founder of Bet Buddy (https://betbuddyuk.uk).\n\n' +
      'Ladbrokes and Coral are titans of the UK high-street and digital betting market. We have recently added both brands to our UK bookmaker selector and want to officially onboard your affiliate tracking links into our app.\n\n' +
      'Why Bet Buddy drives prime recreational volume for Ladbrokes and Coral:\n' +
      '- High-Margin Accas: Our Target-Profit builder constructs 2-to-6 leg accumulators to hit user profit goals.\n' +
      '- Gamified Silverware Ladders: Punters automatically enter 6 geographic tiers (Hometown, County, Scotland/England, UK, Europe, World) plus private friend leagues. Our scoring explicitly awards points based on odds length, creating weekly competition to land big-price accumulators.\n' +
      '- Year-Round Retention: Multi-sport toggles allow players to combine football with tennis, darts, golf, and rugby so player turnover never pauses over the summer.\n\n' +
      'Our users are 100% recreational UK sports punters. We are happy to start on standard rev-share or starter CPA terms with zero upfront charges.\n\n' +
      'Who is the dedicated account manager handling UK publisher integrations for Ladbrokes/Coral?\n\n' +
      'Best regards,\nMartin White & Chris Faulds\nBet Buddy\noctopigardens@gmail.com\nhttps://betbuddyuk.uk'
  },
  {
    name: 'Sky Betting & Gaming Affiliates',
    email: 'affiliates@skybettingandgaming.com',
    subject: 'Driving recreational Acca turnover & Buddy League volume for Sky Bet',
    body: 'Hi Sky Bet Affiliates Team,\n\n' +
      'I am Martin, co-founder of Bet Buddy (https://betbuddyuk.uk).\n\n' +
      'Sky Bet has long pioneered recreational accumulator betting in the UK. Bet Buddy takes that cultural habit and supercharges it with social gamification and algorithmic slip building:\n\n' +
      '- Automated Acca Building: Our engine scans upcoming fixtures to assemble high-confidence 3-to-6 leg accumulators targeting specific profit amounts.\n' +
      '- Silverware Competitions: Punter leagues across town, county, national, and global leaderboards—where players earn points weighted by the length of odds they win. This drives steady demand for multi-leg accumulators.\n' +
      '- Multi-Sport Parlays: Punters can toggle between football, darts, tennis, rugby, and golf to build cross-sport slips with 1 tap.\n\n' +
      'We want to channel our accumulator placement clicks directly to Sky Bet via your affiliate program. We are offering top-tier placement on our builder cards and match pages under standard affiliate commission terms.\n\n' +
      'Please let me know how we can expedite publisher tracking approval for the app.\n\n' +
      'Best regards,\nMartin White & Chris Faulds\nBet Buddy\noctopigardens@gmail.com\nhttps://betbuddyuk.uk'
  },
  {
    name: 'Flutter Partners (Paddy Power & Betfair)',
    email: 'affiliates@paddypower.com',
    altEmail: 'affiliates@betfair.com',
    subject: 'Bet Buddy: High-margin social Accas & multi-sport turnover for Paddy Power / Betfair',
    body: 'Hi Flutter Partnerships Team,\n\n' +
      'I am Martin, co-founder of Bet Buddy (https://betbuddyuk.uk), a fresh UK mobile platform combining transparent statistical evidence with social accumulator betting.\n\n' +
      'Our platform has been built from the ground up to drive high-margin turnover:\n' +
      '1. Target-Profit Acca Builder: Instantly generates 2–6 leg accumulators calibrated to punter profit targets.\n' +
      '2. Competitive Buddy Leagues: Users create private leagues with friends or compete on 6 automatic geographic ladders. Points are awarded based on odds length, creating intense incentive for players to place weekend accumulators and build up their trophy cabinets.\n' +
      '3. Multi-Sport Toggle: Football, Tennis, Darts, Golf, and Rugby can be mixed into unified multi-sport parlays.\n\n' +
      'We are currently setting up our default "Place Bet" bookmaker routing and want to feature Paddy Power / Betfair as preferred partners.\n\n' +
      'We operate transparently with no upfront fees and are ready to commence on standard commercial tiers (CPA / NGR rev-share).\n\n' +
      'Could you connect me with the affiliate onboarding manager for UK sportsbook publishers?\n\n' +
      'Kind regards,\nMartin White & Chris Faulds\nBet Buddy\noctopigardens@gmail.com\nhttps://betbuddyuk.uk'
  },
  {
    name: 'William Hill Partners',
    email: 'affiliates@williamhill.com',
    altEmail: 'support@williamhillaffiliates.com',
    subject: 'Bet Buddy Acca Engine & Buddy League partnership inquiry',
    body: 'Hi William Hill Partners Team,\n\n' +
      'I am Martin, co-founder of Bet Buddy (https://betbuddyuk.uk).\n\n' +
      'Bet Buddy is a UK web and mobile application designed to help recreational bettors build smart accumulators and compete in social leagues.\n\n' +
      'Key volume drivers for William Hill:\n' +
      '- Algorithmic Acca Builder: Users choose a target win (£20–£500) and number of legs (2–6+), and our model automatically finds the optimal combination of value selections.\n' +
      '- Silverware & Buddy Leagues: Players compete on local and worldwide leaderboards. Because scoring is weighted by odds length, punters actively seek out high-odds accumulators to earn points and trophies.\n' +
      '- Cross-Sport Betting: Live UK bookmaker odds for football, tennis, golf, rugby, and darts, keeping users active 365 days a year.\n\n' +
      'We want to integrate William Hill tracking directly into our 1-click bookmaker placement modal. We are ready to begin on standard affiliate terms.\n\n' +
      'Please advise on how to set up our publisher account.\n\n' +
      'Kind regards,\nMartin White & Chris Faulds\nBet Buddy\noctopigardens@gmail.com\nhttps://betbuddyuk.uk'
  }
];

function verifyAccount() {
  const activeEmail = (Session.getActiveUser().getEmail() || '').toLowerCase().trim();
  if (activeEmail && !activeEmail.includes('octopi') && !activeEmail.includes('octopus')) {
    throw new Error('STOP: Must run inside octopigardens@gmail.com account session. Current: ' + activeEmail);
  }
}

function sendOutreachBatch() {
  verifyAccount();
  const labelName = 'Bet Buddy: Bookmaker Outreach';
  let label = GmailApp.getUserLabelByName(labelName);
  if (!label) label = GmailApp.createLabel(labelName);

  TARGETS.forEach(function(target) {
    const threadQuery = 'to:' + target.email + ' subject:"' + target.subject + '"';
    const existing = GmailApp.search(threadQuery);
    if (existing.length === 0) {
      GmailApp.sendEmail(target.email, target.subject, target.body, {
        cc: target.altEmail || undefined,
        name: 'Martin from Bet Buddy'
      });
      Utilities.sleep(1500);
      const threads = GmailApp.search('to:' + target.email);
      if (threads.length > 0) label.addToThread(threads[0]);
      Logger.log('Sent pitch to ' + target.name);
    } else {
      Logger.log('Already contacted: ' + target.name);
    }
  });
}

function monitorInboxTwiceDaily() {
  verifyAccount();
  const labelName = 'Bet Buddy: Bookmaker Outreach';
  const label = GmailApp.getUserLabelByName(labelName);
  if (!label) return;

  const threads = label.getThreads();
  threads.forEach(function(thread) {
    const messages = thread.getMessages();
    if (messages.length > 1) {
      const lastMsg = messages[messages.length - 1];
      const sender = lastMsg.getFrom();
      if (!sender.toLowerCase().includes('octopi')) {
        Logger.log('Reply received from: ' + sender);
        
        const drafts = GmailApp.getDrafts();
        const hasDraft = drafts.some(function(d) {
          return d.getMessage().getThread().getId() === thread.getId();
        });

        if (!hasDraft) {
          const draftBody = 'Hi,\n\n' +
            'Thanks for the swift reply.\n\n' +
            'To confirm:\n' +
            '1. Traffic Profile: 100% UK recreational sports bettors, driven by our Target-Profit Acca Builder and social Buddy Leagues.\n' +
            '2. Integration: We place your tracking gateway behind our "Place Bet" button on match screens, acca slips, and multi-sport tournament cards.\n' +
            '3. Commercial Terms: We are happy to start on standard Rev-Share (25%-30%) or starter CPA tier while we scale our volume.\n\n' +
            'Please send over our partner tracking ID so we can integrate and verify tracking immediately.\n\n' +
            'Kind regards,\nMartin White & Chris Faulds\noctopigardens@gmail.com\nhttps://betbuddyuk.uk';

          thread.createDraftReply(draftBody);
          Logger.log('Created prepared draft reply in Gmail.');
        }
      }
    }
  });
}

function setupTriggerTwiceDaily() {
  ScriptApp.newTrigger('monitorInboxTwiceDaily')
    .timeBased()
    .everyHours(12)
    .create();
  Logger.log('Scheduled twice-daily inbox check.');
}
