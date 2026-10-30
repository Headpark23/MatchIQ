css_additions = '''
/* ------------------------------------------------------------ Multi-Sport Filter & Event Cards */
.sport-filter-bar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0 14px 0;
  margin-bottom: 8px;
  -webkit-overflow-scrolling: touch;
}
.sport-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 20px;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--soft);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.sport-pill:hover {
  background: var(--surface-light);
  color: #fff;
  border-color: var(--border-hover);
}
.sport-pill.active {
  background: rgba(6, 182, 212, 0.14);
  border-color: var(--cyan);
  color: #fff;
  box-shadow: 0 0 12px rgba(6, 182, 212, 0.25);
}
.sport-events-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin-top: 14px;
}
.sport-event-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sport-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
.sport-event-title {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  margin: 0;
}
.sport-tournament-sub {
  font-size: 12px;
  color: var(--dim);
  margin-top: 2px;
}
.sport-odds-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sport-selection-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
  border-radius: 8px;
  gap: 8px;
}
.sport-sel-info {
  display: flex;
  flex-direction: column;
}
.sport-sel-name {
  font-weight: 600;
  font-size: 13.5px;
  color: #fff;
}
.sport-sel-bookie {
  font-size: 11px;
  color: var(--dim);
}
.sport-sel-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sport-odds-btn {
  background: rgba(6, 182, 212, 0.12);
  border: 1px solid var(--cyan);
  color: var(--cyan);
  font-family: monospace;
  font-weight: 700;
  font-size: 13.5px;
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.sport-odds-btn:hover {
  background: var(--cyan);
  color: #000;
}
.btn-add-cross-acca {
  background: rgba(16, 185, 129, 0.14);
  border: 1px solid var(--emerald);
  color: var(--emerald);
  font-size: 12px;
  font-weight: 600;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}
.btn-add-cross-acca:hover {
  background: var(--emerald);
  color: #000;
}

/* ------------------------------------------------------------ 6-Tier Geo Ladders & Silverware */
.geo-ladder-nav {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
  margin: 16px 0;
}
.geo-tier-btn {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}
.geo-tier-btn:hover {
  border-color: var(--border-hover);
  background: var(--surface-light);
}
.geo-tier-btn.active {
  border-color: var(--cyan);
  background: rgba(6, 182, 212, 0.08);
  box-shadow: 0 0 10px rgba(6, 182, 212, 0.2);
}
.geo-tier-name {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 6px;
}
.geo-tier-scope {
  font-size: 11px;
  color: var(--dim);
}

.frequency-toggle-bar {
  display: inline-flex;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 3px;
  gap: 3px;
}
.freq-btn {
  background: transparent;
  border: none;
  color: var(--dim);
  font-size: 12.5px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.freq-btn:hover {
  color: #fff;
}
.freq-btn.active {
  background: var(--surface-light);
  color: #fff;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}

/* ------------------------------------------------------------ Trophy Cabinet & Showcase */
.trophy-summary-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(16, 185, 129, 0.08));
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 700;
  color: #f59e0b;
  cursor: pointer;
}
.trophy-summary-pill:hover {
  border-color: #f59e0b;
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.3);
}

.trophy-cabinet-box {
  max-width: 680px;
  max-height: 85vh;
  overflow-y: auto;
}
.trophy-haul-banner {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--line);
  border-radius: 10px;
  margin-bottom: 20px;
  text-align: center;
}
.trophy-haul-val {
  font-size: 24px;
  font-weight: 800;
  font-family: monospace;
}
.trophy-haul-val.gold { color: #f59e0b; }
.trophy-haul-val.silver { color: #e2e8f0; }
.trophy-haul-val.bronze { color: #d97706; }
.trophy-haul-lbl {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--dim);
  font-weight: 700;
  letter-spacing: 0.5px;
}

.trophy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.trophy-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  position: relative;
  overflow: hidden;
}
.trophy-card.tier-worldwide {
  border-color: rgba(6, 182, 212, 0.4);
  background: linear-gradient(180deg, rgba(6, 182, 212, 0.08) 0%, var(--surface) 100%);
}
.trophy-card.tier-europe {
  border-color: rgba(234, 179, 8, 0.4);
  background: linear-gradient(180deg, rgba(234, 179, 8, 0.08) 0%, var(--surface) 100%);
}
.trophy-card.tier-uk {
  border-color: rgba(239, 68, 68, 0.4);
  background: linear-gradient(180deg, rgba(239, 68, 68, 0.08) 0%, var(--surface) 100%);
}
.trophy-card.tier-country {
  border-color: rgba(2, 132, 199, 0.4);
  background: linear-gradient(180deg, rgba(2, 132, 199, 0.08) 0%, var(--surface) 100%);
}
.trophy-card.tier-region {
  border-color: rgba(16, 185, 129, 0.4);
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.08) 0%, var(--surface) 100%);
}
.trophy-card.tier-town {
  border-color: rgba(245, 158, 11, 0.4);
  background: linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, var(--surface) 100%);
}

.trophy-icon-large {
  font-size: 38px;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));
}
.trophy-title {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
}
.trophy-period {
  font-size: 11px;
  color: var(--dim);
}
.trophy-rank-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 800;
}
.trophy-rank-tag.gold {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  border: 1px solid #f59e0b;
}
.trophy-rank-tag.silver {
  background: rgba(226, 232, 240, 0.2);
  color: #e2e8f0;
  border: 1px solid #cbd5e1;
}
.trophy-rank-tag.bronze {
  background: rgba(217, 119, 6, 0.2);
  color: #d97706;
  border: 1px solid #d97706;
}

/* Emoji picker in league modal */
.emoji-picker-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0;
}
.emoji-opt-btn {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.emoji-opt-btn:hover, .emoji-opt-btn.active {
  background: rgba(6, 182, 212, 0.15);
  border-color: var(--cyan);
  transform: scale(1.1);
}
'''

with open('styles.css', 'a', encoding='utf-8') as f:
    f.write(css_additions)

print('Appended Leagues, Silverware and Multi-Sport CSS to styles.css')
