import unittest

from pipeline import recommend


class BttsSampleSize(unittest.TestCase):
    def test_btts_uses_its_own_backtest_size(self):
        markets = {"btts": {"evidence": {"status": "provisional", "strength": "weak"}, "league_p": 0.5,
                            "selections": [{"key": "yes", "label": "Yes", "p": 0.6}]}}
        validation = {"name": "Test League", "markets": {"btts": {"n": 100}, "shots": {"n": 7}}}
        out = recommend.candidates(markets, {}, validation)
        self.assertEqual(out[0]["n"], 100)
        expected = (100 * 0.6 + recommend.SHRINK_WEIGHT * 0.5) / (100 + recommend.SHRINK_WEIGHT)
        self.assertAlmostEqual(out[0]["credible_p"], round(expected, 4), places=4)


if __name__ == "__main__":
    unittest.main()
