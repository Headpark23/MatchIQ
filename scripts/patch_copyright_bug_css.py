with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

new_styles = '''
/* Copyright and Bug Report Bar */
.copyright-bar {
  display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center;
  gap: 12px; margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--line);
  font-size: 13px; color: var(--soft); font-weight: 500;
}
.report-bug-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(251, 113, 133, 0.1); border: 1px solid rgba(251, 113, 133, 0.35);
  color: #fecdd3; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 8px;
  transition: all .15s ease;
}
.report-bug-btn:hover {
  background: rgba(251, 113, 133, 0.2); border-color: var(--rose); color: #fff;
}

/* Auto-Updating Admin Dashboard Chart styling */
.admin-chart-box {
  background: linear-gradient(160deg, rgba(14, 23, 40, 0.95), rgba(6, 11, 19, 0.98));
  border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; margin-top: 18px;
}
.admin-chart-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.admin-pulse-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #10b981;
  box-shadow: 0 0 10px #10b981; display: inline-block; margin-right: 6px;
}
'''

css += new_styles

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(css)

print('Updated styles.css with copyright, bug button and chart styles')

