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
