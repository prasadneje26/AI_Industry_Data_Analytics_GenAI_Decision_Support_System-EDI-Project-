import unittest

import pandas as pd

from src.analytics import detect_anomalies, forecast, inventory_risk, machine_learning_forecast


class AnalyticsFunctionTests(unittest.TestCase):
    def setUp(self):
        self.df = pd.read_csv('data/industry_sales_inventory.csv')

    def test_detect_anomalies_runs_without_error(self):
        anomalies, method = detect_anomalies(self.df)
        self.assertIsInstance(method, str)
        self.assertIsInstance(anomalies, pd.DataFrame)

    def test_forecast_returns_rows(self):
        forecast_df, message = forecast(self.df, 6)
        self.assertIsInstance(message, str)
        self.assertIsInstance(forecast_df, pd.DataFrame)

    def test_inventory_risk_returns_data(self):
        risk_df, message = inventory_risk(self.df)
        self.assertIsInstance(message, str)
        self.assertIsInstance(risk_df, pd.DataFrame)
        self.assertIn('risk_level', risk_df.columns)

    def test_machine_learning_and_deep_learning_forecast(self):
        predictions, message = machine_learning_forecast(self.df, 3)
        self.assertIsInstance(message, str)
        self.assertEqual(len(predictions), 3)
        self.assertIn('ml_forecast', predictions.columns)
        self.assertIn('dl_forecast', predictions.columns)


if __name__ == '__main__':
    unittest.main()
