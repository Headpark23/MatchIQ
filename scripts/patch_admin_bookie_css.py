with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

bookie_and_admin_styles = '''
/* Bookmaker Selector Modal */
.bookie-modal-card { max-width: 480px; }
.bookie-summary-box {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px; border-radius: 12px;
  background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25);
  margin-bottom: 12px;
}
.bookie-list-grid { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.bookie-choice-btn {
  display: flex; align-items: center; gap: 14px; padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03); border: 1px solid var(--line);
  border-radius: 12px; text-decoration: none; color: inherit; transition: all .15s ease;
}
.bookie-choice-btn:hover {
  background: rgba(255, 255, 255, 0.07); border-color: var(--cyan);
  transform: translateX(3px);
}
.bookie-tag {
  width: 42px; height: 32px; border-radius: 6px; display: grid; place-items: center;
  font-weight: 800; font-size: 11px; font-family: var(--display); text-transform: uppercase;
}
.bookie-tag.b365 { background: #00733c; color: #ffdf1b; }
.bookie-tag.skybet { background: #0b1f3a; color: #e11438; border: 1px solid #e11438; }
.bookie-tag.pp { background: #004b2c; color: #fff; }
.bookie-tag.bf { background: #ffb80c; color: #000; }
.bookie-tag.wh { background: #0a1e41; color: #ecd000; border: 1px solid #ecd000; }
.bookie-choice-btn strong { display: block; font-size: 14px; color: #fff; }
.bookie-go-arrow { margin-left: auto; font-size: 18px; color: var(--dim); }

/* Commercial Admin & Affiliation Tracking Dashboard */
.admin-metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-top: 14px; }
.admin-metric-card {
  padding: 18px; border-radius: var(--radius); border: 1px solid var(--line);
  background: var(--surface); backdrop-filter: blur(14px);
}
.admin-metric-val { font-family: var(--mono); font-size: 28px; font-weight: 700; color: #fff; margin: 4px 0 2px; }
.admin-metric-val.emerald { color: #34d399; }
.admin-metric-val.cyan { color: var(--cyan); }
.admin-metric-val.amber { color: #fbbf24; }
.admin-metric-sub { font-size: 12px; color: var(--muted); }
.admin-table-card { margin-top: 18px; padding: 0; overflow: hidden; border-radius: var(--radius); border: 1px solid var(--line); background: var(--surface); }
.admin-table { width: 100%; border-collapse: collapse; text-align: left; }
.admin-table th { padding: 12px 16px; font-size: 11.5px; text-transform: uppercase; color: var(--muted); background: rgba(0,0,0,0.3); border-bottom: 1px solid var(--line-strong); }
.admin-table td { padding: 12px 16px; border-bottom: 1px solid var(--line); font-size: 13.5px; }
.btn-place-bet-inline {
  display: inline-flex; align-items: center; gap: 5px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(16, 185, 129, 0.15));
  border: 1px solid rgba(56, 189, 248, 0.35); color: #fff; font-size: 12px; font-weight: 600;
  padding: 5px 10px; border-radius: 8px; margin-left: 6px; cursor: pointer;
}
.btn-place-bet-inline:hover {
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.28), rgba(16, 185, 129, 0.28));
  border-color: var(--cyan);
}
'''

css += bookie_and_admin_styles

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(css)

print('Updated styles.css with bookmaker modal and admin dashboard styles')

