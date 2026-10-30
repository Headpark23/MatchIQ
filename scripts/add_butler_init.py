with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = "updateDiaryCount();\nloadData().then(() => {"
replacement = "updateDiaryCount();\ntry { updateButlerUI(); } catch (e) {}\nloadData().then(() => {"

if target in text:
    text = text.replace(target, replacement)
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Added updateButlerUI() call.")
else:
    print("Target not found.")

