import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def profile_data(df):
    dt = []
    for c in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[c]): dt.append(c)
        elif any(k in c.lower() for k in ('date','time')):
            p = pd.to_datetime(df[c], errors='coerce')
            if p.notna().mean() >= .8: dt.append(c)
    return {
        'rows': len(df), 'columns': len(df.columns),
        'numeric': df.select_dtypes(include=np.number).columns.tolist(),
        'categorical': df.select_dtypes(include=['object','category','bool']).columns.tolist(),
        'datetime': dt, 'missing': df.isna().sum(),
        'missing_cells': int(df.isna().sum().sum()),
        'duplicates': int(df.duplicated().sum())
    }


def clean_data(df):
    out = df.copy(); changes=[]
    before_missing=int(out.isna().sum().sum()); before_dupes=int(out.duplicated().sum())
    if before_dupes:
        out=out.drop_duplicates().reset_index(drop=True)
        changes.append(f'Removed {before_dupes} duplicate rows.')
    for c in list(out.columns):
        if out[c].dtype == 'object':
            converted=pd.to_numeric(out[c].astype(str).str.replace(',','',regex=False).str.replace('%','',regex=False),errors='coerce')
            if out[c].notna().sum() and converted.notna().mean() >= .9:
                out[c]=converted; changes.append(f'Converted {c} to numeric.')
    for c in list(out.columns):
        if any(k in c.lower() for k in ('date','time')):
            parsed=pd.to_datetime(out[c],errors='coerce')
            if parsed.notna().mean() >= .8:
                out[c]=parsed; changes.append(f'Parsed {c} as datetime.')
    for c in out.select_dtypes(include=np.number).columns:
        if out[c].isna().any():
            out[c]=out[c].fillna(out[c].median()); changes.append(f'Imputed missing numeric values in {c} with median.')
    for c in out.select_dtypes(include=['object','category','bool']).columns:
        if out[c].isna().any():
            mode=out[c].mode(); val=mode.iloc[0] if not mode.empty else 'Unknown'
            out[c]=out[c].fillna(val); changes.append(f'Imputed missing categorical values in {c} with mode.')
    return out,changes,before_missing,int(out.isna().sum().sum())


def descriptive_stats(df):
    return df.select_dtypes(include=np.number).describe().T


def correlations(df):
    n=df.select_dtypes(include=np.number)
    return n.corr() if n.shape[1]>=2 else pd.DataFrame()


def detect_anomalies(df):
    num=df.select_dtypes(include=np.number).replace([np.inf,-np.inf],np.nan)
    if num.empty: return pd.DataFrame(),'No numeric columns available.'
    num=num.fillna(num.median(numeric_only=True)).fillna(0)
    flags=pd.Series(False,index=df.index); scores=pd.Series(0.0,index=df.index)
    for c in num.columns:
        q1,q3=num[c].quantile([.25,.75]); iqr=q3-q1
        if iqr>0: flags |= (num[c]<q1-1.5*iqr)|(num[c]>q3+1.5*iqr)
    method='IQR'
    if len(num)>=20:
        X = num.to_numpy(dtype=float)
        iso=IsolationForest(contamination='auto',random_state=42,n_estimators=200)
        iso.fit(X)
        scores=pd.Series(-iso.score_samples(X),index=df.index)
        flags |= (iso.predict(X)==-1)
        method='IQR + Isolation Forest'
    result=df.loc[flags].copy(); result['anomaly_score']=scores.loc[result.index]
    return result.sort_values('anomaly_score',ascending=False),method


def find_date_column(df):
    for c in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[c]): return c
    for c in df.columns:
        if any(k in c.lower() for k in ('date','time')):
            p=pd.to_datetime(df[c],errors='coerce')
            if p.notna().mean()>=.8: return c
    return None


def find_measure(df, preferred=('Sales','Revenue','Quantity','Demand','Profit')):
    for p in preferred:
        for c in df.columns:
            if c.lower()==p.lower() and pd.api.types.is_numeric_dtype(df[c]): return c
    nums=df.select_dtypes(include=np.number).columns.tolist()
    return nums[0] if nums else None


def auto_insights(df):
    insights=[]; nums=df.select_dtypes(include=np.number)
    for c in nums.columns:
        s=nums[c].dropna()
        if len(s)>=2: insights.append(f'{c}: mean {s.mean():,.2f}, median {s.median():,.2f}, standard deviation {s.std():,.2f}.')
    if 'Profit' in df.columns and 'Sales' in df.columns:
        margin=(df['Profit']/df['Sales'].replace(0,np.nan)).mean()*100
        insights.append(f'Average profit margin is approximately {margin:.1f}%.')
    date=find_date_column(df); measure=find_measure(df)
    if date and measure:
        d=df[[date,measure]].dropna().copy(); d[date]=pd.to_datetime(d[date]); d=d.sort_values(date)
        if len(d)>=8:
            first=d[measure].head(max(1,len(d)//5)).mean(); last=d[measure].tail(max(1,len(d)//5)).mean()
            if first: insights.append(f'{measure} changed by {(last-first)/abs(first)*100:.1f}% between the early and recent portions of the dataset.')
    return insights[:12] or ['No numeric business measures found.']


def forecast(df,horizon=6):
    date_col=find_date_column(df); measure=find_measure(df)
    if not date_col or not measure: return pd.DataFrame(), 'Need a date/time column and a numeric business measure.'
    d=df[[date_col,measure]].copy(); d[date_col]=pd.to_datetime(d[date_col],errors='coerce'); d=d.dropna().sort_values(date_col)
    if len(d)<8: return pd.DataFrame(),'At least 8 dated observations are recommended.'
    ts=d.set_index(date_col)[measure].resample('MS').sum().dropna()
    if len(ts)<4: ts=d.set_index(date_col)[measure].resample('W').sum().dropna()
    if len(ts)<4: return pd.DataFrame(),'Not enough time periods for a baseline forecast.'
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    try:
        model=ExponentialSmoothing(ts,trend='add',damped_trend=True,initialization_method='estimated').fit()
        fc=model.forecast(horizon)
        method='Holt-Winters damped trend'
    except Exception:
        x=np.arange(len(ts)); coef=np.polyfit(x,ts.values,1); future=np.arange(len(ts),len(ts)+horizon)
        idx=pd.date_range(ts.index[-1]+pd.offsets.MonthBegin(1),periods=horizon,freq='MS'); fc=pd.Series(np.polyval(coef,future),index=idx); method='linear trend fallback'
    return pd.DataFrame({'date':fc.index,'forecast':np.maximum(fc.values,0)}),f'Forecast of {measure} using {method}. This is a baseline forecast, not a guarantee.'


def machine_learning_forecast(df, horizon=6):
    """Forecast the next observations with a Random Forest and a deep MLP regressor."""
    date_col=find_date_column(df); measure=find_measure(df)
    if not date_col or not measure:
        return pd.DataFrame(), 'ML/DL forecast needs a date/time column and a numeric business measure.'
    data=df[[date_col, measure]].copy()
    data[date_col]=pd.to_datetime(data[date_col], errors='coerce')
    data[measure]=pd.to_numeric(data[measure], errors='coerce')
    data=data.dropna().sort_values(date_col)
    values=data[measure].to_numpy(dtype=float)
    if len(values)<10:
        return pd.DataFrame(), 'At least 10 observations are recommended for the ML/DL forecast.'

    lags=3
    features=[]; targets=[]
    for index in range(lags, len(values)):
        features.append([index, *values[index-lags:index][::-1]])
        targets.append(values[index])
    X=np.asarray(features, dtype=float); y=np.asarray(targets, dtype=float)
    rf=RandomForestRegressor(n_estimators=200, random_state=42, min_samples_leaf=1)
    dl=make_pipeline(
        StandardScaler(),
        MLPRegressor(hidden_layer_sizes=(64, 32, 16), activation='relu', solver='lbfgs',
                     max_iter=2000, random_state=42),
    )
    rf.fit(X, y); dl.fit(X, y)

    rf_values=list(values); dl_values=list(values)
    rf_predictions=[]; dl_predictions=[]
    for step in range(horizon):
        index=len(values)+step
        rf_input=np.asarray([[index, *rf_values[-lags:][::-1]]])
        dl_input=np.asarray([[index, *dl_values[-lags:][::-1]]])
        rf_value=max(0.0, float(rf.predict(rf_input)[0]))
        dl_value=max(0.0, float(dl.predict(dl_input)[0]))
        rf_predictions.append(rf_value); dl_predictions.append(dl_value)
        rf_values.append(rf_value); dl_values.append(dl_value)

    if len(data)>=2:
        step_days=max(1, int(data[date_col].diff().dropna().dt.days.median()))
    else:
        step_days=1
    start=data[date_col].iloc[-1]
    dates=[start+pd.Timedelta(days=step_days*(offset+1)) for offset in range(horizon)]
    result=pd.DataFrame({'date':dates, 'ml_forecast':rf_predictions, 'dl_forecast':dl_predictions})
    return result, f'{measure} forecast trained with Random Forest Regressor and a 3-layer MLP neural network using lag features.'


def inventory_risk(df):
    required={'Inventory','Sales'}
    if not required.issubset(df.columns): return pd.DataFrame(), 'Inventory-risk model requires Inventory and Sales columns.'
    x=df[['Inventory','Sales']].apply(pd.to_numeric,errors='coerce').fillna(0)
    # Transparent heuristic risk score: low inventory relative to sales = higher risk.
    ratio=x['Inventory']/(x['Sales'].abs()+1e-6)
    score=1/(1+np.exp(4*(ratio-0.35)))
    out=df.copy(); out['stockout_risk']=score
    out['risk_level']=pd.cut(score,[-.01,.33,.66,1.01],labels=['Low','Medium','High'])
    return out.sort_values('stockout_risk',ascending=False), 'Inventory-to-sales risk scoring heuristic (transparent baseline).'


def kpis(df):
    result={}
    for label,candidates in [('Sales',('Sales','Revenue')),('Profit',('Profit',)),('Quantity',('Quantity','Demand')),('Inventory',('Inventory',))]:
        c=next((c for c in candidates if c in df.columns and pd.api.types.is_numeric_dtype(df[c])),None)
        if c: result[label]=float(df[c].sum())
    if 'Sales' in df.columns and 'Profit' in df.columns:
        s=df['Sales'].sum(); result['Profit Margin %']=float(df['Profit'].sum()/s*100) if s else 0
    return result
