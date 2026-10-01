import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

// Only named marketing/demo families may leave the common bundle. Unknown selectors stay.
export const NON_TAP_FAMILIES=Object.freeze(['demo-lab-','landing-','hero-','simple-trust-','sdk-','nexid-pricing-','brand-synergy-','institutional-video-','commercial-value-','dpp-participant-','nexid-motion-','investor-']);
function requiredFamily(selector,families){
 return selector.nodes.some(node=>{
  if(node.type==='class')return families.some(prefix=>node.value.startsWith(prefix));
  // Negation/relational selectors never prove that a marketing class is required.
  return node.type==='pseudo'&&[':is',':where'].includes(node.value)&&node.nodes?.length>0&&node.nodes.every(part=>requiredFamily(part,families));
 });
}
export function splitPublicStyles(css,sunSources){
 const blocked=NON_TAP_FAMILIES.filter(prefix=>sunSources.includes(prefix));
 const families=NON_TAP_FAMILIES.filter(prefix=>!blocked.includes(prefix));
 const tree=postcss.parse(css),removed=[];
 tree.walkRules(rule=>{
  // Animation frames are not DOM selectors and stay in their original order.
  for(let p=rule.parent;p;p=p.parent)if(p.type==='atrule'&&/keyframes$/i.test(p.name))return;
  let selectors;try{selectors=selectorParser().astSync(rule.selector);}catch{return;}
  if(selectors.nodes.length&&selectors.nodes.every(selector=>requiredFamily(selector,families))){removed.push({selector:rule.selector,line:rule.source.start.line,bytes:Buffer.byteLength(rule.toString())});rule.remove();}
 });
 tree.walkComments(comment=>comment.remove());
 for(let i=0;i<4;i++)tree.walkAtRules(rule=>{if(rule.nodes&&!rule.nodes.length)rule.remove();});
 return {css:tree.toString(),removed,families,retainedFamilies:blocked};
}
