#!/usr/bin/env python3
with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

target = '.google-primary-btn:hover { background: #f3f4f6; box-shadow: 0 4px 14px rgba(0,0,0,0.3); }'
additions = '''
.auth-divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 16px 0;
  color: var(--soft);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.auth-divider::before, .auth-divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--line);
}
.auth-divider span {
  padding: 0 10px;
}
.auth-error-box {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #fca5a5;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 8px;
  margin: 10px 0;
  line-height: 1.4;
}
.auth-info-box {
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.35);
  color: #7dd3fc;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 8px;
  margin: 10px 0;
  line-height: 1.4;
}
.auth-warning-box {
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #fcd34d;
  font-size: 13px;
  padding: 10px 12px;
  border-radius: 8px;
  margin-top: 14px;
  line-height: 1.4;
}
.text-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--cyan);
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
  display: inline-block;
}
.text-link:hover { color: #fff; }
.inline-link-btn {
  background: none;
  border: none;
  padding: 0;
  color: var(--cyan);
  font-size: inherit;
  text-decoration: underline;
  cursor: pointer;
  display: inline;
}
.auth-checkbox-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin: 14px 0 10px;
  font-size: 12.5px;
  color: #cbd5e1;
  line-height: 1.45;
}
.auth-checkbox-row input[type="checkbox"] {
  margin-top: 3px;
  accent-color: var(--pick);
  cursor: pointer;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.auth-nav-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
}
'''

if target in css and '.auth-divider' not in css:
    css = css.replace(target, target + additions)
    with open('styles.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print("Added auth styles to styles.css")
else:
    print("Styles already present or target not found")
