from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from xml.sax.saxutils import escape

def make_report(path,summary,kpis,insights,anomalies,forecast_text,root_cause,actions):
    styles=getSampleStyleSheet(); doc=SimpleDocTemplate(path,pagesize=A4,rightMargin=36,leftMargin=36,topMargin=36,bottomMargin=36)
    story=[Paragraph('AI Industry Data Analytics & GenAI Decision Support Report',styles['Title']),Spacer(1,12),Paragraph('Executive Summary',styles['Heading2']),Paragraph(escape(summary),styles['BodyText']),Spacer(1,10),Paragraph('KPI Snapshot',styles['Heading2'])]
    if kpis:
        data=[['Metric','Value']]+[[escape(str(k)),escape(f'{v:,.2f}')] for k,v in kpis.items()]
        t=Table(data,colWidths=[220,220]); t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,colors.grey),('BACKGROUND',(0,0),(-1,0),colors.lightgrey),('FONTNAME',(0,0),(-1,0),'Helvetica-Bold')]))
        story += [t,Spacer(1,10)]
    sections=[('Key Insights',insights),('Anomaly Detection',[anomalies]),('Prediction',[forecast_text]),('Root Cause Analysis',[root_cause]),('Recommended Actions',actions.splitlines())]
    for title,items in sections:
        story += [Paragraph(title,styles['Heading2'])]
        for item in items:
            if str(item).strip(): story.append(Paragraph('• '+escape(str(item)),styles['BodyText']))
        story.append(Spacer(1,8))
    doc.build(story)
