import argparse
import os
from dotenv import load_dotenv
from pymongo import MongoClient

DEFAULT_TARGETS = [
    ("No Screams", "GFS"),
    ("No Baiting", "NNG"),
    ("No Smoking", "Camel"),
    ("No Enemies", "11111"),
    ("No Filling", "GFS"),
    ("No AFK", "zzz"),
    ("No Reason", "GFS"),
]


def _parse_player(spec: str) -> tuple[str, str]:
    """Parse 'Name#Tag' into (gameName, tagLine)."""
    if "#" not in spec:
        raise argparse.ArgumentTypeError(f"Formato inválido '{spec}', usa 'Nombre#Tag'")
    name, tag = spec.rsplit("#", 1)
    return (name, tag)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verifica duplicados de matchId y conteo de partidas por jugadores objetivo.",
    )
    parser.add_argument(
        "--expected-per-player",
        type=int,
        default=400,
        help="Conteo esperado por jugador objetivo.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Devuelve exit code 1 si hay duplicados o conteos distintos al esperado.",
    )
    parser.add_argument(
        "--players",
        nargs="+",
        type=_parse_player,
        default=None,
        help="Jugadores a verificar (formato: 'Nombre#Tag'). Por defecto usa la lista interna.",
    )
    args = parser.parse_args()

    targets = args.players if args.players else DEFAULT_TARGETS

    load_dotenv()
    db_uri = os.getenv("DB_URI")
    db_name = os.getenv("DB_NAME")
    if not db_uri or not db_name:
        raise SystemExit("Faltan DB_URI o DB_NAME en .env")

    db = MongoClient(db_uri)[db_name]

    dups = list(
        db.matches.aggregate(
            [
                {"$group": {"_id": "$matchInfo.matchId", "n": {"$sum": 1}}},
                {"$match": {"n": {"$gt": 1}}},
            ]
        )
    )

    print("DUP_MATCH_IDS", len(dups))
    if dups:
        print("Ejemplos de duplicados (max 10):")
        for row in dups[:10]:
            print(f"- {row.get('_id')}: {row.get('n')}")

    print("\nTARGET_MATCH_COUNTS")
    mismatches = []
    for game_name, tag_line in targets:
        count = db.matches.count_documents(
            {
                "players": {
                    "$elemMatch": {
                        "gameName": game_name,
                        "tagLine": tag_line,
                    }
                }
            }
        )
        delta = count - args.expected_per_player
        if delta == 0:
            delta_label = "OK"
        elif delta < 0:
            delta_label = f"faltan {abs(delta)}"
        else:
            delta_label = f"sobran {delta}"

        print(f"{game_name}#{tag_line}: {count} ({delta_label})")
        if count != args.expected_per_player:
            mismatches.append((game_name, tag_line, count))

    if args.strict and (dups or mismatches):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
