const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

console.log('Testing Bet Butler Button & Bookmaker Checkbox List...');

// 1. Inspect index.html
const indexHtml = fs.readFileSync('index.html', 'utf8');

// Check header button text
assert(indexHtml.includes('Bet Butler: <b id="header-butler-name">'), 'Header button must say Bet Butler: [name]');
console.log('✓ Header button label is long format "Bet Butler: [name]"');

// Check bookmaker checkboxes in modal
const bookies = ['skybet', 'bet365', 'williamhill', 'paddypower', 'betfair', 'coral', 'ladbrokes'];
bookies.forEach(b => {
  assert(indexHtml.includes(`data-select-butler="${b}"`), `Must contain bookmaker ${b}`);
  assert(indexHtml.includes(`id="check-box-${b}"`), `Must contain checkbox element for ${b}`);
});
assert(indexHtml.includes('class="butler-checkbox"'), 'Must contain butler-checkbox class');
assert(indexHtml.includes('class="butler-check-svg"'), 'Must contain butler-check-svg checkmark icon');
console.log(`✓ All ${bookies.length} bookmakers have explicit checkbox elements and left-aligned rows`);

// 2. Inspect styles.css
const stylesCss = fs.readFileSync('styles.css', 'utf8');

// Button should have generous min-width and no squashed 115px max-width
assert(stylesCss.includes('min-width: 175px;'), '.butler-pill-btn must have min-width: 175px on desktop');
assert(!stylesCss.includes('max-width: 115px !important;'), 'styles.css must NOT contain squashed max-width: 115px !important');
console.log('✓ Bet Butler button is long and generous (min-width: 175px, 0 squashed max-width overrides)');

// Dropdown list must be vertical column (list) and left-aligned
assert(stylesCss.includes('flex-direction: column;'), 'Bookie grid must be flex column list');
assert(stylesCss.includes('.butler-checkbox {'), 'Must have .butler-checkbox styles');
assert(stylesCss.includes('.butler-choice-card.active .butler-checkbox {'), 'Must have active checkbox styles');
assert(stylesCss.includes('.butler-choice-left {'), 'Must have .butler-choice-left styles');
console.log('✓ Dropdown list is left-aligned vertical list with styled checkboxes');

// 3. Test updateButlerUI in app.js
const appCode = fs.readFileSync('app.js', 'utf8');
const mcCode = fs.readFileSync('market_calculations.js', 'utf8');
const bbCode = fs.readFileSync('bet_builder.js', 'utf8');

const mockStorage = {};
const mockElements = {};

function createMockEl(attrs = {}) {
  return {
    textContent: '',
    innerHTML: '',
    dataset: attrs.dataset || {},
    appendChild: () => {},
    removeChild: () => {},
    querySelector: () => createMockEl(),
    querySelectorAll: () => [],
    classList: {
      classes: new Set(),
      add(c) { this.classes.add(c); },
      remove(c) { this.classes.delete(c); },
      contains(c) { return this.classes.has(c); }
    },
    setAttribute(k, v) { this[k] = v; },
    getAttribute(k) { return this[k]; }
  };
}

const cards = bookies.map(b => createMockEl({ dataset: { selectButler: b } }));
const nameEl = createMockEl();

const sandbox = {
  location: { hash: '#/' },
  scrollTo: () => {},
  window: { addEventListener: () => {}, scrollTo: () => {} },
  addEventListener: () => {},
  document: {
    addEventListener: () => {},
    createElement: () => createMockEl(),
    body: { appendChild: () => {}, removeChild: () => {} },
    querySelectorAll: (sel) => {
      if (sel.includes('.butler-choice-card')) return cards;
      if (sel.includes('#header-butler-name')) return [nameEl];
      return [];
    },
    getElementById: (id) => createMockEl()
  },
  localStorage: {
    getItem: (k) => mockStorage[k] || null,
    setItem: (k, v) => { mockStorage[k] = String(v); },
    removeItem: (k) => { delete mockStorage[k]; }
  },
  navigator: { onLine: true, serviceWorker: { addEventListener: () => {} } },
  console,
  setTimeout: () => {},
  setInterval: () => {},
  toast: () => {},
  render: () => {},
  closeButlerModal: () => {}
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(mcCode, sandbox);
vm.runInContext(bbCode, sandbox);
vm.runInContext(appCode, sandbox);

// Set bookmaker to bet365
vm.runInContext("setButlerBookmaker('bet365');", sandbox);

// Verify localStorage
assert.strictEqual(mockStorage['betbuddy_butler_bookie_v1'], 'bet365', 'Stored bookmaker must be bet365');

// Verify active classes and aria-checked on cards
const activeCards = cards.filter(c => c.classList.contains('active'));
assert.strictEqual(activeCards.length, 1, 'Exactly one card must be active');
assert.strictEqual(activeCards[0].dataset.selectButler, 'bet365', 'Active card must be bet365');
assert.strictEqual(activeCards[0]['aria-checked'], 'true', 'Active card aria-checked must be true');

const inactiveCards = cards.filter(c => !c.classList.contains('active'));
assert.strictEqual(inactiveCards.length, 6, 'Six cards must be inactive');
inactiveCards.forEach(c => {
  assert.strictEqual(c['aria-checked'], 'false', 'Inactive card aria-checked must be false');
});

// Set bookmaker to skybet
vm.runInContext("setButlerBookmaker('skybet');", sandbox);
assert.strictEqual(mockStorage['betbuddy_butler_bookie_v1'], 'skybet');
const skyCard = cards.find(c => c.dataset.selectButler === 'skybet');
assert(skyCard.classList.contains('active'), 'Sky Bet must be active');
assert.strictEqual(skyCard['aria-checked'], 'true', 'Sky Bet aria-checked must be true');

console.log('✓ UI interaction and state updates passed cleanly!');
console.log('ALL BET BUTLER UI TESTS PASSED!');
