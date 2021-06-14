'use strict'

const NS_XMLNS = 'http://www.w3.org/2000/xmlns/';
const NS_SVG = 'http://www.w3.org/2000/svg';

/*
New algorithm for when element <use> is used
*/

/**
* cleanSVG result
* @typedef {Object} CleanSVG
* @property {string} text - the serialized svg element
* @property {Element} document - the svg element (cleaned)
*/

/**
* Clean the namespace attributes for svg elements and resolve use elements
* @param {string} svgText - The outerHTML of an svg element
* @param {string} locationHref - The full URL of the page containing the svg element
* @param {bool} verbose - Toggle verbose logging
* @returns {Promise<CleanSVG>} cleaned svg result {@link CleanSVG}
*/
const cleanSVG = async function(svgText, locationHref, colors, verbose) {
  // Replace deprecated xlink to avoid namespace errors
	svgText = svgText.replace(/xlink\:href/g, 'href');

	let doc;
	try {
		doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
	} catch(e) {
		if (VERBOSE) console.log(svgText);
		throw e;
	}
  const svg = doc.documentElement;
  if (verbose) console.log(doc, svg);
  if (!svg.hasAttribute('xmlns')) svg.setAttribute('SVGNS',NS_SVG);
  if (!svg.hasAttribute('xmlns:dc')) svg.setAttributeNS(NS_XMLNS,'xmlns:dc','http://purl.org/dc/elements/1.1/');
  if (!svg.hasAttribute('xmlns:cc')) svg.setAttributeNS(NS_XMLNS,'xmlns:cc','http://creativecommons.org/ns#');
  if (!svg.hasAttribute('xmlns:rdf')) svg.setAttributeNS(NS_XMLNS,'xmlns:rdf','http://www.w3.org/1999/02/22-rdf-syntax-ns#');
  if (!svg.hasAttribute('xmlns:svg')) svg.setAttributeNS(NS_XMLNS,'xmlns:svg',NS_SVG);
  if (colors) {
    svg.removeAttribute('style');
    svg.setAttribute('stroke', colors.color);
    svg.setAttribute('fill', colors.fill);
  }

	// Expand links
	for (let use of svg.querySelectorAll('use[href]')) {
    const href = use.getAttribute('href');
    if (href !== null) {
			const uri = new URL(href, locationHref);
			if (verbose) console.log(uri);
			const res = await fetch(uri);
			if (res.ok) {
				const cleanChild = await cleanSVG(await res.text(), verbose);
				let parent = use.parentElement;
        if (parent === null) parent = svg;
				for (let child of cleanChild.document.children) {
          parent.insertBefore(child.cloneNode(true), use);
        }
				use.setAttribute('href', uri.hash);
			} else {
        use.setAttribute('href', uri);
      }
    }
  }

  // couldn't figure out how to keep xmlns so forced it
  const res = new XMLSerializer().serializeToString(svg).replace(/SVGNS/g,'xmlns');

  if (verbose) console.log(svg, res);
  return { text: res, document: svg };
}
