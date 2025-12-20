from pymongo import MongoClient
import os

client = MongoClient(os.getenv("MONGO_URI"))
client.admin.command("ping")
print("Mongo OK")