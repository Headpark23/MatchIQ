with open('app.js', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("window.launchBookmakerSlip = launchBookmakerSlip;", "if (typeof window !== 'undefined') window.launchBookmakerSlip = launchBookmakerSlip;")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(c)

print("Guarded window in app.js")
