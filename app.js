// Stage 00 — load the processed ABS dataset and calculate a headline.
// Subsequent commits add the Vega-Lite maps and other charts.
'use strict';
async function initialiseHeadline() {
  const label = document.getElementById('hero-total');
  try {
    const response = await fetch('data/meat_production.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const records = await response.json();
    const national2025 = records.filter(row => row.year === 2025 && row.state === 'Australia');
    const tonnes = national2025.reduce((sum, row) => sum + row.tonnes, 0);
    label.textContent = `${(tonnes / 1000000).toFixed(2)} million`;
  } catch (error) {
    console.error('Unable to load ABS data:', error);
    label.textContent = 'Data unavailable';
  }
}
window.addEventListener('load', initialiseHeadline);
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
let MEAT=[], TEMPLATES=[], BYKEY=new Map(), RENDER_SEQ=0;
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

// Add Section 01: three Vega-Lite map idioms.
function resolveSpec(id, {year, species, state}) {
  const spec = clone(TEMPLATES[id - 1]);
  const rows = regional(year, species);
  if (id === 1) {
    spec.layer[1].transform[1].from.data.values = rows;
    dim(spec, 1, state);
  } else if (id === 2) {
    const bubbles = rows.map(row => ({
      ...row,
      lon: CENTRES[row.state][0],
      lat: CENTRES[row.state][1],
    }));
    setData(spec, bubbles.filter(row => row.tonnes > 0), 1);
    spec.layer[1].mark.fill = COLOURS[species];
    dim(spec, 1, state);
  } else if (id === 3) {
    const tiles = buildTileRows(year, state);
    setData(spec, tiles, 0);
    setData(spec, tiles, 1);
    spec.layer[0].encoding.opacity = {
      field: 'opacity', type: 'quantitative',
      scale: {domain: [0, 1], range: [0, 1]}, legend: null,
    };
  }
  return spec;
}
function explainMaps({year, species, state}) {
  const rows = regional(year, species).sort((a, b) => b.tonnes - a.tonnes);
  const top = rows[0];
  byId('selection-note').textContent = `Showing ${year} · ${species} · ${state}. Hover over marks to see values. Unavailable state observations are never treated as zero.`;
  byId('note01').textContent = top
    ? `${ABBR[top.state]} contributes ${top.share.toFixed(1)}% of Australia's recorded ${species.toLowerCase()} meat tonnage in ${year}.`
    : `No published state breakdown is available for ${species.toLowerCase()} in ${year}.`;
  byId('note02').textContent = `${rows.length} out of 8 states/territories have complete published ${species.toLowerCase()} series in ${year}. Symbols use schematic state centres.`;
  byId('note03').textContent = 'Tile colour indicates the highest relative red-meat specialisation index, not the largest absolute number of tonnes.';
}
async function renderMaps() {
  const generation = ++RENDER_SEQ;
  const chosen = {
    year: Number(byId('year').value),
    species: byId('species').value,
    state: byId('state').value,
  };
  explainMaps(chosen);
  await Promise.all([1,2,3].map(async chartNumber => {
    const id = String(chartNumber).padStart(2, '0');
    const target = byId(`vis${id}`);
    try {
      await vegaEmbed(target, resolveSpec(chartNumber, chosen), {
        actions: false, renderer: 'svg', hover: true,
      });
    } catch (err) {
      if (generation === RENDER_SEQ) {
        console.error('Unable to render map', id, err);
        target.innerHTML = '<p class="err">Map could not load. Check Vega/GeoJSON network access.</p>';
      }
    }
  }));
}
async function initialise() {
  try {
    const paths = ['data/meat_production.json', 'charts/chart01.json',
                   'charts/chart02.json', 'charts/chart03.json'];
    const files = await Promise.all(paths.map(async path => {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
      return response.json();
    }));
    [MEAT, ...TEMPLATES] = files;
    BYKEY = new Map(MEAT.map(row => [key(row.year, row.state, row.species), row.tonnes]));
    byId('year').innerHTML = Array.from({length:10}, (_,i) =>
      `<option value="${2025-i}">${2025-i}</option>`).join('');
    const total = SPECIES.reduce((acc, species) => acc + value(2025, 'Australia', species), 0);
    byId('hero-total').textContent = `${(total/1000000).toFixed(2)} million`;
    for (const control of ['year','species','state']) byId(control).addEventListener('change', renderMaps);
    byId('reset').addEventListener('click', () => {
      byId('year').value = '2025';
      byId('species').value = 'Cattle';
      byId('state').value = 'Australia';
      renderMaps();
    });
    await renderMaps();
  } catch (error) {
    console.error(error);
    byId('selection-note').textContent = 'Data unavailable. Run through a local HTTP server and check the console.';
    for (const id of ['01','02','03']) byId(`vis${id}`).textContent = 'Unable to load this visualisation.';
  }
}
window.addEventListener('load', initialise);
