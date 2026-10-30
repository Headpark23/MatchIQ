with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

# 1. Add brand-panda-img styles right after .brand-mark
old_brand_mark = '.brand-mark { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: linear-gradient(135deg, var(--pick-deep), var(--cyan)); box-shadow: 0 0 18px var(--pick-glow); }'
new_brand_mark = '''.brand-mark { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: linear-gradient(135deg, var(--pick-deep), var(--cyan)); box-shadow: 0 0 18px var(--pick-glow); }
.brand-panda-img { width: 34px; height: 34px; border-radius: 10px; object-fit: cover; box-shadow: 0 0 16px rgba(16, 185, 129, 0.35); display: block; }'''

assert old_brand_mark in css, 'old_brand_mark not found'
css = css.replace(old_brand_mark, new_brand_mark, 1)

# 2. Update .pwa-install-btn and media query
old_install_block = '''.pwa-install-btn {
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
}'''

new_install_block = '''.pwa-install-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.22), rgba(6, 182, 212, 0.22));
  border: 1px solid var(--emerald);
  color: #fff; font-weight: 700; font-size: 13px;
  padding: 6px 12px; min-height: 32px; border-radius: 9999px; transition: all .15s ease;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.2);
  cursor: pointer;
}
.pwa-install-btn:hover {
  background: var(--emerald);
  color: #000;
  box-shadow: 0 0 14px rgba(16, 185, 129, 0.45);
}
@media (max-width: 480px) {
  .pwa-install-btn { padding: 5px 9px; font-size: 12px; min-height: 28px; }
  .pwa-install-btn .install-label { font-size: 11.5px; display: inline !important; }
  .brand-panda-img { width: 32px; height: 32px; }
}'''

assert old_install_block in css, 'old_install_block not found'
css = css.replace(old_install_block, new_install_block, 1)

with open('styles.css', 'w', encoding='utf-8', newline='\n') as f:
    f.write(css)

print('Updated styles.css successfully')
