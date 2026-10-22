const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

const checks = [
  { name: 'calc.matchWinnerIndicator(hv,av)', pass: content.includes('calc.matchWinnerIndicator(hv,av)') },
  { name: 'calc.dataFreshnessSummary(d)', pass: content.includes('calc.dataFreshnessSummary(d)') },
  { name: 'Historical home-win/away-loss indicator', pass: content.includes('Historical home-win/away-loss indicator') },
  { name: 'NOT avg(av.map(r=>r.FTR===\'A\'?1:0))', pass: !content.includes("avg(av.map(r=>r.FTR==='A'?1:0))") }
];

console.log('Regression Checks:');
let allPass = true;
checks.forEach(c => {
  console.log(' ', c.name, '->', c.pass ? 'PASS' : 'FAIL');
  if (!c.pass) allPass = false;
});

process.exit(allPass ? 0 : 1);
