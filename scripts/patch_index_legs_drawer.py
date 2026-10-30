with open('index.html', 'r', encoding='utf-8') as f:
    h = f.read()

target = """        <a href="https://sports.williamhill.com/betting/en-gb/football" target="_blank" rel="noopener noreferrer" class="bookie-choice-btn" data-bookie-click="William Hill">
          <span class="bookie-tag wh">WH</span>
          <div><strong>William Hill</strong><span class="text-sm muted">Epic Odds & traditional UK betting shop</span></div>
          <span class="bookie-go-arrow">›</span>
        </a>
      </div>"""

replacement = """        <a href="https://sports.williamhill.com/betting/en-gb/football" target="_blank" rel="noopener noreferrer" class="bookie-choice-btn" data-bookie-click="William Hill">
          <span class="bookie-tag wh">WH</span>
          <div><strong>William Hill</strong><span class="text-sm muted">Epic Odds & traditional UK betting shop</span></div>
          <span class="bookie-go-arrow">›</span>
        </a>
        <a href="https://www.leovegas.com/en-gb/betting#search/football" target="_blank" rel="noopener noreferrer" class="bookie-choice-btn" data-bookie-click="LeoVegas">
          <span class="bookie-tag" style="background:#ff6600;color:#fff;font-weight:700;">LV</span>
          <div><strong>LeoVegas Sport</strong><span class="text-sm muted">Top mobile betting app & fast acca builder</span></div>
          <span class="bookie-go-arrow">›</span>
        </a>
      </div>
      <div id="bookie-legs-drawer" hidden></div>"""

if target in h:
    h = h.replace(target, replacement)
    print("Added LeoVegas and bookie-legs-drawer to index.html")
else:
    target_crlf = target.replace('\n', '\r\n')
    replacement_crlf = replacement.replace('\n', '\r\n')
    if target_crlf in h:
        h = h.replace(target_crlf, replacement_crlf)
        print("Added LeoVegas and bookie-legs-drawer (CRLF) to index.html")
    else:
        print("Warning: target not matched in index.html")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(h)

