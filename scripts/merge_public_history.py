"""Merge all 57 missing evaluated historical predictions into data/public/prediction_history.json
and recalculate data/public/performance.json.
"""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from pipeline import history as hist

def main():
    with open(ROOT / 'data' / 'prediction_history.json', 'r', encoding='utf-8') as f:
        full_ledger = json.load(f)
    with open(ROOT / 'data' / 'public' / 'prediction_history.json', 'r', encoding='utf-8') as f:
        pub_ledger = json.load(f)

    pub_eval_ids = {r['match_id'] for r in pub_ledger['records'] if r.get('evaluated')}
    new_records = []

    for r in full_ledger['records']:
        if not r.get('evaluated') or r['match_id'] in pub_eval_ids:
            continue
        # Filter markets and settlement to public only
        pub_markets = {k: v for k, v in r['markets'].items() if k in ('result', 'goals', 'btts')}
        pub_settle = {k: v for k, v in r.get('settlement', {}).items() if k in ('result', 'goals', 'btts')}

        rec = {
            'record_id': f"PUB-{r['match_id']}#r{r.get('revision', 1)}",
            'match_id': r['match_id'],
            'revision': r.get('revision', 1),
            'fixture': r['fixture'],
            'published_at': r['published_at'],
            'inputs_fingerprint': r.get('inputs_fingerprint', 'public-ledger'),
            'markets': pub_markets,
            'sources': ['football-data.org', 'openfootball'],
            'origin': 'public-derived'
        }
        rec['sha256'] = hist.seal(rec)
        rec['result'] = r['result']
        rec['settlement'] = pub_settle
        rec['evaluated'] = True
        new_records.append(rec)

    print(f"Prepared {len(new_records)} new records to insert.")
    # Insert at the beginning or sort by published_at
    combined_records = new_records + pub_ledger['records']
    combined_records.sort(key=lambda x: x.get('published_at', ''))

    merged_ledger = {
        'version': pub_ledger.get('version', 1),
        'description': pub_ledger.get('description', 'Public prediction history ledger'),
        'records': combined_records
    }

    # Verify sha256 integrity
    hist.verify(merged_ledger)
    print("Verification passed 100%! All SHA-256 seals valid.")

    with open(ROOT / 'data' / 'public' / 'prediction_history.json', 'w', encoding='utf-8') as f:
        json.dump(merged_ledger, f, indent=2, ensure_ascii=False)
    print(f"Saved merged ledger to data/public/prediction_history.json with {len(combined_records)} total records ({sum(1 for r in combined_records if r.get('evaluated'))} evaluated).")

    # Recalculate performance
    new_perf = hist.performance(merged_ledger)
    with open(ROOT / 'data' / 'public' / 'performance.json', 'w', encoding='utf-8') as f:
        json.dump(new_perf, f, indent=2, ensure_ascii=False)
    print("Saved updated data/public/performance.json.")

if __name__ == '__main__':
    main()

