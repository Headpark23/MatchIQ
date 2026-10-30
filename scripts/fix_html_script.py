with open('index.html', 'r', encoding='utf-8') as f:
    c = f.read()

bad_snippet = """        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(function(regs) {
            regs.forEach(function(r) { r.update(); });
          });
        }
      }
    } catch (e) {}
          });
        }
      }
    } catch (e) {}"""

good_snippet = """        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(function(regs) {
            regs.forEach(function(r) { r.update(); });
          });
        }
      }
    } catch (e) {}"""

c = c.replace(bad_snippet, good_snippet)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(c)

print("Fixed index.html script tag")

