"""Offline, synthetic settlement regression checks. Never writes repository ledgers."""
import copy
import datetime as dt
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
TODAY=dt.datetime.now(dt.timezone.utc).date()
DAY=(TODAY-dt.timedelta(days=3))
DATE=DAY.strftime("%d/%m/%Y")
ISO=DAY.isoformat()

def check(script, model, prediction, valid, bad, expected):
    with tempfile.TemporaryDirectory() as tmp:
        root=Path(tmp)
        (root/"data").mkdir()
        (root/script).write_text((ROOT/script).read_text())
        ledger={"version":1,"model":model,"records":[prediction]}
        (root/"data"/("forward_test.json" if script=="forward_test.py" else "match_winner_forward.json")).write_text(json.dumps(ledger))
        def run(rows):
            (root/"data"/"matches.json").write_text(json.dumps({"matches":rows,"fixtures":[],"fixtures_last_checked":None}))
            result=subprocess.run([sys.executable,str(root/script)],cwd=root,capture_output=True,text=True)
            if result.returncode: raise AssertionError(result.stdout+"\n"+result.stderr)
            path=root/"data"/("forward_test.json" if script=="forward_test.py" else "match_winner_forward.json")
            return json.loads(path.read_text())["records"][0]
        for label,rows in [("missing",[]),("invalid",[bad]),("duplicate",[valid,valid])]:
            got=run(rows)
            assert got==prediction,(script,label,got)
        got=run([valid])
        assert got["status"]=="settled",(script,got)
        assert got["probabilities"]==prediction["probabilities"],"probabilities changed"
        assert got[expected[0]]==expected[1],(script,got)
        assert run([valid])==got,"settlement not idempotent"
        print(script+": missing, invalid, duplicate, valid, immutable and idempotent PASS")

def main():
    base={"date":ISO,"home":"Alpha","away":"Beta","created_at":(dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=5)).isoformat(),"status":"pending"}
    corner=dict(base,probabilities={"9.5":0.55},model="v0.9-frozen-poisson")
    match={"Date":DATE,"HomeTeam":"Alpha","AwayTeam":"Beta","FTHG":"2","FTAG":"1","FTR":"H","HC":"6","AC":"5"}
    invalid=dict(match,HC="-1")
    check("forward_test.py","v0.9-frozen-poisson",corner,match,invalid,("actual_corners",11.0))
    winner=dict(base,probabilities={"H":0.6,"D":0.25,"A":0.15},model="dixon-coles-v1-forward-frozen")
    invalid_winner=dict(match,FTR="A")
    check("match_winner_forward.py","dixon-coles-v1-forward-frozen",winner,match,invalid_winner,("actual","H"))

if __name__=="__main__":main()
