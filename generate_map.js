const fs = require('fs');
const d3 = require('d3-geo');
const topojson = require('topojson-client');
const world = require('world-atlas/countries-50m.json');

const countries = topojson.feature(world, world.objects.countries);

// We want to fit from Longitude -10 to 60, Latitude 20 to 60
// We can use projection.fitExtent
const projection = d3.geoMercator().fitExtent(
  [[20, 20], [780, 380]], 
  {
    type: "LineString", 
    coordinates: [[-10, 60], [60, 20]]
  }
);

const path = d3.geoPath().projection(projection);

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" fill="none">
<path d="${path(countries)}" stroke="#ece5d7" stroke-width="0.3" opacity="0.85"/>
</svg>`;

fs.writeFileSync('high-detail-emea.svg', svg);

console.log("Map generated. Test coordinates:");
console.log("Bucharest:", projection([26.1025, 44.4268]));
console.log("London:", projection([-0.1276, 51.5072]));
console.log("Dubai:", projection([55.2708, 25.2048]));
console.log("Riyadh:", projection([46.6753, 24.7136]));
console.log("Geneva:", projection([6.1432, 46.2044]));
console.log("Nice:", projection([7.262, 43.7102]));
console.log("Vienna:", projection([16.3738, 48.2082]));
console.log("Istanbul:", projection([28.9784, 41.0082]));

