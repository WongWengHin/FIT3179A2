const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const readJSON = filename => JSON.parse(fs.readFileSync(path.join(root, filename), 'utf8'));
const meat = readJSON('data/meat_production.json');
const econ = fs.existsSync(path.join(root, 'data/agricultural_value.json')) ? readJSON('data/agricultural_value.json') : [];
const count = Number(process.argv[2] || 9);
const specs = Array.from({length: count}, (_, index) => readJSON(`charts/chart${String(index + 1).padStart(2, '0')}.json`));
const elements = {};
const document = {getElementById(id) {
    return elements[id] ??= {value: '', textContent: '', innerHTML: '', addEventListener() {}};
}};
const sandbox = {document, window: {addEventListener() {}}, console, vegaEmbed: async () => ({})};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), sandbox);
sandbox.input = {meat, econ, specs};
vm.runInContext('MEAT=input.meat; ECON=input.econ; TEMPLATES=input.specs; BYKEY=new Map(MEAT.map(row => [key(row.year,row.state,row.species),row.tonnes]));', sandbox);
assert.equal(specs.length, count);
assert(meat.every(row => Number.isFinite(row.tonnes) && row.tonnes >= 0));
assert.equal(meat.filter(row => row.year === 2025 && row.state === 'Australia').length, 4);
const selections = ['Cattle', 'Sheep', 'Pigs', 'Poultry', 'Red meat'];
const states = ['Australia','New South Wales','Victoria','Queensland','South Australia','Western Australia','Tasmania','Northern Territory','Australian Capital Territory'];
let checked = 0;
for (let year = 2016; year <= 2025; year++) {
    for (const species of selections) {
        for (const state of states) {
            sandbox.selection = {year, species, state};
            for (let i = 1; i <= count; i++) {
                sandbox.current = i;
                const spec = vm.runInContext('resolveSpec(current, selection)', sandbox);
                assert.equal(spec.$schema, 'https://vega.github.io/schema/vega-lite/v5.json');
                assert(spec.layer || spec.mark);
                assert.equal(spec.width, 'container');
                assert(spec.height >= 300, `Expected full-width readable chart at ${i}`);
                checked++;
            }
        }
    }
}
if (count === 12) {
    assert.equal(econ.at(-1).fy, '2025-26');
    const share = 100 * econ.at(-1).livestock_and_products_m / econ.at(-1).total_farm_m;
    assert(share > 35 && share < 60);
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.equal((html.match(/class="figure"/g) || []).length, count);
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
assert(css.includes('grid-template-columns: minmax(0,1fr)'));
console.log(`PASS: ${count} charts, ${checked} chart/filter combinations, valid stage structure and full-width layout.`);
