import urllib.request
import json

BASE = "https://firestore.googleapis.com/v1/projects/betbuddyuk/databases/(default)/documents"

def clean_doc(collection, doc_id):
    url = f"{BASE}/{collection}/{doc_id}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req) as resp:
            doc = json.loads(resp.read().decode())
    except Exception as e:
        print(f"Error fetching {collection}/{doc_id}: {e}")
        return

    fields = doc.get("fields", {})
    members_map = {}
    
    # Check existing nested members
    if "members" in fields and "mapValue" in fields["members"]:
        existing = fields["members"]["mapValue"].get("fields", {})
        members_map.update(existing)
        
    # Check top-level dot fields
    for k, v in list(fields.items()):
        if k.startswith("members.") and "mapValue" in v:
            handle = k[len("members."):]
            members_map[handle] = v
            
    # Always ensure Punter_747 and HeadPark73 are included
    if "Punter_747" not in members_map:
        members_map["Punter_747"] = {
            "mapValue": {
                "fields": {
                    "handle": {"stringValue": "Punter_747"},
                    "avatar": {"stringValue": "⚽"},
                    "points": {"integerValue": "0"},
                    "winRate": {"integerValue": "0"},
                    "roi": {"integerValue": "0"},
                    "settled": {"integerValue": "0"},
                    "form": {"arrayValue": {"values": [{"stringValue": "—"}]}},
                    "updated_at": {"stringValue": "2026-10-30T14:40:00.000Z"}
                }
            }
        }
    if "HeadPark73" not in members_map:
        members_map["HeadPark73"] = {
            "mapValue": {
                "fields": {
                    "handle": {"stringValue": "HeadPark73"},
                    "avatar": {"stringValue": "⚽"},
                    "points": {"integerValue": "0"},
                    "winRate": {"integerValue": "0"},
                    "roi": {"integerValue": "0"},
                    "settled": {"integerValue": "0"},
                    "form": {"arrayValue": {"values": [{"stringValue": "—"}]}},
                    "updated_at": {"stringValue": "2026-10-30T14:40:00.000Z"}
                }
            }
        }

    # Clean fields - remove dot fields
    cleaned_fields = {k: v for k, v in fields.items() if not k.startswith("members.")}
    cleaned_fields["members"] = {"mapValue": {"fields": members_map}}
    
    # Save back
    patch_req = urllib.request.Request(
        url,
        data=json.dumps({"fields": cleaned_fields}).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='PATCH'
    )
    try:
        with urllib.request.urlopen(patch_req) as resp:
            print(f"Successfully cleaned {collection}/{doc_id}. Members: {list(members_map.keys())}")
    except Exception as e:
        print(f"Error saving {collection}/{doc_id}: {e}")

# Clean all leagues
clean_doc("leagues", "BUDDY-9240")
clean_doc("leagues", "BUDDY-5310")

# Clean all geo leagues
for geo in ["geo-world", "geo-europe", "geo-uk", "country-scotland", "region-renfrewshire", "town-paisley"]:
    clean_doc("geo_leagues", geo)
