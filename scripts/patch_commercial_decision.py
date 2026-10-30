# Patch Decision History
entry = '''
## 30 October 2026 — Commercial Outreach Dossier & Tiered League Pyramid

**Decision:** Human approved commercial strategy to approach UK bookmakers (Flutter, Entain, bet365, William Hill):
- **Core Value Proposition**: Monitize recreational punters via high-margin accumulator building combined with private social Buddy Leagues.
- **League Scale Pyramid**: Roadmap drafted to progress Buddy Leagues from Private mini-leagues (Tier 1) to Regional (Tier 2), UK National (Tier 3), and Global/World Cup (Tier 4), maintaining strict percentage Win Rate & ROI fairness.
- **Commercial Pitch Assets Created**: Full sponsor dossier and affiliate outreach email templates generated in brain artifact directory.
'''

with open('.obsidian_vault/Projects/MatchIQ/MatchIQ Decision History.md', 'r', encoding='utf-8') as f:
    text = f.read()

text += entry

with open('.obsidian_vault/Projects/MatchIQ/MatchIQ Decision History.md', 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated decision history with commercial strategy')

