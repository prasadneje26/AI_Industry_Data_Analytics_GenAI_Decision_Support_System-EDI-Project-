import math
from pathlib import Path

import numpy as np
import pandas as pd
import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from src.analytics import (
    auto_insights,
    clean_data,
    correlations,
    descriptive_stats,
    detect_anomalies,
    find_date_column,
    find_measure,
    forecast,
    inventory_risk,
    kpis,
    machine_learning_forecast,
    profile_data,
)
from src.genai import generate
from src.report import make_report

app = FastAPI(title="Industry AI Decision Support API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Helper Function for JSON Serialization Security ---
def clean_for_json(obj):
    """Recursively converts NaN, Infinity, and NumPy types into standard JSON-compliant types."""
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_for_json(v) for v in obj]
    elif isinstance(obj, (float, np.floating)):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return float(obj)
    elif isinstance(obj, (int, np.integer)):
        return int(obj)
    elif isinstance(obj, np.ndarray):
        return clean_for_json(obj.tolist())
    elif pd.isna(obj):
        return None
    return obj


class DecisionRequest(BaseModel):
    question: str
    evidence: dict


class ReportRequest(BaseModel):
    summary: str
    kpis: dict = {}
    insights: list[str] = []
    anomalies: str = ""
    forecast_text: str = ""
    root_cause: str = ""
    actions: str = ""


@app.get("/")
def health():
    return {"status": "ok", "service": "industry-ai-dss-api"}


def model_catalog():
    return {
        "anomaly_detection": "IQR + Isolation Forest",
        "forecasting": "Holt-Winters damped trend with linear fallback",
        "machine_learning": "Random Forest Regressor with lag features",
        "deep_learning": "3-layer MLP neural network with lag features",
        "inventory_risk": "Transparent inventory-to-sales stockout heuristic",
        "genai": "Grounded Decision Copilot (Multi-Provider Support)",
    }


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    try:
        suffix = Path(file.filename or "").suffix.lower()
        content = await file.read()

        if suffix == ".csv":
            df = pd.read_csv(pd.io.common.BytesIO(content))
        elif suffix in {".xlsx", ".xls"}:
            df = pd.read_excel(pd.io.common.BytesIO(content))
        else:
            raise ValueError("Unsupported file type. Use CSV or Excel.")

        if df.empty:
            raise ValueError("Uploaded file contains no data.")

        profile = profile_data(df)
        cleaned, changes, before_missing, after_missing = clean_data(df)
        metric_kpis = kpis(cleaned)

        insights = auto_insights(cleaned)
        anomalies, method = detect_anomalies(cleaned)
        fc, fc_msg = forecast(cleaned, 6)
        model_fc, model_fc_msg = machine_learning_forecast(cleaned, 6)
        risk, risk_msg = inventory_risk(cleaned)

        evidence = {
            "dataset": {"rows": len(cleaned), "columns": len(cleaned.columns)},
            "kpis": metric_kpis,
            "insights": insights,
            "anomalies": anomalies.head(10).to_dict("records"),
            "forecast": fc.to_dict("records"),
            "model_forecast": model_fc.to_dict("records"),
            "inventory_risk": risk.head(10).to_dict("records"),
            "columns": cleaned.columns.tolist(),
        }

        # Generative AI Insights with Graceful Fallbacks
        try:
            root = generate(
                "Identify the most important business problems and probable contributing factors. "
                "For every inference, cite the relevant evidence fields and avoid unsupported causal claims.",
                evidence,
            )
        except Exception as gen_err:
            root = f"Automated Root Cause Fallback: Operational patterns show variance across key metrics. (Notice: GenAI provider temporary offline: {str(gen_err)})"

        try:
            actions = generate(
                "Give 4 prioritized, practical management actions. Use only evidence. "
                "Number the actions and include a short rationale.",
                evidence,
            )
        except Exception as gen_err:
            actions = (
                "1. Audit Inventory Thresholds: Prevent stockouts based on current risk metrics.\n"
                "2. Monitor Anomalies: Review highlighted variance data points.\n"
                "3. Adjust Demand Models: Evaluate sales projections against Holt-Winters trends.\n"
                "4. Stabilize Data Ingestion: Ensure clean telemetry stream uploads."
            )

        payload = {
            "profile": {
                "rows": profile["rows"],
                "columns": profile["columns"],
                "missing_cells": before_missing,
                "duplicates": profile["duplicates"],
                "numeric": profile["numeric"],
                "categorical": profile["categorical"],
                "datetime": profile["datetime"],
            },
            "kpis": metric_kpis,
            "insights": insights,
            "anomalies": anomalies.head(10).to_dict("records"),
            "forecast": fc.to_dict("records"),
            "model_forecast": model_fc.to_dict("records"),
            "risk": risk.head(10).to_dict("records"),
            "root": root,
            "actions": actions,
            "changes": changes,
            "before_missing": before_missing,
            "after_missing": after_missing,
            "forecast_msg": fc_msg,
            "model_forecast_msg": model_fc_msg,
            "risk_msg": risk_msg,
            "anomaly_method": method,
            "models": model_catalog(),
        }

        # Sanitize entire output dictionary before returning to frontend
        return clean_for_json(payload)

    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/decision")
def decision(request: DecisionRequest):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question is required.")

    try:
        answer = generate(question, request.evidence)
    except Exception as exc:
        answer = (
            f"Decision Support Fallback Mode: Unable to query GenAI engine right now ({str(exc)}). "
            "Please review numerical KPIs and anomaly thresholds directly."
        )

    return {"answer": answer, "model": model_catalog()["genai"]}


@app.post("/report")
def report(request: ReportRequest):
    try:
        output_path = Path("outputs") / "industry_ai_decision_report.pdf"
        output_path.parent.mkdir(exist_ok=True)
        make_report(
            str(output_path),
            request.summary,
            request.kpis,
            request.insights,
            request.anomalies,
            request.forecast_text,
            request.root_cause,
            request.actions,
        )
        return FileResponse(
            output_path, media_type="application/pdf", filename=output_path.name
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"PDF Generation failed: {str(exc)}"
        ) from exc


if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)