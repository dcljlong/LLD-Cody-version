import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

pid = "4089ef43-02f5-4d8e-a503-6781fc8d64b3"

fixes = {
    2: "Partitions Complete",
    4: "Linings Complete",
    7: "Subbies 2nd Fix to Ceiling Grid -> Tile Out",
}

results = []
for order, name in fixes.items():
    r = db.gates.update_many(
        {"project_id": pid, "order": order},
        {"$set": {"name": name}}
    )
    results.append({
        "order": order,
        "matched": r.matched_count,
        "modified": r.modified_count,
        "name": name
    })

print(results)
