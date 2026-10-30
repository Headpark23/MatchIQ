/**
 * BET BUDDY - AUTONOMOUS OUTREACH & INBOX MONITOR
 * Hard-locked to octopigardens@gmail.com
 *
 * HOW TO RUN (60 seconds):
 * 1. Open script.google.com in browser signed in as octopigardens@gmail.com
 * 2. Create New Project, paste this code, and click Save.
 * 3. Run 'sendOutreachBatch()' to send the bookmaker outreach emails.
 * 4. Run 'monitorInboxTwiceDaily()' or set a time-driven trigger to run every 12 hours.
 */

const TARGETS = [
  {
    name: 'bet365 Partnerships Team',
    email: 'partnerships@bet365.com',
    altEmail: 'support@affiliates365.com',
    subject: 'Bet Buddy partnership inquiry: Target-Profit Acca integration',
    body: 'Hi bet365 Partnerships Team,\n\n' +
      'My name is Martin, founder of Bet Buddy (https://betbuddyuk.uk), a new mobile-first football prediction platform and accumulator builder in the UK.\n\n' +
      'We have built a dedicated Target-Profit Acca Builder and Buddy Leagues—private mini-leagues where UK friend groups compete purely on Win Rate % and ROI % (10p to £5 bets), generating consistent, weekly accumulator turnover.\n\n' +
      'We want to integrate bet365 as our primary featured bookmaker for 1-tap bet placement across our match cards and accumulator slips.\n\n' +
      'Because we are early-stage and focused on building long-term volume, we are ready to operate on standard revenue share (25%–30% NGR) or a starter CPA with zero upfront listing fees.\n\n' +
      'Could you let me know how we can fast-track our publisher account approval, or if there is a specific account manager we should liaise with?\n\n' +
      'Kind regards,\nMartin\nFounder, Bet Buddy\noctopigardens@gmail.com\nhttps://betbuddyuk.uk'
  },
  {
    name: 'Sky Betting & Gaming Affiliates',
    email: 'affiliates@skybettingandgaming.com',
    subject: 'Bet Buddy / Sky Bet Acca Integration & Buddy Leagues',
    body: 'Hi Sky Bet Affiliates Team,\n\n' +
      'I am Martin, founder of Bet Buddy (https://betbuddyuk.uk).\n\n' +
      'We have developed a social football betting platform centered around Buddy Leagues (friend groups competing on Win Rate % regardless of stake size) and an algorithmic Acca Builder.\n\n' +
      'Sky Bet is the UK favorite for weekend accumulators. We have built 1-tap bookmaker placement buttons directly into our match views and want to route our accumulator traffic directly into Sky Bet via your affiliate program.\n\n' +
      'We are offering preferred top placement on our bet slips and match pages under standard affiliate commission terms (CPA or rev-share).\n\n' +
      'Please let me know the best route to onboard our app with your partner network.\n\n' +
      'Best regards,\nMartin\nBet Buddy\noctopigardens@gmail.com\nhttps://betbuddyuk.uk'
  },
  {
    name: 'Flutter Partners (Paddy Power / Betfair)',
    email: 'affiliates@paddypower.com',
    altEmail: 'affiliates@betfair.com',
    subject: 'Social Acca traffic & Buddy League integration for Paddy Power',
    body: 'Hi Partnerships Team,\n\n' +
      'I am Martin, creator of Bet Buddy (https://betbuddyuk.uk).\n\n' +
      'Bet Buddy is an honest, model-backed football intelligence app featuring private Buddy Leagues and an automated Acca Builder designed for casual UK football punters.\n\n' +
      'We are currently onboarding our initial bookmaker partners for our "Place Bet" integration and want to feature Paddy Power / Betfair as recommended partners.\n\n' +
      'We are a young platform willing to offer prime placement at introductory commission rates to build mutual volume.\n\n' +
      'Who is the best person to speak with regarding our affiliate tracking integration?\n\n' +
      'Kind regards,\nMartin\nFounder, Bet Buddy\noctopigardens@gmail.com\nhttps://betbuddyuk.uk'
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
      // Label thread
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
        // Inbound reply from bookmaker received!
        Logger.log('Reply received from: ' + sender);
        
        // Prepare draft reply if no draft already exists
        const drafts = GmailApp.getDrafts();
        const hasDraft = drafts.some(function(d) {
          return d.getMessage().getThread().getId() === thread.getId();
        });

        if (!hasDraft) {
          const draftBody = 'Hi,\n\n' +
            'Thanks for the swift reply.\n\n' +
            'To confirm:\n' +
            '1. Traffic Profile: 100% UK recreational football bettors, primarily targeting weekend Premier League and Championship accumulators.\n' +
            '2. Integration: We place your tracking gateway behind our "Place Bet" button on match screens and acca slips.\n' +
            '3. Commercial Terms: We are happy to start on standard Rev-Share (25%-30%) or starter CPA tier while we scale our volume.\n\n' +
            'Please send over our partner tracking ID so we can integrate and verify tracking immediately.\n\n' +
            'Kind regards,\nMartin\noctopigardens@gmail.com\nhttps://betbuddyuk.uk';

          thread.createDraftReply(draftBody);
          Logger.log('Created prepared draft reply for Martin to review in Gmail.');
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
