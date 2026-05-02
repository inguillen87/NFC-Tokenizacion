import{a as f,c as m}from"./chunk-RKFCKAZO.js";import{a as F}from"./chunk-WJKNYX56.js";import"./chunk-VSWSMAJO.js";import{C as w,T as R}from"./chunk-AAGSJDQ5.js";import"./chunk-WGZRCCGL.js";import"./chunk-DX4FRJOS.js";import"./chunk-UFK3ZRAC.js";import"./chunk-K26PVPY3.js";import"./chunk-K3AOJOH2.js";import"./chunk-GVYJJ5O4.js";import"./chunk-YKOUW7JH.js";import"./chunk-OITW6XPJ.js";import"./chunk-UWWKYXHB.js";import"./chunk-4KIYPLYV.js";import"./chunk-36FODMJL.js";import"./chunk-IH3OE2JK.js";import"./chunk-YEWLBR7H.js";import"./chunk-5M4YNGA7.js";import"./chunk-NQ2RSCCD.js";import"./chunk-STF3KHTR.js";import"./chunk-2OVY4GZB.js";import"./chunk-7NESUNEV.js";import"./chunk-QJJPRU5N.js";import"./chunk-UYPVVWVK.js";import"./chunk-H3NGPCQH.js";import"./chunk-ICLDN2IS.js";import"./chunk-IGADAGVB.js";import"./chunk-2EV2CEOV.js";import"./chunk-C3T65T2N.js";import"./chunk-BU6NS6DM.js";import"./chunk-EOII3ZM4.js";import"./chunk-4AQPJCXC.js";import"./chunk-S7OF43WY.js";import"./chunk-APRBWPN6.js";import"./chunk-FPYN3Z4M.js";import{c as T,d as b}from"./chunk-ODEKWZDQ.js";import{_a as s}from"./chunk-4UZ62P35.js";import{c as t}from"./chunk-GMCPERTA.js";import"./chunk-YW5FUI3G.js";import"./chunk-JQE54VLJ.js";import"./chunk-IOZJ6Q2V.js";import"./chunk-2JKW6MYZ.js";import"./chunk-TLOSW2ZV.js";import"./chunk-CM4IKBRQ.js";import"./chunk-35TCDNFL.js";import"./chunk-ABIAQLBL.js";import"./chunk-I2OEGV4C.js";import"./chunk-I3YV6OQV.js";import"./chunk-OJPBMZQC.js";import"./chunk-QVLP4NN7.js";import"./chunk-UPPQC44E.js";import"./chunk-CYENH7PC.js";import"./chunk-VVXI3XCM.js";import"./chunk-EET66OOP.js";import{Lb as B,ob as l,vb as x}from"./chunk-4LEFXYMU.js";import"./chunk-TU6Q222R.js";import"./chunk-BYU664DD.js";import{Ca as a,M,Ma as I,N as h,Z as C}from"./chunk-XKSNUIWB.js";import"./chunk-U7OZEJ4F.js";import"./chunk-ZRGHR2IN.js";import{a as d,g as c,i as y,n as g}from"./chunk-TSHWMJEM.js";y();g();var k=c(M(),1);var n=c(h(),1),E=t.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow-y: scroll;
`,N=t.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 90px;
`,S=t(s).attrs({size:28,weight:500,color:a.colors.legacy.textBase})`
  margin: 16px;
`,V=t(s).attrs({size:14,weight:400,lineHeight:17,color:a.colors.legacy.textDiminished})`
  max-width: 275px;

  span {
    color: white;
  }
`,$=d(({networkId:o,token:r})=>{let{t:e}=C(),{handleHideModalVisibility:p}=R(),u=(0,k.useCallback)(()=>{p("insufficientBalance")},[p]),v=o&&x(B(l.getChainID(o))),{canBuy:P,openBuy:D}=w({caip19:v||"",context:"modal",analyticsEvent:"fiatOnrampFromInsufficientBalance",entryPoint:"insufficientBalance"}),i=o?l.getTokenSymbol(o):e("tokens");return(0,n.jsxs)(E,{children:[(0,n.jsx)("div",{children:(0,n.jsxs)(N,{children:[(0,n.jsx)(F,{type:"failure",backgroundWidth:75}),(0,n.jsx)(S,{children:e("insufficientBalancePrimaryText",{tokenSymbol:i})}),(0,n.jsx)(V,{children:e("insufficientBalanceSecondaryText",{tokenSymbol:i})}),r?(0,n.jsxs)(I,{borderRadius:8,gap:1,marginTop:32,width:"100%",children:[(0,n.jsx)(f,{label:e("insufficientBalanceRemaining"),children:(0,n.jsx)(m,{color:a.colors.legacy.spotNegative,children:`${r.balance} ${i}`})}),(0,n.jsx)(f,{label:e("insufficientBalanceRequired"),children:(0,n.jsx)(m,{children:`${r.required} ${i}`})})]}):null]})}),P?(0,n.jsx)(b,{primaryText:e("buyAssetInterpolated",{tokenSymbol:i}),onPrimaryClicked:D,secondaryText:e("commandCancel"),onSecondaryClicked:u}):(0,n.jsx)(T,{onClick:u,children:e("commandCancel")})]})},"InsufficientBalance"),X=$;export{$ as InsufficientBalance,X as default};
//# sourceMappingURL=InsufficientBalance-PZBFZV5T.js.map
