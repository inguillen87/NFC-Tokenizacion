import{r as f,a as m}from"./index.CxJLds0B.js";var i={exports:{}},c={};/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var v=f,x=Symbol.for("react.element"),y=Symbol.for("react.fragment"),E=Object.prototype.hasOwnProperty,R=v.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,b={key:!0,ref:!0,__self:!0,__source:!0};function _(o,e,n){var r,s={},a=null,t=null;n!==void 0&&(a=""+n),e.key!==void 0&&(a=""+e.key),e.ref!==void 0&&(t=e.ref);for(r in e)E.call(e,r)&&!b.hasOwnProperty(r)&&(s[r]=e[r]);if(o&&o.defaultProps)for(r in e=o.defaultProps,e)s[r]===void 0&&(s[r]=e[r]);return{$$typeof:x,type:o,key:a,ref:t,props:s,_owner:R.current}}c.Fragment=y;c.jsx=_;c.jsxs=_;i.exports=c;var w=i.exports,d,l=m;d=l.createRoot,l.hydrateRoot;const I=o=>{const[e,n]=f.useState(!1),r=f.useCallback(t=>t&&a.observe(t),[]),s=t=>{var u;const p=(u=t==null?void 0:t[0])==null?void 0:u.isIntersecting;p&&n(p)},a=new IntersectionObserver(s);return f.useEffect(()=>{e&&o(),n(!1)},[e]),{endOfListRef:r}};export{d as c,w as j,I as u};
