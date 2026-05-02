import{a as B,b as Q}from"./chunk-MPSZ5JMT.js";import{a as v}from"./chunk-4KIYPLYV.js";import{a as k}from"./chunk-36FODMJL.js";import"./chunk-STF3KHTR.js";import{a as x}from"./chunk-2OVY4GZB.js";import{g as E}from"./chunk-7NESUNEV.js";import"./chunk-2EV2CEOV.js";import"./chunk-C3T65T2N.js";import{b as R}from"./chunk-EOII3ZM4.js";import{c as C}from"./chunk-ODEKWZDQ.js";import{_a as b}from"./chunk-4UZ62P35.js";import{c as s}from"./chunk-GMCPERTA.js";import{b as I}from"./chunk-35TCDNFL.js";import"./chunk-ABIAQLBL.js";import"./chunk-CYENH7PC.js";import"./chunk-VVXI3XCM.js";import{Be as S,ae as T,ob as u}from"./chunk-4LEFXYMU.js";import"./chunk-TU6Q222R.js";import"./chunk-BYU664DD.js";import{Ca as c,M as P,N as f,Ta as h,Z as N}from"./chunk-XKSNUIWB.js";import"./chunk-U7OZEJ4F.js";import"./chunk-ZRGHR2IN.js";import{a as D,g as a,i as l,n as g}from"./chunk-TSHWMJEM.js";l();g();var H=a(Q(),1),m=a(P(),1);l();g();var y=a(P(),1);var F=a(f(),1),$=s(C).attrs({borderRadius:"100px",width:"auto",fontSize:14,fontWeight:600})`
  flex-shrink: 0;
  padding: 5px 12px;
`,M=y.default.memo(n=>{let{copyText:e,className:d}=n,{buttonText:t,copy:r}=B(e),p=(0,y.useCallback)(A=>{A.stopPropagation(),r()},[r]);return(0,F.jsx)($,{className:d,onClick:p,theme:"primary",children:t})});var o=a(f(),1),L=s(x).attrs({align:"center",justify:"space-between"})`
  height: 100%;
`,O=s(H.default)`
  padding: 8px;
  background: ${c.colors.legacy.white};
  border-radius: 6px;
`,z=s(k).attrs({align:"center",justify:"space-between"})`
  box-shadow: inset 0px 0px 4px rgba(0, 0, 0, 0.25);
  padding: 12px 15px;
  background: ${c.colors.legacy.areaAccent};
  border: 1px solid ${c.colors.legacy.borderDiminished};
  border-radius: 6px;
`,K=s(x).attrs({align:"center"})`
  ${z} {
    margin-top: 32px;
    margin-bottom: 11px;
  }
`,U=s(k)`
  p:first-child {
    margin-right: 6px;
  }
`,W=D(n=>{let{accountName:e,walletAddress:d,address:t,symbol:r,onClose:p,networkID:A}=n,w=r||(t?S(t):void 0),{t:i}=N();return{i18nStrings:(0,m.useMemo)(()=>({depositAssetInterpolated:i("depositAssetDepositInterpolated",{tokenSymbol:w}),learnMore:i("commandLearnMore2"),transferFromExchange:i("depositAssetTransferFromExchange"),depositAssetShareAddressError1:i("sendInvalidQRCodeLoadingError1"),depositAssetShareAddressError2:i("sendInvalidQRCodeLoadingError2"),close:i("commandClose")}),[i,w]),accountName:e,walletAddress:d,networkID:A,onClose:p}},"useProps"),Y=m.default.memo(n=>{let{i18nStrings:e,accountName:d,walletAddress:t,networkID:r,onClose:p}=n;return(0,o.jsxs)(L,{children:[(0,o.jsx)(E,{children:e.depositAssetInterpolated}),(0,o.jsx)(K,{children:t?(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(O,{value:t,size:160}),(0,o.jsxs)(z,{children:[(0,o.jsx)(U,{children:(0,o.jsx)(v,{name:d,publicKey:t})}),(0,o.jsx)(M,{copyText:t})]}),(0,o.jsxs)(b,{size:14,color:c.colors.legacy.textDiminished,lineHeight:20,children:[(0,o.jsxs)(I,{i18nKey:"depositAssetQRCodeInterpolated",values:{network:u.getNetworkName(r)},children:["Use to receive tokens on the ",u.getNetworkName(r)," network only."]}),u.isBitcoinNetworkID(r)?(0,o.jsxs)(o.Fragment,{children:[" ",(0,o.jsx)(b,{size:14,lineHeight:20,onClick:()=>R({url:T}),children:e.learnMore})]}):null]})]}):(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(h,{align:"center",font:"labelSemibold",children:e.depositAssetShareAddressError1}),(0,o.jsx)(h,{align:"center",font:"body",children:e.depositAssetShareAddressError2})]})}),(0,o.jsx)(x,{children:(0,o.jsx)(C,{onClick:p,children:e.close})})]})}),j=m.default.memo(n=>{let e=W(n);return(0,o.jsx)(Y,{...e})}),Co=j;export{Co as default};
//# sourceMappingURL=DepositAddressPage-2EDK7YLE.js.map
