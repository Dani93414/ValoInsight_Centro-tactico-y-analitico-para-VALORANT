from pymongo import MongoClient
import os


def ping_mongo() -> None:
	client = MongoClient(os.getenv("MONGO_URI"))
	client.admin.command("ping")
	print("Mongo OK")


if __name__ == "__main__":
	ping_mongo()