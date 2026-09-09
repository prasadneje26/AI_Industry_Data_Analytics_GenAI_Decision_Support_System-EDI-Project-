# Industry AI Decision Support System

## 1. Project Overview

The Industry AI Decision Support System is a full-stack academic project that converts industry sales and inventory data into business insights, predictions, explanations, recommendations, and executive reports.

The system follows this pipeline:

```text
Upload Data -> Data Quality -> Analytics -> ML/DL Prediction -> GenAI Explanation -> Decision Support -> Executive Report
```

The application is designed for an operations manager, business analyst, or decision-maker who needs to understand what happened, what may happen next, why it happened, and what action should be taken.

## 2. Main Objectives

The project aims to:

1. Accept CSV and Excel business datasets.
2. Automatically understand the structure and quality of the data.
3. Calculate important industry and business KPIs.
4. Detect unusual or risky records.
5. Forecast future sales or demand.
6. Use machine learning and deep learning models for prediction.
7. Estimate inventory stockout risk.
8. Use Generative AI for grounded root-cause analysis.
9. Generate management recommendations.
10. Export a professional executive PDF report.

## 3. Technology Stack

### Frontend

- React 18
- Vite
- JavaScript
- CSS

### Backend

- Python
- FastAPI
- Uvicorn
- Pandas
- NumPy

### Analytics and ML

- Scikit-learn
- Statsmodels
- Holt-Winters Exponential Smoothing
- Isolation Forest
- Random Forest Regressor
- MLP neural network

### Generative AI

- OpenAI API or Google Gemini API
- Environment-based API key configuration
- Evidence-grounded prompting

### Reporting

- ReportLab for PDF generation

## 4. System Architecture

```text
+-----------------------+
| React Frontend        |
| Upload and dashboards |
+-----------+-----------+
            |
            | HTTP requests
            v
+-----------------------+
| FastAPI Backend       |
| /analyze              |
| /decision             |
| /report               |
+-----------+-----------+
            |
            v
+-----------------------+
| Data Processing       |
| Profiling and cleaning|
+-----------+-----------+
            |
            v
+-----------------------+
| Analytics Layer       |
| KPIs, insights, risks |
+-----------+-----------+
            |
            v
+-----------------------+
| ML/DL Layer           |
| Forecasts and anomaly |
| detection             |
+-----------+-----------+
            |
            v
+-----------------------+
| GenAI Layer           |
| Root cause and action |
+-----------+-----------+
            |
            v
+-----------------------+
| PDF Report Layer      |
+-----------------------+
```

## 5. Project Folder Structure

```text
industry_ai_dss/
|
|-- backend/
|   |-- main.py                 FastAPI API and request handling
|
|-- data/
|   |-- industry_sales_inventory.csv
|
|-- frontend/
|   |-- package.json
|   |-- index.html
|   |-- src/
|       |-- App.jsx             React dashboard and page navigation
|       |-- main.jsx            React entry point
|       |-- styles.css          Dashboard styling
|
|-- outputs/                    Generated reports
|-- src/
|   |-- analytics.py            Cleaning, analytics, ML, and DL logic
|   |-- genai.py                OpenAI/Gemini integration
|   |-- report.py               PDF report generation
|
|-- tests/
|   |-- test_analytics.py       Analytics and prediction tests
|
|-- .env                       Local API configuration; never commit this
|-- .env.example                Safe environment configuration template
|-- .gitignore                 Secret and build-output protection
|-- Dockerfile                 FastAPI container configuration
|-- README.md                  Quick project instructions
|-- PROJECT_DOCUMENTATION.md  Full project explanation
|-- requirements.txt           Python dependencies
```

## 6. Dataset Requirements

The recommended dataset is a sales and inventory dataset. The strongest dataset contains the following columns:

| Column | Meaning | Required for |
|---|---|---|
| Date or Order_Date | Transaction or observation date | Forecasting, trend analysis, ML, DL |
| Sales or Revenue | Business revenue value | KPIs, insights, forecasting, risk |
| Quantity or Demand | Units sold or demanded | KPIs, forecasting, anomaly detection |
| Profit | Business profit | Profit KPI and margin |
| Inventory | Available inventory | Inventory-risk scoring |
| Product | Product identifier | Grouping and business interpretation |
| Region | Geographic business region | Segmentation |
| Category | Product or business category | Segmentation |
| Price | Unit price | Descriptive analysis |
| Delivery_Days | Delivery duration | Operational risk analysis |

The only strictly required fields for the main forecasting workflow are:

- A date or time column
- At least one numeric business measure, such as Sales, Revenue, Quantity, or Demand
- At least 10 dated observations for the ML/DL forecasting models

The inventory-risk workflow requires both:

- Sales
- Inventory

## 7. Included Demo Dataset

The project includes:

```text
data/industry_sales_inventory.csv
```

Its columns are:

```text
Order_Date
Region
Product
Category
Sales
Quantity
Price
Profit
Inventory
Delivery_Days
```

This dataset is suitable for demonstrating the complete pipeline because it includes dates, sales, quantities, profit, inventory, product categories, regions, and delivery information.

## 8. Kaggle Dataset Recommendations

Recommended Kaggle search terms and dataset types:

### Retail Store Inventory and Demand Forecasting

Best match for this project. It can support forecasting, inventory risk, demand prediction, anomaly detection, and management recommendations.

### Walmart Sales Forecasting

Useful for sales trend analysis, forecasting, Random Forest prediction, and neural forecasting. It may not contain inventory, so inventory-risk analysis may need an additional inventory column.

### M5 Forecasting Accuracy

A large and realistic retail demand forecasting dataset containing products, stores, calendar information, prices, and demand. It is suitable for advanced forecasting but may require preprocessing because it is large.

### Superstore Sales Dataset

Easy to explain in a college presentation. It supports sales, profit, category, region, and customer analysis. It usually does not contain inventory, so the inventory-risk page may not produce results unless inventory is added.

### Retail Demand Forecasting Dataset

Useful for demand prediction with Random Forest and neural network models.

## 9. Dataset Column Mapping

Different datasets may use different column names. Rename columns to match the project when necessary.

| Dataset column | Project name |
|---|---|
| order_date | Order_Date |
| date | Date |
| revenue | Sales |
| sales_amount | Sales |
| demand | Quantity or Demand |
| units_sold | Quantity |
| stock_level | Inventory |
| inventory_level | Inventory |
| product_name | Product |
| product_category | Category |
| location | Region |
| profit_amount | Profit |
| lead_time | Delivery_Days |

## 10. Sidebar Pages

### Industry Overview

Displays the main operational summary:

- Number of rows
- Number of columns
- Missing cells
- Duplicate rows
- Sales summary
- Business insights
- Forecast availability
- Inventory-risk summary

### Data Quality

Displays:

- Numeric columns
- Categorical columns
- Date/time columns
- Missing values
- Duplicate records
- Cleaning actions
- Data preparation status

### AI Root Cause

Displays the GenAI explanation based on computed evidence:

- Important business problems
- Observed signals
- Possible contributing factors
- Uncertainty where evidence is insufficient
- Evidence-based explanations

### Inventory Risk

Displays:

- Highest-risk records
- Stockout-risk score
- Risk level
- Product and date information
- Inventory-to-sales relationship

The current implementation uses a transparent baseline heuristic. It is not a validated production probability model.

### Forecasting

Displays and compares:

- Holt-Winters forecast
- Random Forest forecast
- MLP neural-network forecast
- Future dates
- Predicted values
- Model descriptions

### Executive Report

Provides a PDF export containing:

- Executive summary
- KPI snapshot
- Business insights
- Anomaly detection output
- Forecast information
- Root-cause analysis
- Recommended actions

## 11. Data Processing Workflow

When the user uploads a file:

1. The frontend creates a multipart form request.
2. FastAPI receives the CSV or Excel file.
3. Pandas loads the file into a DataFrame.
4. The system profiles the original data.
5. Duplicate rows are removed.
6. Numeric-looking text is converted to numeric values.
7. Date-like columns are parsed as dates.
8. Missing numeric values are filled with the column median.
9. Missing categorical values are filled with the column mode.
10. A cleaning log is created.
11. The cleaned data is passed to the analytics and prediction modules.

## 12. Analytics Functions

### Profiling

The profiling module detects:

- Number of rows
- Number of columns
- Numeric columns
- Categorical columns
- Date columns
- Missing cells
- Duplicate rows

### KPIs

The KPI module calculates totals for available fields:

- Sales
- Profit
- Quantity
- Inventory
- Profit Margin percentage

### Automatic Insights

The system generates descriptive statements such as:

- Mean and median values
- Standard deviation
- Average profit margin
- Change between early and recent time periods

### Anomaly Detection

The project combines:

1. IQR detection for statistical outliers.
2. Isolation Forest for multivariate unusual records.

The returned records include an anomaly score.

## 13. Machine Learning Models

### Holt-Winters Baseline

Holt-Winters exponential smoothing is used as a statistical baseline. It models recent values and trend behavior.

It is useful because it provides a simple reference forecast against which the ML and DL predictions can be compared.

### Random Forest Regressor

The Random Forest model is trained at analysis time using lag features.

Example features:

```text
current index
previous observation
second previous observation
third previous observation
```

The model creates an ensemble of decision trees and averages their predictions.

Advantages:

- Works with nonlinear patterns
- Easy to use for tabular data
- Usually stable on small datasets
- Does not require feature scaling

Limitations:

- A small dataset may not generalize well.
- It is not a full time-series model.
- It requires proper time-based evaluation for production use.

### MLP Neural Network

The deep-learning component uses an MLPRegressor with three hidden layers:

```text
64 neurons -> 32 neurons -> 16 neurons
```

The neural network uses standardized lag features and learns nonlinear relationships.

Advantages:

- Can model nonlinear patterns
- Demonstrates a deep-learning approach
- Works with numerical lag features

Limitations:

- A small dataset is not enough for reliable deep learning.
- It needs more historical data and tuning for production use.
- It should be compared using time-based validation.

## 14. GenAI Model

The system supports two providers:

### OpenAI

Configuration:

```env
GENAI_PROVIDER=openai
OPENAI_API_KEY=your_new_key_here
OPENAI_MODEL=gpt-5-mini
```

### Google Gemini

Configuration:

```env
GENAI_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Never place a real key in source code, README files, `.env.example`, or chat messages. Store it only in the local `.env` file.

### Grounded Prompting

The GenAI prompt instructs the model to:

1. Use only the supplied evidence.
2. Never invent numbers or causes.
3. Separate observed evidence from inference.
4. State when evidence is insufficient.
5. Give concise practical recommendations.
6. Include priorities and rationale.

The evidence packet contains:

- Dataset dimensions
- KPIs
- Automatic insights
- Anomalies
- Holt-Winters forecast
- ML/DL forecast
- Inventory-risk records
- Dataset columns

## 15. API Endpoints

### Health Check

```text
GET /
```

Returns the service status.

### Analyze Dataset

```text
POST /analyze
```

Accepts a CSV or Excel file using multipart upload.

Returns:

- Profile
- KPIs
- Insights
- Anomalies
- Baseline forecast
- ML/DL forecast
- Inventory risk
- GenAI root cause
- GenAI actions
- Cleaning log
- Model catalog

### Ask Decision Copilot

```text
POST /decision
```

Request example:

```json
{
  "question": "What should management prioritize next month?",
  "evidence": {}
}
```

### Generate PDF Report

```text
POST /report
```

Generates an executive PDF from the completed analysis.

## 16. Local Setup

### Backend Setup

```powershell
cd industry_ai_dss
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create the environment file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` with a newly generated provider key if GenAI is required.

Start the backend:

```powershell
.\.venv\Scripts\uvicorn.exe backend.main:app --host 0.0.0.0 --port 8000
```

### Frontend Setup

Open a second terminal:

```powershell
cd industry_ai_dss\frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally:

```text
http://localhost:5173
```

## 17. Docker Setup

Build the image:

```powershell
docker build -t industry-ai-dss .
```

Run the FastAPI backend:

```powershell
docker run --env-file .env -p 8000:8000 industry-ai-dss
```

The React frontend can be run separately with Vite.

## 18. Testing and Validation

Run analytics tests:

```powershell
.\.venv\Scripts\python.exe -m unittest tests.test_analytics -v
```

The tests verify:

- Anomaly detection runs successfully.
- Holt-Winters forecasting returns output.
- Inventory-risk scoring returns risk levels.
- Random Forest and MLP forecasting return future predictions.

Compile Python modules:

```powershell
.\.venv\Scripts\python.exe -m compileall -q backend src
```

Build the frontend:

```powershell
npm --prefix frontend run build
```

## 19. Limitations

1. The inventory-risk score is a transparent heuristic and not a clinically or commercially validated probability.
2. The Random Forest and MLP models train at request time and are not persisted.
3. Small datasets may produce unstable predictions.
4. Forecasts should be evaluated using time-based train/test splits.
5. GenAI output depends on the configured provider and API availability.
6. GenAI recommendations are decision support, not a replacement for business judgment.
7. The API currently allows broad CORS access for local development and should be restricted in production.
8. Uploaded files are processed in memory and should receive size and security limits in production.

## 20. Future Improvements

- Add train/test forecasting metrics such as MAE and RMSE.
- Add time-series cross-validation.
- Persist trained models with model versioning.
- Add LSTM or Temporal Fusion Transformer models for larger datasets.
- Train a supervised stockout classifier using historical stockout labels.
- Add authentication and role-based access.
- Restrict CORS to the deployed frontend domain.
- Add database storage for historical analyses.
- Add interactive charts using a frontend chart library.
- Add data export in CSV and Excel formats.
- Add automated data schema validation.
- Add experiment tracking and model monitoring.

## 21. College Presentation Explanation

A short explanation for a presentation:

> Our project is an Industry AI Decision Support System. The user uploads sales and inventory data through a React interface. The FastAPI backend cleans and profiles the dataset, calculates business KPIs, detects anomalies, estimates inventory risk, and generates forecasts using Holt-Winters, Random Forest, and a neural network. A grounded OpenAI or Gemini model then uses the computed evidence to explain possible root causes and recommend management actions. Finally, the system exports the complete result as an executive PDF report.

The main innovation is the combination of traditional analytics, machine learning, deep learning, and Generative AI in one decision-support workflow.

## 22. Important Security Note

The `.env` file may contain a private API key. It is ignored by Git and must never be committed, uploaded, or shared. If a key is ever exposed, revoke it immediately and create a replacement key.
