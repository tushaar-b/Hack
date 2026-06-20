import os
import sys
from cloud_api.routers.notion_auth import _post, WATCHLIST_DB_ID, NOTION_API_KEY

print("API KEY:", NOTION_API_KEY[:10] + "...")
print("DB ID:", WATCHLIST_DB_ID)

email = "tushaarbharara@gmail.com"
symbol = "INFY"
try:
    existing = _post(f"databases/{WATCHLIST_DB_ID}/query", {
        "filter": {
            "and": [
                {"property": "User Email", "email": {"equals": email}},
                {"property": "Symbol", "title": {"equals": symbol}},
            ]
        }
    })
    print("EXISTING:", existing)
except Exception as e:
    import traceback
    traceback.print_exc()
