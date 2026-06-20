import os
from cloud_api.routers.notion_auth import _post, WATCHLIST_DB_ID, NOTION_API_KEY
from datetime import datetime

email = "tushaarbharara@gmail.com"
symbol = "INFY"

try:
    page = _post("pages", {
        "parent": {"database_id": WATCHLIST_DB_ID},
        "properties": {
            "Symbol":     {"title": [{"type": "text", "text": {"content": symbol}}]},
            "User Email": {"email": email},
            "Added At":   {"date":  {"start": datetime.utcnow().date().isoformat()}},
        }
    })
    print("SUCCESS:", page["id"])
except Exception as e:
    import traceback
    traceback.print_exc()
    if hasattr(e, 'response'):
        print(e.response.text)
