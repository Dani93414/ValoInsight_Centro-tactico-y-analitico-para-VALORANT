from __future__ import annotations

TRADE_WINDOW_MS = 5000

SIDE_ATTACK = "attack"
SIDE_DEFENSE = "defense"
SIDE_UNKNOWN = "unknown"

ROLE_DUELIST = "Duelista"
ROLE_INITIATOR = "Iniciador"
ROLE_CONTROLLER = "Controlador"
ROLE_SENTINEL = "Centinela"
ROLE_UNKNOWN = "Desconocido"

ALL_ROLES = {
    ROLE_DUELIST,
    ROLE_INITIATOR,
    ROLE_CONTROLLER,
    ROLE_SENTINEL,
    ROLE_UNKNOWN,
}

RATING_WEIGHTS = {
    ROLE_DUELIST: {
        "adr": 0.18,
        "kills_per_round": 0.16,
        "kd_ratio": 0.14,
        "acs": 0.12,
        "fkfd_diff_per_round": 0.16,
        "trade_kills_per_round": 0.08,
        "clutch_win_rate": 0.04,
        "survival_rate": 0.04,
        "damage_per_1000_credits": 0.04,
        "assists_per_round": 0.04,
    },
    ROLE_INITIATOR: {
        "adr": 0.16,
        "kills_per_round": 0.10,
        "kd_ratio": 0.10,
        "acs": 0.10,
        "fkfd_diff_per_round": 0.10,
        "trade_kills_per_round": 0.12,
        "clutch_win_rate": 0.06,
        "survival_rate": 0.10,
        "damage_per_1000_credits": 0.06,
        "assists_per_round": 0.10,
    },
    ROLE_CONTROLLER: {
        "adr": 0.14,
        "kills_per_round": 0.08,
        "kd_ratio": 0.10,
        "acs": 0.10,
        "fkfd_diff_per_round": 0.06,
        "trade_kills_per_round": 0.10,
        "clutch_win_rate": 0.10,
        "survival_rate": 0.16,
        "damage_per_1000_credits": 0.10,
        "assists_per_round": 0.06,
    },
    ROLE_SENTINEL: {
        "adr": 0.14,
        "kills_per_round": 0.10,
        "kd_ratio": 0.12,
        "acs": 0.10,
        "fkfd_diff_per_round": 0.06,
        "trade_kills_per_round": 0.10,
        "clutch_win_rate": 0.12,
        "survival_rate": 0.14,
        "damage_per_1000_credits": 0.08,
        "assists_per_round": 0.04,
    },
    ROLE_UNKNOWN: {
        "adr": 0.15,
        "kills_per_round": 0.12,
        "kd_ratio": 0.12,
        "acs": 0.10,
        "fkfd_diff_per_round": 0.10,
        "trade_kills_per_round": 0.08,
        "clutch_win_rate": 0.08,
        "survival_rate": 0.10,
        "damage_per_1000_credits": 0.08,
        "assists_per_round": 0.07,
    },
}

BUY_BUCKETS = {
    "eco": (0, 2400),
    "low_buy": (2401, 3900),
    "full_buy": (3901, 999999),
}