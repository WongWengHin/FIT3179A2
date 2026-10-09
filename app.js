const ACTIVE_CHART_COUNT = 12;
'use strict';
const SPECIES=['Cattle','Sheep','Pigs','Poultry'];
const STATES=['New South Wales','Victoria','Queensland','South Australia','Western Australia','Tasmania','Northern Territory','Australian Capital Territory'];
const ABBR={'New South Wales':'NSW','Victoria':'VIC','Queensland':'QLD','South Australia':'SA','Western Australia':'WA','Tasmania':'TAS','Northern Territory':'NT','Australian Capital Territory':'ACT'};
const COLOURS={Cattle:'#498269',Sheep:'#d3a74e',Pigs:'#c86e59',Poultry:'#629ac4','Red meat':'#487d66'};
const CENTRES={'New South Wales':[147.2,-32.6],'Victoria':[144.3,-37.3],'Queensland':[143.7,-22.5],'South Australia':[135.9,-30.3],'Western Australia':[121.6,-25.2],'Tasmania':[146.7,-42.1],'Northern Territory':[133.7,-20.1],'Australian Capital Territory':[149.1,-35.4]};
const TILES={'Western Australia':[.1,1.1],'Northern Territory':[1.15,.05],'South Australia':[1.15,1.1],'Queensland':[2.2,.05],'New South Wales':[2.2,1.1],'Victoria':[2.2,2.15],'Australian Capital Territory':[3.25,2.15],'Tasmania':[3.25,3.2]};
const comma=n=>Math.round(n).toLocaleString('en-AU');
const percentage=(v,d)=>d>0?100*v/d:null;
const pct=(now,old)=>old>0?100*(now/old-1):null;
const byId=id=>document.getElementById(id);
let MEAT=[], ECON=[], TEMPLATES=[], BYKEY=new Map(), RENDER_SEQ=0;
const key=(year,state,species)=>`${year}#${state}#${species}`;
function value(year,state,species){
 if(species==='Red meat'){
   const ns=['Cattle','Sheep','Pigs'].map(x=>BYKEY.get(key(year,state,x)));
   return ns.every(Number.isFinite)?ns.reduce((a,b)=>a+b,0):null;
 }
 const v=BYKEY.get(key(year,state,species)); return v===undefined?null:v;
}
function nationalRows(year){return SPECIES.map((species,i)=>({year,species,rank:i+1,tonnes:value(year,'Australia',species)})).filter(d=>Number.isFinite(d.tonnes));}
function regional(year,species){
 const n=value(year,'Australia',species);
 return STATES.map(state=>({year,state,abbr:ABBR[state],tonnes:value(year,state,species),share:percentage(value(year,state,species),n)})).filter(d=>Number.isFinite(d.tonnes));
}
function getStateSeries(year,state){return SPECIES.map((species,i)=>({year,state,species,rank:i+1,tonnes:value(year,state,species)})).filter(d=>Number.isFinite(d.tonnes));}
const clone=o=>JSON.parse(JSON.stringify(o));
function setData(spec,rows,layerIdx=null){(layerIdx===null?spec:spec.layer[layerIdx]).data={values:rows};}
function dim(spec,layerIdx,state){
 if(state==='Australia')return;
 spec.layer[layerIdx].encoding.opacity={condition:{test:`datum.state === ${JSON.stringify(state)}`,value:1},value:.27};
}
function buildTileRows(year,stateSelected){
 const nat=SPECIES.slice(0,3).map(s=>value(year,'Australia',s));const nsum=nat.reduce((a,b)=>a+b,0);
 return STATES.map(state=>{
  const loc=TILES[state];const vs=SPECIES.slice(0,3).map(s=>value(year,state,s));
  const denom=vs.every(Number.isFinite)?vs.reduce((a,b)=>a+b,0):0;
  let leader='Unavailable',index=null;
  if(denom>0&&nsum>0){
   const indexes=vs.map((v,i)=>nat[i]>0?(v/denom)/(nat[i]/nsum):0);
   const top=indexes.indexOf(Math.max(...indexes));leader=SPECIES[top];index=indexes[top];
  }
  const [x,y]=loc;
  return {state,abbr:ABBR[state],leader,index,x,y,x2:x+.91,y2:y+.91,cx:x+.455,cy:y+.455,opacity:stateSelected==='Australia'||stateSelected===state?1:.25};
 });
}
function nationalTrend(){return Array.from({length:10},(_,i)=>2016+i).flatMap(nationalRows);}
function stateTrend(state){return Array.from({length:10},(_,i)=>2016+i).flatMap(y=>getStateSeries(y,state));}
function growth(rows){
 let out=[];for(const s of SPECIES){const xs=rows.filter(r=>r.species===s).sort((a,b)=>a.year-b.year);
  xs.forEach((d,i)=>{if(i>0&&xs[i-1].year===d.year-1&&xs[i-1].tonnes>0)out.push({year:d.year,species:s,pct:pct(d.tonnes,xs[i-1].tonnes)});});
 }return out;
}
function formatShareMix(rows){
 const sums=new Map();for(const r of rows)sums.set(r.year,(sums.get(r.year)||0)+r.tonnes);
 return rows.map(r=>({...r,share:r.tonnes/sums.get(r.year)}));
}
function stateBump(species,selected){
 let avg=STATES.map(state=>({state,avg:Array.from({length:10},(_,i)=>value(2016+i,state,species)).filter(Number.isFinite)}))
  .filter(d=>d.avg.length>=8).map(d=>({state:d.state,avg:d.avg.reduce((a,b)=>a+b,0)/d.avg.length})).sort((a,b)=>b.avg-a.avg);
 let keep=avg.slice(0,6).map(d=>d.state);
 if(selected!=='Australia'&&!keep.includes(selected)&&avg.some(d=>d.state===selected))keep=[...keep.slice(0,5),selected];
 const out=[];
 for(let y=2016;y<=2025;y++){
  const ranked=STATES.map(state=>({state,tonnes:value(y,state,species)})).filter(d=>Number.isFinite(d.tonnes)).sort((a,b)=>b.tonnes-a.tonnes||a.state.localeCompare(b.state));
  ranked.forEach((r,i)=>{if(keep.includes(r.state))out.push({...r,year:y,rank:i+1});});
 }
 return out;
}
function dumbbell(year,species){
 return STATES.map(state=>({state,abbr:ABBR[state],start:value(2016,state,species),end:value(year,state,species)}))
 .filter(d=>Number.isFinite(d.start)&&Number.isFinite(d.end)).sort((a,b)=>b.end-a.end);
}
function treemap(fy){
 const v=SPECIES.map(s=>({species:s,value_m:fy[s.toLowerCase()+'_value_m']}));
 const total=v.reduce((a,b)=>a+b.value_m,0),first=v[0],right=100*(1-first.value_m/total),out=[];
 const mainW=100-right;
 out.push({species:first.species,value_m:first.value_m,x:0,x2:mainW,y:0,y2:100,cx:mainW/2,cy:50,label:`Cattle  $${(first.value_m/1000).toFixed(1)}bn`});
 const rest=v.slice(1).sort((a,b)=>b.value_m-a.value_m);let y=0;
 for(const d of rest){const h=100*d.value_m/(total-first.value_m);out.push({species:d.species,value_m:d.value_m,x:mainW,x2:100,y,y2:y+h,cx:(mainW+100)/2,cy:y+h/2,label:`${d.species}  $${(d.value_m/1000).toFixed(1)}bn`});y+=h;}
 return out;
}
function mosaic(){
 const picks=ECON.filter(r=>r.fy_start%2===1);const grand=picks.reduce((a,r)=>a+r.total_farm_m,0);let x=0;let rectangles=[],labels=[];
 for(const d of picks){const w=100*d.total_farm_m/grand;const s=100*d.livestock_and_products_m/d.total_farm_m;
  for(const [group,y0,y1,amount] of [['Livestock & products',0,s,d.livestock_and_products_m],['Other agriculture',s,100,d.total_farm_m-d.livestock_and_products_m]])
   rectangles.push({fy:d.fy,group,x0:x,x1:x+w,y0,y1,value_m:amount,share:100*amount/d.total_farm_m});
  labels.push({xc:x+w/2,short:String(d.fy_start)});x+=w;
 }return [rectangles,labels];
}
function scatter(){const prev=ECON.find(r=>r.fy_start===2024),now=ECON.find(r=>r.fy_start===2025);return SPECIES.map(species=>({species,volume_change:pct(now[species.toLowerCase()+'_volume_kt'],prev[species.toLowerCase()+'_volume_kt']),value_change:pct(now[species.toLowerCase()+'_value_m'],prev[species.toLowerCase()+'_value_m'])}));}
function resolveSpec(id,context){
 const s=clone(TEMPLATES[id-1]),{year,species,state}=context;
 const reg=regional(year,species);const national=value(year,'Australia',species);
 if(id===1){s.layer[1].transform[1].from.data.values=reg;dim(s,1,state);return s;}
 if(id===2){const map=reg.map(r=>({...r,lon:CENTRES[r.state][0],lat:CENTRES[r.state][1]}));setData(s,map.filter(d=>d.tonnes>0),1);s.layer[1].mark.fill=COLOURS[species];dim(s,1,state);return s;}
 if(id===3){const rows=buildTileRows(year,state);setData(s,rows,0);setData(s,rows,1);s.layer[0].encoding.opacity={field:'opacity',type:'quantitative',scale:{domain:[0,1],range:[0,1]},legend:null};return s;}
 if(id===4){setData(s,state==='Australia'?nationalTrend():stateTrend(state));return s;}
 if(id===5){setData(s,growth(state==='Australia'?nationalTrend():stateTrend(state)));return s;}
 if(id===6){setData(s,formatShareMix(nationalTrend()));return s;}
 if(id===7){const ranked=reg.map(r=>({...r,share:percentage(r.tonnes,national)}));setData(s,ranked);if(state!=='Australia')s.encoding.color={condition:{test:`datum.state === ${JSON.stringify(state)}`,value:'#be6e52'},value:'#4a856b'};return s;}
 if(id===8){setData(s,stateBump(species,state));return s;}
 if(id===9){const rows=dumbbell(year,species);for(let i=0;i<3;i++)setData(s,rows,i);return s;}
 if(id===10){const rows=treemap(ECON[ECON.length-1]);setData(s,rows,0);setData(s,rows,1);return s;}
 if(id===11){const [blocks,labels]=mosaic();setData(s,blocks,0);setData(s,labels,1);return s;}
 if(id===12){const rows=scatter();setData(s,rows,2);setData(s,rows,3);return s;}
 return s;
}

function updateText({year, species, state}) {
    const rows = regional(year, species).sort((a, b) => b.tonnes - a.tonnes);
    const top = rows[0];
    const note = document.getElementById('selection-note');
    note.textContent = `Showing ${year} · ${species} · ${state} · Hover over chart marks for exact values. Missing observations are not zero.`;
    const change = (id, text) => {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    };
    change('note01', top ? `${ABBR[top.state]} contributes ${top.share.toFixed(1)}% of national ${species.toLowerCase()} tonnes in ${year}.` : 'No comparable state data for this selection.');
    change('note02', `${rows.length} of 8 states and territories have complete ${species.toLowerCase()} series this year.`);
    change('note03', 'Specialisation compares each state’s red-meat composition with the national mix, not the greatest number of tonnes.');
    if (ACTIVE_CHART_COUNT >= 6) {
        const start = value(2016, 'Australia', 'Cattle');
        const end = value(2025, 'Australia', 'Cattle');
        change('note04', `National cattle meat: ${comma(start)} tonnes in 2016 and ${comma(end)} tonnes in 2025. The line chart shows your state selection where applicable.`);
        change('note06', 'The composition chart is always national; published state-level chicken data are incomplete.');
    }
    if (ACTIVE_CHART_COUNT >= 9) {
        change('note07', rows.length < 8 ? `Published state coverage is incomplete (${rows.length}/8); unavailable states are not ranked.` : 'All eight states and territories are present for this selected category.');
    }
    if (ACTIVE_CHART_COUNT >= 12) {
        const cattle = scatter().find(row => row.species === 'Cattle');
        change('note12', `ABARES estimates for FY 2025–26: cattle volume changed ${cattle.volume_change.toFixed(1)}% and gross value changed ${cattle.value_change.toFixed(1)}% from the prior financial year.`);
    }
}

async function renderAll() {
    const sequence = ++RENDER_SEQ;
    const context = {
        year: Number(byId('year').value),
        species: byId('species').value,
        state: byId('state').value
    };
    updateText(context);
    const jobs = [];
    for (let number = 1; number <= ACTIVE_CHART_COUNT; number++) {
        const id = String(number).padStart(2, '0');
        const target = byId(`vis${id}`);
        const specification = resolveSpec(number, context);
        jobs.push(vegaEmbed(target, specification, {
            actions: false,
            renderer: 'svg',
            hover: true
        }).catch(error => {
            if (sequence === RENDER_SEQ) {
                console.error('Unable to render chart', id, error);
                target.innerHTML = '<p class="err">Chart could not load. Check the local server, Vega libraries and GeoJSON URL.</p>';
            }
        }));
    }
    await Promise.all(jobs);
}

async function initialise() {
    try {
        const economicPath = ACTIVE_CHART_COUNT === 12 ? ['data/agricultural_value.json'] : [];
        const chartPaths = Array.from({length: ACTIVE_CHART_COUNT}, (_, index) =>
            `charts/chart${String(index + 1).padStart(2, '0')}.json`);
        const paths = ['data/meat_production.json', ...economicPath, ...chartPaths];
        const files = await Promise.all(paths.map(async path => {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
            return response.json();
        }));
        MEAT = files[0];
        ECON = economicPath.length ? files[1] : [];
        TEMPLATES = files.slice(1 + economicPath.length);
        BYKEY = new Map(MEAT.map(row => [key(row.year, row.state, row.species), row.tonnes]));
        byId('year').innerHTML = Array.from({length: 10}, (_, index) => {
            const year = 2025 - index;
            return `<option value="${year}">${year}</option>`;
        }).join('');
        const total = SPECIES.reduce((sum, species) => sum + value(2025, 'Australia', species), 0);
        byId('hero-total').textContent = `${(total / 1e6).toFixed(2)} million`;
        for (const control of ['year', 'species', 'state']) {
            byId(control).addEventListener('change', renderAll);
        }
        byId('reset').addEventListener('click', () => {
            byId('year').value = '2025';
            byId('species').value = 'Cattle';
            byId('state').value = 'Australia';
            renderAll();
        });
        await renderAll();
    } catch (error) {
        console.error('Chart setup failed:', error);
        byId('selection-note').textContent = 'Unable to load local files. Run python3 -m http.server 8000, or publish using GitHub Pages.';
        for (let number = 1; number <= ACTIVE_CHART_COUNT; number++) {
            byId(`vis${String(number).padStart(2, '0')}`).innerHTML = '<p class="err">Data unavailable.</p>';
        }
    }
}

window.addEventListener('load', initialise);
