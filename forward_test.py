"""MatchIQ v1.0: append-only pre-match corners predictions, later settlement.
No odds, no betting instructions, no retrospective prediction creation.
Uses cached data; does not contact external services.
"""
import datetime as dt, json, math, pathlib
from zoneinfo import ZoneInfo

ROOT=pathlib.Path(__file__).parent
DATA=ROOT/"data"/"matches.json"
LEDGER=ROOT/"data"/"forward_test.json"
UTC=dt.timezone.utc
UK=ZoneInfo("Europe/London")
LINES=(8.5,9.5,10.5)

def parse_date(value):
    for fmt in ("%d/%m/%Y","%d/%m/%y","%Y-%m-%d"):
        try:return dt.datetime.strptime(value,fmt).date()
        except ValueError:pass
    return None

def number(value):
    try:return float(value)
    except (ValueError,TypeError):return None

def poisson_over(mean,line):
    term=math.exp(-mean);cdf=term
    for k in range(1,int(line)+1):
        term*=mean/k;cdf+=term
    return max(0,min(1,1-cdf))

def main():
    now=dt.datetime.now(UTC)
    data=json.loads(DATA.read_text())
    ledger=json.loads(LEDGER.read_text()) if LEDGER.exists() else {"version":1,"model":"v0.9-frozen-poisson","records":[]}
    if ledger.get("model")!="v0.9-frozen-poisson":raise ValueError("Unexpected ledger model; refusing to modify")
    records=ledger["records"]
    seen={(r["date"],r["home"],r["away"]) for r in records}
    history=[]
    for r in data.get("matches",[]):
        date=parse_date(r.get("Date",""))
        hc,ac=number(r.get("HC")),number(r.get("AC"))
        if date and hc is not None and ac is not None:
            history.append((date,r,hc,ac))
    history.sort(key=lambda x:x[0])
    changed=False
    # Settle previously committed predictions only. Never change probabilities.
    for record in records:
        if record.get("status")!="pending":continue
        matches=[(date,hc+ac) for date,r,hc,ac in history if date.isoformat()==record["date"] and r["HomeTeam"]==record["home"] and r["AwayTeam"]==record["away"]]
        if len(matches)!=1:continue
        date,total=matches[0]
        if date>=now.date():continue
        record["status"]="settled";record["actual_corners"]=total
        record["outcomes"]={line:int(total>float(line)) for line in record["probabilities"]}
        record["settled_at"]=now.isoformat()
        changed=True
    checked=data.get("fixtures_last_checked")
    try:age=now-dt.datetime.fromisoformat(checked)
    except (ValueError,TypeError):age=dt.timedelta(days=999)
    # Fail closed when fixture schedule is stale.
    if dt.timedelta(0)<=age<=dt.timedelta(days=4):
        for f in data.get("fixtures",[]):
            date=parse_date(f.get("Date",""))
            try:
                hour,minute=map(int,f["Time"].split(":"))
                kickoff=dt.datetime.combine(date,dt.time(hour,minute),UK).astimezone(UTC)
            except (ValueError,TypeError,KeyError):continue
            if not now<kickoff<=now+dt.timedelta(days=14):continue
            home,away=f.get("HomeTeam"),f.get("AwayTeam")
            if not home or not away or (date.isoformat(),home,away) in seen:continue
            # Prior calendar days only, no same-day leakage.
            h=[(r,hc,ac) for d,r,hc,ac in history if d<date and r["HomeTeam"]==home][-10:]
            a=[(r,hc,ac) for d,r,hc,ac in history if d<date and r["AwayTeam"]==away][-10:]
            if len(h)<5 or len(a)<5:continue
            avg=lambda values:sum(values)/len(values)
            expected=(avg([hc for _,hc,ac in h])+avg([hc for _,hc,ac in a])+
                      avg([ac for _,hc,ac in a])+avg([ac for _,hc,ac in h]))/2
            record={"date":date.isoformat(),"kickoff_utc":kickoff.isoformat(),"home":home,"away":away,
                    "created_at":now.isoformat(),"model":"v0.9-frozen-poisson","status":"pending",
                    "sample_home":len(h),"sample_away":len(a),"expected_corners":round(expected,5),
                    "probabilities":{str(line):round(poisson_over(expected,line),6) for line in LINES}}
            records.append(record);seen.add((date.isoformat(),home,away));changed=True
    if changed:
        LEDGER.parent.mkdir(exist_ok=True)
        LEDGER.write_text(json.dumps(ledger,indent=2)+"\n")
    print("Forward ledger:",len(records),"entries;",sum(r["status"]=="settled" for r in records),"settled; changed:",changed)
if __name__=="__main__":main()
