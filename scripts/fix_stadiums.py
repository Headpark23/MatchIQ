with open('app.js', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("'John Smith's Stadium'", '"John Smiths Stadium"')

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(c)

print("Fixed John Smiths Stadium")

