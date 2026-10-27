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

if (id === 8) {
  const rows = stateBump(species, state);
  setData(s, rows);

  // Expand the Y-axis when ranks 7 or 8 are displayed.
  const maxRank = Math.max(6, ...rows.map(d => d.rank));

  s.encoding.y.scale.domain = [maxRank + 0.2, 0.8];

  // Display whole-number ranks only.
  s.encoding.y.axis.values = Array.from(
    { length: maxRank },
    (_, i) => i + 1
  );

  // Keep the legend accurate when a territory is selected.
  s.encoding.color.legend.title = 'States / territories shown';

  return s;
}
 if(id===9){const rows=dumbbell(year,species);for(let i=0;i<3;i++)setData(s,rows,i);return s;}
 if(id===10){const rows=treemap(ECON[ECON.length-1]);setData(s,rows,0);setData(s,rows,1);return s;}
 if(id===11){const [blocks,labels]=mosaic();setData(s,blocks,0);setData(s,labels,1);return s;}
 if(id===12){const rows=scatter();setData(s,rows,2);setData(s,rows,3);return s;}
 return s;
}


function updateText({year, species, state}) {
  const setNote = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  const movement = n =>
    `${Math.abs(n).toFixed(1)}% ${n >= 0 ? 'increase' : 'decrease'}`;

  const area = state === 'Australia' ? 'Australia' : state;

  const rows = regional(year, species)
    .sort((a, b) => b.tonnes - a.tonnes);

  const leader = rows[0];
  const selected = rows.find(r => r.state === state);

  setNote('selection-note',
    `Showing ${year} · ${species} · ${state}. Hover for exact values. Missing data are not zero.`
  );

  // Figure 01: National production share
  setNote('note01',
    !leader ? 'No comparable regional data available.' :
    state !== 'Australia' ?
      (selected
        ? `${state} accounted for ${selected.share.toFixed(1)}% of Australia's ${species.toLowerCase()} meat tonnes in ${year}.`
        : `${state} has no published comparable figure for ${year}.`)
      : `${leader.state} led production, accounting for ${leader.share.toFixed(1)}% of Australia's ${species.toLowerCase()} meat total in ${year}.`
  );


  // Figure 02: Production scale comparison
  const runnerUp = rows[1];
  const meatLabel = species === 'Red meat'
    ? 'red meat'
    : `${species.toLowerCase()} meat`;

  setNote('note02',
    leader && runnerUp && runnerUp.tonnes > 0
      ? `${leader.state} produced ${comma(leader.tonnes)} tonnes of ${meatLabel} in ${year}, ${(leader.tonnes / runnerUp.tonnes).toFixed(2)} times as much as ${runnerUp.state} (${comma(runnerUp.tonnes)} tonnes). This highlights the production gap between the two leading states.${rows.length < 8 ? ` Comparable data are available for only ${rows.length} of 8 states and territories.` : ''}`
      : leader
        ? `${leader.state} recorded ${comma(leader.tonnes)} tonnes in ${year}, but a valid comparison with the second-largest producer is unavailable.`
        : 'No comparable regional values available.'
  );


  // Figure 03: Relative specialisation
  const specialised = buildTileRows(year, state)
    .filter(r => Number.isFinite(r.index))
    .sort((a, b) => b.index - a.index)[0];

  setNote('note03',
    specialised
      ? `In ${year}, ${specialised.state} showed the strongest relative specialisation in ${specialised.leader === 'Pigs' ? 'pig' : specialised.leader.toLowerCase()} meat. Its share of the state's red-meat mix was ${specialised.index.toFixed(2)} times the national equivalent.`
      : 'Insufficient data to calculate specialisation.'
  );

  // Figure 04: Long-term trend
  const start = value(2016, area, 'Cattle');
  const end = value(2025, area, 'Cattle');

  setNote('note04',
    start > 0 && Number.isFinite(end)
      ? `From 2016 to 2025, cattle meat production in ${area} recorded a ${movement(pct(end, start))}, moving from ${comma(start)} to ${comma(end)} tonnes.`
      : `A comparable cattle production change is unavailable for ${area}.`
  );

  // Figure 05: Largest annual change
  const changes = growth(
    state === 'Australia'
      ? nationalTrend()
      : stateTrend(state)
  ).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

  const strongest = changes[0];

  setNote('note05',
    strongest
      ? `Across 2017–2025, the largest annual movement for ${area} was a ${movement(strongest.pct)} in ${strongest.species.toLowerCase()} meat in ${strongest.year}.`
      : `Annual percentage changes are unavailable for ${area}.`
  );

  // Figure 06: National industry composition
  const mix = y => {
    const total = SPECIES.reduce(
      (sum, s) => sum + value(y, 'Australia', s), 0
    );

    const chosen = species === 'Red meat'
      ? ['Cattle', 'Sheep', 'Pigs'].reduce(
          (sum, s) => sum + value(y, 'Australia', s), 0
        )
      : value(y, 'Australia', species);

    return percentage(chosen, total);
  };

  setNote('note06',
    `Nationally, ${species.toLowerCase()} accounted for ${mix(2025).toFixed(1)}% of the four meat categories in 2025, compared with ${mix(2016).toFixed(1)}% in 2016.`
  );


  // Figure 07: Concentration among leading states
  const topThree = rows.slice(0, 3);

  const topThreeTotal = topThree.reduce(
    (sum, r) => sum + r.tonnes, 0
  );

  const nationalTotal = value(year, 'Australia', species);

  const topThreeShare = percentage(
    topThreeTotal, nationalTotal
  );

  const topThreeNames = topThree
    .map(r => r.state)
    .join(', ')
    .replace(/, ([^,]+)$/, ' and $1');

  setNote('note07',
    topThree.length === 3 && topThreeShare !== null
      ? rows.length < 8
        ? `${topThreeNames} together accounted for ${topThreeShare.toFixed(1)}% of Australia's ${meatLabel} production in ${year}. Only ${rows.length} states and territories have comparable published figures, so the regional ranking is incomplete.`
        : `${topThreeNames} together accounted for ${topThreeShare.toFixed(1)}% of Australia's ${meatLabel} production in ${year}. This reveals how national output is concentrated among the three leading states.`
      : 'Insufficient comparable regional data to assess production concentration.'
  );



    // Figure 08: Ranking changes
    const rankInsights = {
    'Cattle':
        'Queensland remained the largest cattle-producing state. However, Western Australia overtook South Australia for fourth place. Victoria also recorded 75.0% production growth despite remaining third, showing that stable rankings can hide significant growth.',

    'Sheep':
        'Victoria retained first place, but Western Australia overtook South Australia for third. Western Australian output grew by 17.0%, while South Australian production fell by 34.3%, revealing a shift in their relative positions.',

    'Pigs':
        'Queensland climbed from third to first place, overtaking South Australia. Queensland’s pig meat production increased by 41.9%, compared with just 5.2% in South Australia, highlighting a change in regional leadership.',

    'Poultry':
        'New South Wales maintained its lead, while Victoria overtook Queensland for second place. Victoria’s production grew by 17.7%, whereas Queensland recorded a 2.5% decline.',

    'Red meat':
        'Queensland remained the leading red meat producer, while Western Australia overtook South Australia for fourth place. Western Australian output rose by 27.4%, whereas South Australian production declined by 8.6%.'
    };

    setNote('note08', rankInsights[species]);


  // Figure 09: Largest absolute production change
  const differences = dumbbell(year, species)
    .map(r => ({
      ...r,
      difference: r.end - r.start
    }))
    .sort((a, b) =>
      Math.abs(b.difference) - Math.abs(a.difference)
    );

  const biggest = differences[0];

  setNote('note09',
    year === 2016
      ? 'Choose a later year to compare production changes.'
      : biggest
        ? `${biggest.state} recorded the largest absolute change from 2016 to ${year}: ${biggest.difference >= 0 ? '+' : '−'}${comma(Math.abs(biggest.difference))} tonnes of ${species.toLowerCase()} meat.`
        : 'No comparable endpoint data available.'
  );

  // Figure 10: Livestock production value
  const fy = ECON.find(r => r.fy_start === 2025);
  const cattleValue = fy.cattle_value_m;

  const fourValues = SPECIES.reduce(
    (sum, s) => sum + fy[s.toLowerCase() + '_value_m'], 0
  );

  setNote('note10',
    `In FY 2025–26 estimates, cattle contributed A$${(cattleValue / 1000).toFixed(1)} billion, representing ${(100 * cattleValue / fourValues).toFixed(1)}% of the four livestock groups shown.`
  );

  // Figure 11: Livestock share of total agriculture
  const old = ECON.find(r => r.fy_start === 2015);

  const oldShare =
    100 * old.livestock_and_products_m / old.total_farm_m;

  const newShare =
    100 * fy.livestock_and_products_m / fy.total_farm_m;

  setNote('note11',
    `Livestock and livestock products represented ${oldShare.toFixed(1)}% of total farm value in FY 2015–16, compared with an estimated ${newShare.toFixed(1)}% in FY 2025–26.`
  );



  // Figure 12: Volume compared with value
  const figure12Changes = scatter();

  const cattle = figure12Changes.find(
    r => r.species === 'Cattle'
  );

  const sheep = figure12Changes.find(
    r => r.species === 'Sheep'
  );

  setNote('note12',
    `From FY 2024–25 to FY 2025–26 (estimates), cattle production value increased ${cattle.value_change.toFixed(1)}% despite meat volume growing only ${cattle.volume_change.toFixed(1)}%. More strikingly, sheep production value rose ${sheep.value_change.toFixed(1)}% even as volume declined ${Math.abs(sheep.volume_change).toFixed(1)}%. This shows that higher economic value does not necessarily mean greater physical production.`
  );
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
