import{a as N,c as F,d as G,g as I}from"./chunk-ATUTADYU.js";import{a as x}from"./chunk-BFPLQINX.js";import"./chunk-WJKNYX56.js";import{a as D}from"./chunk-LG5ZMMWW.js";import"./chunk-SSIIYEFC.js";import"./chunk-ONUSXHBV.js";import"./chunk-IYC44SOP.js";import"./chunk-OKVREMOS.js";import"./chunk-AAGSJDQ5.js";import"./chunk-WGZRCCGL.js";import"./chunk-DX4FRJOS.js";import"./chunk-UFK3ZRAC.js";import"./chunk-K26PVPY3.js";import"./chunk-K3AOJOH2.js";import"./chunk-GVYJJ5O4.js";import"./chunk-YKOUW7JH.js";import"./chunk-OITW6XPJ.js";import"./chunk-UWWKYXHB.js";import"./chunk-4KIYPLYV.js";import{a as L}from"./chunk-36FODMJL.js";import"./chunk-IH3OE2JK.js";import"./chunk-YEWLBR7H.js";import"./chunk-5M4YNGA7.js";import"./chunk-NQ2RSCCD.js";import"./chunk-STF3KHTR.js";import"./chunk-2OVY4GZB.js";import"./chunk-7NESUNEV.js";import{a as C}from"./chunk-QJJPRU5N.js";import"./chunk-UYPVVWVK.js";import"./chunk-OZJQQPAL.js";import"./chunk-H3NGPCQH.js";import"./chunk-ICLDN2IS.js";import"./chunk-IGADAGVB.js";import"./chunk-2EV2CEOV.js";import"./chunk-C3T65T2N.js";import"./chunk-35OI4BQM.js";import"./chunk-DKK3I2DA.js";import"./chunk-BU6NS6DM.js";import"./chunk-EOII3ZM4.js";import"./chunk-4AQPJCXC.js";import"./chunk-S7OF43WY.js";import"./chunk-APRBWPN6.js";import"./chunk-FPYN3Z4M.js";import"./chunk-ODEKWZDQ.js";import{q as _}from"./chunk-4UZ62P35.js";import{c as s}from"./chunk-GMCPERTA.js";import{a as y}from"./chunk-QQJPKFTO.js";import"./chunk-YW5FUI3G.js";import"./chunk-JQE54VLJ.js";import"./chunk-IOZJ6Q2V.js";import"./chunk-2JKW6MYZ.js";import"./chunk-TLOSW2ZV.js";import"./chunk-CM4IKBRQ.js";import"./chunk-35TCDNFL.js";import"./chunk-ABIAQLBL.js";import"./chunk-I2OEGV4C.js";import"./chunk-I3YV6OQV.js";import"./chunk-OJPBMZQC.js";import"./chunk-QVLP4NN7.js";import"./chunk-UPPQC44E.js";import"./chunk-CYENH7PC.js";import{s as $,z as O}from"./chunk-VVXI3XCM.js";import"./chunk-EET66OOP.js";import{hf as E,yf as P}from"./chunk-4LEFXYMU.js";import"./chunk-TU6Q222R.js";import"./chunk-BYU664DD.js";import{Ca as e,M as z,N as u,Ya as R,ab as T}from"./chunk-XKSNUIWB.js";import"./chunk-U7OZEJ4F.js";import"./chunk-ZRGHR2IN.js";import{a as g,g as l,i as n,n as i}from"./chunk-TSHWMJEM.js";n();i();var f=l(z(),1);n();i();n();i();var M=s(C)`
  cursor: pointer;
  width: 24px;
  height: 24px;
  transition: background-color 200ms ease;
  background-color: ${t=>t.$isExpanded?e.colors.legacy.black:e.colors.legacy.elementAccent} !important;
  :hover {
    background-color: ${e.colors.legacy.gray};
    svg {
      fill: white;
    }
  }
  svg {
    fill: ${t=>t.$isExpanded?"white":e.colors.legacy.textDiminished};
    transition: fill 200ms ease;
    position: relative;
    ${t=>t.top?`top: ${t.top}px;`:""}
    ${t=>t.right?`right: ${t.right}px;`:""}
  }
`;var o=l(u(),1),K=s(L).attrs({justify:"space-between"})`
  background-color: ${e.colors.legacy.areaBase};
  padding: 10px 16px;
  border-bottom: 1px solid ${e.colors.legacy.borderDiminished};
  height: 46px;
  opacity: ${t=>t.opacity??"1"};
`,Q=s.div`
  display: flex;
  margin-left: 10px;
  > * {
    margin-right: 10px;
  }
`,W=s.div`
  width: 24px;
  height: 24px;
`,X=g(({onBackClick:t,totalSteps:c,currentStepIndex:d,isHidden:m,showBackButtonOnFirstStep:r,showBackButton:S=!0})=>(0,o.jsxs)(K,{opacity:m?0:1,children:[S&&(r||d!==0)?(0,o.jsx)(M,{right:1,onClick:t,children:(0,o.jsx)(_,{})}):(0,o.jsx)(W,{}),(0,o.jsx)(Q,{children:E(c).map(p=>{let h=p<=d?e.colors.legacy.spotBase:e.colors.legacy.elementAccent;return(0,o.jsx)(C,{diameter:12,color:h},p)})}),(0,o.jsx)(W,{})]}),"StepHeader");n();i();var a=l(u(),1),Z=g(()=>{let{mutateAsync:t}=O(),{hardwareStepStack:c,pushStep:d,popStep:m,currentStep:r,setOnConnectHardwareAccounts:S,setOnConnectHardwareDone:b,setExistingAccounts:p}=N(),{data:h=[],isFetched:H,isError:v}=$(),w=P(c,(k,q)=>k?.length===q.length),J=c.length>(w??[]).length,B=w?.length===0,U={initial:{x:B?0:J?150:-150,opacity:B?1:0},animate:{x:0,opacity:1},exit:{opacity:0},transition:{duration:.2}},V=(0,f.useCallback)(()=>{r()?.props.preventBack||(r()?.props.onBackCallback&&r()?.props.onBackCallback?.(),m())},[r,m]);return D(()=>{S(async k=>{await t(k),await y.set(x,!await y.get(x))}),b(()=>self.close()),d((0,a.jsx)(I,{}))},c.length===0),(0,f.useEffect)(()=>{p({data:h,isFetched:H,isError:v})},[h,H,v,p]),(0,a.jsxs)(F,{children:[(0,a.jsx)(X,{totalSteps:3,onBackClick:V,showBackButton:!r()?.props.preventBack,currentStepIndex:c.length-1}),(0,a.jsx)(R,{mode:"wait",children:(0,a.jsx)(T.div,{style:{display:"flex",flexGrow:1},...U,children:(0,a.jsx)(G,{children:r()})},`${c.length}_${w?.length}`)})]})},"SettingsConnectHardware"),Tt=Z;export{Tt as default};
//# sourceMappingURL=SettingsConnectHardware-AIBGLIUC.js.map
