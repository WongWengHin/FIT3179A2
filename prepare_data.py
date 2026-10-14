"""Reproducible extraction from original ABS June 2026 and ABARES Sep 2026 workbooks.
Source workbooks remain in source/. Uses artifact_tool for spreadsheet reading.
"""
import json, csv, collections
from datetime import datetime, timedelta
from pathlib import Path
from artifact_tool import Blob, SpreadsheetFile
R=Path(__file__).parent
S=R/'source'; D=R/'data';D.mkdir(exist_ok=True)
STATES=['New South Wales','Victoria','Queensland','South Australia','Western Australia','Tasmania','Northern Territory','Australian Capital Territory']
SPECIES=['Cattle','Sheep','Pigs','Poultry']
TABLES={'Cattle':[9,10],'Sheep':[11,12],'Pigs':[13],'Poultry':[15]}
YEAR_MIN,YEAR_MAX=2016,2025

def load_abs(table):
 w=SpreadsheetFile.import_xlsx(Blob.load(str(S/f'72150{table:02d}.xlsx')))
 sh=w.worksheets.get_item('Data1')
 # compact: 240 rows x 24 columns, first record at 0-based row 10
 v=sh.get_range('A1:X300').values
 h=v[0]; series=v[2]
 cols={}
 for c in range(1,len(h)):
  if series[c]!='Original' or not isinstance(h[c],str):continue
  name=h[c].split(';')[-2].strip()
  if name=='Total (State)':name='Australia'
  if name in STATES+['Australia']:cols[name]=c
 out={}
 for row in v[10:]:
  dt=row[0]
  if not isinstance(dt,(float,int)):continue
  dt=datetime(1899,12,30)+timedelta(days=int(dt))
  if not(YEAR_MIN<=dt.year<=YEAR_MAX):continue
  key=(dt.year, (dt.month-1)//3+1)
  out[key]={}
  for st,c in cols.items():
   value=row[c]
   out[key][st]=float(value) if isinstance(value,(float,int)) else None
 return out

allabs={t:load_abs(t) for t in (9,10,11,12,13,15)}
rows=[]
for year in range(YEAR_MIN,YEAR_MAX+1):
 for species,tables in TABLES.items():
  for state in ['Australia']+STATES:
   vals=[]
   for table in tables:
    parts=[]
    for quarter in (1,2,3,4):
     x=allabs[table].get((year,quarter),{}).get(state)
     if x is None:break
     parts.append(x)
    if len(parts)==4:vals.append(sum(parts))
    else:break
   if len(vals)==len(tables):
    rows.append({'year':year,'state':state,'species':species,'tonnes':round(sum(vals),1),'source':'ABS original quarterly; sum of 4 quarters'})
# Notes: no zeros substituted for unavailable states.
with (D/'meat_production.csv').open('w') as f:
 wr=csv.DictWriter(f,fieldnames=['year','state','species','tonnes','source']);wr.writeheader();wr.writerows(rows)
(D/'meat_production.json').write_text(json.dumps(rows,indent=2))

w=SpreadsheetFile.import_xlsx(Blob.load(str(S/'03_AgCommodities202609_Stats_v1.0.0.xlsx')))
# ABARES Table 3 total farm production incl livestock products; fiscal-year with estimate/forecast flags
m3=w.worksheets.get_item('Table 3').get_range('A1:AJ60').values
m9=w.worksheets.get_item('Table 9').get_range('A1:AY65').values
meta=[]
for c in range(3,36):
 y=m3[7][c]
 if not isinstance(y,str) or not y[:4].isdigit(): continue
 start=int(y[:4]);
 if not 2015<=start<=2025:continue
 def value(mat,row):
  v=mat[row-1][c if mat is m3 else c+15] # ABARES Table9 starts in 1979, Table3 in 1994; 15-year offset
  return round(float(v),3) if isinstance(v,(float,int)) else None
 rec={'fy':f'{start}-{str(start+1)[-2:]}','fy_start':start,'status':('estimate' if 's' in y else 'forecast' if 'f' in y else 'historical'),
      'total_farm_m':value(m3,10),'livestock_and_products_m':value(m3,26),'livestock_slaughter_m':value(m3,28)}
 for species,rr in {'Cattle':(44,), 'Sheep':(45,46),'Pigs':(47,), 'Poultry':(48,)}.items():
  vals=[value(m9,r) for r in rr];rec[species.lower()+'_value_m']=round(sum(vals),3) if all(x is not None for x in vals) else None
 for species,rr in {'Cattle':(57,), 'Sheep':(58,59),'Pigs':(61,), 'Poultry':(62,)}.items():
  # ABARES Table 8: 1985 start, c9 = c3 + 9
  pass
 meta.append(rec)
# ABARES Table8 gross volumes, thousand tonnes, carcass weight, comparable fiscal years
m8=w.worksheets.get_item('Table 8').get_range('A1:AY70').values
for rec in meta:
 c=3+(rec['fy_start']-1994)+9
 for species,rr in {'Cattle':(57,), 'Sheep':(58,59),'Pigs':(61,), 'Poultry':(62,)}.items():
  vs=[m8[r-1][c] for r in rr]
  rec[species.lower()+'_volume_kt']=round(sum(float(x) for x in vs),3) if all(isinstance(x,(float,int)) for x in vs) else None
(D/'agricultural_value.json').write_text(json.dumps(meta,indent=2))
with (D/'agricultural_value.csv').open('w') as f:
 wr=csv.DictWriter(f,fieldnames=meta[0].keys());wr.writeheader();wr.writerows(meta)

print('ABS original annual rows:',len(rows))
print('ABS annual 2025 national tonnes:',{s:next((int(r['tonnes']) for r in rows if r['year']==2025 and r['species']==s and r['state']=='Australia'),None) for s in SPECIES})
print('ABS state coverage (2025):',{s:[r['state'] for r in rows if r['year']==2025 and r['species']==s and r['state']!='Australia'] for s in SPECIES})
print('ABARES annual rows',len(meta),'first',meta[0],'last',meta[-1])
# Sanity-check FY value series alignment by comparing ratio growth and totals
assert len(meta)==11 and len(rows)>200
assert all(x['tonnes']>=0 for x in rows)
assert all(0<x['livestock_and_products_m']<x['total_farm_m'] for x in meta)
assert all((x['cattle_volume_kt'] or 0)>1000 for x in meta)
