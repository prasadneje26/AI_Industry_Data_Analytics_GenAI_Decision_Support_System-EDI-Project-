# Industry AI Decision Support System

An academic full-stack decision-support application for industry sales and inventory data.

The system follows this pipeline:

**Upload data -> Clean and profile -> Analyze -> Predict -> Explain -> Decide -> Report**

## What The Project Does

- Accepts CSV and Excel datasets.
- Profiles rows, columns, missing values, duplicates, and data types.
- Cleans duplicate, numeric, date, and missing-value issues with an audit log.
- Calculates sales, profit, quantity, inventory, and margin KPIs.
- Detects unusual records with IQR and Isolation Forest.
- Generates automatic business insights from the uploaded data.
- Produces a Holt-Winters statistical forecast.
- Trains a Random Forest regressor using lag features.
- Trains a multi-layer perceptron neural network using lag features.
- Scores transparent inventory stockout risk when Sales and Inventory exist.
- Uses a grounded Gemini or OpenAI model for root-cause analysis and recommendations.
- Answers manager questions using the computed evidence packet.
- Exports an executive PDF report.

## Architecture

```text
React dashboard
	|
	v
FastAPI API
	|
	+--> Data profiling and cleaning
	+--> Statistical analytics
	+--> ML: Random Forest Regressor
	+--> DL: MLP neural network
	+--> GenAI: Gemini or OpenAI
	+--> PDF reporting
```

## Run Locally

### Backend

```powershell
cd industry_ai_dss
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

The API is available at `http://localhost:8000`.

### Frontend

Open a second terminal:

```powershell
cd industry_ai_dss\\frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

## GenAI Configuration

Copy `.env.example` to `.env` and add a newly generated provider key:

```env
GENAI_PROVIDER=openai
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5-mini
```

Gemini is also supported with `GEMINI_API_KEY` and `GEMINI_MODEL`. Local Ollama is supported through its OpenAI-compatible API:

```env
GENAI_PROVIDER=ollama
OLLAMA_MODEL=llama3.2
OLLAMA_BASE_URL=http://localhost:11434/v1
```

Install Ollama, run `ollama pull llama3.2`, and keep Ollama running before starting the backend. Never commit `.env` or paste keys into source code.

Without a GenAI key, analytics, ML, DL, forecasting, risk, and reports remain available.

## Dataset Expectations

Strong results come from datasets containing a date or time column, a numeric measure such as Sales, Revenue, Quantity, or Demand, and optional Profit, Inventory, Product, Region, and Category columns.

The forecasting models require at least 10 dated observations. Inventory risk requires both `Sales` and `Inventory`.

## API Endpoints

- `GET /` - health check
- `POST /analyze` - upload and analyze CSV or Excel data
- `POST /decision` - ask the grounded manager copilot a question
- `POST /report` - generate and download an executive PDF report

## Validation

```powershell
.\\.venv\\Scripts\\python.exe -m unittest tests.test_analytics -v
cd frontend
npm run build
```

## Docker

The Docker image runs the FastAPI backend:

```powershell
docker build -t industry-ai-dss .
docker run --env-file .env -p 8000:8000 industry-ai-dss
```

Run the React frontend separately with `npm run dev`.

## Model Notes

The inventory score is a transparent baseline heuristic, not a validated production probability. The Random Forest and neural forecasts are educational predictive models trained at request time on lagged observations. They should be evaluated with larger historical data and time-based validation before operational use.
