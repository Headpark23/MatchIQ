with open('app.js', 'r', encoding='utf-8') as f:
    c = f.read()

# Add toast in joinCloudLeague
old_join_end = """  syncLeagueToCloud(league);
  listenToActiveLeague(code);
  render();
}"""

new_join_end = """  syncLeagueToCloud(league);
  listenToActiveLeague(code);
  toast('Joined ' + league.name + '! ⚽');
  render();
}"""

c = c.replace(old_join_end, new_join_end)

# Autofill input if modal opened
old_route = """  if (hash.startsWith('join-league=')) {
    try {
      const code = decodeURIComponent(hash.slice(12)).trim().toUpperCase();
      joinCloudLeague(code);
    } catch (e) { /* ignore */ }
    return ['leagues'];
  }"""

new_route = """  if (hash.startsWith('join-league=')) {
    try {
      const code = decodeURIComponent(hash.slice(12)).trim().toUpperCase();
      const inp = $('join-league-code');
      if (inp) inp.value = code;
      joinCloudLeague(code);
    } catch (e) { /* ignore */ }
    return ['leagues'];
  }"""

c = c.replace(old_route, new_route)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated joinCloudLeague with instant toast and input autofill.")
