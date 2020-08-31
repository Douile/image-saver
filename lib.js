const NS_XMLNS = 'http://www.w3.org/2000/xmlns/';
const NS_SVG = 'http://www.w3.org/2000/svg';

const cleanSVG = function(svgText, verbose) {
  let doc = new DOMParser().parseFromString(svgText,'image/svg+xml');
  let svg = doc.documentElement;
  if (verbose) console.log(doc, svg);
  if (!svg.hasAttribute('xmlns')) svg.setAttribute('SVGNS',NS_SVG);
  if (!svg.hasAttribute('xmlns:dc')) svg.setAttributeNS(NS_XMLNS,'xmlns:dc','http://purl.org/dc/elements/1.1/');
  if (!svg.hasAttribute('xmlns:cc')) svg.setAttributeNS(NS_XMLNS,'xmlns:cc','http://creativecommons.org/ns#');
  if (!svg.hasAttribute('xmlns:rdf')) svg.setAttributeNS(NS_XMLNS,'xmlns:rdf','http://www.w3.org/1999/02/22-rdf-syntax-ns#');
  if (!svg.hasAttribute('xmlns:svg')) svg.setAttributeNS(NS_XMLNS,'xmlns:svg',NS_SVG);
  let res = new XMLSerializer().serializeToString(svg).replace('SVGNS','xmlns'); // couldn't figure out how to keep xmlns so forced it
  if (verbose) console.log(svg, res);
  return res;
}
