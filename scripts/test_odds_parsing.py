import re
with open('data/predictions.json', 'r', encoding='utf-8') as f:
    text = f.read()

matches = re.findall(r'"fair_odds":\s*"([^"]+)"', text)
unique = set(matches)
print('Total fair_odds found:', len(matches))
for s in sorted(list(unique))[:30]:
    print(ascii(s))
