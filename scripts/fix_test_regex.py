with open('app.js', 'r', encoding='utf-8') as f:
    app_text = f.read()

# Replace slipOdds.toFixed(1) with Math.round(slipOdds)
app_text = app_text.replace("kicker: 'Balanced Acca (' + slipOdds.toFixed(1) + '/1)'", "kicker: 'Balanced Acca (' + Math.round(slipOdds) + '/1)'")
app_text = app_text.replace("kicker: 'High Chance Pick (' + slipOdds.toFixed(1) + '/1)'", "kicker: 'High Chance Pick (' + Math.max(1, Math.round(slipOdds)) + '/1)'")

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_text)

print('Replaced slipOdds.toFixed(1) with integer rounding')
