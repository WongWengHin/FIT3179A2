import json
from pathlib import Path
O=Path(__file__).parent/'charts';O.mkdir(exist_ok=True)
SC='https://vega.github.io/schema/vega-lite/v5.json'
GEO='https://raw.githubusercontent.com/anthwri/GeoJson-Data/master/australian-states.json'
CL=['#498269','#d3a74e','#c86e59','#629ac4'];SP=['Cattle','Sheep','Pigs','Poultry']
FONT='Arial, sans-serif'
T=lambda f,t='quantitative',**kw: {'field':f,'type':t,**kw}
TOOL=[T('state','nominal',title='State'),T('tonnes',title='Tonnes',format=',.0f')]

def base(height=212):
 return {'$schema':SC,'width':'container','height':height,'background':None,'padding':{'left':4,'right':8,'top':5,'bottom':3},'data':{'values':[]},'config':{
 'view':{'stroke':None},'axis':{'labelFont':FONT,'titleFont':FONT,'labelColor':'#64756e','titleColor':'#64756e','labelFontSize':10,'titleFontSize':10,'gridColor':'#e7eae3','tickColor':'#cbd4cc','domainColor':'#cbd4cc','titlePadding':7},'legend':{'labelFont':FONT,'titleFont':FONT,'labelColor':'#62736a','titleColor':'#334a3f','labelFontSize':10,'orient':'bottom','symbolSize':65},'text':{'font':FONT}}}

def save(n,s):
 (O/f'chart{n:02d}.json').write_text(json.dumps(s,indent=2)+'\n')

# 01 numerical choropleth
s=base(210);s.pop('data');s['projection']={'type':'equalEarth'}
geo={'url':GEO,'format':{'type':'json','property':'features'}}
calc={'calculate':'datum.properties.STATE_NAME','as':'state'}
s['layer']=[
 {'data':geo,'mark':{'type':'geoshape','fill':'#e6eae5','stroke':'#fffef8','strokeWidth':1}},
 {'data':geo,'transform':[calc,{'lookup':'state','from':{'data':{'values':[]},'key':'state','fields':['share','tonnes','state','year']}},{'filter':'isValid(datum.share)'}], 'mark':{'type':'geoshape','stroke':'#fffef8','strokeWidth':1.3},'encoding':{'color':T('share',scale={'scheme':'greens','domain':[0,55]},legend={'title':'National share (%)','gradientLength':95}), 'tooltip':[T('state','nominal'),T('tonnes',title='Tonnes',format=',.0f'),T('share',title='National share %',format='.1f')]}}]
save(1,s)
#02 proportional symbols
s=base(210);s.pop('data');s['projection']={'type':'equalEarth'}
s['layer']=[{'data':geo,'mark':{'type':'geoshape','fill':'#e8ede7','stroke':'#ffffff','strokeWidth':1}},
 {'data':{'values':[]},'mark':{'type':'circle','fill':'#4b846b','stroke':'#fffcf4','strokeWidth':1.6,'opacity':.82},'encoding':{'longitude':T('lon'),'latitude':T('lat'),'size':T('tonnes',scale={'type':'sqrt','range':[35,2000]},legend={'title':'Tonnes','orient':'bottom'}),'tooltip':[T('state','nominal'),T('tonnes',format=',.0f')]}}]
save(2,s)
#03 regional tile-grid map (advanced distinct from choropleth/symbol map)
s=base(198);s.pop('data');s['layer']=[
 {'data':{'values':[]},'mark':{'type':'rect','cornerRadius':4,'stroke':'#fffefa','strokeWidth':3},'encoding':{'x':T('x',axis=None,scale={'domain':[-.2,4.2]}),'x2':{'field':'x2'},'y':T('y',axis=None,scale={'domain':[-.2,4.2],'reverse':True}),'y2':{'field':'y2'},'color':T('leader','nominal',scale={'domain':SP[:3]+['Unavailable'],'range':CL[:3]+['#e1e6df']},legend={'title':'Most specialised in'}),'tooltip':[T('state','nominal'),T('leader','nominal',title='Relative specialisation'),T('index',title='Index vs national mix',format='.2f')] }},
 {'data':{'values':[]},'mark':{'type':'text','fontWeight':'bold','fontSize':12,'color':'#244338'},'encoding':{'x':T('cx',axis=None,scale={'domain':[-.2,4.2]}),'y':T('cy',axis=None,scale={'domain':[-.2,4.2],'reverse':True}),'text':T('abbr','nominal')}}]
save(3,s)
#04 time series
s=base(214);s['mark']={'type':'line','point':{'size':25},'strokeWidth':2.1}
s['encoding']={'x':T('year',axis={'title':'Calendar year','format':'d','tickMinStep':1}),'y':T('tonnes',axis={'title':'Tonnes','format':'~s'},scale={'zero':True}),'color':T('species','nominal',scale={'domain':SP,'range':CL},legend={'title':None}),'tooltip':[T('year',format='d'),T('species','nominal'),T('tonnes',format=',.0f')]}
save(4,s)
#05 heatmap
s=base(200);s['mark']={'type':'rect','stroke':'#fffdf7','strokeWidth':2,'cornerRadius':2}
s['encoding']={'x':T('year','ordinal',axis={'title':'Calendar year','labelAngle':-45}),'y':T('species','nominal',sort=SP,axis={'title':None,'domain':False,'ticks':False}),'color':T('pct',scale={'domainMid':0,'scheme':'redblue'},legend={'title':'Annual change %','orient':'bottom'}),'tooltip':[T('year','ordinal'),T('species','nominal'),T('pct',title='Change (%)',format='+.1f')]}
save(5,s)
#06 shares
s=base(214);s['mark']={'type':'area','opacity':.88,'interpolate':'monotone'}
s['encoding']={'x':T('year',axis={'title':'Calendar year','format':'d','tickMinStep':1}),'y':T('tonnes',stack='normalize',axis={'title':'Share of tonnes','format':'.0%' }),'color':T('species','nominal',scale={'domain':SP,'range':CL},sort=SP,legend={'title':None}), 'order':T('rank'),'tooltip':[T('year',format='d'),T('species','nominal'),T('tonnes',title='Tonnes',format=',.0f'),T('share',title='Share',format='.1%')]}
save(6,s)
#07 ranked state bars
s=base(228);s['mark']={'type':'bar','cornerRadiusEnd':3,'color':'#4a856b'}
s['encoding']={'y':T('abbr','nominal',sort='-x',axis={'title':None,'labelLimit':55,'ticks':False}),'x':T('tonnes',axis={'title':'Tonnes','format':'~s'}),'tooltip':[T('state','nominal'),T('tonnes',format=',.0f'),T('share',title='National share (%)',format='.1f')]}
save(7,s)
#08 bump chart ranks
s=base(224);s['mark']={'type':'line','point':{'filled':True,'size':30},'strokeWidth':2.4}
s['encoding']={'x':T('year',axis={'title':'Calendar year','format':'d','tickMinStep':1}), 'y':T('rank',axis={'title':'Rank (1 = highest)','tickMinStep':1,'grid':True},scale={'domain':[6.2,.8]}),'color':T('state','nominal',legend={'title':'Top six states','columns':2}),'detail':T('state','nominal'),'tooltip':[T('state','nominal'),T('year',format='d'),T('rank',format='.0f'),T('tonnes',format=',.0f')]}
save(8,s)
#09 dumbbell
s=base(224);s.pop('data'); ency={'field':'abbr','type':'nominal','sort':{'field':'end','order':'descending'},'axis':{'title':None}}
s['layer']=[{'data':{'values':[]},'mark':{'type':'rule','stroke':'#afbbb4','strokeWidth':2},'encoding':{'y':ency,'x':T('start',scale={'zero':True},axis={'title':'Annual tonnes','format':'~s'}),'x2':{'field':'end'},'tooltip':[T('state','nominal'),T('start',title='2016 tonnes',format=',.0f'),T('end',title='Selected year tonnes',format=',.0f')]}},
 {'data':{'values':[]},'mark':{'type':'point','filled':True,'color':'#c5d0c6','size':65},'encoding':{'y':ency,'x':T('start')}},
 {'data':{'values':[]},'mark':{'type':'point','filled':True,'color':'#437a62','size':65},'encoding':{'y':ency,'x':T('end')}}]
save(9,s)
#10 value-size treemap (slice-and-dice layout)
s=base(214);s.pop('data');s['layer']=[{'data':{'values':[]},'mark':{'type':'rect','stroke':'#fffef8','strokeWidth':4},'encoding':{'x':T('x',axis=None,scale={'domain':[0,100]}),'x2':{'field':'x2'},'y':T('y',axis=None,scale={'domain':[0,100],'reverse':True}),'y2':{'field':'y2'},'color':T('species','nominal',scale={'domain':SP,'range':CL},legend=None),'tooltip':[T('species','nominal'),T('value_m',title='Gross value (A$ million)',format=',.0f')]}},
 {'data':{'values':[]},'mark':{'type':'text','fontSize':12,'fontWeight':'bold','color':'#1c362c'},'encoding':{'x':T('cx',axis=None,scale={'domain':[0,100]}),'y':T('cy',axis=None,scale={'domain':[0,100],'reverse':True}),'text':T('label','nominal')}}]
save(10,s)
#11 Marimekko map width = size of farm sector; height = livestock proportion
s=base(214);s.pop('data');s['layer']=[{'data':{'values':[]},'mark':{'type':'rect','stroke':'#fffef7','strokeWidth':2},'encoding':{'x':T('x0',axis=None,scale={'domain':[0,100]}),'x2':{'field':'x1'},'y':T('y0',axis={'title':'Share of farm value','format':'.0f'},scale={'domain':[0,100],'reverse':True}),'y2':{'field':'y1'},'color':T('group','nominal',scale={'domain':['Livestock & products','Other agriculture'],'range':['#4e866f','#e3e5df']},legend={'title':None}),'tooltip':[T('fy','nominal',title='Financial year'),T('group','nominal'),T('value_m',title='Value (A$ million)',format=',.0f'),T('share',title='Share (%)',format='.1f')]}},
 {'data':{'values':[]},'mark':{'type':'text','fontSize':9,'fontWeight':'bold','color':'#2b5141','dy':7},'encoding':{'x':T('xc',axis=None,scale={'domain':[0,100]}),'y':{'value':200},'text':T('short','nominal')}}]
save(11,s)
#12 scatter quadrant
s=base(220);s.pop('data');s['layer']=[
 {'data':{'values':[{'x':0}]},'mark':{'type':'rule','stroke':'#abb9b2','strokeDash':[4,4]},'encoding':{'x':T('x')}},
 {'data':{'values':[{'y':0}]},'mark':{'type':'rule','stroke':'#abb9b2','strokeDash':[4,4]},'encoding':{'y':T('y')}},
 {'data':{'values':[]},'mark':{'type':'circle','size':180,'opacity':.9,'stroke':'#fff','strokeWidth':1},'encoding':{'x':T('volume_change',axis={'title':'Change in meat volume (%)','format':'.0f'}),'y':T('value_change',axis={'title':'Change in output value (%)','format':'.0f'}),'color':T('species','nominal',scale={'domain':SP,'range':CL},legend={'title':None}),'tooltip':[T('species','nominal'),T('volume_change',title='Volume change (%)',format='+.1f'),T('value_change',title='Value change (%)',format='+.1f')]}},
 {'data':{'values':[]},'mark':{'type':'text','dx':10,'dy':-9,'fontSize':11,'fontWeight':'bold'},'encoding':{'x':T('volume_change'),'y':T('value_change'),'text':T('species','nominal')}}]
save(12,s)
print('Generated',len(list(O.glob('chart*.json'))),'Vega-Lite specifications')


# The site uses one chart per row (Stage 05). Preserve readable full-width heights.
for chart_number in range(1, 13):
    target = Path(__file__).resolve().parent / 'charts' / f'chart{chart_number:02d}.json'
    if target.exists():
        import json as _json
        spec = _json.loads(target.read_text())
        spec['width'] = 'container'
        spec['height'] = 390 if chart_number in (1, 2) else (360 if chart_number == 3 else (330 if chart_number in (10, 11) else 355))
        target.write_text(_json.dumps(spec, ensure_ascii=False, indent=2) + '\n')
