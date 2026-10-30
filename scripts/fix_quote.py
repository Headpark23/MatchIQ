with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

bad = "'</span>'' +"
good = "'</span>' +"

if bad in text:
    text = text.replace(bad, good)
    print("Fixed bad quote successfully!")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(text)

