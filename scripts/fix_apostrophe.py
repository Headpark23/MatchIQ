with open('app.js', 'r', encoding='utf-8') as f:
    c = f.read()
c = c.replace("'St. Andrew's'", '"St. Andrews"')
with open('app.js', 'w', encoding='utf-8') as f:
    f.write(c)
print("Fixed stadium string in app.js")

