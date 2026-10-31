#!/usr/bin/env python3
with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace any sequence of 4 closing divs before #bookie-modal with 3 closing divs
import re
text = re.sub(r'(</div>\s*){4}(<div class="modal-backdrop" id="bookie-modal")', r'</div>\n  </div>\n</div>\n\n\2', text)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Cleaned extra closing div in index.html.")
