from pathlib import Path

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

app = FastAPI(title='Industry AI Decision Support API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class DecisionRequest(BaseModel):
    question: str
    evidence: dict


class ReportRequest(BaseModel):
    summary: str
    kpis: dict = {}
    insights: list[str] = []
    anomalies: str = ''
    forecast_text: str = ''
    root_cause: str = ''
    actions: str = ''


@app.get('/')
def health():
    return {'status': 'ok', 'service': 'industry-ai-dss-api'}


def model_catalog():
    return {
        'anomaly_detection': 'IQR + Isolation Forest',
        'forecasting': 'Holt-Winters damped trend with linear fallback',
        'machine_learning': 'Random Forest Regressor with lag features',
        'deep_learning': '3-layer MLP neural network with lag features',
        'inventory_risk': 'Transparent inventory-to-sales stockout heuristic',
        'genai': 'Gemini or OpenAI grounded decision copilot',
    }


@app.post('/analyze')
async def analyze(file: UploadFile = File(...)):
    try:
        suffix = Path(file.filename or '').suffix.lower()
        content = await file.read()
        if suffix == '.csv':
            df = pd.read_csv(pd.io.common.BytesIO(content))
        elif suffix in {'.xlsx', '.xls'}:
            df = pd.read_excel(pd.io.common.BytesIO(content))
        else:
            raise ValueError('Unsupported file type. Use CSV or Excel.')

        profile = profile_data(df)
        cleaned, changes, before_missing, after_missing = clean_data(df)
        metric_kpis = kpis(cleaned)

        insights = auto_insights(cleaned)
        anomalies, method = detect_anomalies(cleaned)
        fc, fc_msg = forecast(cleaned, 6)
        model_fc, model_fc_msg = machine_learning_forecast(cleaned, 6)
        risk, risk_msg = inventory_risk(cleaned)

        evidence = {
            'dataset': {'rows': len(cleaned), 'columns': len(cleaned.columns)},
            'kpis': metric_kpis,
            'insights': insights,
            'anomalies': anomalies.head(10).to_dict('records'),
            'forecast': fc.to_dict('records'),
            'model_forecast': model_fc.to_dict('records'),
            'inventory_risk': risk.head(10).to_dict('records'),
            'columns': cleaned.columns.tolist(),
        }

        root = generate('Identify the most important business problems and probable contributing factors. For every inference, cite the relevant evidence fields and avoid unsupported causal claims.', evidence)
        actions = generate('Give 4 prioritized, practical management actions. Use only evidence. Number the actions and include a short rationale.', evidence)

        return {
            'profile': {
                'rows': profile['rows'],
                'columns': profile['columns'],
                'missing_cells': before_missing,
                'duplicates': profile['duplicates'],
                'numeric': profile['numeric'],
                'categorical': profile['categorical'],
                'datetime': profile['datetime'],
            },
            'kpis': metric_kpis,
            'insights': insights,
            'anomalies': anomalies.head(10).to_dict('records'),
            'forecast': fc.to_dict('records'),
            'model_forecast': model_fc.to_dict('records'),
            'risk': risk.head(10).to_dict('records'),
            'root': root,
            'actions': actions,
            'changes': changes,
            'before_missing': before_missing,
            'after_missing': after_missing,
            'forecast_msg': fc_msg,
            'model_forecast_msg': model_fc_msg,
            'risk_msg': risk_msg,
            'anomaly_method': method,
            'models': model_catalog(),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post('/decision')
def decision(request: DecisionRequest):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail='Question is required.')
    return {'answer': generate(question, request.evidence), 'model': model_catalog()['genai']}


@app.post('/report')
def report(request: ReportRequest):
    output_path = Path('outputs') / 'industry_ai_decision_report.pdf'
    output_path.parent.mkdir(exist_ok=True)
    make_report(
        str(output_path), request.summary, request.kpis, request.insights,
        request.anomalies, request.forecast_text, request.root_cause, request.actions,
    )
    return FileResponse(output_path, media_type='application/pdf', filename=output_path.name)


if __name__ == '__main__':
    uvicorn.run('backend.main:app', host='0.0.0.0', port=8000, reload=True)
