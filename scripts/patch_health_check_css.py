with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

styles_to_add = '''
/* Sub-header admin link */
.sub-admin-link {
  color: var(--cyan); text-decoration: none; font-size: 11.5px; font-weight: 600;
  padding: 1px 6px; border-radius: 4px; background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.25);
}
.sub-admin-link:hover { background: rgba(56, 189, 248, 0.2); color: #fff; }

/* Ladbrokes & Coral Bookmaker Badges */
.bookie-tag.ladbrokes { background: #d31e1e; color: #fff; }
.bookie-tag.coral { background: #004c97; color: #ffeb3b; }

/* Compliance text button */
.compliance-link-btn {
  color: var(--soft); text-decoration: underline; text-underline-offset: 3px;
  background: none; border: none; padding: 0; font: inherit; font-size: 12px; cursor: pointer;
}
.compliance-link-btn:hover { color: #fff; }

/* Auth Modal Benefits Grid */
.auth-benefits-grid {
  display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 18px;
}
.auth-benefit-item {
  display: flex; align-items: flex-start; gap: 12px; padding: 10px 14px;
  border-radius: 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--line);
}
.benefit-icon { font-size: 20px; line-height: 1.2; flex-shrink: 0; }
.auth-benefit-item strong { display: block; font-size: 13.5px; color: #fff; font-weight: 600; margin-bottom: 2px; }
.auth-benefit-item span { font-size: 12px; color: var(--soft); line-height: 1.4; display: block; }

/* Universal Share Sheet Modal */
.share-modal-box { max-width: 480px; }
.share-preview-card {
  background: rgba(0, 0, 0, 0.35); border: 1px solid var(--line-strong);
  border-radius: 12px; padding: 12px; margin-bottom: 16px; max-height: 120px; overflow-y: auto;
}
.share-text-box {
  font-family: var(--mono); font-size: 12px; color: var(--soft);
  white-space: pre-wrap; word-break: break-word; line-height: 1.5; margin: 0;
}
.share-channels-grid { display: flex; flex-direction: column; gap: 8px; }
.share-channel-btn {
  display: flex; align-items: center; gap: 14px; padding: 12px 16px;
  border-radius: 12px; border: 1px solid var(--line); background: rgba(255, 255, 255, 0.03);
  text-decoration: none; color: #fff; font-size: 14px; transition: all .15s ease;
}
.share-channel-btn:hover {
  background: rgba(255, 255, 255, 0.08); border-color: var(--cyan); transform: translateX(3px);
}
.share-channel-btn.whatsapp svg { color: #25d366; }
.share-channel-btn.whatsapp:hover { border-color: #25d366; }
.share-channel-btn.sms svg { color: #38bdf8; }
.share-channel-btn.email svg { color: #fbbf24; }
.share-channel-btn.copy svg { color: #a7f3d0; }
.share-channel-btn strong { display: block; font-size: 14px; color: #fff; }
.share-channel-btn span { font-size: 12px; color: var(--muted); }
.share-arrow { margin-left: auto; font-size: 18px; color: var(--dim); }

/* GDPR Privacy Notice Modal */
.gdpr-modal-box { max-width: 620px; max-height: 85vh; overflow-y: auto; }
.gdpr-body-content { font-size: 13.5px; line-height: 1.6; color: var(--soft); }
.gdpr-section { margin-bottom: 16px; }
.gdpr-section h3 { font-size: 15px; color: #fff; font-weight: 700; margin-bottom: 4px; }
.gdpr-list { margin: 8px 0 8px 20px; display: grid; gap: 6px; }
.gdpr-list b { color: #fff; }
'''

css += styles_to_add

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(css)

print('Updated styles.css with health check styles')

