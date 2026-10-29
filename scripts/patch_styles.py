with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

header_and_auth_styles = '''
/* Header Actions: Install & Google Sign In */
.header-tools { display: flex; align-items: center; gap: 8px; }
.pwa-install-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(56, 189, 248, 0.22));
  border: 1px solid rgba(16, 185, 129, 0.45);
  color: #a7f3d0; font-weight: 700; font-size: 12.5px;
  padding: 6px 12px; border-radius: 9999px; transition: all .15s ease;
}
.pwa-install-btn:hover {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.35), rgba(56, 189, 248, 0.35));
  border-color: #34d399; color: #fff; box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
}
.header-auth-wrap { display: flex; align-items: center; }
.google-btn {
  display: inline-flex; align-items: center; gap: 7px;
  background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18);
  color: #fff; font-weight: 600; font-size: 12.5px;
  padding: 6px 13px; border-radius: 9999px; transition: all .15s ease;
}
.google-btn:hover {
  background: rgba(255, 255, 255, 0.14); border-color: rgba(255, 255, 255, 0.35);
}
.header-user-btn {
  display: inline-flex; align-items: center; gap: 7px;
  background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35);
  padding: 4px 10px 4px 6px; border-radius: 9999px; color: #fff; font-weight: 600; font-size: 12.5px;
}
.header-avatar {
  width: 24px; height: 24px; border-radius: 50%;
  background: linear-gradient(135deg, #059669, #38bdf8);
  display: grid; place-items: center; font-size: 11px; font-weight: 800; color: #04140d;
}

/* Google Sign-in Modal & Profile styles */
.auth-modal { max-width: 440px; }
.auth-modal-brand { display: flex; align-items: center; gap: 10px; }
.auth-modal-brand h2 { margin: 0; font-size: 1.25rem; font-family: var(--display); }
.auth-sub { font-size: 13.5px; color: var(--soft); line-height: 1.5; margin-bottom: 16px; }
.auth-flow-card { background: rgba(255, 255, 255, 0.03); border: 1px solid var(--line); border-radius: 14px; padding: 16px; }
.google-primary-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  background: #ffffff; color: #1f2937; font-weight: 700; font-size: 14px;
  padding: 12px 18px; border-radius: 12px; margin-top: 14px; transition: all .15s ease;
}
.google-primary-btn:hover { background: #f3f4f6; box-shadow: 0 4px 14px rgba(0,0,0,0.3); }
.signed-in-profile {
  display: flex; align-items: center; gap: 16px; padding: 18px;
  background: rgba(255, 255, 255, 0.03); border: 1px solid var(--line); border-radius: 14px;
}
.profile-avatar-large {
  width: 52px; height: 52px; border-radius: 50%;
  background: linear-gradient(135deg, #10b981, #38bdf8);
  display: grid; place-items: center; font-size: 20px; font-weight: 800; color: #04140d;
  box-shadow: 0 0 16px rgba(16, 185, 129, 0.3);
}
.profile-details { display: flex; flex-direction: column; gap: 3px; }
.profile-details strong { font-size: 16px; color: #fff; }
.badge-status-green {
  display: inline-block; width: fit-content; padding: 2px 8px; border-radius: 9999px;
  font-size: 11px; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.35); margin-top: 4px;
}

/* Install Modal styling */
.install-modal-box { max-width: 480px; }
.install-head-badge { display: flex; align-items: center; gap: 12px; }
.install-logo-thumb { border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
.install-guide-steps { display: flex; flex-direction: column; gap: 14px; margin-top: 16px; }
.install-step-item {
  display: flex; gap: 14px; align-items: flex-start;
  padding: 14px; background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line); border-radius: 14px;
}
.install-step-num {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--surface-raised); border: 1px solid var(--cyan);
  color: var(--cyan); font-family: var(--mono); font-weight: 800; font-size: 13px;
  display: grid; place-items: center; flex-shrink: 0;
}
.install-step-body strong { display: block; color: #fff; font-size: 14px; margin-bottom: 2px; }
.install-step-body span { font-size: 13px; color: var(--soft); }
.install-badge-preview {
  display: flex; align-items: center; gap: 14px; padding: 14px; margin-top: 16px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(56, 189, 248, 0.1));
  border: 1px dashed rgba(56, 189, 248, 0.35); border-radius: 14px;
}
'''

css += header_and_auth_styles

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(css)

print('Updated styles.css with header auth & install styling')
