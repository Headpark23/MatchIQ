with open('build_public_dist.py', 'r', encoding='utf-8') as f:
    text = f.read()

target = '"rights.json"'
replacement = '"rights.json",\n    "multi_sport_events.json"'

assert target in text, 'target not found'
text = text.replace(target, replacement, 1)

with open('build_public_dist.py', 'w', encoding='utf-8', newline='\n') as f:
    f.write(text)

print('Added multi_sport_events.json to build_public_dist.py')

