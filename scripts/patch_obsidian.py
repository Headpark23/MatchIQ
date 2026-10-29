# Patch Decision History
entry = '''
## 29 October 2026 — Panda Football Icon, Top Google Sign-In & Mobile Installation Guide

**Decision:** Human approved mobile accessibility upgrades, panda football icon, and Google login integration:
- **Panda + Football Icon**: Redesigned master app icons (`icon-512.png`, `icon-192.png`, `apple-touch-icon.png`, `favicon-32.png`) featuring a cute panda mascot playing with a classic stitched leather soccer ball atop an emerald/cyan stadium emblem.
- **Top Header Google Sign-In**: Positioned prominent Google sign-in button directly in top header tools bar next to odds toggle. Enables optional one-tap login syncing with player's username handle in Buddy Leagues while keeping anonymous usage 100% friction-free.
- **Mobile Phone PWA Download**:
  - Upgraded PWA manifest with `"id": "/MatchIQ/"` and `"prefer_related_applications": false`.
  - Bumped Service Worker cache to `betbuddy-pwa-v12`.
  - Added "Install App" button in top header triggering native installation on Android/desktop Chrome and opening an illustrated step-by-step walkthrough for iPhone Safari users ("Share" -> "Add to Home Screen").
- Built isolated `public-dist/` distribution with passing regression suites and deployed live to GitHub Pages (`main` branch).
'''

with open('.obsidian_vault/Projects/MatchIQ/MatchIQ Decision History.md', 'r', encoding='utf-8') as f:
    text = f.read()

text += entry

with open('.obsidian_vault/Projects/MatchIQ/MatchIQ Decision History.md', 'w', encoding='utf-8') as f:
    f.write(text)

print('Recorded decision in Obsidian Vault')
