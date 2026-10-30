const fs = require('fs');
const path = require('path');
const mc = require('../market_calculations.js');
const bb = require('../bet_builder.js');

const elements = {};
function mockElement(id) {
  if (!elements[id]) {
    elements[id] = {
      id, hidden: false, value: '', innerHTML: '', textContent: '', style: {}, dataset: {}, children: [],
      classList: { add(){}, remove(){}, toggle(){}, contains(){return false;} },
      appendChild(){}, removeChild(){}, setAttribute(){}, removeAttribute(){}, getAttribute(){return '';},
      querySelector(){return mockElement('d');}, querySelectorAll(){return [];},
      focus(){}, remove(){}, addEventListener(){}
    };
  }
  return elements[id];
}

global.window = {
  location: { hash: '#/', origin: 'https://headpark23.github.io', pathname: '/MatchIQ/' },
  addEventListener(){}, scrollTo(){},
  MatchIQCalculations: mc, MatchIQBuilder: bb,
  history: { back(){} }
};
global.MatchIQCalculations = mc;
global.MatchIQBuilder = bb;
global.document = {
  getElementById: mockElement,
  querySelector: mockElement,
  querySelectorAll: () => [],
  createElement: () => mockElement('div'),
  addEventListener(){},
  body: mockElement('body'),
  title: ''
};
global.location = global.window.location;
global.localStorage = {
  s: {},
  getItem(k){return this.s[k]||null;},
  setItem(k,v){this.s[k]=String(v);},
  removeItem(k){delete this.s[k];}
};
global.sessionStorage = {
  s: {},
  getItem(k){return this.s[k]||null;},
  setItem(k,v){this.s[k]=String(v);}
};
global.navigator = { clipboard: { writeText: async () => {} } };
global.fetch = async (url) => {
  const cleanUrl = url.split('?')[0];
  if (fs.existsSync(cleanUrl)) {
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(cleanUrl, 'utf8')) };
  }
  return { ok: false, status: 404 };
};

eval(fs.readFileSync('app.js', 'utf8') + `
;global._scan = async () => {
  console.log('--- Deep Scanning App Components & Views ---');
  await loadData();
  console.log('1. Data Loaded Successfully');
  console.log('   Predictions:', predictionsList().length);
  console.log('   Fixtures:', fixturesList().length);
  console.log('   History:', historyRecords().length);
  console.log('   MultiSport sports:', Object.keys(DATA.multiSport ? DATA.multiSport.sports : {}));

  const views = [
    ['Home', () => viewHome()],
    ['Picks', () => viewPicks()],
    ['Fixtures', () => viewFixtures()],
    ['Results', () => viewResults()],
    ['Diary', () => viewDiary()],
    ['Leagues', () => viewLeagues()],
    ['More', () => viewMore()],
    ['Commercial', () => viewCommercial()],
    ['Admin', () => viewAdmin()]
  ];

  for (const [name, fn] of views) {
    try {
      const html = fn();
      if (!html || typeof html !== 'string' || html.length < 50) {
        throw new Error('Returned empty or short HTML: ' + html);
      }
      console.log('PASS View: ' + name + ' (length: ' + html.length + ')');
    } catch (e) {
      console.error('FAIL View: ' + name, e);
    }
  }

  // Scan viewMatch for fixtures
  const fixs = fixturesList();
  let matchViewPassed = 0;
  for (const f of fixs.slice(0, 10)) {
    try {
      const mHtml = viewMatch(f.id);
      if (mHtml && mHtml.length > 100) matchViewPassed++;
    } catch (e) {
      console.error('FAIL viewMatch for ' + f.id, e);
    }
  }
  console.log('PASS viewMatch: tested ' + matchViewPassed + ' fixtures.');

  // Scan builderCompute
  try {
    builderCompute();
    console.log('PASS builderCompute: result slips = ' + (builderResult ? builderResult.slips.length : 0));
  } catch (e) {
    console.error('FAIL builderCompute:', e);
  }

  // Scan openDiary
  try {
    openDiary({ selection: 'Arsenal Win', odds: '2.50' });
    console.log('PASS openDiary');
    closeDiary();
  } catch (e) {
    console.error('FAIL openDiary:', e);
  }

  // Scan Trophy Cabinet
  try {
    openTrophyCabinet();
    console.log('PASS openTrophyCabinet');
  } catch (e) {
    console.error('FAIL openTrophyCabinet:', e);
  }
};
`);

global._scan().then(() => {
  console.log('--- Deep Scan Complete ---');
  process.exit(0);
}).catch(err => {
  console.error('CRASH in Deep Scan:', err);
  process.exit(1);
});
