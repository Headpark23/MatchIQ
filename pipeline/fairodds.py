"""Python twin of market_calculations.js formatFairOdds, so the history ledger stores
exactly the fractional fair odds the app displays. tests/test_pipeline.py checks parity."""
from fractions import Fraction

UK_PRICE_LADDER = (
    "1/20", "1/16", "1/14", "1/12", "1/10", "1/9", "1/8", "1/7", "1/6", "1/5", "2/9", "1/4", "2/7",
    "3/10", "1/3", "4/11", "2/5", "4/9", "1/2", "8/15", "4/7", "8/13", "4/6", "8/11", "4/5", "5/6",
    "10/11", "Evens", "11/10", "6/5", "5/4", "11/8", "6/4", "13/8", "7/4", "15/8", "2/1", "9/4",
    "5/2", "11/4", "3/1", "100/30", "7/2", "4/1", "9/2", "5/1", "11/2", "6/1", "13/2", "7/1",
    "15/2", "8/1", "9/1", "10/1", "11/1", "12/1", "14/1", "16/1", "18/1", "20/1", "25/1", "33/1",
    "40/1", "50/1", "66/1", "100/1",
)


def decimal_price(fractional):
    return 2.0 if fractional == "Evens" else 1 + float(Fraction(fractional))


def fair_odds(probability):
    if probability is None or not 0 < probability < 1:
        return "—"
    best = min(UK_PRICE_LADDER, key=lambda price: abs(1 / decimal_price(price) - probability))
    return "≈" + best
