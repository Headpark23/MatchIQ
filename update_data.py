"""Private MatchIQ research: scheduled CSV refresh, maximum twice weekly."""
import csv,io,json,pathlib,urllib.request,datetime
ROOT=pathlib.Path(__file__).parent
OUT=ROOT/'data'/'matches.json'
SEASONS=('2425','2526','2627')
FIELDS=('Date','HomeTeam','AwayTeam','FTHG','FTAG','FTR','HC','AC','HY','AY','HST','AST','HS','AS')
def main():
    previous=json.loads(OUT.read_text()) if OUT.exists() else {}
    merged={(r['season'],r['Date'],r['HomeTeam'],r['AwayTeam']):r for r in previous.get('matches',[])}
    ok=[];errors=[]
    for season in SEASONS:
        try:
            url='https://www.football-data.co.uk/mmz4281/'+season+'/E0.csv'
            req=urllib.request.Request(url,headers={'User-Agent':'MatchIQ-private-research/0.4'})
            with urllib.request.urlopen(req,timeout=20) as response:
                body=response.read().decode('utf-8-sig',errors='replace')
            records=list(csv.DictReader(io.StringIO(body)))
            if not records or not {'Date','HomeTeam','AwayTeam'}.issubset(records[0]):raise ValueError('Missing columns')
            count=0
            for row in records:
                if not all(row.get(k) for k in ('Date','HomeTeam','AwayTeam')):continue
                clean={k:(row.get(k) or '').strip() for k in FIELDS}
                clean['season']=season
                merged[(season,clean['Date'],clean['HomeTeam'],clean['AwayTeam'])]=clean
                count+=1
            ok.append({'season':season,'rows':count})
        except Exception as exc:errors.append({'season':season,'error':str(exc)})
    if not ok:raise RuntimeError('No source succeeded; preserving existing data')
    payload={'source':'football-data.co.uk','last_successful_refresh':datetime.datetime.now(datetime.timezone.utc).isoformat(),'season_status':ok,'errors':errors,'matches':list(merged.values())}
    OUT.parent.mkdir(exist_ok=True)
    tmp=OUT.with_suffix('.tmp')
    tmp.write_text(json.dumps(payload,separators=(',',':')))
    tmp.replace(OUT)
    print('Updated',len(merged),'records; failures',len(errors))
if __name__=='__main__':main()
