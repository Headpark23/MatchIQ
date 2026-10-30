with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Replace header tools and auth styles with slim compact styling
old_styles = '''.header-tools { display: flex; align-items: center; gap: 8px; }
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
}'''

new_styles = '''/* Slim Header & Tools */
.header-tools { display: flex; align-items: center; gap: 6px; }
.pwa-install-btn {
  display: inline-flex; align-items: center; gap: 4px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(56, 189, 248, 0.18));
  border: 1px solid rgba(16, 185, 129, 0.4);
  color: #a7f3d0; font-weight: 600; font-size: 11.5px;
  padding: 4px 9px; min-height: 28px; border-radius: 9999px; transition: all .15s ease;
}
.pwa-install-btn:hover {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(56, 189, 248, 0.3));
  border-color: #34d399; color: #fff;
}
@media (max-width: 480px) {
  .pwa-install-btn { padding: 4px 7px; }
  .pwa-install-btn .install-label { display: none; }
}

/* Sub-Header Banner (Below Bet Buddy logo banner) */
.sub-header-bar {
  background: rgba(6, 11, 20, 0.82);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(8px);
}
.sub-header-inner {
  max-width: 1240px; margin: 0 auto; padding: 6px 20px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  min-height: 38px;
}
.sub-header-left { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
.badge-dot-live { width: 6px; height: 6px; border-radius: 50%; background: var(--pick); box-shadow: 0 0 6px var(--pick); }
.sub-header-tagline { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub-header-auth-wrap { display: flex; align-items: center; }

.google-sub-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f1f5f9; font-weight: 500; font-size: 12px;
  padding: 3px 10px; border-radius: 9999px; transition: all .15s ease;
}
.google-sub-btn:hover {
  background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.25); color: #fff;
}
.header-user-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 2px 8px 2px 4px; border-radius: 9999px; color: #fff; font-weight: 600; font-size: 11.5px;
}
.header-avatar {
  width: 20px; height: 20px; border-radius: 50%;
  background: linear-gradient(135deg, #059669, #38bdf8);
  display: grid; place-items: center; font-size: 10px; font-weight: 800; color: #04140d;
}

@media (max-width: 600px) {
  .sub-header-inner { padding: 5px 14px; }
  .sub-header-tagline { display: none; }
}'''

assert old_styles in css, 'old_styles not found in styles.css'
css = css.replace(old_styles, new_styles)

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(css)

print('Updated styles.css with slim header and sub-header bar styling')

