"""Fix Google login persistence and header display, add Full Time (Awaiting Feed) status flag,
and update refresh schedule to run every 2 hours.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent

def patch_app():
    path = ROOT / 'app.js'
    code = path.read_text(encoding='utf-8')

    # 1. Prevent onAuthStateChanged(null) from wiping cachedAuthUser on initial page load
    old_auth_changed = """    } else {
      currentAuthUser = null;
      currentAuthProfile = null;
      cachedAuthUser = null;
      try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch (e) {}
    }"""

    new_auth_changed = """    } else {
      currentAuthUser = null;
      currentAuthProfile = null;
      // Do NOT wipe cachedAuthUser here: onAuthStateChanged fires with null on initial boot before resolving session.
      // Explicit sign-out is handled by handleSignOut().
    }"""

    assert old_auth_changed in code, "old_auth_changed not found"
    code = code.replace(old_auth_changed, new_auth_changed, 1)

    # 2. Fix click listeners for auth buttons using .closest()
    old_auth_clicks = """  if (t.id === 'header-auth-btn' || t.id === 'header-user-btn' || t.dataset.openAuth !== undefined) { openAuthModal(); return; }
  if (t.dataset.closeAuth !== undefined) { closeAuthModal(); return; }
  if (t.id === 'btn-auth-google') { signInWithGoogle(); return; }"""

    new_auth_clicks = """  if (t.id === 'header-auth-btn' || t.id === 'header-user-btn' || t.dataset.openAuth !== undefined || t.closest('#header-auth-btn') || t.closest('#header-user-btn') || t.closest('.google-sub-btn')) { openAuthModal(); return; }
  if (t.dataset.closeAuth !== undefined || t.closest('[data-close-auth]')) { closeAuthModal(); return; }
  if (t.id === 'btn-auth-google' || t.closest('#btn-auth-google') || t.closest('.google-primary-btn')) { signInWithGoogle(); return; }"""

    assert old_auth_clicks in code, "old_auth_clicks not found"
    code = code.replace(old_auth_clicks, new_auth_clicks, 1)

    # 3. Add Full Time (Awaiting Feed) flag to logRow
    old_log_row = """function logRow(r) {
  const f = r.fixture, ms = kickoffMs(f), m = r.markets.result, s = r.settlement && r.settlement.result;
  const right = s ? '<span class="badge ' + (s.pick_won ? 'won' : 'lost') + '">' + (s.pick_won ? 'Right' : 'Wrong') + '</span>' : r.result ? '' : '<span class="badge pending">' + (ms > Date.now() ? 'Upcoming' : 'Awaiting') + '</span>';"""

    new_log_row = """function logRow(r) {
  const f = r.fixture, ms = kickoffMs(f), m = r.markets.result, s = r.settlement && r.settlement.result;
  const isPast = ms <= Date.now();
  const isStuck = isPast && (Date.now() - ms > 2.2 * 3600000);
  const pendingBadge = isStuck
    ? '<span class="badge warn" style="font-size:11px;" title="Match completed; awaiting official score confirmation from match feed">Full Time (Awaiting Feed)</span>'
    : '<span class="badge pending">' + (isPast ? 'Awaiting' : 'Upcoming') + '</span>';
  const right = s ? '<span class="badge ' + (s.pick_won ? 'won' : 'lost') + '">' + (s.pick_won ? 'Right' : 'Wrong') + '</span>' : r.result ? '' : pendingBadge;"""

    assert old_log_row in code, "old_log_row not found"
    code = code.replace(old_log_row, new_log_row, 1)

    path.write_text(code, encoding='utf-8')
    print("Successfully patched app.js!")

def patch_workflow():
    path = ROOT / '.github' / 'workflows' / 'matchiq-refresh.yml'
    text = path.read_text(encoding='utf-8')
    text = text.replace("- cron: '40 */6 * * *'", "- cron: '40 */2 * * *'")
    path.write_text(text, encoding='utf-8')
    print("Successfully patched matchiq-refresh.yml schedule to every 2 hours!")

if __name__ == '__main__':
    patch_app()
    patch_workflow()

