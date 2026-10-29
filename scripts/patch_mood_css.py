with open('styles.css', 'r', encoding='utf-8') as f:
    css_text = f.read()

target = ".panda-mood-card.amber { border-color: rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.1); }"
replacement = target + "\n.panda-mood-card.rose { border-color: rgba(251, 113, 133, 0.4); background: rgba(251, 113, 133, 0.12); }"
css_text = css_text.replace(target, replacement)

target2 = ".panda-mood-card.amber .panda-mood-kicker { color: #fbbf24; }"
replacement2 = target2 + "\n.panda-mood-card.rose .panda-mood-kicker { color: #fb7185; }"
css_text = css_text.replace(target2, replacement2)

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(css_text)

print('Updated styles.css with rose mood card styling')
