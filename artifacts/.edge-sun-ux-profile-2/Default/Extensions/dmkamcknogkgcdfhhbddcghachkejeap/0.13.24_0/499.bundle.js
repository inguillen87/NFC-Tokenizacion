"use strict";(self.webpackChunk_keplr_wallet_extension=self.webpackChunk_keplr_wallet_extension||[]).push([[499],{22386:(e,t,n)=>{n.d(t,{x:()=>a});var r=n(2784),i=n(71893);const o={Container:i.default.div`
    position ${({position:e,after:t})=>e||(t?"relative":"static")};
    width: ${({width:e})=>e};
    min-width: ${({minWidth:e})=>e};
    max-width: ${({maxWidth:e})=>e};
    height: ${({height:e})=>e};
    min-height: ${({minHeight:e})=>e};
    max-height: ${({maxHeight:e})=>e};
    color: ${({color:e})=>e};
    background-color: ${({backgroundColor:e})=>e};
    border-radius: ${({borderRadius:e})=>e};
    
    border-style: ${({borderWidth:e})=>e?"solid":void 0};
    border-width: ${({borderWidth:e})=>e};
    border-color: ${({borderColor:e})=>e};

    padding: ${({padding:e})=>e};
    padding-left: ${({paddingLeft:e,paddingX:t})=>e||t};
    padding-right: ${({paddingRight:e,paddingX:t})=>e||t};
    padding-top: ${({paddingTop:e,paddingY:t})=>e||t};
    padding-bottom: ${({paddingBottom:e,paddingY:t})=>e||t};

    margin: ${({margin:e})=>e};
    margin-left: ${({marginLeft:e,marginX:t})=>e||t};
    margin-right: ${({marginRight:e,marginX:t})=>e||t};
    margin-top: ${({marginTop:e,marginY:t})=>e||t};
    margin-bottom: ${({marginBottom:e,marginY:t})=>e||t};

    z-index: ${({zIndex:e})=>e};
    
    display: flex;
    flex-direction: column;
    align-items: ${({alignX:e})=>"left"===e?"flex-start":"center"===e?"center":"right"===e?"flex-end":void 0};
    justify-content: ${({alignY:e})=>"top"===e?"flex-start":"center"===e?"center":"bottom"===e?"flex-end":void 0};
    
    cursor: ${({cursor:e})=>e};
    opacity: ${({opacity:e})=>e};
      
    transition: ${({transitions:e})=>null==e?void 0:e.join(",")};
    
    ${({hover:e})=>{if(e)return i.css`
          &:hover {
            color: ${e.color};
            background-color: ${e.backgroundColor};
            background: ${e.background};
            border-style: ${e.borderWidth?"solid":void 0};
            border-width: ${e.borderWidth};
            border-color: ${e.borderColor};
            opacity: ${e.opacity};
          }
        `}};
    
    ${({after:e})=>{if(e)return i.css`
          &::after {
            content: "";
            position: absolute;
            top: 0;
            bottom: 0;
            left: 0;
            right: 0;
            background-color: ${e.backgroundColor};
            border-radius: ${e.borderRadius};
          }
        `}};
  `};const a=(0,r.forwardRef)(((e,t)=>{var{children:n,style:i,className:a,onHoverStateChange:s}=e,l=function(e,t){var n={};for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&t.indexOf(r)<0&&(n[r]=e[r]);if(null!=e&&"function"==typeof Object.getOwnPropertySymbols){var i=0;for(r=Object.getOwnPropertySymbols(e);i<r.length;i++)t.indexOf(r[i])<0&&Object.prototype.propertyIsEnumerable.call(e,r[i])&&(n[r[i]]=e[r[i]])}return n}(e,["children","style","className","onHoverStateChange"]);return r.createElement(o.Container,Object.assign({},l,{ref:t,style:i,className:a,onMouseEnter:()=>{null==s||s(!0)},onMouseLeave:()=>{null==s||s(!1)}}),n)}))},27660:(e,t,n)=>{n.d(t,{T:()=>o});var r=n(2784);const i={Container:n(71893).default.div`
    width: ${({size:e,direction:t})=>"vertical"===t?"1px":e};
    min-width: ${({size:e,direction:t})=>"vertical"===t?"1px":e};
    height: ${({size:e,direction:t})=>"horizontal"===t?"1px":e};
    min-height: ${({size:e,direction:t})=>"horizontal"===t?"1px":e};
  `},o=e=>r.createElement(i.Container,Object.assign({},e))},22673:(e,t,n)=>{n(2784)},85037:(e,t,n)=>{n(2784)},12208:(e,t,n)=>{n(2784)},87094:(e,t,n)=>{n(2784)},93466:(e,t,n)=>{n(2784)},62509:(e,t,n)=>{n.d(t,{H:()=>i});var r=n(2784);const i=({width:e="1.5rem",height:t="1.5rem",color:n})=>r.createElement("svg",{xmlns:"http://www.w3.org/2000/svg",width:e,height:t,viewBox:"0 0 24 24"},r.createElement("g",{stroke:n||"currentColor"},r.createElement("circle",{cx:"12",cy:"12",r:"9.5",fill:"none",strokeLinecap:"round",strokeWidth:"3"},r.createElement("animate",{attributeName:"stroke-dasharray",calcMode:"spline",dur:"1.5s",keySplines:"0.42,0,0.58,1;0.42,0,0.58,1;0.42,0,0.58,1",keyTimes:"0;0.475;0.95;1",repeatCount:"indefinite",values:"0 150;42 150;42 150;42 150"}),r.createElement("animate",{attributeName:"stroke-dashoffset",calcMode:"spline",dur:"1.5s",keySplines:"0.42,0,0.58,1;0.42,0,0.58,1;0.42,0,0.58,1",keyTimes:"0;0.475;0.95;1",repeatCount:"indefinite",values:"0;-16;-59;-59"})),r.createElement("animateTransform",{attributeName:"transform",dur:"2s",repeatCount:"indefinite",type:"rotate",values:"0 12 12;360 12 12"})))},3002:(e,t,n)=>{n(2784)},11569:(e,t,n)=>{n(2784)},55213:(e,t,n)=>{n(2784)},70514:(e,t,n)=>{n(2784)},97619:(e,t,n)=>{n(2784)},72131:(e,t,n)=>{n.d(t,{Tx:()=>p,X5:()=>c,ht:()=>d});var r=n(2784),i=n(9171),o=n(75868),a=n(35851),s=n(19823),l=n(66769);const c=(e,t)=>{var n;const{initialSceneProps:i}=e,s=(0,r.useRef)(0),[l,c]=(0,r.useState)((()=>[Object.assign(Object.assign({},i),{id:s.current.toString(),top:!0,animTop:new o.SpringValue(!0),initialX:0,targetX:0,initialOpacity:1,targetOpacity:1,detached:!1})])),d=(0,r.useRef)([]),p=(0,r.useCallback)(((e,t)=>{c((n=>{s.current++;const r=n.slice(),i=r.find((e=>e.top));return i&&(i.top=!1,i.animTop.set(!1),i.targetX=-1,i.targetOpacity=0),r.push({name:e,props:t,id:s.current.toString(),top:!0,animTop:new o.SpringValue(!0),initialX:1,targetX:0,initialOpacity:0,targetOpacity:1,detached:!1}),r}))}),[]),u=(0,r.useCallback)(((e,t)=>{c((n=>{s.current++;const r=n.slice(),i=r.find((e=>e.top));return i&&(i.top=!1,i.animTop.set(!1),i.targetX=0,i.targetOpacity=0,i.detached=!0),r.push({name:e,props:t,id:s.current.toString(),top:!0,animTop:new o.SpringValue(!0),initialX:1,targetX:0,initialOpacity:0,targetOpacity:1,detached:!1,onAminEnd:()=>{c((e=>e.slice().filter((e=>e!==i))))}}),r}))}),[]),g=(0,r.useCallback)(((e,t)=>{c((n=>{s.current++;const r=n.slice(),i=new Map;for(const e of r)i.set(e.id,!0),e.detached=!0;const a=r.find((e=>e.top));return a&&(a.top=!1,a.animTop.set(!1),a.targetX=-1,a.targetOpacity=0),r.push({name:e,props:t,id:s.current.toString(),top:!0,animTop:new o.SpringValue(!0),initialX:1,targetX:0,initialOpacity:0,targetOpacity:1,detached:!1,onAminEnd:()=>{c((e=>e.slice().filter((e=>!i.get(e.id)))))}}),r}))}),[]),m=(0,r.useCallback)((()=>{c((e=>{const t=e.slice();if(1===t.length)throw new Error("You can't remove initial scene");if(0===t.length)throw new Error("Stack is empty");let n;const r=t.findIndex((e=>e.top));if(r>=0){const e=t[r];for(let e=r-1;e>=0;e--){const r=t[e];if(!r.detached){n=r;break}}e.top=!1,e.animTop.set(!1),e.targetX=1,e.targetOpacity=0,e.detached=!0,e.onAminEnd=()=>{c((t=>t.slice().filter((t=>t!==e))))}}return n&&(n.top=!0,n.animTop.set(!0),n.targetX=0,n.targetOpacity=1),t}))}),[]),h=(0,r.useCallback)((e=>{c((t=>{const n=t.filter((e=>!e.detached));return n.length>0?(n[n.length-1].props=e,t.slice()):t}))}),[]),f=(0,r.useMemo)((()=>l.filter((e=>!e.detached)).map((e=>e.name))),[l]);(0,r.useImperativeHandle)(t,(()=>{var e;return{push:p,pop:m,replace:u,replaceAll:g,setCurrentSceneProps:h,canPop:()=>f.length>1,get stack(){return f},currentScene:null!==(e=f[f.length-1])&&void 0!==e?e:"",addSceneChangeListener(e){d.current.push(e)},removeSceneChangeListener(e){d.current=d.current.filter((t=>t!==e))}}}),[f,m,p,u,g,h]),(0,r.useEffect)((()=>{for(const e of d.current)e(f)}),[f]);const v=l.find((e=>e.top)),[y]=(0,r.useState)((()=>{var e;return new a.V7(null!==(e=null==v?void 0:v.id)&&void 0!==e?e:"")}));return y.setTopSceneId(null!==(n=null==v?void 0:v.id)&&void 0!==n?n:""),{push:p,pop:m,replace:u,replaceAll:g,setCurrentSceneProps:h,stack:l,topScene:v,notDetachedStackNames:f,registry:y}},d=(0,r.forwardRef)(((e,t)=>{const n=c(e,t);return r.createElement(p,Object.assign({},e,n))})),p=({width:e,scenes:t,transitionAlign:n,transitionMode:o,push:l,pop:c,replace:d,replaceAll:p,setCurrentSceneProps:g,stack:m,notDetachedStackNames:h,registry:f,transitionContainerStyle:v})=>{var y;return r.createElement(s.y3.Provider,{value:{push:l,pop:c,replace:d,replaceAll:p,setCurrentSceneProps:g,canPop:()=>h.length>1,stack:h,currentScene:null!==(y=h[h.length-1])&&void 0!==y?y:""}},r.createElement(i.n,{style:v,width:e,transitionAlign:n,registry:f},m.map(((e,i)=>{var s;const l=t.find((t=>t.name===e.name));if(!l)throw new Error(`Unknown scene: ${e.name}`);const c=null!==(s=e.props)&&void 0!==s?s:{},{children:d}=c,p=function(e,t){var n={};for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&t.indexOf(r)<0&&(n[r]=e[r]);if(null!=e&&"function"==typeof Object.getOwnPropertySymbols){var i=0;for(r=Object.getOwnPropertySymbols(e);i<r.length;i++)t.indexOf(r[i])<0&&Object.prototype.propertyIsEnumerable.call(e,r[i])&&(n[r[i]]=e[r[i]])}return n}(c,["children"]);return r.createElement(a.jF,{key:e.id,sceneId:e.id,parentRegistry:f},r.createElement(u,{top:e.top,animTop:e.animTop,index:i,initialX:e.initialX,targetX:e.targetX,initialOpacity:e.initialOpacity,targetOpacity:e.targetOpacity,onAnimEnd:e.onAminEnd,transitionAlign:n,transitionMode:o,sceneWidth:e.sceneWidth},r.createElement(l.element,Object.assign({},p),d)))}))))},u=({children:e,animTop:t,index:n,initialX:i,targetX:a,initialOpacity:c,targetOpacity:d,onAnimEnd:p,transitionAlign:u,transitionMode:g="x-axis",sceneWidth:m})=>{const h=(0,r.useRef)(null),f=(0,o.useSpringValue)(c,{config:l.a});(0,r.useEffect)((()=>{f.start(d,{delay:"opacity"===g&&1===d?100:0})}),[f,d,g]);const v=(0,o.useSpringValue)(i,{config:l.a}),y=(0,r.useRef)(p);y.current=p,(0,r.useEffect)((()=>{var e,t,n,r;0===a?null===(t=null===(e=h.current)||void 0===e?void 0:e.onWillVisible)||void 0===t||t.call(e):null===(r=null===(n=h.current)||void 0===n?void 0:n.onWillInvisible)||void 0===r||r.call(n),v.start(a,{onRest:()=>{var e,t,n,r,i;null===(e=y.current)||void 0===e||e.call(y),0===a?null===(n=null===(t=h.current)||void 0===t?void 0:t.onDidVisible)||void 0===n||n.call(t):null===(i=null===(r=h.current)||void 0===r?void 0:r.onDidInvisible)||void 0===i||i.call(r)}})}),[a,v]);const b=[];return r.createElement(s.bo.Provider,{value:{setEvents(e){b.push(e),h.current={onWillVisible:()=>{var e;for(const t of b)null===(e=t.onWillVisible)||void 0===e||e.call(t)},onDidVisible:()=>{var e;for(const t of b)null===(e=t.onDidVisible)||void 0===e||e.call(t)},onWillInvisible:()=>{var e;for(const t of b)null===(e=t.onWillInvisible)||void 0===e||e.call(t)},onDidInvisible:()=>{var e;for(const t of b)null===(e=t.onDidInvisible)||void 0===e||e.call(t)}}}}},r.createElement(o.animated.div,{style:{display:"grid",gridTemplateColumns:"100%",zIndex:n+1,width:(0,o.to)([m],(e=>e||"100%")),position:t.to((e=>e?"relative":"absolute")),top:t.to((e=>e?"auto":"center"===u?"50%":"bottom"===u?"auto":"0")),bottom:t.to((e=>e?"auto":"bottom"===u?"0":"auto")),left:(0,o.to)([t,v,m],((e,t,n)=>n?null!=t&&t>0?(t*=100)+"%":"auto":e?"auto":"0")),right:(0,o.to)([t,v,m],((e,t,n)=>n?null!=t&&t<0?(t=100*t*-1)+"%":"auto":e?"auto":"0")),pointerEvents:t.to((e=>e?"auto":"none")),opacity:f,transform:(0,o.to)([v,t,m],((...e)=>{let t=e[0];const n=e[1];t*=100,t=Math.max(t,-100),t=Math.min(t,100);let r=0;return n||(r="center"!==u?0:-50),"x-axis"!==g||e[2]?`translate(0%, ${r}%)`:`translate(${t}%, ${r}%)`}))}},r.createElement(o.animated.div,{style:{gridRowStart:1,gridColumnStart:1}},e)))}},35851:(e,t,n)=>{n.d(t,{V7:()=>o,jF:()=>s});var r=n(2784),i=n(38403);class o extends i.Y8{constructor(e){super(),this.isDescendantAnimatingLastSceneId=null,this.topSceneId=e}setTopSceneId(e){this.topSceneId!==e&&(this.topSceneId=e)}isDescendantAnimating(){for(const e of this._registries)if(e.value instanceof a&&e.value.sceneId===this.topSceneId&&e.value.isDescendantAnimatingWithSelf())return this.isDescendantAnimatingLastSceneId=this.topSceneId,!0;if(null!=this.isDescendantAnimatingLastSceneId){if(this.isDescendantAnimatingLastSceneId===this.topSceneId)return setTimeout((()=>{this.isDescendantAnimatingLastSceneId=null}),1),!0;this.isDescendantAnimatingLastSceneId=null}return!1}isAnimating(){return!1}}class a extends i.Y8{constructor(e){super(),this.sceneId=e}setSceneId(e){this.sceneId!==e&&(this.sceneId=e)}isAnimating(){return!1}}const s=({sceneId:e,parentRegistry:t,children:n})=>{const[o]=(0,r.useState)((()=>new a(e)));o.setSceneId(e),(0,r.useLayoutEffect)((()=>{const e=t.registerRegistry(o);return()=>{t.unregisterRegistry(e)}}),[t,o]);const s=(0,r.useMemo)((()=>({registry:o})),[o]);return r.createElement(i.Jh.Provider,{value:s},n)}},38403:(e,t,n)=>{n.d(t,{Jh:()=>r.Jh,Y8:()=>r.Y8,of:()=>r.of,y8:()=>r.y8});var r=n(13563)},25300:(e,t,n)=>{n.d(t,{i:()=>i});var r=n(71893);const i=r.default.div`
  color: ${({color:e})=>e||"inherit"};

  ${({hoverColor:e})=>{if(e)return r.css`
        &:hover {
          color: ${e};
        }
      `}}
`},4886:(e,t,n)=>{n.d(t,{x:()=>w});var r=n(2784),i=n(43),o=n(11443),a=n(86534),s=n(22386),l=n(95700),c=n(35150),d=n(27660),p=n(4922),u=n(86693),g=n(4176),m=n(48753),h=n(49405),f=n(48834),v=n(70791),y=n(42670),b=n(71893);const w=()=>{const e=(0,b.useTheme)(),t=(0,i.IE)();(0,o.sM)({onWillVisible:()=>{t.setHeader({mode:"empty"})}});const n=(0,o.ae)();return(0,h.q)((()=>{var e,t,r,i;e=void 0,t=void 0,i=function*(){try{const e=Math.floor(1e4*Math.random()).toString(),t=encodeURIComponent(window.btoa(JSON.stringify({instanceId:e,redirectToOpener:!1}))),r=browser.identity.getRedirectURL(),i=new URL("https://accounts.google.com/o/oauth2/v2/auth");i.searchParams.append("response_type","token id_token"),i.searchParams.append("client_id","413984222848-8r7u4ip9i6htppalo6jopu5qbktto6mi.apps.googleusercontent.com"),i.searchParams.append("state",t),i.searchParams.append("scope","profile email openid"),i.searchParams.append("redirect_uri",r),i.searchParams.append("nonce",e),i.searchParams.append("prompt","consent select_account");const o=yield browser.identity.launchWebAuthFlow({url:i.href,interactive:!0}),a=new URL(o).hash,s=new URLSearchParams(a),l=s.get("id_token"),c=s.get("access_token");if(!l)throw new Error("No id token");const{data:d}=yield(0,u.simpleFetch)("https://www.googleapis.com/userinfo/v2/me",{mode:"cors",cache:"no-cache",method:"GET",headers:{Authorization:`Bearer ${c}`}}),p=new m.Z({network:"mainnet"}),{torusNodeEndpoints:h,torusNodePub:v,torusIndexes:y}=yield p.getNodeDetails({verifier:"chainapsis-google",verifierId:d.email.toLowerCase()}),b=new g.Z({network:"mainnet",clientId:"BHr78o6XDBbR2CuM0VpdNuBQchjHU5QW4srIvQHlLudTbU-4SrcQoogcL4YOv0V4GmsA7YBs58pccBI4IJFyDBY"}),w=yield b.getPublicAddress(h,v,{verifier:"chainapsis-google",verifierId:d.email.toLowerCase()}),S=yield b.retrieveShares({endpoints:h,indexes:y,nodePubkeys:v,verifier:"chainapsis-google",verifierParams:{verifier_id:d.email.toLowerCase()},idToken:l});if("string"==typeof w)throw new Error("must use extended pub key");if(S.finalKeyData.walletAddress.toLowerCase()!==w.finalKeyData.walletAddress.toLowerCase())throw new Error("data ethAddress does not match response address");if(!S.finalKeyData.privKey)throw new Error("no key found");n.replace("name-password",{privateKey:{value:f.Buffer.from(S.finalKeyData.privKey,"hex"),meta:{web3Auth:{email:d.email,type:"google"}},needBackUpPrivateKey:!0},stepPrevious:0,stepTotal:3})}catch(e){alert(e.message?e.message:e.toString()),n.pop()}},new((r=void 0)||(r=Promise))((function(n,o){function a(e){try{l(i.next(e))}catch(e){o(e)}}function s(e){try{l(i.throw(e))}catch(e){o(e)}}function l(e){var t;e.done?n(e.value):(t=e.value,t instanceof r?t:new r((function(e){e(t)}))).then(a,s)}l((i=i.apply(e,t||[])).next())}))})),r.createElement(a.e,null,r.createElement(s.x,{alignX:"center"},r.createElement(l.F5,{color:"light"===e.mode?c.VZ["gray-500"]:c.VZ["gray-50"]},r.createElement(y.Z,{id:"page.register.google.title"})),r.createElement(d.T,{size:"1.25rem"}),r.createElement(p.mI,{color:c.VZ["gray-300"]},r.createElement(y.Z,{id:"page.register.google.paragraph"})),r.createElement(d.T,{size:"1.75rem"}),r.createElement(s.x,{alignX:"center",alignY:"center",height:"14rem"},r.createElement(v.Ho,{width:"2.5rem",height:"2.5rem",color:c.VZ["gray-100"]}))))}},86534:(e,t,n)=>{n.d(t,{e:()=>s});var r=n(2784),i=n(22386),o=n(71893),a=n(35150);const s=({children:e,style:t})=>r.createElement(i.x,{paddingX:"3.25rem",paddingY:"3rem",style:t},e);o.default.div`
    font-weight: 600;
    font-size: 2rem;
    line-height: 2rem;
    text-align: center;
    color: ${a.VZ["platinum-500"]};

    margin-bottom: 2rem;
  `},22428:(e,t,n)=>{n.d(t,{i:()=>r});const r=n(71893).default.div`
  font-family: "Haffer", "Inter", sans-serif;

  color: ${({color:e})=>e||"inherit"};
`},63857:(e,t,n)=>{n.d(t,{F:()=>o});var r=n(71893),i=n(4922);const o=(0,r.default)(i.i0)`
  font-weight: 600;
  font-size: 2.25rem;
`},52977:(e,t,n)=>{n.d(t,{Z:()=>s});var r=n(71893),i=n(17704),o=n(93043),a=n(74255);const s=r.createGlobalStyle`
  ${i.Fv}
  
  ${a.nz}
  
  html {
    // TODO: Change the scheme according to theme after theme feature is implemented.
    color-scheme: ${e=>"light"===e.theme.mode?"light":"dark"};
  }
  
  html, body {
    font-family: 'Inter', sans-serif;
    -webkit-font-smoothing: antialiased;
    
    &[data-lang="ko"] {
      font-family: 'Inter', 'NotoSansKR', sans-serif;
      
      word-break: keep-all;
      word-wrap: break-word;
    }
    &[data-lang="zh-cn"] {
      font-family: 'Inter', 'NotoSansSC', sans-serif;
    }
    color: ${e=>"light"===e.theme.mode?o.V["gray-700"]:o.V.white};
    background: ${e=>"light"===e.theme.mode?o.V["light-gradient"]:o.V["gray-700"]};

    &[data-white-background="true"] {
      background: ${e=>"light"===e.theme.mode?o.V.white:o.V["gray-700"]};
    }
  }
  
  pre {
    font-family: 'Inter', sans-serif;
    -webkit-font-smoothing: antialiased;
    font-weight: 400;
    font-size: 0.8125rem;
    color: ${o.V["gray-200"]};

    &[data-lang="ko"] {
      font-family: 'Inter', 'NotoSansKR', sans-serif;
    }
    &[data-lang="zh-cn"] {
      font-family: 'Inter', 'NotoSansSC', sans-serif;
    }
  }

  // Set border-box as default for convenience.
  html {
    box-sizing: border-box;
  }
  *, *:before, *:after {
    box-sizing: inherit;
  }
  
  * {
    font-feature-settings: "calt" 0
  }
`},21650:(e,t,n)=>{e.exports=n.p+"assets/HafferSQXH-Medium.ttf"},44800:(e,t,n)=>{e.exports=n.p+"assets/HafferSQXH-SemiBold.ttf"},35127:(e,t,n)=>{e.exports=n.p+"assets/intro-logo-light.png"},93451:(e,t,n)=>{e.exports=n.p+"assets/intro-logo.png"}}]);