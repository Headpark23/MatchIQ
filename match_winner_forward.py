"""MatchIQ experimental Dixon-Coles forward ledger; separate from frozen corners.
Runs on GitHub Actions after fixture refresh. Append predictions before kickoff only.
"""
import datetime as dt
import json
from pathlib import Path
from zoneinfo import ZoneInfo
import penaltyblog as pb

ROOT=Path(__file__).resolve().parent
DATA=ROOT/"data"/"matches.json"
LEDGER=ROOT/"data"/"match_winner_forward.json"
UTC=dt.timezone.utc
UK=ZoneInfo("Europe/London")
MODEL="dixon-coles-v1-forward-frozen"

def main():
    now=dt.datetime.now(UTC)
    data=json.loads(DATA.read_text())
    ledger=json.loads(LEDGER.read_text()) if LEDGER.exists() else {"version":1,"model":MODEL,"records":[]}
    if ledger.get("model")!=MODEL:raise ValueError("Ledger model mismatch")
    records=ledger["records"]
    seen={(r["date"],r["home"],r["away"]) for r in records}
    history=[]
    for r in data.get("matches",[]):
        try:
            day=dt.datetime.strptime(r["Date"],"%d/%m/%Y").date()
            hg,ag=int(r["FTHG"]),int(r["FTAG"])
            history.append((day,r["HomeTeam"],r["AwayTeam"],hg,ag))
        except (ValueError,KeyError,TypeError):continue
    history.sort(key=lambda x:x[0])
    changed=False
    for rec in records:
        if rec["status"]!="pending":continue
        matches=[m for m in history if m[0].isoformat()==rec["date"] and m[1]==rec["home"] and m[2]==rec["away"]]
        if len(matches)!=1 or matches[0][0]>=now.astimezone(UK).date():continue
        m=matches[0];rec["status"]="settled";rec["actual"]="H" if m[3]>m[4] else "A" if m[4]>m[3] else "D"
        rec["score"]=[m[3],m[4]];rec["settled_at"]=now.isoformat();changed=True
    try:age=now-dt.datetime.fromisoformat(data["fixtures_last_checked"].replace("Z","+00:00"))
    except (KeyError,TypeError,ValueError):age=dt.timedelta(days=999)
    if dt.timedelta(0)<=age<=dt.timedelta(days=4):
        for f in data.get("fixtures",[]):
            try:
                day=dt.date.fromisoformat(f["Date"])
                hh,mm=map(int,f["Time"].split(":"))
                kickoff=dt.datetime.combine(day,dt.time(hh,mm),UK).astimezone(UTC)
                home,away=f["HomeTeam"],f["AwayTeam"]
            except (ValueError,KeyError,TypeError):continue
            if not now<kickoff<=now+dt.timedelta(days=14) or (day.isoformat(),home,away) in seen:continue
            prior=[m for m in history if m[0]<day]
            teams={m[1] for m in prior}|{m[2] for m in prior}
            if home not in teams or away not in teams:continue
            if sum(m[1]==home for m in prior)<5 or sum(m[2]==away for m in prior)<5:continue
            model=pb.models.DixonColesGoalModel([m[3] for m in prior],[m[4] for m in prior],
                                                [m[1] for m in prior],[m[2] for m in prior])
            model.fit()
            h,d,a=model.predict(home,away).home_draw_away
            probabilities={"H":round(float(h),6),"D":round(float(d),6),"A":round(float(a),6)}
            rec={"date":day.isoformat(),"kickoff_utc":kickoff.isoformat(),"home":home,"away":away,
                 "created_at":now.isoformat(),"model":MODEL,"status":"pending",
                 "training_matches":len(prior),"probabilities":probabilities}
            records.append(rec);seen.add((day.isoformat(),home,away));changed=True
    if changed:
        LEDGER.write_text(json.dumps(ledger,indent=2)+"\n")
    print("Dixon-Coles forward:",len(records),"records;",sum(r["status"]=="settled" for r in records),"settled; changed:",changed)

if __name__=="__main__":main()
