const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = path => JSON.parse(fs.readFileSync(require('node:path').join(root, path), 'utf8'));
const records = read('data/meat_production.json');
const specs = [1,2,3].map(n => read(`charts/chart0${n}.json`));
const context = {
  window:{addEventListener(){}}, console,
  document:{getElementById(){return {}}},
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context);
context.source = {records,specs};
vm.runInContext('MEAT=source.records; TEMPLATES=source.specs; BYKEY=new Map(MEAT.map(row => [key(row.year, row.state, row.species), row.tonnes]));',context);
let combinations = 0;
for (let year = 2016;year <= 2025;year++) {
  for (const species of ['Cattle','Sheep','Pigs','Poultry','Red meat']) {
    for (const state of ['Australia','New South Wales','Victoria','Queensland','South Australia','Western Australia','Tasmania','Northern Territory','Australian Capital Territory']) {
      context.selection = {year,species,state};
      for (let figure=1;figure<=3;figure++) {
        context.figure=figure;
        const spec=vm.runInContext('resolveSpec(figure,selection)',context);
        assert.equal(spec.$schema,'https://vega.github.io/schema/vega-lite/v5.json');
        assert(Array.isArray(spec.layer));
        combinations++;
      }
    }
  }
}
assert.equal(records.filter(r => r.year===2025&&r.state==='Australia').length,4);
console.log(`PASS — ${combinations} map/filter cases; three Vega-Lite specs; ABS data integrity baseline.`);
