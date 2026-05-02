/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 7984:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2379);
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1364);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

html:not([dir="rtl"]) io-highlighter .options button,
html[dir="rtl"] io-highlighter .options button {
  margin: 0;
}
`, ""]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ }),

/***/ 342:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2379);
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1364);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

io-highlighter,
io-highlighter *,
io-highlighter *::before,
io-highlighter *::after {
  box-sizing: border-box;
}

io-highlighter {
  display: block;
  position: relative;
  border: 1px solid #979797;
}

io-highlighter .split {
  display: flex;
  height: 100%;
}

io-highlighter .options {
  width: 95px;
  padding: 12px;
  border-right: 1px solid #979797;
  color: #4a4a4a;
  background-color: #f1f1f1;
}

io-highlighter canvas {
  width: 100%;
  height: 100%;
  user-select: none;
  pointer-events: none;
  flex-grow: 1;
  touch-action: none;
}

io-highlighter[drawing] canvas {
  pointer-events: all;
}

io-highlighter .options .highlight {
  background-image: url(/skin/icons/highlight.svg?off#off);
}

io-highlighter[drawing="highlight"] .options .highlight {
  background-image: url(/skin/icons/highlight.svg?on#on);
}

io-highlighter .options .hide {
  background-image: url(/skin/icons/hide.svg?off#off);
}

io-highlighter[drawing="hide"] .options .hide {
  background-image: url(/skin/icons/hide.svg?on#on);
}

io-highlighter .options .highlight,
io-highlighter .options .hide {
  width: 70px;
  min-height: 70px;
  margin-bottom: 12px;
  padding: 0;
  padding-top: 40px;
  border-width: 0;
  border-radius: 12px;
  outline: none;
  color: inherit;
  background-repeat: no-repeat;
  background-position: center 12px;
  font-size: 0.7rem;
  word-break: break-all;
}

io-highlighter[drawing="highlight"] .options .highlight,
io-highlighter[drawing="hide"] .options .hide {
  color: #fff;
  background-color: #9b9b9b;
}

io-highlighter .closer {
  display: block;
  position: absolute;
  width: 24px;
  height: 24px;
  border-radius: 24px;
  background-color: #4a4a4a;
  cursor: pointer;
  transform: translateX(-12px) translateY(-12px);
}

io-highlighter .closer img {
  width: 12px;
  margin: 6px;
}
`, ""]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ }),

/***/ 5882:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2379);
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1364);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

io-steps {
  display: flex;
  position: relative;
  margin: 0;
  margin-top: 2rem;
  padding: 0;
  justify-content: space-between;
}

/* this element is used only to decorate via horizontal line */
io-steps::before {
  position: absolute;
  z-index: -1;
  top: 12px;
  width: 100%;
  height: 1px;
  background-color: #bcbcbc;
  font-size: 1px;
  line-height: 1px;
  content: " ";
}

html:not([dir="rtl"]) io-steps button,
html[dir="rtl"] io-steps button {
  margin: initial;
  padding: initial;
}

io-steps button {
  min-width: 80px;
  border: 0;
  outline: none;
  color: #0797e1;
  background: #f3f3f3;
  font-size: small;
  font-weight: initial;
  text-transform: inherit;
}

io-steps button::before {
  display: block;
  width: 24px;
  height: 24px;
  margin: auto;
  margin-bottom: 8px;
  border-radius: 12px;
  color: #fafbfd;
  background-color: #0797e1;
  font-size: 0.8rem;
  font-weight: 400;
  line-height: 24px;
  content: attr(data-value);
}

io-steps button:disabled::before {
  background-color: #9b9b9b;
}

io-steps button:disabled {
  color: #d8d8d8;
}

io-steps button.completed::before {
  content: "✔";
  animation: io-steps-completed 0.3s ease-in-out;
}

@keyframes io-steps-completed {
  0% {
    content: " ";
  }

  30% {
    font-size: 0;
    content: "✔";
    transform: scale(0.5);
  }
}
`, ""]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ }),

/***/ 6350:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2379);
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1364);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
  Used for translatable screen reader only content.
  e.g.: Use instead of aria-label to avoid complex attribute value translation
*/
.sr-only {
  clip: rect(0, 0, 0, 0);
  overflow: hidden;
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0px;
  border: 0px;
}
`, ""]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ }),

/***/ 6054:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2379);
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1364);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

@font-face {
  font-family: "Source Sans Pro";
  font-style: normal;
  font-weight: 300;
  src:
    local("Source Sans Pro Light"),
    local("SourceSansPro-Light"),
    url(/skin/fonts/source-sans-pro-300.woff2) format("woff2");
}

@font-face {
  font-family: "Source Sans Pro";
  font-style: normal;
  font-weight: 400;
  src:
    local("Source Sans Pro Regular"),
    local("SourceSansPro-Regular"),
    url(/skin/fonts/source-sans-pro-400.woff2) format("woff2");
}

@font-face {
  font-family: "Source Sans Pro";
  font-style: normal;
  font-weight: 700;
  src:
    local("Source Sans Pro Bold"),
    local("SourceSansPro-Bold"),
    url(/skin/fonts/source-sans-pro-700.woff2) format("woff2");
}

body {
  font-family: "Source Sans Pro", sans-serif;
  font-size: inherit;
}
`, ""]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ }),

/***/ 4341:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2379);
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1364);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
// Imports


var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

:root {
  --background-color-cta-primary: #0797e1;
  --background-color-cta-primary-hover: #0797e1ee;
  --background-color-cta-secondary: #fff;
  --background-color-cta-secondary-hover: #0001;
  --background-color-error: #f7dde1;
  --background-color-info: #0797e1;
  --background-color-secondary: #f7f7f7;
  --background-color-primary: #fff;
  --background-color-ternary: #edf9ff;
  --border-color-cta-primary: var(--background-color-cta-primary);
  --border-color-cta-secondary: var(--color-primary);
  --border-color-secondary: #d2d2d2;
  --border-color-primary: #cdcdcd;
  --border-color-ternary: #c0e6f9;
  --border-color-outline: #acacac;
  --border-radius: 4px;
  --border-radius-primary: 6px;
  --border-style-primary: solid;
  --border-width-thick: 4px;
  --border-width-thin: 1px;
  --box-shadow-primary: 0 2px 4px 0 hsla(0, 0%, 84%, 0.5);
  --color-brand-primary: #ed1e45;
  --color-cta-primary: #fff;
  --color-cta-secondary: #666;
  --color-primary: #585858;
  --color-secondary: #000;
  --color-dimmed: #4a4a4a;
  --color-critical: var(--color-brand-primary);
  --color-default: #ff8f00;
  --color-error: var(--color-brand-primary);
  --color-link: #0797e1;
  --color-info: #0797e1;
  --color-premium: #eda51e;
  --color-premium-hover: #eb9b05;
  --font-size-heavy: 20px;
  --font-size-big: 17px;
  --font-size-medium: 16px;
  --font-size-primary: 13px;
  --font-size-small: 12px;
  --margin-primary: 16px;
  --margin-secondary: calc(var(--margin-primary) / 2);
  --padding-primary: 16px;
  --padding-secondary: calc(var(--padding-primary) / 2);
  --primary-outline: var(--border-color-outline) dotted 1px;
}
`, ""]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ }),

/***/ 6092:
/***/ ((module, __webpack_exports__, __webpack_require__) => {

"use strict";
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(2379);
/* harmony import */ var _node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(1364);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_theme_ui_font_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6054);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_theme_ui_common_css__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(6350);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_theme_ui_light_css__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4341);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_components_ui_io_steps_css__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(5882);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_components_ui_io_highlighter_css__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(342);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_components_ui_io_highlighter_fixes_css__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(7984);
// Imports








var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_noSourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_theme_ui_font_css__WEBPACK_IMPORTED_MODULE_2__/* ["default"] */ .A);
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_theme_ui_common_css__WEBPACK_IMPORTED_MODULE_3__/* ["default"] */ .A);
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_theme_ui_light_css__WEBPACK_IMPORTED_MODULE_4__/* ["default"] */ .A);
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_components_ui_io_steps_css__WEBPACK_IMPORTED_MODULE_5__/* ["default"] */ .A);
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_components_ui_io_highlighter_css__WEBPACK_IMPORTED_MODULE_6__/* ["default"] */ .A);
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_ruleSet_1_rules_1_use_1_components_ui_io_highlighter_fixes_css__WEBPACK_IMPORTED_MODULE_7__/* ["default"] */ .A);
// Module
___CSS_LOADER_EXPORT___.push([module.id, `/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

html {
  font-size: 16px;
}

body {
  display: flex;
  flex-direction: column;
  margin: 0rem;
  color: #494949;
  background-color: #f3f3f3;
  font-size: 1.25rem;
  align-items: center;
}

input,
button {
  font-family: inherit;
}

header,
footer {
  width: 46.3rem;
}

main {
  width: 90vw;
  max-width: 1400px;
}

header {
  display: flex;
  flex-direction: column;
  margin-top: 1.2rem;
  margin-bottom: 2rem;
  align-items: stretch;
}

header > .logo {
  display: flex;
  flex-direction: column;
  align-items: center;
}

#logo {
  height: 2.8rem;
}

.logo > p {
  margin: 0;
  margin-top: 1.2rem;
  padding: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.8rem;
  text-transform: uppercase;
}

main {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 1.4rem;
  flex-grow: 1;
  min-height: 60vh;
}

main,
#other-issues,
.modalContent {
  border: 1px solid #cdcdcd;
  background-color: #fff;
}

.page:not([hidden]) {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.page > p {
  font-size: 0.9rem;
}

main h1 {
  margin: 0;
  padding: 0;
  font-size: 1.5rem;
}

/*
 * Combined Report Issue Page Layout
 */

#reportIssueLayout {
  display: flex;
  gap: 1.5rem;
  flex-grow: 1;
  min-height: 500px;
  overflow: hidden;
  width: 100%;
}

#screenshotContainer {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/*
 * Screenshot Info & Warning Banners
 */

.info-banner,
.warning-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
  border-radius: 6px;
}

.info-banner {
  background-color: #e8f4fc;
  border: 1px solid #0797e1;
}

.info-banner p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
  color: #005d80;
}

.info-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  background-color: #0797e1;
  -webkit-mask-image: url(/skin/icons/info.svg);
  mask-image: url(/skin/icons/info.svg);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.warning-banner {
  background-color: #fff8e6;
  border: 1px solid #f5a623;
  margin-bottom: 1rem;
}

.warning-banner p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.4;
  color: #6b4700;
}

/*
 * Screenshot Consent Modal
 */

#screenshotConsentModal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

#screenshotConsentModal[hidden] {
  display: none;
}

.modal-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
}

.modal-content {
  position: relative;
  width: 90%;
  max-width: 480px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  background-color: #fff8e6;
  border-bottom: 2px solid #f5a623;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #6b4700;
}

.warning-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  background-color: #f5a623;
  -webkit-mask-image: url(/skin/icons/attention.svg);
  mask-image: url(/skin/icons/attention.svg);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.modal-body {
  padding: 1.5rem;
}

.modal-body p {
  margin: 0;
  font-size: 1rem;
  line-height: 1.5;
  color: #333;
}

.modal-body .consent-question {
  margin-top: 1rem;
  font-weight: 600;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  background-color: #f9f9f9;
  border-top: 1px solid #e0e0e0;
}

#screenshotContainer io-highlighter {
  flex-grow: 1;
  min-height: 450px;
  height: 100%;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

#screenshotContainer io-highlighter .split {
  max-width: 100%;
  height: 100%;
}

#screenshotContainer io-highlighter canvas {
  max-width: 100%;
  height: 100%;
}

#issueSidebar {
  width: 280px;
  min-width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  background-color: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow-y: auto;
}

#issueSidebar h2 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #333;
}

#typeSelectorGroup {
  font-size: 0.95rem;
}

.issue-option {
  margin-bottom: 0.75rem;
  padding: 0.75rem;
  border: 2px solid transparent;
  border-radius: 6px;
  background-color: #fff;
  transition: border-color 0.15s ease;
}

.issue-option:hover {
  border-color: #ccc;
}

.issue-option:has(input:checked) {
  border-color: #0797e1;
  background-color: #f0f8ff;
}

.issue-option input[type="radio"] {
  vertical-align: top;
  margin-top: 0.15rem;
}

.issue-option label {
  display: inline-block;
  cursor: pointer;
  vertical-align: top;
  width: calc(100% - 28px);
}

html:not([dir="rtl"]) .issue-option label {
  margin-left: 0.5rem;
}

html[dir="rtl"] .issue-option label {
  margin-right: 0.5rem;
}

.option-title {
  display: block;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.option-desc {
  display: block;
  font-size: 0.85rem;
  color: #666;
  line-height: 1.4;
}

#otherMessageContainer {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e0e0e0;
}

#otherMessageContainer > label {
  display: block;
  font-size: 0.9rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

#otherMessage {
  width: 100%;
  min-height: 4em;
  box-sizing: border-box;
  font-size: 0.9rem;
}

#detailsPage .checkbox-option,
#reviewPage .checkbox-option {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 1rem;
  background-color: #e8f4fc;
  border: 2px solid #0797e1;
  border-radius: 6px;
}

#detailsPage .checkbox-option input[type="checkbox"],
#reviewPage .checkbox-option input[type="checkbox"] {
  margin-top: 0.15rem;
  flex-shrink: 0;
}

#detailsPage .checkbox-option label,
#reviewPage .checkbox-option label {
  font-size: 1rem;
  line-height: 1.4;
  cursor: pointer;
  font-weight: normal;
}

/*
 * Details Page
 */

#detailsPage {
  max-width: 46.3rem;
  margin: 0 auto;
}

#detailsPage h1 {
  margin-bottom: 1.5rem;
}

#detailsPage .form-section {
  margin-bottom: 2rem;
}

#detailsPage .section-note {
  font-size: 0.95rem;
  color: #555;
  line-height: 1.5;
  margin: 0 0 1rem 0;
}

#detailsPage .form-row {
  margin-bottom: 0.5rem;
}

#detailsPage .form-row > label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.premium-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 0.5rem;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: var(--color-premium);
  vertical-align: middle;
}

.premium-crown {
  display: inline-block;
  width: 15px;
  height: 10px;
  background-color: #fff;
  -webkit-mask-image: url(/skin/icons/premium-crown.svg);
  mask-image: url(/skin/icons/premium-crown.svg);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-position: center;
  mask-position: center;
}

.premium-text {
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
}

.premium-email-header {
  margin-bottom: 1rem;
}

.premium-email-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.premium-email-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: #fff;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
}

.premium-email-option:hover {
  border-color: #ccc;
}

.premium-email-option:has(input:checked) {
  border-color: #0797e1;
  background-color: #f0f8ff;
}

.premium-email-option input[type="radio"] {
  margin: 0;
  flex-shrink: 0;
}

.premium-email-option label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 1rem;
}

.premium-email-display {
  font-weight: 600;
  color: #0797e1;
}

#detailsPage .form-row input[type="email"] {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem;
}

#detailsPage .form-row textarea {
  width: 100%;
  min-height: 8em;
  box-sizing: border-box;
}

/*
 * Review Page
 */

#reviewPage {
  max-width: 46.3rem;
  margin: 0 auto;
}

#reportPreview {
  padding: 1rem;
  background-color: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  margin: 1rem 0;
}

#sendingState {
  text-align: center;
  padding: 2rem 0;
}

#error {
  margin-top: 0.3em;
  margin-bottom: 1em;
  color: var(--color-error);
}

#comment {
  min-height: 2em;
  flex-grow: 1;
}

#sendingProgressContainer:not([hidden]) {
  display: flex;
  flex-direction: row;
  margin-top: 2rem;
  justify-content: center;
}

#result {
  border-width: 0px;
  flex-grow: 1;
}

#result .report-id {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 1rem 0;
}

#result .support-message {
  font-size: 1rem;
  margin: 0;
  line-height: 1.5;
}

.support-email {
  color: #0797e1;
  font-weight: 600;
  text-decoration: none;
}

.support-email:hover {
  text-decoration: underline;
}

#error .support-email {
  color: #0797e1;
}

footer,
footer > div {
  box-sizing: border-box;
  padding-bottom: 16px;
}

footer > div:not(#other-issues) {
  display: flex;
  flex-direction: row;
  margin-top: 2rem;
}

footer > div:not(#other-issues) > div {
  flex-grow: 1;
  align-self: flex-end;
}

#privacyPolicy,
#other-issues {
  font-size: 1rem;
}

#other-issues {
  margin-top: 1rem;
  padding-top: 16px;
  background-image: url(/skin/icons/info-big.svg);
  background-repeat: no-repeat;
}

html[dir="ltr"] #other-issues {
  padding-left: 72px;
  background-position: 24px center;
}

html[dir="rtl"] #other-issues {
  padding-right: 72px;
  background-position: calc(100% - 24px) center;
}

#other-issues a,
#other-issues a:visited {
  font-weight: 600;
  text-decoration: none;
}

#privacyPolicy,
#privacyPolicy:visited,
#other-issues a,
#other-issues a:visited {
  color: #0797e1;
}

/*
 * Generic styles
 */

[data-invisible="true"] {
  visibility: hidden;
}

button {
  padding: 0.8rem 1.2rem;
  background-color: transparent;
  font-size: 1.125rem;
  font-weight: 700;
  text-decoration: none;
  text-transform: uppercase;
  cursor: pointer;
  flex-shrink: 0;
}

html:not([dir="rtl"]) button {
  margin-left: 0.5rem;
}

html[dir="rtl"] button {
  margin-right: 0.5rem;
}

button.primary:not(.icon) {
  border: 0px;
  color: #fff;
  background-color: #0797e1;
}

button.primary:not([disabled]):not(.icon):hover {
  box-shadow: inset 0 0 0 3px #005d80;
}

button.primary[disabled]:not(.icon) {
  background-color: #5cbce1;
}

button.secondary {
  border: 1px solid #0797e1;
  color: #0797e1;
}

button.secondary:hover {
  box-shadow: inset 0 0 0 2px #0797e1;
}

button.link {
  padding: 0.2rem;
  border: 0px;
  color: #0797e1;
  background-color: transparent;
  font-weight: 400;
  text-decoration: underline;
  text-transform: none;
}

button.link:hover {
  color: #5cbce1;
}

button.link:disabled,
button.link:disabled:hover {
  color: #ccc;
  cursor: default;
}

input[type="text"],
input[type="email"],
textarea {
  border: 2px solid #0797e1;
  font-size: 1.25rem;
}

input[type="email"]:invalid {
  border-color: var(--color-error);
}

input[type="checkbox"],
input[type="radio"] {
  display: inline-block;
  width: 18px;
  height: 18px;
  margin: 0px 3px;
  padding: 0px;
  border: 0px;
  background-color: transparent;
  background-repeat: no-repeat;
  -webkit-appearance: none;
  -moz-appearance: none;
}

input[type="checkbox"] {
  background-image: url(/skin/icons/checkbox.svg?off#off);
}

input[type="checkbox"]:checked {
  background-image: url(/skin/icons/checkbox.svg?on#on);
}

input[type="radio"] {
  background-image: url(/skin/icons/radio.svg?normal#normal);
}

input[type="radio"]:hover {
  background-image: url(/skin/icons/radio.svg?hover#hover);
}

input[type="radio"]:checked {
  background-image: url(/skin/icons/radio.svg?selected#selected);
}

.modal:not([hidden]) {
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 5rem;
  background-color: rgba(0, 0, 0, 0.5);
}

.modalContent {
  display: flex;
  overflow: auto;
  flex-direction: column;
  padding: 2rem;
  flex-grow: 1;
  align-items: flex-end;
}

[aria-hidden="true"] {
  display: none !important;
}

#notification {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  padding: 2px;
  opacity: 0.8;
  color: #4a4a4a;
  background-color: #d8d8d8;
  font-size: 1rem;
}

#notification-text {
  text-align: center;
  flex: 1;
}

.icon {
  padding: 0px;
  border: 0px;
  background-color: transparent;
}

.icon:hover {
  box-shadow: none;
}

.icon::before {
  display: block;
  border: 0.2rem solid transparent;
  background-repeat: no-repeat;
  content: "";
}

.close.icon::before {
  width: 1rem;
  height: 1rem;
}

.icon.close.tertiary::before {
  background-image: url(/skin/icons/close.svg?tertiary#tertiary);
}

.icon.close.tertiary:hover::before {
  background-image: url(/skin/icons/close.svg?tertiary-hover#tertiary-hover);
}

/* Button visibility based on current page */
body[data-page="reviewPage"] #continue {
  display: none;
}

body[data-page="reviewPage"] #send {
  display: inline-block;
}

body[data-page="detailsPage"] #back,
body[data-page="reviewPage"] #back {
  display: inline-block;
}

input[type="checkbox"],
input[type="radio"] {
  vertical-align: top;
}

/*
 * Report Preview Styles
 */

.preview-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.preview-section:last-child {
  border-bottom: none;
}

.preview-section h3 {
  margin: 0 0 0.5rem 0;
  padding: 0;
  color: #0797e1;
  font-size: 1rem;
  font-weight: 700;
}

.preview-section p {
  margin: 0;
  word-break: break-word;
}

.preview-row {
  margin-bottom: 0.3rem;
}

.preview-label {
  font-weight: 600;
  color: #666;
}

.preview-value {
  margin-left: 0.5rem;
  word-break: break-word;
}

.preview-list {
  max-height: 150px;
  overflow-y: auto;
  padding: 0.5rem;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.preview-list-item {
  padding: 0.25rem 0;
  font-size: 0.85rem;
  word-break: break-all;
}

.preview-list-item code {
  background-color: #eee;
  padding: 0.1rem 0.3rem;
  border-radius: 2px;
  font-family: monospace;
}

.preview-screenshot {
  max-width: 100%;
  max-height: 200px;
  margin-top: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

/* Report consent checkbox on review page */
#reportConsentContainer {
  margin-top: 1rem;
  margin-bottom: 1rem;
}

/* Hide consent and all buttons when sending */
body.sending #reportConsentContainer,
body.sending #back,
body.sending #send,
body.sending #cancel {
  display: none !important;
}

/* Hide consent, back, cancel after sent - but show close button */
body.sent #reportConsentContainer,
body.sent #back,
body.sent #cancel {
  display: none !important;
}
`, ""]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ }),

/***/ 1364:
/***/ ((module) => {

"use strict";


/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
module.exports = function (cssWithMappingToString) {
  var list = [];

  // return the list of modules as css string
  list.toString = function toString() {
    return this.map(function (item) {
      var content = "";
      var needLayer = typeof item[5] !== "undefined";
      if (item[4]) {
        content += "@supports (".concat(item[4], ") {");
      }
      if (item[2]) {
        content += "@media ".concat(item[2], " {");
      }
      if (needLayer) {
        content += "@layer".concat(item[5].length > 0 ? " ".concat(item[5]) : "", " {");
      }
      content += cssWithMappingToString(item);
      if (needLayer) {
        content += "}";
      }
      if (item[2]) {
        content += "}";
      }
      if (item[4]) {
        content += "}";
      }
      return content;
    }).join("");
  };

  // import a list of modules into the list
  list.i = function i(modules, media, dedupe, supports, layer) {
    if (typeof modules === "string") {
      modules = [[null, modules, undefined]];
    }
    var alreadyImportedModules = {};
    if (dedupe) {
      for (var k = 0; k < this.length; k++) {
        var id = this[k][0];
        if (id != null) {
          alreadyImportedModules[id] = true;
        }
      }
    }
    for (var _k = 0; _k < modules.length; _k++) {
      var item = [].concat(modules[_k]);
      if (dedupe && alreadyImportedModules[item[0]]) {
        continue;
      }
      if (typeof layer !== "undefined") {
        if (typeof item[5] === "undefined") {
          item[5] = layer;
        } else {
          item[1] = "@layer".concat(item[5].length > 0 ? " ".concat(item[5]) : "", " {").concat(item[1], "}");
          item[5] = layer;
        }
      }
      if (media) {
        if (!item[2]) {
          item[2] = media;
        } else {
          item[1] = "@media ".concat(item[2], " {").concat(item[1], "}");
          item[2] = media;
        }
      }
      if (supports) {
        if (!item[4]) {
          item[4] = "".concat(supports);
        } else {
          item[1] = "@supports (".concat(item[4], ") {").concat(item[1], "}");
          item[4] = supports;
        }
      }
      list.push(item);
    }
  };
  return list;
};

/***/ }),

/***/ 2379:
/***/ ((module) => {

"use strict";


module.exports = function (i) {
  return i[1];
};

/***/ }),

/***/ 3465:
/***/ ((module) => {

"use strict";


var stylesInDOM = [];
function getIndexByIdentifier(identifier) {
  var result = -1;
  for (var i = 0; i < stylesInDOM.length; i++) {
    if (stylesInDOM[i].identifier === identifier) {
      result = i;
      break;
    }
  }
  return result;
}
function modulesToDom(list, options) {
  var idCountMap = {};
  var identifiers = [];
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    var id = options.base ? item[0] + options.base : item[0];
    var count = idCountMap[id] || 0;
    var identifier = "".concat(id, " ").concat(count);
    idCountMap[id] = count + 1;
    var indexByIdentifier = getIndexByIdentifier(identifier);
    var obj = {
      css: item[1],
      media: item[2],
      sourceMap: item[3],
      supports: item[4],
      layer: item[5]
    };
    if (indexByIdentifier !== -1) {
      stylesInDOM[indexByIdentifier].references++;
      stylesInDOM[indexByIdentifier].updater(obj);
    } else {
      var updater = addElementStyle(obj, options);
      options.byIndex = i;
      stylesInDOM.splice(i, 0, {
        identifier: identifier,
        updater: updater,
        references: 1
      });
    }
    identifiers.push(identifier);
  }
  return identifiers;
}
function addElementStyle(obj, options) {
  var api = options.domAPI(options);
  api.update(obj);
  var updater = function updater(newObj) {
    if (newObj) {
      if (newObj.css === obj.css && newObj.media === obj.media && newObj.sourceMap === obj.sourceMap && newObj.supports === obj.supports && newObj.layer === obj.layer) {
        return;
      }
      api.update(obj = newObj);
    } else {
      api.remove();
    }
  };
  return updater;
}
module.exports = function (list, options) {
  options = options || {};
  list = list || [];
  var lastIdentifiers = modulesToDom(list, options);
  return function update(newList) {
    newList = newList || [];
    for (var i = 0; i < lastIdentifiers.length; i++) {
      var identifier = lastIdentifiers[i];
      var index = getIndexByIdentifier(identifier);
      stylesInDOM[index].references--;
    }
    var newLastIdentifiers = modulesToDom(newList, options);
    for (var _i = 0; _i < lastIdentifiers.length; _i++) {
      var _identifier = lastIdentifiers[_i];
      var _index = getIndexByIdentifier(_identifier);
      if (stylesInDOM[_index].references === 0) {
        stylesInDOM[_index].updater();
        stylesInDOM.splice(_index, 1);
      }
    }
    lastIdentifiers = newLastIdentifiers;
  };
};

/***/ }),

/***/ 5814:
/***/ ((module) => {

"use strict";


var memo = {};

/* istanbul ignore next  */
function getTarget(target) {
  if (typeof memo[target] === "undefined") {
    var styleTarget = document.querySelector(target);

    // Special case to return head of iframe instead of iframe itself
    if (window.HTMLIFrameElement && styleTarget instanceof window.HTMLIFrameElement) {
      try {
        // This will throw an exception if access to iframe is blocked
        // due to cross-origin restrictions
        styleTarget = styleTarget.contentDocument.head;
      } catch (e) {
        // istanbul ignore next
        styleTarget = null;
      }
    }
    memo[target] = styleTarget;
  }
  return memo[target];
}

/* istanbul ignore next  */
function insertBySelector(insert, style) {
  var target = getTarget(insert);
  if (!target) {
    throw new Error("Couldn't find a style target. This probably means that the value for the 'insert' parameter is invalid.");
  }
  target.appendChild(style);
}
module.exports = insertBySelector;

/***/ }),

/***/ 2389:
/***/ ((module) => {

"use strict";


/* istanbul ignore next  */
function insertStyleElement(options) {
  var element = document.createElement("style");
  options.setAttributes(element, options.attributes);
  options.insert(element, options.options);
  return element;
}
module.exports = insertStyleElement;

/***/ }),

/***/ 9337:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


/* istanbul ignore next  */
function setAttributesWithoutAttributes(styleElement) {
  var nonce =  true ? __webpack_require__.nc : 0;
  if (nonce) {
    styleElement.setAttribute("nonce", nonce);
  }
}
module.exports = setAttributesWithoutAttributes;

/***/ }),

/***/ 6622:
/***/ ((module) => {

"use strict";


/* istanbul ignore next  */
function apply(styleElement, options, obj) {
  var css = "";
  if (obj.supports) {
    css += "@supports (".concat(obj.supports, ") {");
  }
  if (obj.media) {
    css += "@media ".concat(obj.media, " {");
  }
  var needLayer = typeof obj.layer !== "undefined";
  if (needLayer) {
    css += "@layer".concat(obj.layer.length > 0 ? " ".concat(obj.layer) : "", " {");
  }
  css += obj.css;
  if (needLayer) {
    css += "}";
  }
  if (obj.media) {
    css += "}";
  }
  if (obj.supports) {
    css += "}";
  }
  var sourceMap = obj.sourceMap;
  if (sourceMap && typeof btoa !== "undefined") {
    css += "\n/*# sourceMappingURL=data:application/json;base64,".concat(btoa(unescape(encodeURIComponent(JSON.stringify(sourceMap)))), " */");
  }

  // For old IE
  /* istanbul ignore if  */
  options.styleTagTransform(css, styleElement, options.options);
}
function removeStyleElement(styleElement) {
  // istanbul ignore if
  if (styleElement.parentNode === null) {
    return false;
  }
  styleElement.parentNode.removeChild(styleElement);
}

/* istanbul ignore next  */
function domAPI(options) {
  if (typeof document === "undefined") {
    return {
      update: function update() {},
      remove: function remove() {}
    };
  }
  var styleElement = options.insertStyleElement(options);
  return {
    update: function update(obj) {
      apply(styleElement, options, obj);
    },
    remove: function remove() {
      removeStyleElement(styleElement);
    }
  };
}
module.exports = domAPI;

/***/ }),

/***/ 8722:
/***/ ((module) => {

"use strict";


/* istanbul ignore next  */
function styleTagTransform(css, styleElement) {
  if (styleElement.styleSheet) {
    styleElement.styleSheet.cssText = css;
  } else {
    while (styleElement.firstChild) {
      styleElement.removeChild(styleElement.firstChild);
    }
    styleElement.appendChild(document.createTextNode(css));
  }
}
module.exports = styleTagTransform;

/***/ }),

/***/ 2558:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";
/* @@package_name - v@@version - @@timestamp */
/* -*- Mode: indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set sts=2 sw=2 et tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


if (!(globalThis.chrome && globalThis.chrome.runtime && globalThis.chrome.runtime.id)) {
  throw new Error("This script should only be loaded in a browser extension.");
}

if (!(globalThis.browser && globalThis.browser.runtime && globalThis.browser.runtime.id)) {
  const CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE = "The message port closed before a response was received.";
  const ERROR_TO_IGNORE = `A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received`;

  // Wrapping the bulk of this polyfill in a one-time-use function is a minor
  // optimization for Firefox. Since Spidermonkey does not fully parse the
  // contents of a function until the first time it's called, and since it will
  // never actually need to be called, this allows the polyfill to be included
  // in Firefox nearly for free.
  const wrapAPIs = extensionAPIs => {
    // NOTE: apiMetadata is associated to the content of the api-metadata.json file
    // at build time by replacing the following "include" with the content of the
    // JSON file.
    const apiMetadata = __webpack_require__(2058);

    if (Object.keys(apiMetadata).length === 0) {
      throw new Error("api-metadata.json has not been included in browser-polyfill");
    }

    /**
     * A WeakMap subclass which creates and stores a value for any key which does
     * not exist when accessed, but behaves exactly as an ordinary WeakMap
     * otherwise.
     *
     * @param {function} createItem
     *        A function which will be called in order to create the value for any
     *        key which does not exist, the first time it is accessed. The
     *        function receives, as its only argument, the key being created.
     */
    class DefaultWeakMap extends WeakMap {
      constructor(createItem, items = undefined) {
        super(items);
        this.createItem = createItem;
      }

      get(key) {
        if (!this.has(key)) {
          this.set(key, this.createItem(key));
        }

        return super.get(key);
      }
    }

    /**
     * Returns true if the given object is an object with a `then` method, and can
     * therefore be assumed to behave as a Promise.
     *
     * @param {*} value The value to test.
     * @returns {boolean} True if the value is thenable.
     */
    const isThenable = value => {
      return value && typeof value === "object" && typeof value.then === "function";
    };

    /**
     * Creates and returns a function which, when called, will resolve or reject
     * the given promise based on how it is called:
     *
     * - If, when called, `chrome.runtime.lastError` contains a non-null object,
     *   the promise is rejected with that value.
     * - If the function is called with exactly one argument, the promise is
     *   resolved to that value.
     * - Otherwise, the promise is resolved to an array containing all of the
     *   function's arguments.
     *
     * @param {object} promise
     *        An object containing the resolution and rejection functions of a
     *        promise.
     * @param {function} promise.resolve
     *        The promise's resolution function.
     * @param {function} promise.reject
     *        The promise's rejection function.
     * @param {object} metadata
     *        Metadata about the wrapped method which has created the callback.
     * @param {boolean} metadata.singleCallbackArg
     *        Whether or not the promise is resolved with only the first
     *        argument of the callback, alternatively an array of all the
     *        callback arguments is resolved. By default, if the callback
     *        function is invoked with only a single argument, that will be
     *        resolved to the promise, while all arguments will be resolved as
     *        an array if multiple are given.
     *
     * @returns {function}
     *        The generated callback function.
     */
    const makeCallback = (promise, metadata) => {
      // In case we encounter a browser error in the callback function, we don't
      // want to lose the stack trace leading up to this point. For that reason,
      // we need to instantiate the error outside the callback function.
      let error = new Error();
      return (...callbackArgs) => {
        if (extensionAPIs.runtime.lastError) {
          error.message = extensionAPIs.runtime.lastError.message;
          promise.reject(error);
        } else if (metadata.singleCallbackArg ||
                   (callbackArgs.length <= 1 && metadata.singleCallbackArg !== false)) {
          promise.resolve(callbackArgs[0]);
        } else {
          promise.resolve(callbackArgs);
        }
      };
    };

    const pluralizeArguments = (numArgs) => numArgs == 1 ? "argument" : "arguments";

    /**
     * Creates a wrapper function for a method with the given name and metadata.
     *
     * @param {string} name
     *        The name of the method which is being wrapped.
     * @param {object} metadata
     *        Metadata about the method being wrapped.
     * @param {integer} metadata.minArgs
     *        The minimum number of arguments which must be passed to the
     *        function. If called with fewer than this number of arguments, the
     *        wrapper will raise an exception.
     * @param {integer} metadata.maxArgs
     *        The maximum number of arguments which may be passed to the
     *        function. If called with more than this number of arguments, the
     *        wrapper will raise an exception.
     * @param {boolean} metadata.singleCallbackArg
     *        Whether or not the promise is resolved with only the first
     *        argument of the callback, alternatively an array of all the
     *        callback arguments is resolved. By default, if the callback
     *        function is invoked with only a single argument, that will be
     *        resolved to the promise, while all arguments will be resolved as
     *        an array if multiple are given.
     *
     * @returns {function(object, ...*)}
     *       The generated wrapper function.
     */
    const wrapAsyncFunction = (name, metadata) => {
      return function asyncFunctionWrapper(target, ...args) {
        if (args.length < metadata.minArgs) {
          throw new Error(`Expected at least ${metadata.minArgs} ${pluralizeArguments(metadata.minArgs)} for ${name}(), got ${args.length}`);
        }

        if (args.length > metadata.maxArgs) {
          throw new Error(`Expected at most ${metadata.maxArgs} ${pluralizeArguments(metadata.maxArgs)} for ${name}(), got ${args.length}`);
        }

        return new Promise((resolve, reject) => {
          if (metadata.fallbackToNoCallback) {
            // This API method has currently no callback on Chrome, but it return a promise on Firefox,
            // and so the polyfill will try to call it with a callback first, and it will fallback
            // to not passing the callback if the first call fails.
            try {
              target[name](...args, makeCallback({resolve, reject}, metadata));
            } catch (cbError) {
              console.warn(`${name} API method doesn't seem to support the callback parameter, ` +
                           "falling back to call it without a callback: ", cbError);

              target[name](...args);

              // Update the API method metadata, so that the next API calls will not try to
              // use the unsupported callback anymore.
              metadata.fallbackToNoCallback = false;
              metadata.noCallback = true;

              resolve();
            }
          } else if (metadata.noCallback) {
            target[name](...args);
            resolve();
          } else {
            target[name](...args, makeCallback({resolve, reject}, metadata));
          }
        });
      };
    };

    /**
     * Wraps an existing method of the target object, so that calls to it are
     * intercepted by the given wrapper function. The wrapper function receives,
     * as its first argument, the original `target` object, followed by each of
     * the arguments passed to the original method.
     *
     * @param {object} target
     *        The original target object that the wrapped method belongs to.
     * @param {function} method
     *        The method being wrapped. This is used as the target of the Proxy
     *        object which is created to wrap the method.
     * @param {function} wrapper
     *        The wrapper function which is called in place of a direct invocation
     *        of the wrapped method.
     *
     * @returns {Proxy<function>}
     *        A Proxy object for the given method, which invokes the given wrapper
     *        method in its place.
     */
    const wrapMethod = (target, method, wrapper) => {
      return new Proxy(method, {
        apply(targetMethod, thisObj, args) {
          return wrapper.call(thisObj, target, ...args);
        },
      });
    };

    let hasOwnProperty = Function.call.bind(Object.prototype.hasOwnProperty);

    /**
     * Wraps an object in a Proxy which intercepts and wraps certain methods
     * based on the given `wrappers` and `metadata` objects.
     *
     * @param {object} target
     *        The target object to wrap.
     *
     * @param {object} [wrappers = {}]
     *        An object tree containing wrapper functions for special cases. Any
     *        function present in this object tree is called in place of the
     *        method in the same location in the `target` object tree. These
     *        wrapper methods are invoked as described in {@see wrapMethod}.
     *
     * @param {object} [metadata = {}]
     *        An object tree containing metadata used to automatically generate
     *        Promise-based wrapper functions for asynchronous. Any function in
     *        the `target` object tree which has a corresponding metadata object
     *        in the same location in the `metadata` tree is replaced with an
     *        automatically-generated wrapper function, as described in
     *        {@see wrapAsyncFunction}
     *
     * @returns {Proxy<object>}
     */
    const wrapObject = (target, wrappers = {}, metadata = {}) => {
      let cache = Object.create(null);
      let handlers = {
        has(proxyTarget, prop) {
          return prop in target || prop in cache;
        },

        get(proxyTarget, prop, receiver) {
          if (prop in cache) {
            return cache[prop];
          }

          if (!(prop in target)) {
            return undefined;
          }

          let value = target[prop];

          if (typeof value === "function") {
            // This is a method on the underlying object. Check if we need to do
            // any wrapping.

            if (typeof wrappers[prop] === "function") {
              // We have a special-case wrapper for this method.
              value = wrapMethod(target, target[prop], wrappers[prop]);
            } else if (hasOwnProperty(metadata, prop)) {
              // This is an async method that we have metadata for. Create a
              // Promise wrapper for it.
              let wrapper = wrapAsyncFunction(prop, metadata[prop]);
              value = wrapMethod(target, target[prop], wrapper);
            } else {
              // This is a method that we don't know or care about. Return the
              // original method, bound to the underlying object.
              value = value.bind(target);
            }
          } else if (typeof value === "object" && value !== null &&
                     (hasOwnProperty(wrappers, prop) ||
                      hasOwnProperty(metadata, prop))) {
            // This is an object that we need to do some wrapping for the children
            // of. Create a sub-object wrapper for it with the appropriate child
            // metadata.
            value = wrapObject(value, wrappers[prop], metadata[prop]);
          } else if (hasOwnProperty(metadata, "*")) {
            // Wrap all properties in * namespace.
            value = wrapObject(value, wrappers[prop], metadata["*"]);
          } else {
            // We don't need to do any wrapping for this property,
            // so just forward all access to the underlying object.
            Object.defineProperty(cache, prop, {
              configurable: true,
              enumerable: true,
              get() {
                return target[prop];
              },
              set(value) {
                target[prop] = value;
              },
            });

            return value;
          }

          cache[prop] = value;
          return value;
        },

        set(proxyTarget, prop, value, receiver) {
          if (prop in cache) {
            cache[prop] = value;
          } else {
            target[prop] = value;
          }
          return true;
        },

        defineProperty(proxyTarget, prop, desc) {
          return Reflect.defineProperty(cache, prop, desc);
        },

        deleteProperty(proxyTarget, prop) {
          return Reflect.deleteProperty(cache, prop);
        },
      };

      // Per contract of the Proxy API, the "get" proxy handler must return the
      // original value of the target if that value is declared read-only and
      // non-configurable. For this reason, we create an object with the
      // prototype set to `target` instead of using `target` directly.
      // Otherwise we cannot return a custom object for APIs that
      // are declared read-only and non-configurable, such as `chrome.devtools`.
      //
      // The proxy handlers themselves will still use the original `target`
      // instead of the `proxyTarget`, so that the methods and properties are
      // dereferenced via the original targets.
      let proxyTarget = Object.create(target);
      return new Proxy(proxyTarget, handlers);
    };

    /**
     * Creates a set of wrapper functions for an event object, which handles
     * wrapping of listener functions that those messages are passed.
     *
     * A single wrapper is created for each listener function, and stored in a
     * map. Subsequent calls to `addListener`, `hasListener`, or `removeListener`
     * retrieve the original wrapper, so that  attempts to remove a
     * previously-added listener work as expected.
     *
     * @param {DefaultWeakMap<function, function>} wrapperMap
     *        A DefaultWeakMap object which will create the appropriate wrapper
     *        for a given listener function when one does not exist, and retrieve
     *        an existing one when it does.
     *
     * @returns {object}
     */
    const wrapEvent = wrapperMap => ({
      addListener(target, listener, ...args) {
        target.addListener(wrapperMap.get(listener), ...args);
      },

      hasListener(target, listener) {
        return target.hasListener(wrapperMap.get(listener));
      },

      removeListener(target, listener) {
        target.removeListener(wrapperMap.get(listener));
      },
    });

    const onRequestFinishedWrappers = new DefaultWeakMap(listener => {
      if (typeof listener !== "function") {
        return listener;
      }

      /**
       * Wraps an onRequestFinished listener function so that it will return a
       * `getContent()` property which returns a `Promise` rather than using a
       * callback API.
       *
       * @param {object} req
       *        The HAR entry object representing the network request.
       */
      return function onRequestFinished(req) {
        const wrappedReq = wrapObject(req, {} /* wrappers */, {
          getContent: {
            minArgs: 0,
            maxArgs: 0,
          },
        });
        listener(wrappedReq);
      };
    });

    const onMessageWrappers = new DefaultWeakMap(listener => {
      if (typeof listener !== "function") {
        return listener;
      }

      /**
       * Wraps a message listener function so that it may send responses based on
       * its return value, rather than by returning a sentinel value and calling a
       * callback. If the listener function returns a Promise, the response is
       * sent when the promise either resolves or rejects.
       *
       * @param {*} message
       *        The message sent by the other end of the channel.
       * @param {object} sender
       *        Details about the sender of the message.
       * @param {function(*)} sendResponse
       *        A callback which, when called with an arbitrary argument, sends
       *        that value as a response.
       * @returns {boolean}
       *        True if the wrapped listener returned a Promise, which will later
       *        yield a response. False otherwise.
       */
      return function onMessage(message, sender, sendResponse) {
        let didCallSendResponse = false;

        let wrappedSendResponse;
        let sendResponsePromise = new Promise(resolve => {
          wrappedSendResponse = function(response) {
            didCallSendResponse = true;
            resolve(response);
          };
        });

        let result;
        try {
          result = listener(message, sender, wrappedSendResponse);
        } catch (err) {
          result = Promise.reject(err);
        }

        const isResultThenable = result !== true && isThenable(result);

        // If the listener didn't returned true or a Promise, or called
        // wrappedSendResponse synchronously, we can exit earlier
        // because there will be no response sent from this listener.
        if (result !== true && !isResultThenable && !didCallSendResponse) {
          return false;
        }

        // A small helper to send the message if the promise resolves
        // and an error if the promise rejects (a wrapped sendMessage has
        // to translate the message into a resolved promise or a rejected
        // promise).
        const sendPromisedResult = (promise) => {
          promise.then(msg => {
            // send the message value.
            sendResponse(msg);
          }, error => {
            // Send a JSON representation of the error if the rejected value
            // is an instance of error, or the object itself otherwise.
            let message;
            if (error && (error instanceof Error ||
                typeof error.message === "string")) {
              message = error.message;
            } else {
              message = "An unexpected error occurred";
            }

            sendResponse({
              __mozWebExtensionPolyfillReject__: true,
              message,
            });
          }).catch(err => {
            // Print an error on the console if unable to send the response.
            console.error("Failed to send onMessage rejected reply", err);
          });
        };

        // If the listener returned a Promise, send the resolved value as a
        // result, otherwise wait the promise related to the wrappedSendResponse
        // callback to resolve and send it as a response.
        if (isResultThenable) {
          sendPromisedResult(result);
        } else {
          sendPromisedResult(sendResponsePromise);
        }

        // Let Chrome know that the listener is replying.
        return true;
      };
    });

    const wrappedSendMessageCallback = ({reject, resolve}, reply) => {
      if (extensionAPIs.runtime.lastError) {
        // Detect when none of the listeners replied to the sendMessage call and resolve
        // the promise to undefined as in Firefox.
        // See https://github.com/mozilla/webextension-polyfill/issues/130
        if (extensionAPIs.runtime.lastError.message === CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE || extensionAPIs.runtime.lastError.message.includes(ERROR_TO_IGNORE)) {
          resolve();
        } else {
          reject(new Error(extensionAPIs.runtime.lastError.message));
        }
      } else if (reply && reply.__mozWebExtensionPolyfillReject__) {
        // Convert back the JSON representation of the error into
        // an Error instance.
        reject(new Error(reply.message));
      } else {
        resolve(reply);
      }
    };

    const wrappedSendMessage = (name, metadata, apiNamespaceObj, ...args) => {
      if (args.length < metadata.minArgs) {
        throw new Error(`Expected at least ${metadata.minArgs} ${pluralizeArguments(metadata.minArgs)} for ${name}(), got ${args.length}`);
      }

      if (args.length > metadata.maxArgs) {
        throw new Error(`Expected at most ${metadata.maxArgs} ${pluralizeArguments(metadata.maxArgs)} for ${name}(), got ${args.length}`);
      }

      return new Promise((resolve, reject) => {
        const wrappedCb = wrappedSendMessageCallback.bind(null, {resolve, reject});
        args.push(wrappedCb);
        apiNamespaceObj.sendMessage(...args);
      });
    };

    const staticWrappers = {
      devtools: {
        network: {
          onRequestFinished: wrapEvent(onRequestFinishedWrappers),
        },
      },
      runtime: {
        onMessage: wrapEvent(onMessageWrappers),
        onMessageExternal: wrapEvent(onMessageWrappers),
        sendMessage: wrappedSendMessage.bind(null, "sendMessage", {minArgs: 1, maxArgs: 3}),
      },
      tabs: {
        sendMessage: wrappedSendMessage.bind(null, "sendMessage", {minArgs: 2, maxArgs: 3}),
      },
    };
    const settingMetadata = {
      clear: {minArgs: 1, maxArgs: 1},
      get: {minArgs: 1, maxArgs: 1},
      set: {minArgs: 1, maxArgs: 1},
    };
    apiMetadata.privacy = {
      network: {"*": settingMetadata},
      services: {"*": settingMetadata},
      websites: {"*": settingMetadata},
    };

    return wrapObject(extensionAPIs, staticWrappers, apiMetadata);
  };

  // The build process adds a UMD wrapper around this file, which makes the
  // `module` variable available.
  module.exports = wrapAPIs(chrome);
} else {
  module.exports = globalThis.browser;
}


/***/ }),

/***/ 2181:
/***/ ((module) => {

(function webpackUniversalModuleDefinition(root, factory) {
	if(true)
		module.exports = factory();
	else {}
})(self, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 7795:
/***/ ((module, __unused_webpack_exports, __nested_webpack_require_510__) => {

/* @@package_name - v@@version - @@timestamp */
/* -*- Mode: indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* vim: set sts=2 sw=2 et tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


if (!(globalThis.chrome && globalThis.chrome.runtime && globalThis.chrome.runtime.id)) {
  throw new Error("This script should only be loaded in a browser extension.");
}

if (!(globalThis.browser && globalThis.browser.runtime && globalThis.browser.runtime.id)) {
  const CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE = "The message port closed before a response was received.";
  const ERROR_TO_IGNORE = `A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received`;

  // Wrapping the bulk of this polyfill in a one-time-use function is a minor
  // optimization for Firefox. Since Spidermonkey does not fully parse the
  // contents of a function until the first time it's called, and since it will
  // never actually need to be called, this allows the polyfill to be included
  // in Firefox nearly for free.
  const wrapAPIs = extensionAPIs => {
    // NOTE: apiMetadata is associated to the content of the api-metadata.json file
    // at build time by replacing the following "include" with the content of the
    // JSON file.
    const apiMetadata = __nested_webpack_require_510__(9438);

    if (Object.keys(apiMetadata).length === 0) {
      throw new Error("api-metadata.json has not been included in browser-polyfill");
    }

    /**
     * A WeakMap subclass which creates and stores a value for any key which does
     * not exist when accessed, but behaves exactly as an ordinary WeakMap
     * otherwise.
     *
     * @param {function} createItem
     *        A function which will be called in order to create the value for any
     *        key which does not exist, the first time it is accessed. The
     *        function receives, as its only argument, the key being created.
     */
    class DefaultWeakMap extends WeakMap {
      constructor(createItem, items = undefined) {
        super(items);
        this.createItem = createItem;
      }

      get(key) {
        if (!this.has(key)) {
          this.set(key, this.createItem(key));
        }

        return super.get(key);
      }
    }

    /**
     * Returns true if the given object is an object with a `then` method, and can
     * therefore be assumed to behave as a Promise.
     *
     * @param {*} value The value to test.
     * @returns {boolean} True if the value is thenable.
     */
    const isThenable = value => {
      return value && typeof value === "object" && typeof value.then === "function";
    };

    /**
     * Creates and returns a function which, when called, will resolve or reject
     * the given promise based on how it is called:
     *
     * - If, when called, `chrome.runtime.lastError` contains a non-null object,
     *   the promise is rejected with that value.
     * - If the function is called with exactly one argument, the promise is
     *   resolved to that value.
     * - Otherwise, the promise is resolved to an array containing all of the
     *   function's arguments.
     *
     * @param {object} promise
     *        An object containing the resolution and rejection functions of a
     *        promise.
     * @param {function} promise.resolve
     *        The promise's resolution function.
     * @param {function} promise.reject
     *        The promise's rejection function.
     * @param {object} metadata
     *        Metadata about the wrapped method which has created the callback.
     * @param {boolean} metadata.singleCallbackArg
     *        Whether or not the promise is resolved with only the first
     *        argument of the callback, alternatively an array of all the
     *        callback arguments is resolved. By default, if the callback
     *        function is invoked with only a single argument, that will be
     *        resolved to the promise, while all arguments will be resolved as
     *        an array if multiple are given.
     *
     * @returns {function}
     *        The generated callback function.
     */
    const makeCallback = (promise, metadata) => {
      // In case we encounter a browser error in the callback function, we don't
      // want to lose the stack trace leading up to this point. For that reason,
      // we need to instantiate the error outside the callback function.
      let error = new Error();
      return (...callbackArgs) => {
        if (extensionAPIs.runtime.lastError) {
          error.message = extensionAPIs.runtime.lastError.message;
          promise.reject(error);
        } else if (metadata.singleCallbackArg ||
                   (callbackArgs.length <= 1 && metadata.singleCallbackArg !== false)) {
          promise.resolve(callbackArgs[0]);
        } else {
          promise.resolve(callbackArgs);
        }
      };
    };

    const pluralizeArguments = (numArgs) => numArgs == 1 ? "argument" : "arguments";

    /**
     * Creates a wrapper function for a method with the given name and metadata.
     *
     * @param {string} name
     *        The name of the method which is being wrapped.
     * @param {object} metadata
     *        Metadata about the method being wrapped.
     * @param {integer} metadata.minArgs
     *        The minimum number of arguments which must be passed to the
     *        function. If called with fewer than this number of arguments, the
     *        wrapper will raise an exception.
     * @param {integer} metadata.maxArgs
     *        The maximum number of arguments which may be passed to the
     *        function. If called with more than this number of arguments, the
     *        wrapper will raise an exception.
     * @param {boolean} metadata.singleCallbackArg
     *        Whether or not the promise is resolved with only the first
     *        argument of the callback, alternatively an array of all the
     *        callback arguments is resolved. By default, if the callback
     *        function is invoked with only a single argument, that will be
     *        resolved to the promise, while all arguments will be resolved as
     *        an array if multiple are given.
     *
     * @returns {function(object, ...*)}
     *       The generated wrapper function.
     */
    const wrapAsyncFunction = (name, metadata) => {
      return function asyncFunctionWrapper(target, ...args) {
        if (args.length < metadata.minArgs) {
          throw new Error(`Expected at least ${metadata.minArgs} ${pluralizeArguments(metadata.minArgs)} for ${name}(), got ${args.length}`);
        }

        if (args.length > metadata.maxArgs) {
          throw new Error(`Expected at most ${metadata.maxArgs} ${pluralizeArguments(metadata.maxArgs)} for ${name}(), got ${args.length}`);
        }

        return new Promise((resolve, reject) => {
          if (metadata.fallbackToNoCallback) {
            // This API method has currently no callback on Chrome, but it return a promise on Firefox,
            // and so the polyfill will try to call it with a callback first, and it will fallback
            // to not passing the callback if the first call fails.
            try {
              target[name](...args, makeCallback({resolve, reject}, metadata));
            } catch (cbError) {
              console.warn(`${name} API method doesn't seem to support the callback parameter, ` +
                           "falling back to call it without a callback: ", cbError);

              target[name](...args);

              // Update the API method metadata, so that the next API calls will not try to
              // use the unsupported callback anymore.
              metadata.fallbackToNoCallback = false;
              metadata.noCallback = true;

              resolve();
            }
          } else if (metadata.noCallback) {
            target[name](...args);
            resolve();
          } else {
            target[name](...args, makeCallback({resolve, reject}, metadata));
          }
        });
      };
    };

    /**
     * Wraps an existing method of the target object, so that calls to it are
     * intercepted by the given wrapper function. The wrapper function receives,
     * as its first argument, the original `target` object, followed by each of
     * the arguments passed to the original method.
     *
     * @param {object} target
     *        The original target object that the wrapped method belongs to.
     * @param {function} method
     *        The method being wrapped. This is used as the target of the Proxy
     *        object which is created to wrap the method.
     * @param {function} wrapper
     *        The wrapper function which is called in place of a direct invocation
     *        of the wrapped method.
     *
     * @returns {Proxy<function>}
     *        A Proxy object for the given method, which invokes the given wrapper
     *        method in its place.
     */
    const wrapMethod = (target, method, wrapper) => {
      return new Proxy(method, {
        apply(targetMethod, thisObj, args) {
          return wrapper.call(thisObj, target, ...args);
        },
      });
    };

    let hasOwnProperty = Function.call.bind(Object.prototype.hasOwnProperty);

    /**
     * Wraps an object in a Proxy which intercepts and wraps certain methods
     * based on the given `wrappers` and `metadata` objects.
     *
     * @param {object} target
     *        The target object to wrap.
     *
     * @param {object} [wrappers = {}]
     *        An object tree containing wrapper functions for special cases. Any
     *        function present in this object tree is called in place of the
     *        method in the same location in the `target` object tree. These
     *        wrapper methods are invoked as described in {@see wrapMethod}.
     *
     * @param {object} [metadata = {}]
     *        An object tree containing metadata used to automatically generate
     *        Promise-based wrapper functions for asynchronous. Any function in
     *        the `target` object tree which has a corresponding metadata object
     *        in the same location in the `metadata` tree is replaced with an
     *        automatically-generated wrapper function, as described in
     *        {@see wrapAsyncFunction}
     *
     * @returns {Proxy<object>}
     */
    const wrapObject = (target, wrappers = {}, metadata = {}) => {
      let cache = Object.create(null);
      let handlers = {
        has(proxyTarget, prop) {
          return prop in target || prop in cache;
        },

        get(proxyTarget, prop, receiver) {
          if (prop in cache) {
            return cache[prop];
          }

          if (!(prop in target)) {
            return undefined;
          }

          let value = target[prop];

          if (typeof value === "function") {
            // This is a method on the underlying object. Check if we need to do
            // any wrapping.

            if (typeof wrappers[prop] === "function") {
              // We have a special-case wrapper for this method.
              value = wrapMethod(target, target[prop], wrappers[prop]);
            } else if (hasOwnProperty(metadata, prop)) {
              // This is an async method that we have metadata for. Create a
              // Promise wrapper for it.
              let wrapper = wrapAsyncFunction(prop, metadata[prop]);
              value = wrapMethod(target, target[prop], wrapper);
            } else {
              // This is a method that we don't know or care about. Return the
              // original method, bound to the underlying object.
              value = value.bind(target);
            }
          } else if (typeof value === "object" && value !== null &&
                     (hasOwnProperty(wrappers, prop) ||
                      hasOwnProperty(metadata, prop))) {
            // This is an object that we need to do some wrapping for the children
            // of. Create a sub-object wrapper for it with the appropriate child
            // metadata.
            value = wrapObject(value, wrappers[prop], metadata[prop]);
          } else if (hasOwnProperty(metadata, "*")) {
            // Wrap all properties in * namespace.
            value = wrapObject(value, wrappers[prop], metadata["*"]);
          } else {
            // We don't need to do any wrapping for this property,
            // so just forward all access to the underlying object.
            Object.defineProperty(cache, prop, {
              configurable: true,
              enumerable: true,
              get() {
                return target[prop];
              },
              set(value) {
                target[prop] = value;
              },
            });

            return value;
          }

          cache[prop] = value;
          return value;
        },

        set(proxyTarget, prop, value, receiver) {
          if (prop in cache) {
            cache[prop] = value;
          } else {
            target[prop] = value;
          }
          return true;
        },

        defineProperty(proxyTarget, prop, desc) {
          return Reflect.defineProperty(cache, prop, desc);
        },

        deleteProperty(proxyTarget, prop) {
          return Reflect.deleteProperty(cache, prop);
        },
      };

      // Per contract of the Proxy API, the "get" proxy handler must return the
      // original value of the target if that value is declared read-only and
      // non-configurable. For this reason, we create an object with the
      // prototype set to `target` instead of using `target` directly.
      // Otherwise we cannot return a custom object for APIs that
      // are declared read-only and non-configurable, such as `chrome.devtools`.
      //
      // The proxy handlers themselves will still use the original `target`
      // instead of the `proxyTarget`, so that the methods and properties are
      // dereferenced via the original targets.
      let proxyTarget = Object.create(target);
      return new Proxy(proxyTarget, handlers);
    };

    /**
     * Creates a set of wrapper functions for an event object, which handles
     * wrapping of listener functions that those messages are passed.
     *
     * A single wrapper is created for each listener function, and stored in a
     * map. Subsequent calls to `addListener`, `hasListener`, or `removeListener`
     * retrieve the original wrapper, so that  attempts to remove a
     * previously-added listener work as expected.
     *
     * @param {DefaultWeakMap<function, function>} wrapperMap
     *        A DefaultWeakMap object which will create the appropriate wrapper
     *        for a given listener function when one does not exist, and retrieve
     *        an existing one when it does.
     *
     * @returns {object}
     */
    const wrapEvent = wrapperMap => ({
      addListener(target, listener, ...args) {
        target.addListener(wrapperMap.get(listener), ...args);
      },

      hasListener(target, listener) {
        return target.hasListener(wrapperMap.get(listener));
      },

      removeListener(target, listener) {
        target.removeListener(wrapperMap.get(listener));
      },
    });

    const onRequestFinishedWrappers = new DefaultWeakMap(listener => {
      if (typeof listener !== "function") {
        return listener;
      }

      /**
       * Wraps an onRequestFinished listener function so that it will return a
       * `getContent()` property which returns a `Promise` rather than using a
       * callback API.
       *
       * @param {object} req
       *        The HAR entry object representing the network request.
       */
      return function onRequestFinished(req) {
        const wrappedReq = wrapObject(req, {} /* wrappers */, {
          getContent: {
            minArgs: 0,
            maxArgs: 0,
          },
        });
        listener(wrappedReq);
      };
    });

    const onMessageWrappers = new DefaultWeakMap(listener => {
      if (typeof listener !== "function") {
        return listener;
      }

      /**
       * Wraps a message listener function so that it may send responses based on
       * its return value, rather than by returning a sentinel value and calling a
       * callback. If the listener function returns a Promise, the response is
       * sent when the promise either resolves or rejects.
       *
       * @param {*} message
       *        The message sent by the other end of the channel.
       * @param {object} sender
       *        Details about the sender of the message.
       * @param {function(*)} sendResponse
       *        A callback which, when called with an arbitrary argument, sends
       *        that value as a response.
       * @returns {boolean}
       *        True if the wrapped listener returned a Promise, which will later
       *        yield a response. False otherwise.
       */
      return function onMessage(message, sender, sendResponse) {
        let didCallSendResponse = false;

        let wrappedSendResponse;
        let sendResponsePromise = new Promise(resolve => {
          wrappedSendResponse = function(response) {
            didCallSendResponse = true;
            resolve(response);
          };
        });

        let result;
        try {
          result = listener(message, sender, wrappedSendResponse);
        } catch (err) {
          result = Promise.reject(err);
        }

        const isResultThenable = result !== true && isThenable(result);

        // If the listener didn't returned true or a Promise, or called
        // wrappedSendResponse synchronously, we can exit earlier
        // because there will be no response sent from this listener.
        if (result !== true && !isResultThenable && !didCallSendResponse) {
          return false;
        }

        // A small helper to send the message if the promise resolves
        // and an error if the promise rejects (a wrapped sendMessage has
        // to translate the message into a resolved promise or a rejected
        // promise).
        const sendPromisedResult = (promise) => {
          promise.then(msg => {
            // send the message value.
            sendResponse(msg);
          }, error => {
            // Send a JSON representation of the error if the rejected value
            // is an instance of error, or the object itself otherwise.
            let message;
            if (error && (error instanceof Error ||
                typeof error.message === "string")) {
              message = error.message;
            } else {
              message = "An unexpected error occurred";
            }

            sendResponse({
              __mozWebExtensionPolyfillReject__: true,
              message,
            });
          }).catch(err => {
            // Print an error on the console if unable to send the response.
            console.error("Failed to send onMessage rejected reply", err);
          });
        };

        // If the listener returned a Promise, send the resolved value as a
        // result, otherwise wait the promise related to the wrappedSendResponse
        // callback to resolve and send it as a response.
        if (isResultThenable) {
          sendPromisedResult(result);
        } else {
          sendPromisedResult(sendResponsePromise);
        }

        // Let Chrome know that the listener is replying.
        return true;
      };
    });

    const wrappedSendMessageCallback = ({reject, resolve}, reply) => {
      if (extensionAPIs.runtime.lastError) {
        // Detect when none of the listeners replied to the sendMessage call and resolve
        // the promise to undefined as in Firefox.
        // See https://github.com/mozilla/webextension-polyfill/issues/130
        if (extensionAPIs.runtime.lastError.message === CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE || extensionAPIs.runtime.lastError.message.includes(ERROR_TO_IGNORE)) {
          resolve();
        } else {
          reject(new Error(extensionAPIs.runtime.lastError.message));
        }
      } else if (reply && reply.__mozWebExtensionPolyfillReject__) {
        // Convert back the JSON representation of the error into
        // an Error instance.
        reject(new Error(reply.message));
      } else {
        resolve(reply);
      }
    };

    const wrappedSendMessage = (name, metadata, apiNamespaceObj, ...args) => {
      if (args.length < metadata.minArgs) {
        throw new Error(`Expected at least ${metadata.minArgs} ${pluralizeArguments(metadata.minArgs)} for ${name}(), got ${args.length}`);
      }

      if (args.length > metadata.maxArgs) {
        throw new Error(`Expected at most ${metadata.maxArgs} ${pluralizeArguments(metadata.maxArgs)} for ${name}(), got ${args.length}`);
      }

      return new Promise((resolve, reject) => {
        const wrappedCb = wrappedSendMessageCallback.bind(null, {resolve, reject});
        args.push(wrappedCb);
        apiNamespaceObj.sendMessage(...args);
      });
    };

    const staticWrappers = {
      devtools: {
        network: {
          onRequestFinished: wrapEvent(onRequestFinishedWrappers),
        },
      },
      runtime: {
        onMessage: wrapEvent(onMessageWrappers),
        onMessageExternal: wrapEvent(onMessageWrappers),
        sendMessage: wrappedSendMessage.bind(null, "sendMessage", {minArgs: 1, maxArgs: 3}),
      },
      tabs: {
        sendMessage: wrappedSendMessage.bind(null, "sendMessage", {minArgs: 2, maxArgs: 3}),
      },
    };
    const settingMetadata = {
      clear: {minArgs: 1, maxArgs: 1},
      get: {minArgs: 1, maxArgs: 1},
      set: {minArgs: 1, maxArgs: 1},
    };
    apiMetadata.privacy = {
      network: {"*": settingMetadata},
      services: {"*": settingMetadata},
      websites: {"*": settingMetadata},
    };

    return wrapObject(extensionAPIs, staticWrappers, apiMetadata);
  };

  // The build process adds a UMD wrapper around this file, which makes the
  // `module` variable available.
  module.exports = wrapAPIs(chrome);
} else {
  module.exports = globalThis.browser;
}


/***/ }),

/***/ 9438:
/***/ ((module) => {

module.exports = /*#__PURE__*/JSON.parse('{"alarms":{"clear":{"minArgs":0,"maxArgs":1},"clearAll":{"minArgs":0,"maxArgs":0},"get":{"minArgs":0,"maxArgs":1},"getAll":{"minArgs":0,"maxArgs":0}},"bookmarks":{"create":{"minArgs":1,"maxArgs":1},"get":{"minArgs":1,"maxArgs":1},"getChildren":{"minArgs":1,"maxArgs":1},"getRecent":{"minArgs":1,"maxArgs":1},"getSubTree":{"minArgs":1,"maxArgs":1},"getTree":{"minArgs":0,"maxArgs":0},"move":{"minArgs":2,"maxArgs":2},"remove":{"minArgs":1,"maxArgs":1},"removeTree":{"minArgs":1,"maxArgs":1},"search":{"minArgs":1,"maxArgs":1},"update":{"minArgs":2,"maxArgs":2}},"browserAction":{"disable":{"minArgs":0,"maxArgs":1,"fallbackToNoCallback":true},"enable":{"minArgs":0,"maxArgs":1,"fallbackToNoCallback":true},"getBadgeBackgroundColor":{"minArgs":1,"maxArgs":1},"getBadgeText":{"minArgs":1,"maxArgs":1},"getPopup":{"minArgs":1,"maxArgs":1},"getTitle":{"minArgs":1,"maxArgs":1},"openPopup":{"minArgs":0,"maxArgs":0},"setBadgeBackgroundColor":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setBadgeText":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setIcon":{"minArgs":1,"maxArgs":1},"setPopup":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setTitle":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true}},"browsingData":{"remove":{"minArgs":2,"maxArgs":2},"removeCache":{"minArgs":1,"maxArgs":1},"removeCookies":{"minArgs":1,"maxArgs":1},"removeDownloads":{"minArgs":1,"maxArgs":1},"removeFormData":{"minArgs":1,"maxArgs":1},"removeHistory":{"minArgs":1,"maxArgs":1},"removeLocalStorage":{"minArgs":1,"maxArgs":1},"removePasswords":{"minArgs":1,"maxArgs":1},"removePluginData":{"minArgs":1,"maxArgs":1},"settings":{"minArgs":0,"maxArgs":0}},"commands":{"getAll":{"minArgs":0,"maxArgs":0}},"contextMenus":{"remove":{"minArgs":1,"maxArgs":1},"removeAll":{"minArgs":0,"maxArgs":0},"update":{"minArgs":2,"maxArgs":2}},"cookies":{"get":{"minArgs":1,"maxArgs":1},"getAll":{"minArgs":1,"maxArgs":1},"getAllCookieStores":{"minArgs":0,"maxArgs":0},"remove":{"minArgs":1,"maxArgs":1},"set":{"minArgs":1,"maxArgs":1}},"devtools":{"inspectedWindow":{"eval":{"minArgs":1,"maxArgs":2,"singleCallbackArg":false}},"panels":{"create":{"minArgs":3,"maxArgs":3,"singleCallbackArg":true},"elements":{"createSidebarPane":{"minArgs":1,"maxArgs":1}}}},"downloads":{"cancel":{"minArgs":1,"maxArgs":1},"download":{"minArgs":1,"maxArgs":1},"erase":{"minArgs":1,"maxArgs":1},"getFileIcon":{"minArgs":1,"maxArgs":2},"open":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"pause":{"minArgs":1,"maxArgs":1},"removeFile":{"minArgs":1,"maxArgs":1},"resume":{"minArgs":1,"maxArgs":1},"search":{"minArgs":1,"maxArgs":1},"show":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true}},"extension":{"isAllowedFileSchemeAccess":{"minArgs":0,"maxArgs":0},"isAllowedIncognitoAccess":{"minArgs":0,"maxArgs":0}},"history":{"addUrl":{"minArgs":1,"maxArgs":1},"deleteAll":{"minArgs":0,"maxArgs":0},"deleteRange":{"minArgs":1,"maxArgs":1},"deleteUrl":{"minArgs":1,"maxArgs":1},"getVisits":{"minArgs":1,"maxArgs":1},"search":{"minArgs":1,"maxArgs":1}},"i18n":{"detectLanguage":{"minArgs":1,"maxArgs":1},"getAcceptLanguages":{"minArgs":0,"maxArgs":0}},"identity":{"launchWebAuthFlow":{"minArgs":1,"maxArgs":1}},"idle":{"queryState":{"minArgs":1,"maxArgs":1}},"management":{"get":{"minArgs":1,"maxArgs":1},"getAll":{"minArgs":0,"maxArgs":0},"getSelf":{"minArgs":0,"maxArgs":0},"setEnabled":{"minArgs":2,"maxArgs":2},"uninstallSelf":{"minArgs":0,"maxArgs":1}},"notifications":{"clear":{"minArgs":1,"maxArgs":1},"create":{"minArgs":1,"maxArgs":2},"getAll":{"minArgs":0,"maxArgs":0},"getPermissionLevel":{"minArgs":0,"maxArgs":0},"update":{"minArgs":2,"maxArgs":2}},"pageAction":{"getPopup":{"minArgs":1,"maxArgs":1},"getTitle":{"minArgs":1,"maxArgs":1},"hide":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setIcon":{"minArgs":1,"maxArgs":1},"setPopup":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setTitle":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"show":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true}},"permissions":{"contains":{"minArgs":1,"maxArgs":1},"getAll":{"minArgs":0,"maxArgs":0},"remove":{"minArgs":1,"maxArgs":1},"request":{"minArgs":1,"maxArgs":1}},"runtime":{"getBackgroundPage":{"minArgs":0,"maxArgs":0},"getPlatformInfo":{"minArgs":0,"maxArgs":0},"openOptionsPage":{"minArgs":0,"maxArgs":0},"requestUpdateCheck":{"minArgs":0,"maxArgs":0},"sendMessage":{"minArgs":1,"maxArgs":3},"sendNativeMessage":{"minArgs":2,"maxArgs":2},"setUninstallURL":{"minArgs":1,"maxArgs":1}},"sessions":{"getDevices":{"minArgs":0,"maxArgs":1},"getRecentlyClosed":{"minArgs":0,"maxArgs":1},"restore":{"minArgs":0,"maxArgs":1}},"storage":{"local":{"clear":{"minArgs":0,"maxArgs":0},"get":{"minArgs":0,"maxArgs":1},"getBytesInUse":{"minArgs":0,"maxArgs":1},"remove":{"minArgs":1,"maxArgs":1},"set":{"minArgs":1,"maxArgs":1}},"managed":{"get":{"minArgs":0,"maxArgs":1},"getBytesInUse":{"minArgs":0,"maxArgs":1}},"sync":{"clear":{"minArgs":0,"maxArgs":0},"get":{"minArgs":0,"maxArgs":1},"getBytesInUse":{"minArgs":0,"maxArgs":1},"remove":{"minArgs":1,"maxArgs":1},"set":{"minArgs":1,"maxArgs":1}}},"tabs":{"captureVisibleTab":{"minArgs":0,"maxArgs":2},"create":{"minArgs":1,"maxArgs":1},"detectLanguage":{"minArgs":0,"maxArgs":1},"discard":{"minArgs":0,"maxArgs":1},"duplicate":{"minArgs":1,"maxArgs":1},"executeScript":{"minArgs":1,"maxArgs":2},"get":{"minArgs":1,"maxArgs":1},"getCurrent":{"minArgs":0,"maxArgs":0},"getZoom":{"minArgs":0,"maxArgs":1},"getZoomSettings":{"minArgs":0,"maxArgs":1},"goBack":{"minArgs":0,"maxArgs":1},"goForward":{"minArgs":0,"maxArgs":1},"highlight":{"minArgs":1,"maxArgs":1},"insertCSS":{"minArgs":1,"maxArgs":2},"move":{"minArgs":2,"maxArgs":2},"query":{"minArgs":1,"maxArgs":1},"reload":{"minArgs":0,"maxArgs":2},"remove":{"minArgs":1,"maxArgs":1},"removeCSS":{"minArgs":1,"maxArgs":2},"sendMessage":{"minArgs":2,"maxArgs":3},"setZoom":{"minArgs":1,"maxArgs":2},"setZoomSettings":{"minArgs":1,"maxArgs":2},"update":{"minArgs":1,"maxArgs":2}},"topSites":{"get":{"minArgs":0,"maxArgs":0}},"webNavigation":{"getAllFrames":{"minArgs":1,"maxArgs":1},"getFrame":{"minArgs":1,"maxArgs":1}},"webRequest":{"handlerBehaviorChanged":{"minArgs":0,"maxArgs":0}},"windows":{"create":{"minArgs":0,"maxArgs":1},"get":{"minArgs":1,"maxArgs":2},"getAll":{"minArgs":0,"maxArgs":1},"getCurrent":{"minArgs":0,"maxArgs":1},"getLastFocused":{"minArgs":0,"maxArgs":1},"remove":{"minArgs":1,"maxArgs":1},"update":{"minArgs":2,"maxArgs":2}}}');

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nested_webpack_require_29608__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __nested_webpack_require_29608__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__nested_webpack_require_29608__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__nested_webpack_require_29608__.o(definition, key) && !__nested_webpack_require_29608__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__nested_webpack_require_29608__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__nested_webpack_require_29608__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __nested_webpack_exports__ = {};
// ESM COMPAT FLAG
__nested_webpack_require_29608__.r(__nested_webpack_exports__);

// EXPORTS
__nested_webpack_require_29608__.d(__nested_webpack_exports__, {
  account: () => (/* reexport */ account),
  experiments: () => (/* reexport */ experiments),
  sentry: () => (/* reexport */ sentry),
  telemetry: () => (/* reexport */ telemetry)
});

// EXTERNAL MODULE: ../../vendor/webextension-polyfill/src/browser-polyfill.js
var browser_polyfill = __nested_webpack_require_29608__(7795);
;// ./src/all/errors.js
/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

const ERROR_NO_CONNECTION = "Could not establish connection. " +
      "Receiving end does not exist.";
const ERROR_CLOSED_CONNECTION = "A listener indicated an asynchronous " +
      "response by returning true, but the message channel closed before a " +
      "response was received";
// https://bugzilla.mozilla.org/show_bug.cgi?id=1578697
const ERROR_MANAGER_DISCONNECTED = "Message manager disconnected";

/**
 * Reconstructs an error from a serializable error object
 *
 * @param {Object} errorData - Error object
 *
 * @returns {Error} error
 */
function fromSerializableError(errorData) {
  const error = new Error(errorData.message);
  error.cause = errorData.cause;
  error.name = errorData.name;
  error.stack = errorData.stack;

  return error;
}

/**
 * Filters out `browser.runtime.sendMessage` errors to do with the receiving end
 * no longer existing.
 *
 * @param {Promise} promise The promise that should have "no connection" errors
 *   ignored. Generally this would be the promise returned by
 *   `browser.runtime.sendMessage`.
 * @return {Promise} The same promise, but will resolve with `undefined` instead
 *   of rejecting if the receiving end no longer exists.
 */
function ignoreNoConnectionError(promise) {
  return promise.catch(error => {
    if (typeof error == "object" &&
        (error.message == ERROR_NO_CONNECTION ||
         error.message == ERROR_CLOSED_CONNECTION ||
         error.message == ERROR_MANAGER_DISCONNECTED)) {
      return;
    }

    throw error;
  });
}

/**
 * Creates serializable error object from given error
 *
 * @param {Error} error - Error
 *
 * @returns {Object} serializable error object
 */
function toSerializableError(error) {
  return {
    cause: error.cause instanceof Error ?
      toSerializableError(error.cause) :
      error.cause,
    message: error.message,
    name: error.name,
    stack: error.stack
  };
}

;// ./src/ui/sentry.js
/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */





async function forwardError(error) {
  ignoreNoConnectionError(
    browser_polyfill.runtime.sendMessage({
      type: "ewe:sentry-error",
      error: toSerializableError(error)
    })
  );
}

/**
 * API to interact with the sentry module
 * @namespace sentry
 */
/* harmony default export */ const sentry = ({
  /**
   * Report error to Sentry
   *
   * @param {Error} error - Error to send to Sentry.
   */
  async reportError(error) {
    return await forwardError(error);
  },

  /**
   * Initialize and start Sentry
   */
  start() {
    self.addEventListener("error", event => {
      const {error} = event;
      if (!(error instanceof Error)) {
        return;
      }

      forwardError(error);
    });

    self.addEventListener("unhandledrejection", event => {
      const {reason} = event;
      if (!(reason instanceof Error)) {
        return;
      }

      forwardError(reason);
    });
  }
});

;// ./src/front/account.js
/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */




/**
 * Sends a message to the service worker to call the user account API.
 * @param {string} methodName the method to call on the account API
 * @param {any[]} params the parameters to pass to the method
 * @returns {Promise<*>} the result of the API call.
 */
async function callAPI(methodName, ...params) {
  return await ignoreNoConnectionError(
    browser_polyfill.runtime.sendMessage({
      type: "ewe:api-call",
      apiName: "account",
      methodName,
      params
    })
  );
}

/**
 * API to interact with the user account module
 * @namespace account
 */
/* harmony default export */ const account = ({
  /**
   * Retrieves the user's profile information.
   * @ignore
   * @returns {Promise<UserProfile|null>}
   */
  async getProfile() {
    return await callAPI("getProfile");
  },

  /**
   * Checks if the user has an active premium subscription.
   *
   * @returns {Promise<boolean>} - True if the user has a premium subscription,
   *   false otherwise.
   */
  async hasPremium() {
    return await callAPI("hasPremium");
  },

  /**
   * Retrieves the user's trial status.
   *
   * @returns {Promise<boolean>} True if the user is on trial, false otherwise.
   */
  async isTrial() {
    return await callAPI("isTrial");
  },

  /**
   * Retrieves the user's preferences.
   *
   * @returns {Promise<Record<string, boolean>>} An object containing user
   *   preferences.
   */
  async getPreferences() {
    return await callAPI("getPreferences");
  },

  /**
   * Retrieves the user's trial days left.
   *
   * @returns {Promise<{ab: number, abp: number}>} An object containing trial
   *   days left for each product.
   */
  async getTrialDaysLeft() {
    return await callAPI("getTrialDaysLeft");
  }
});

;// ./src/front/experiments.js
/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */




/**
 * Sends a message to the service worker to call the experiments API.
 * @param {string} methodName the method to call on the experiments API
 * @param {any[]} params the parameters to pass to the method
 * @returns {Promise<*>} the result of the API call.
 */
async function experiments_callAPI(methodName, ...params) {
  return await ignoreNoConnectionError(
    browser_polyfill.runtime.sendMessage({
      type: "ewe:api-call",
      apiName: "experiments",
      methodName,
      params
    })
  );
}

/**
 * API to interact with the experiments module
 * @namespace experiments
 */
/* harmony default export */ const experiments = ({
  /**
   * Retrieves the value of a feature flag
   * @ignore
   * @param {string} flagId - Identifier of the feature flag
   * @returns {Promise<*|null>} Value of the feature flag or null if not found
   */
  async getFlag(flagId) {
    return await experiments_callAPI("getFlag", flagId);
  },

  /**
   * Retrieves all the available experiment flags
   * @ignore
   * @returns {Promise<*|null>} Value of the feature flag or null if not found
   */
  async getFlags() {
    return await experiments_callAPI("getFlags");
  },

  /**
   * Retrieves all the experiment assignments
   * @ignore
   * @returns {Promise<Object.<string, string>>} Object specifying the assigned
   *   variant ID for each active assigned experiment ID
   */
  async getAssignments() {
    return await experiments_callAPI("getAssignments");
  }
});

;// ./events.js
/* harmony default export */ const events = ({
  adblock_ui: {
    options_clicked: {
      description: "User clicked the gear icon"
    },
    support_icon_clicked: {
      description: "User clicked the support icon on the header of the Adblock popup"
    },
    opt_out_acceptable_ads_clicked: {
      description: "The user clicked the opt-out link to disable Acceptable Ads on the getadblock.com installed page"
    },
    cm_pause_on_site: {
      description: "User right clicked on the page to open the context menu and selected 'Pause on this site' from the AdBlock section."
    },
    cm_pause_on_all_sites: {
      description: "User right clicked on the page to open the context menu and selected 'Pause on all sites' from the AdBlock section."
    },
    cm_resume_adblock: {
      description: "User right clicked on the page to open the context menu and selected 'Resume blocking ads' from the AdBlock section."
    },
    pause_on_site: {
      description: "User clicked 'Pause on this site' on the Adblock popup"
    },
    resume_adblock: {
      description: "User clicked 'Resume Ad blocking' on the Adblock popup"
    },
    popup_opened: {
      description: "User clicked the AdBlock toolbar icon to open the popup menu",
      data: {
        description: "Data about the popup opened event",
        type: "object",
        properties: {
          isBadgeTextNew: {
            description: "The 'new' badge is shown on the popup icon",
            type: "boolean"
          },
          reason: {
            description: "The reason why the 'new' badge was shown",
            type: "string"
          }
        }
      }
    },
    hide_on_this_page_clicked: {
      description: "User clicked on the three dots in the popup menu, then clicked the 'Hide something on this page' link"
    },
    titletext_clicked: {
      description: "User clicked the AdBlock logo in the popup menu header"
    },
    more_pause_options_clicked: {
      description: "User clicked on the three dots in the popup menu, then clicked 'More pause options' link"
    },
    help_flow_results: {
      description: "Emitted when a user completes the help flow in the popup. The flow presents different options based on the user's issue (e.g., ads not blocked, site broken, etc.), and the emitted event includes the path representing the sequence of choices the user made",
      data: {
        description: "Data about the help flow results",
        type: "object",
        properties: {
          helpFlowPath: {
            description: "The path of the help flow (e.g. 'start,seeAd,seeAdEverywhere,link')",
            type: "string"
          }
        }
      }
    },
    premium_options_clicked: {
      description: "Triggered when a premium user clicks the 'Premium' label in the popup header which is shown next to the Adblock logo. The label is only visible to premium users and opens the Premium tab in the settings page"
    },
    popup_sub_clicked_cookies_premium: {
      description: "Triggered when a premium user clicks the toggle to enable the Premium Cookie Blocking filter list in the popup. The list is not enabled automatically when upgrading to premium"
    },
    popup_sub_clicked_distraction_control: {
      description: "Triggered when a premium user clicks the toggle to enable the Premium Block Distractions filter list in the popup. The list is not enabled automatically when upgrading to premium"
    },
    skip_cookie_walls_learn_more_clicked: {
      description: "A free user clicked the Learn More button on the 'Skip Cookie Walls' section in the AdBlock popup"
    },
    block_distractions_learn_more_clicked: {
      description: "A free user clicked the Learn More button on the 'Block Distractions' section in the AdBlock popup"
    },
    options_page_tab_premium_cta: {
      description: "User interacted with a premium CTA on a premium tab in the options page",
      data: {
        description: "Data about which tab the user was viewing",
        type: "object",
        properties: {
          tab: {
            description: "The name of the tab being viewed when the CTA was clicked",
            type: "string",
            enum: ["premium", "themes", "image_swap", "premium_filters"]
          },
          action: {
            description: "Type of interaction with the Premium CTA",
            type: "string",
            enum: ["clicked"]
          }
        }
      }
    },
    options_page_tab: {
      description: "User clicked or opened a tab on the options page side bar",
      data: {
        description: "Data about the user interaction with the options page tab",
        type: "object",
        properties: {
          tab: {
            description: "The tab that the user interacted with",
            type: "string",
            enum: ["stats", "general", "filter_lists", "customize", "support", "premium", "themes", "image_swap", "premium_filters"]
          },
          action: {
            description: "Type of interaction with the options page tab",
            type: "string",
            enum: ["opened", "clicked"]
          }
        }
      }
    },
    vpn_cta: {
      description: "User interacted with AdBlock VPN promotional banner in the popup menu. This CTA promotes the VPN with 'Introducing AdBlock VPN' message",
      data: {
        description: "Data about the user interaction with the AdBlock VPN promotional banner",
        type: "object",
        properties: {
          action: {
            description: "Type of interaction with the AdBlock VPN promotional banner",
            type: "string",
            enum: ["seen", "clicked", "closed"]
          }
        }
      }
    },
    premium_themes_cta: {
      description: "User interacted with themes customization CTA in the popup menu, opening the themes section in options page",
      data: {
        description: "Information about the theme that was being promoted when clicked",
        type: "object",
        properties: {
          theme: {
            description: "The name of the theme being showcased when the user clicked",
            type: "string",
            enum: ["solarized", "solarized_light", "watermelon", "sunshine", "ocean"]
          },
          action: {
            description: "Type of interaction with the themes customization CTA",
            type: "string",
            enum: ["seen", "clicked", "closed"]
          }
        }
      }
    },
    free_dc_cta: {
      description: "User interacted with Distraction Control promotional banner in the popup menu. This CTA promotes the premium Distraction Control feature with 'Block Floating Videos' message",
      data: {
        description: "Data about the user interaction with the Distraction Control promotional banner",
        type: "object",
        properties: {
          action: {
            description: "Type of interaction with the Distraction Control promotional banner",
            type: "string",
            enum: ["seen", "clicked", "closed"]
          }
        }
      }
    },
    premium_dc_cta: {
      description: "Premium user interacted with the enhanced Distraction Control CTA in the popup menu. This CTA highlights 'New Premium feature available!' to promote advanced distraction blocking options",
      data: {
        description: "Data about the user interaction with the Distraction Control CTA",
        type: "object",
        properties: {
          action: {
            description: "Type of interaction with the Distraction Control CTA",
            type: "string",
            enum: ["seen", "clicked", "closed"]
          }
        }
      }
    },
    premium_upsell_cta: {
      description: "User interacted with Premium upsell upgrade banner in the popup menu. This CTA displays 'Upgrade your AdBlock' message to encourage premium subscription",
      data: {
        description: "Data about the user interaction with the Premium upsell upgrade banner",
        type: "object",
        properties: {
          action: {
            description: "Type of interaction with the Premium upsell upgrade banner",
            type: "string",
            enum: ["seen", "clicked", "closed"]
          }
        }
      }
    },
    premium_filter_list_cta: {
      description: "User interacted with Premium filter list banner in the popup menu. This CTA displays 'Upgrade your AdBlock' message to encourage premium subscription",
      data: {
        description: "Data about the user interaction with the premium filter list CTA",
        type: "object",
        properties: {
          action: {
            description: "Type of interaction with the premium filter list CTA",
            type: "string",
            enum: ["seen", "clicked"]
          }
        }
      }
    },
    data_collection_opt_out: {
      description: "User opted out of data collection in the options page"
    }
  },
  extensions_ui: {
    acceptable_ads_toggled: {
      description: "User toggled the Acceptable Ads checkbox on the extension options page. This is a shared event fired by both AB and ABP.",
      data: {
        description: "Data about the acceptable ads toggle interaction",
        type: "object",
        properties: {
          action: {
            description: "Whether the user opted in or out of acceptable ads",
            type: "string",
            enum: ["opted_in", "opted_out"]
          },
          source: {
            description: "Where the toggle occurred. This could be from the general or filter lists options tabs.",
            type: "string",
            enum: ["options_general", "options_filter_list"]
          }
        }
      }
    }
  },
  adblockplus_ui: {
    issue_report_submitted: {
      description: "Issue report was submitted"
    }
  },
  smart_allowlisting: {
    allowlisting_expired: {
      description: "An allowlisting filter expired automatically",
      data: {
        description: "Details about the filter at the time of expiration.",
        type: "object",
        properties: {
          allowlistExtendDuration: {
            description: "The number of milliseconds to extend the allowlisting filter's expiry when the user navigated to a URL that matches the filter.",
            type: "number"
          }
        }
      }
    },
    allowlisting_renewed: {
      description: "An allowlisting filter was renewed automatically",
      data: {
        description: "Details about the filter at the time of renewal.",
        type: "object",
        properties: {
          allowlistExtendDuration: {
            description: "The number of milliseconds to extend the allowlisting filter's expiry when the user navigated to a URL that matches the filter.",
            type: "number"
          }
        }
      }
    }
  },
  cdp: {
    built_cdp_payload: {
      description: "A payload has been built with the intention of sending it to CDP. This is debug information, and will temporarily include the eventStats until the CDP server is ready to ingest them.",
      data: {
        description: "Data about the built payload",
        type: "object",
        properties: {
          eventStats: {
            description: "Counts of behavior event logs since the last payload.",
            type: "any"
          },
          uncompressedPayloadSize: {
            description: "Size in bytes of the uncompressed and unencrypted payload.",
            type: "integer"
          }
        }
      }
    }
  },
  detection_snippets: {
    snippet_detection_event: {
      description: "Recorded when a snippet detects a condition on a page (e.g. wall detection). Each detection snippet calls this event from a single location with a unique type value. Other snippet concerns (blocking, breakage) should register separate events.",
      data: {
        description: "Metadata about the detected condition",
        type: "object",
        properties: {
          type: {
            description: "Detection type identifier passed from the snippet filter, e.g. 'wall_detected'. Each snippet can have multiple types within a distinct type group for traceability.",
            type: "string"
          },
          domain: {
            description: "Domain where the condition was detected, e.g. 'example.com'",
            type: "string"
          },
          specifier: {
            description: "Optional additional context for filtering in BigQuery, e.g. the CSS selector that matched ('.overlay-wall-container') or a filter list identifier",
            type: ["string", "null"]
          }
        }
      }
    }
  },
  hit_snippets: {
    snippet_hit_event: {
      description: "Recorded when a snippet successfully executes on a page.",
      data: {
        description: "Metadata about the snippet execution",
        type: "object",
        properties: {
          filter: {
            description: "Snippet filter body, e.g. 'json-prune ads userId'",
            type: "string"
          },
          domain: {
            description: "Domain where the snippet fired (document.location.hostname of the frame)",
            type: "string"
          },
          topLevelDomain: {
            description: "Top-level page domain. Equals domain for main-frame snippets; differs for cross-origin iframe snippets.",
            type: "string"
          }
        }
      }
    }
  },
  snippets: {
    context_tampering: {
      description: "Recorded when the website is trying to disable the snippets"
    },
    local_storage_unavailable: {
      description: "The extension intended to use localStorage as a cache, but localStorage was unavailable",
      data: {
        description: "Metadata about the context where localStorage was unavailable",
        type: "object",
        properties: {
          isMainFrame: {
            description: "This occurred in the main frame, not in an iframe",
            type: "boolean"
          }
        }
      }
    },
    zero_delay_cleanup: {
      description: "Recorded when we cleaned up zero-delay storage key from previous extension versions.",
      data: {
        description: "Metadata about the cleanup operation",
        type: "object",
        properties: {
          key: {
            description: "The storage key that was cleaned up",
            type: "string"
          }
        }
      }
    },
    snippet_detection_domainless: {
      description: "Domain omitted intentionally to support user-level retention signals without per-domain identification.",
      data: {
        description: "Metadata about the detected condition",
        type: "object",
        properties: {
          type: {
            description: "Detection type identifier passed from the snippet filter, e.g. 'wall_detected'.",
            type: "string"
          },
          specifier: {
            description: "Extra context from the detection snippet, e.g. a matched CSS selector or filter rule identifier. null when no specifier is available.",
            type: ["string", "null"]
          }
        }
      }
    }
  },
  youtube: {
    yt_site_navigation: {
      description: "Recorded 5 seconds after a user navigates to a YouTube page. This event is sent only once per session. Refreshing or opening a new tab will start a new session. Navigating through videos without refreshing (aka SPA navigation) will not trigger another event.",
      data: {
        description: "Data about the YouTube navigation event",
        type: "object",
        properties: {
          userLoggedIn: {
            description: "Indicates whether the user is logged in to a YouTube account. '1' for logged in, '0' for not logged in.",
            type: "string",
            enum: ["1", "0"]
          }
        }
      }
    },
    yt_site_ad_shown: {
      description: "Recorded when a video ad on YouTube stops playing, either because it was skipped, the user navigated away, or it finished playing",
      data: {
        description: "Data for the YouTube ad shown event",
        type: "object",
        properties: {
          isAllowListed: {
            description: "Indicates whether the page is allowlisted. '1' for allowlisted, '0' for not allowlisted.",
            type: "string",
            enum: ["1", "0"]
          },
          isPremium: {
            description: "Specifies whether the user has a Premium subscription. Used to be called 'p' in getadblock.logs_unified.logs_fact",
            type: "boolean"
          },
          adFormat: {
            description: "Format ID of the displayed ad. Used to be called 'category' in getadblock.logs_unified.logs_fact",
            type: "string"
          },
          totalAdDurationMs: {
            description: "Total duration of the ad, in milliseconds. Used to be called 'bc' in getadblock.logs_unified.logs_fact",
            type: "number"
          },
          adShownDurationMs: {
            description: "Actual playback duration of the ad, in milliseconds. Used to be called 'amount' in getadblock.logs_unified.logs_fact",
            type: "number"
          }
        }
      }
    },
    yt_site_ad_wall_detected: {
      description: "Recorded when the YouTube ad wall is detected and the page is not yet allowlisted.",
      data: {
        description: "Data for YouTube ad wall detection when the page is not yet allowlisted",
        type: "object",
        properties: {
          adwallCategory: {
            description: "The ad wall type: 'soft' (dismiss button) or 'hard' (no dismiss button).",
            type: "string",
            enum: ["soft", "hard"]
          },
          userLoggedIn: {
            description: "String flag indicating whether the user is logged in to a YouTube account ('1' if logged in, otherwise '0').",
            type: "string",
            enum: ["1", "0"]
          },
          isAllowListed: {
            description: "String flag indicating whether the page is allowlisted ('1' if allowlisted, otherwise '0'). Should always be '0' for this event.",
            type: "string",
            enum: ["1", "0"]
          },
          allowlistScope: {
            description: "Scope of the applied allowlist rule: 'video' (single video url) or 'tab' (all videos until the tab is closed).",
            type: "string",
            enum: ["video", "tab"]
          }
        }
      }
    },
    yt_site_already_allowlisted: {
      description: "Recorded when the YouTube ad wall is detected, but the page was already allowlisted.",
      data: {
        description: "Data for YouTube ad wall detection when the page is already allowlisted",
        type: "object",
        properties: {
          adwallCategory: {
            description: "The ad wall type: 'soft' (dismiss button) or 'hard' (no dismiss button).",
            type: "string",
            enum: ["soft", "hard"]
          },
          userLoggedIn: {
            description: "String flag indicating whether the user is logged in to a YouTube account ('1' if logged in, otherwise '0').",
            type: "string",
            enum: ["1", "0"]
          },
          isAllowListed: {
            description: "String flag indicating whether the page is allowlisted ('1' if allowlisted, otherwise '0'). Should always be '1' for this event.",
            type: "string",
            enum: ["1", "0"]
          },
          allowlistScope: {
            description: "Scope of the applied allowlist rule: 'video' (single video url) or 'tab' (all videos until the tab is closed).",
            type: "string",
            enum: ["video", "tab"]
          }
        }
      }
    },
    yt_auto_allowlisted: {
      description: "Recorded immediately after the extension automatically allowlists a YouTube page in response to an ad wall.",
      data: {
        description: "Data for the YouTube auto allowlisted event",
        type: "object",
        properties: {
          allowlistScope: {
            description: "Scope of the applied allowlist rule: 'video' (single video url) or 'tab' (all videos until the tab is closed).",
            type: "string",
            enum: ["video", "tab"]
          }
        }
      }
    },
    yt_site_toast_shown: {
      description: "Recorded when the YouTube 'ad blocker' toast notification appears in the DOM. This is an experiment ran by YouTube that only appears for certain adblocking users, warning them that their adblocker might be causing interruptions.",
      data: {
        description: "Data for the YouTube toast shown event",
        type: "object",
        properties: {
          isAllowListed: {
            description: "String flag indicating whether the page is allowlisted ('1' if allowlisted, otherwise '0').",
            type: "string",
            enum: ["1", "0"]
          },
          isPremium: {
            description: "Specifies whether the user has a Premium subscription",
            type: "boolean"
          }
        }
      }
    },
    yt_site_context_tampering: {
      description: "Recorded when the YouTube error_204 beacon indicates a possible script conflict that could interfere with the extension.",
      data: {
        description: "Data for the YouTube context tampering event",
        type: "object",
        properties: {
          isAllowListed: {
            description: "String flag indicating whether the page is allowlisted ('1' if allowlisted, otherwise '0').",
            type: "string",
            enum: ["1", "0"]
          },
          isPremium: {
            description: "Specifies whether the user has a Premium subscription",
            type: "boolean"
          },
          applicationVersion: {
            description: "YouTube client version from the client.version query param on the error_204 request.",
            type: "string"
          }
        }
      }
    },
    yt_site_yt_error: {
      description: "This event is triggered in the event of an error on YouTube. There could be multiple types of errors happening on the page, so we try to differentiate them via the category parameter.",
      data: {
        description: "Data for the YouTube error event",
        type: "object",
        properties: {
          category: {
            description: "Indicates the error type as defined in our extension code. It can be one of the following: 'uncaught_exception', 'player_error' or 'sww_error'.",
            type: "string",
            enum: ["uncaught_exception", "player_error", "sww_error"]
          },
          applicationVersion: {
            description: "The client version of the YouTube application (e.g., '2.20251020.01.00').",
            type: "string"
          },
          error: {
            description: "Indicates the exception type of JavaScript error, captured by the YouTube error handler (e.g., 'TypeError').",
            type: "string"
          },
          errorMsg: {
            description: "Either the stack trace of the error or an empty string.",
            type: "string"
          },
          isAllowListed: {
            description: "String flag indicating whether the site is allowlisted ('1' if allowlisted, otherwise '0').",
            type: "string",
            enum: ["1", "0"]
          },
          isPremium: {
            description: "Specifies whether the user has a Premium subscription.",
            type: "boolean"
          }
        }
      }
    }
  },
  conflict_detection: {
    bt_loader_blocked: {
      description: "Recorded on every website when the script from Blockthrough fails to load. BTLoader initiates ad recovery for users who allow Acceptable Ads, enabling monetization. This event indicates the script was blocked, which can happen when the user has disabled Acceptable Ads, installed another ad blocker that blocks BTLoader, or allowlisted the page. When BTLoader is blocked, ad recovery cannot occur and monetization is lost.",
      data: {
        description: "Data about why BTLoader was blocked",
        type: "object",
        properties: {
          isPageAllowlisted: {
            description: "Whether the page is allowlisted",
            type: "boolean"
          },
          aaListsStatus: {
            description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
            type: "number"
          },
          errorMsg: {
            description: "Browser string indicating the error that occurred",
            type: "string"
          }
        }
      }
    },
    bt_loader_success: {
      description: "Recorded on every website when the script from Blockthrough successfully loads. BTLoader initiates ad recovery for users who allow Acceptable Ads, enabling monetization. This event confirms that ad recovery can proceed normally on this page.",
      data: {
        description: "Data about the BTLoader success event",
        type: "object",
        properties: {
          isPageAllowlisted: {
            description: "Whether the page is allowlisted",
            type: "boolean"
          },
          aaListsStatus: {
            description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
            type: "number"
          }
        }
      }
    },
    aa_bait1_blocked: {
      description: "Acceptable Ads bait 1 was blocked",
      data: {
        description: "Data about why Acceptable Ads bait 1 was blocked",
        type: "object",
        properties: {
          isPageAllowlisted: {
            description: "Whether the page is allowlisted",
            type: "boolean"
          },
          aaListsStatus: {
            description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
            type: "number"
          },
          errorMsg: {
            description: "Browser string indicating the error that occurred",
            type: "string"
          }
        }
      }
    },
    aa_bait1_success: {
      description: "Acceptable Ads bait 1 was successfully loaded",
      data: {
        description: "Data about the Acceptable Ads bait 1 success event",
        type: "object",
        properties: {
          isPageAllowlisted: {
            description: "Whether the page is allowlisted",
            type: "boolean"
          },
          aaListsStatus: {
            description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
            type: "number"
          }
        }
      }
    },
    aa_bait2_blocked: {
      description: "Acceptable Ads bait 2 was blocked",
      data: {
        description: "Data about why Acceptable Ads bait 2 was blocked",
        type: "object",
        properties: {
          isPageAllowlisted: {
            description: "Whether the page is allowlisted",
            type: "boolean"
          },
          aaListsStatus: {
            description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
            type: "number"
          },
          errorMsg: {
            description: "Browser string indicating the error that occurred",
            type: "string"
          }
        }
      }
    },
    aa_bait2_success: {
      description: "Acceptable Ads bait 2 was successfully loaded",
      data: {
        description: "Data about the Acceptable Ads bait 2 success event",
        type: "object",
        properties: {
          isPageAllowlisted: {
            description: "Whether the page is allowlisted",
            type: "boolean"
          },
          aaListsStatus: {
            description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
            type: "number"
          }
        }
      }
    },
    aa_other_blocked: {
      description: "Acceptable Ads filters on Amazon, Yahoo, LinkedIn, Outlook were blocked",
      data: {
        description: "Data about why Acceptable Ads filters were blocked",
        type: "object",
        properties: {
          isPageAllowlisted: {
            description: "Whether the page is allowlisted",
            type: "boolean"
          },
          aaListsStatus: {
            description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
            type: "number"
          },
          errorMsg: {
            description: "Browser string indicating the error that occurred",
            type: "string"
          }
        }
      }
    },
    aa_other_success: {
      description: "Acceptable Ads filters on Amazon, Yahoo, LinkedIn, Outlook were successfully loaded",
      data: {
        description: "Data about the Acceptable Ads filters success event",
        type: "object",
        properties: {
          isPageAllowlisted: {
            description: "Whether the page is allowlisted",
            type: "boolean"
          },
          aaListsStatus: {
            description: "The status of the Acceptable Ads lists. 0: none, 1: AA, 2: AA Privacy, 3: both",
            type: "number"
          }
        }
      }
    }
  },
  cohorts: {
    facts_snapshot: {
      description: "Cohorts facts snapshot used for cohort estimation",
      data: {
        description: "The updated facts",
        type: "object",
        properties: {
          extName: {
            description: "The name of the extension",
            type: "string"
          },
          extVersion: {
            description: "The version of the extension",
            type: "string"
          },
          browserName: {
            description: "The name of the browser",
            type: "string"
          },
          browserLanguage: {
            description: "The language of the browser",
            type: "string"
          },
          countryCode: {
            description: "The 2-letter country code of the user",
            type: "string"
          },
          aaEnabled: {
            description: "Whether Acceptable Ads is enabled",
            type: "boolean"
          },
          installType: {
            description: "The installation type of the extension",
            type: "string"
          },
          hasPremium: {
            description: "Whether the user has a premium subscription",
            type: "boolean"
          },
          installDate: {
            description: "The timestamp when the extension was installed",
            type: "number"
          },
          blockedCount: {
            description: "The number of blocked requests",
            type: "number"
          }
        }
      }
    }
  },
  dnr_filters: {
    recreated_dnr_rules: {
      description: "On extension upgrade, our DNR filter management module will compare the dynamic DNR rules that the browser has with the filters that we know about. If these do not match, we recreate the DNR rules and log this report.",
      data: {
        description: "Report on the before and after state of the recreation",
        type: "object",
        properties: {
          recreateStats: {
            description: "Stats on how many DNR rules were recreated",
            type: "object",
            properties: {
              recreatedRulesCount: {
                description: "How many DNR rules were recreated",
                type: "integer"
              },
              removedRulesCount: {
                description: "How many existing DNR rules were removed",
                type: "integer"
              }
            }
          },
          checkResultBefore: {
            description: "Results of the data integrity check done before recreating the DNR rules.",
            type: "object",
            properties: {
              valid: {
                description: "True if the data integrity check passed. We only do the recreation if it failed, so this would be expected to always be false.",
                type: "boolean"
              },
              extraRulesInDNRCount: {
                description: "Count of the number of active dynamic DNR rules which we do not expect to see",
                type: "integer"
              },
              missingRulesInDNRCount: {
                description: "Count of the number of rules that our filters expected to exist but didn't",
                type: "integer"
              }
            }
          },
          checkResultAfter: {
            description: "Results of the data integrity check done after recreating the DNR rules.",
            type: "object",
            properties: {
              valid: {
                description: "True if the data integrity check passed. We expect this to be true after the rule recreation has run.",
                type: "boolean"
              },
              extraRulesInDNRCount: {
                description: "Count of the number of active dynamic DNR rules which we do not expect to see. We expect this to be 0 after the rule recreation has run.",
                type: "integer"
              },
              missingRulesInDNRCount: {
                description: "Count of the number of rules that our filters expected to exist but didn't. We expect this to be 0 after the rule recreation has run.",
                type: "integer"
              }
            }
          }
        }
      }
    },
    exceeded_static_rule_count_limit: {
      description: "Debug log when someone runs into the 'set of enabled rulesets exceeds the rule count limit' error when enabling static rulesets",
      data: {
        description: "Data on the current state of static rules and the rulesets being enabled or disabled. Rule counts refer to static DNR rules, bundled in the extension at build time in rulesets.",
        type: "object",
        properties: {
          enableRulesetIds: {
            description: "Ruleset IDs that were to be enabled",
            type: "array",
            items: {
              type: "string"
            }
          },
          enableRuleCount: {
            description: "Static rules that we are trying to enable",
            type: "integer"
          },
          disableRulesetIds: {
            description: "Ruleset IDs that were to be disabled",
            type: "array",
            items: {
              type: "string"
            }
          },
          disableRuleCount: {
            description: "Static rules that we are trying to disable",
            type: "integer"
          },
          currentEnabledRulesetIdsBefore: {
            description: "Currently enabled ruleset IDs, gathered before calling updateEnabledRulesets",
            type: "array",
            items: {
              type: "string"
            }
          },
          currentEnabledRulesetIdsAfter: {
            description: "Currently enabled ruleset IDs, gathered after calling updateEnabledRulesets",
            type: "array",
            items: {
              type: "string"
            }
          },
          currentEnabledRuleCountBefore: {
            description: "Used static rules, gathered before calling updateEnabledRulesets",
            type: "integer"
          },
          currentEnabledRuleCountAfter: {
            description: "Used static rules, gathered after calling updateEnabledRulesets",
            type: "integer"
          },
          availableRuleCountBefore: {
            description: "Available static rules, gathered before calling updateEnabledRulesets",
            type: "integer"
          },
          availableRuleCountAfter: {
            description: "Available static rules, gathered after calling updateEnabledRulesets",
            type: "integer"
          }
        }
      }
    }
  },
  in_product_messaging: {
    command_received: {
      description: "Extension received a valid IPM command from the remote config",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    }
  },
  initialization: {
    initialization_complete: {
      description: "The extension has finished initializing without any errors",
      data: {
        description: "Data about the initialized system",
        type: "object",
        properties: {
          subscriptionsCount: {
            description: "The number of subscriptions the user has active",
            type: "number"
          },
          availableStaticRuleCount: {
            description: "The number of DNR static rules that the user has available, or null for MV2 extensions",
            type: ["number", "null"]
          },
          timings: {
            description: "Profiling information about startup performance",
            type: "object",
            properties: {
              marks: {
                type: "array",
                description: "Specific points in time when something happened",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      description: "Name of the initialization step",
                      type: "string"
                    },
                    startTime: {
                      description: "Milliseconds elapsed since the service worker started",
                      type: "number"
                    }
                  }
                }
              },
              measures: {
                type: "array",
                description: "Measurements of how long steps took",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      description: "Name of the initialization step",
                      type: "string"
                    },
                    startTime: {
                      description: "When the measure started, in milliseconds elapsed since the service worker started",
                      type: "number"
                    },
                    duration: {
                      description: "Duration that the step took in milliseconds",
                      type: "number"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    initialization_error: {
      description: "Errors recorded during the initialization of the extension",
      data: {
        description: "Data about the initializion error",
        type: "object",
        properties: {
          errorMsg: {
            description: "The error message that was recorded",
            type: "string"
          },
          hasInternalError: {
            description: "Whether or not the error string matched 'internal error' which indicates that it is a browser error",
            type: "boolean"
          },
          timings: {
            description: "Profiling information about startup performance",
            type: "object",
            properties: {
              marks: {
                type: "array",
                description: "Specific points in time when something happened",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      description: "Name of the initialization step",
                      type: "string"
                    },
                    startTime: {
                      description: "Milliseconds elapsed since the service worker started",
                      type: "number"
                    }
                  }
                }
              },
              measures: {
                type: "array",
                description: "Measurements of how long steps took",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      description: "Name of the initialization step",
                      type: "string"
                    },
                    startTime: {
                      description: "When the measure started, in milliseconds elapsed since the service worker started",
                      type: "number"
                    },
                    duration: {
                      description: "Duration that the step took in milliseconds",
                      type: "number"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    zero_subs_reset: {
      description: "Event logged when subscriptions are reset to defaults due to zero enabled subscriptions",
      data: {
        description: "Debug metadata about the subscription reset",
        type: "object",
        properties: {
          subs: {
            description: "The total number of subscriptions after reset",
            type: "number"
          },
          enabledSubs: {
            description: "The number of enabled subscriptions after reset",
            type: "number"
          },
          enabledRulesets: {
            description: "The number of enabled DNR rulesets after reset",
            type: "number"
          },
          totalUserFilters: {
            description: "The total number of user filters after reset",
            type: "number"
          },
          dynamicRules: {
            description: "The number of dynamic DNR rules after reset",
            type: "number"
          },
          dataCorrupted: {
            description: "Whether the data is corrupted. True if the extension has detected that storage has thrown an error.",
            type: "boolean"
          },
          firstRun: {
            description: "Whether this is the first run of the extension based on the number of subscriptions and user filters.",
            type: "boolean"
          },
          reinitialized: {
            description: "Whether the extension was reinitialized before reset.",
            type: "boolean"
          },
          errorMsg: {
            description: "An error that occurred when readding subscriptions, if any",
            type: ["string", "null"]
          },
          lastErrorMsg: {
            description: "The last error in the browser runtime, if any",
            type: ["string", "null"]
          }
        }
      }
    }
  },
  customer_lifecycle: {
    new_install_normal: {
      description: "The extension was installed from the browser's official web store (Chrome Web Store, Firefox Add-ons, Microsoft Edge Add-ons)"
    },
    new_install_development: {
      description: "The extension was installed manually in development mode, either as an unpacked directory or from a local .zip/.crx/.xpi package"
    },
    new_install_admin: {
      description: "The extension was installed and managed by an administrator through a policy setting"
    },
    new_install_sideload: {
      description: "The extension was installed by other software on the user's computer"
    },
    new_install_other: {
      description: "The extension was installed through an unrecognized method not covered by other install types(normal/development/admin/sideload)"
    },
    new_install_unknown: {
      description: "The extension was installed but the installation type could not be determined"
    },
    trial_license_expired: {
      description: "The premium trial license has expired"
    }
  },
  new_tab: {
    command_ready: {
      description: "'create_tab' IPM command has passed all checks and new tab is going to be created at the next possible opportunity",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    },
    tab_created: {
      description: "A tab has been created for the IPM command",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    },
    tab_loaded: {
      description: "The contents of the tab for the IPM command have been loaded",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    }
  },
  onpage_dialog: {
    command_ready: {
      description: "'create_on_page_dialog' IPM command has passed all checks and on-page dialog is going to be created at the next possible opportunity",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    }
  },
  onpage_dialog_ui: {
    dialog_button_clicked: {
      description: "The user clicked on the button presented on the dialog",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    },
    dialog_closed: {
      description: "The user closed the dialog by clicking the close icon in the dialog header",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    },
    dialog_ignored: {
      description: "The user did not interact with the dialog while being injected into the page, and the dialog no longer can be interacted with",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    },
    dialog_injected: {
      description: "The extension injected the dialog into the page and rendered it. This doesn't mean that the dialog is visible to the user, or that it looks as expected",
      data: {
        description: "IPM command ID",
        type: "string"
      }
    }
  },
  test_ewe_background: {
    test_event: {
      description: "TEST: A logging test event for various types of data",
      data: {
        description: "Arbitrary test data",
        type: "any"
      }
    },
    test_event_no_data: {
      description: "TEST: A logging test event that has no associated data"
    }
  },
  test_ewe_content_api: {
    test_got_experiment_flag: {
      description: "TEST: In the content test script, an experiment was loaded",
      data: {
        description: "Information about the loaded experiment",
        type: "object",
        properties: {
          flagName: {
            description: "The flag name that was loaded",
            type: "string"
          },
          flag: {
            description: "The loaded value",
            type: "any"
          }
        }
      }
    }
  },
  test_ewe_ui_api: {
    test_message_received: {
      description:
        "TEST: A logger test event indicating the UI page received a request to log",
      data: {
        description: "The data sent to the test listener",
        type: "any"
      }
    },
    test_event: {
      description: "TEST: A logging test event for various types of data",
      data: {
        description: "Arbitrary test data",
        type: "any"
      }
    },
    test_event_no_data: {
      description: "TEST: A logging test event that has no associated data"
    }
  },
  reverse_trial: {
    dialog_shown: {
      description: "The reverse trial dialog was shown to the user",
      data: {
        description: "Details about the dialog shown",
        type: "object",
        properties: {
          touchPointStep: {
            description: "The touch point step number of the dialog shown",
            type: "number"
          },
          installDate: {
            description: "The timestamp when the extension was installed",
            type: "number"
          },
          reverseTrialStartDate: {
            description: "The timestamp when the reverse trial started",
            type: "number"
          }
        }
      }
    },
    dialog_skipped_yt_premium: {
      description: "The reverse trial dialog would have been shown but was skipped because the user has YouTube Premium",
      data: {
        description: "Details about the skipped dialog",
        type: "object",
        properties: {
          touchPointStep: {
            description: "The touch point step number of the dialog that was skipped",
            type: "number"
          },
          installDate: {
            description: "The timestamp when the extension was installed",
            type: "number"
          },
          reverseTrialStartDate: {
            description: "The timestamp when the reverse trial started",
            type: "number"
          }
        }
      }
    },
    dialog_should_still_show_checked: {
      description: "The service worker checked whether a visible reverse trial dialog should still be shown after the tab became active",
      data: {
        description: "Details about the check",
        type: "object",
        properties: {
          touchPointStep: {
            description: "The touch point step number of the dialog being checked",
            type: "number"
          },
          shouldStillShow: {
            description: "Whether the dialog should remain visible",
            type: "boolean"
          },
          installDate: {
            description: "The timestamp when the extension was installed",
            type: "number"
          },
          reverseTrialStartDate: {
            description: "The timestamp when the reverse trial started",
            type: "number"
          }
        }
      }
    },
    dialog_action: {
      description: "The user interacted with the reverse trial dialog",
      data: {
        description: "Details about the interaction",
        type: "object",
        properties: {
          action: {
            description: "The action taken: 'close' for the x button, 'cta' for the call-to-action button",
            type: "string"
          },
          touchPointStep: {
            description: "The touch point step number of the dialog that was interacted with",
            type: "number"
          },
          installDate: {
            description: "The timestamp when the extension was installed",
            type: "number"
          },
          reverseTrialStartDate: {
            description: "The timestamp when the reverse trial started",
            type: "number"
          }
        }
      }
    },
    opt_out: {
      description: "The user opted out of the reverse trial by clicking the opt-out link on the dialog",
      data: {
        description: "Details about the opt-out",
        type: "object",
        properties: {
          touchPointStep: {
            description: "The touch point step number of the dialog from which the user opted out",
            type: "number"
          },
          installDate: {
            description: "The timestamp when the extension was installed",
            type: "number"
          },
          reverseTrialStartDate: {
            description: "The timestamp when the reverse trial started",
            type: "number"
          }
        }
      }
    },
    feedback_clicked: {
      description: "The user clicked the feedback link on the reverse trial dialog",
      data: {
        description: "Details about the feedback link click",
        type: "object",
        properties: {
          touchPointStep: {
            description: "The touch point step number of the dialog from which the user clicked feedback",
            type: "number"
          },
          installDate: {
            description: "The timestamp when the extension was installed",
            type: "number"
          },
          reverseTrialStartDate: {
            description: "The timestamp when the reverse trial started",
            type: "number"
          }
        }
      }
    }
  }
});

;// ./src/all/telemetry.js
/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */



const DEBUG = 1;
const INFO = 2;
const BEHAVIOR = 3;
const WARN = 4;
const OFF = 5;

/**
 * Map of log names (eg 'debug') to their internal numeric representation. The
 * numbers represent a verbosity level, where 1 is the most verbose and 5 is the
 * least.
 */
const logLevelNamesToNumbers = {
  debug: DEBUG,
  info: INFO,
  behavior: BEHAVIOR,
  warn: WARN,
  off: OFF
};

/**
 * Map of log numeric representation back to their name. This can be used to
 * format log messages.
 */
const logLevelNumbersToNames = Object.fromEntries(
  Object.entries(logLevelNamesToNumbers).map(([key, value]) => [value, key])
);

function isPlainObject(obj) {
  if (obj === null || typeof obj !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(obj);
  return proto === Object.prototype || proto === null;
}

function isSerializableToJson(data, seen = new WeakSet()) {
  let type = typeof data;
  if (data === null || type == "undefined" || type == "string" || type == "boolean") {
    return true;
  }

  if (type == "number") {
    return Number.isFinite(data);
  }

  if (isPlainObject(data)) {
    if (seen.has(data)) {
      return false;
    }
    seen.add(data);
    return Object.values(data).every(x => isSerializableToJson(x, seen));
  }

  if (Array.isArray(data)) {
    if (seen.has(data)) {
      return false;
    }
    seen.add(data);
    return data.every(x => isSerializableToJson(x, seen));
  }

  return false;
}

function matchesEventSchema(data, dataSchema) {
  let dataType = typeof data;
  if (dataType === "undefined" || !dataSchema) {
    // if either is undefined (or null), then they must both be undefined.
    return (dataType === "undefined" || data === null) && !dataSchema;
  }

  let types = dataSchema.type;
  if (typeof types === "string") {
    types = [types];
  }

  let typeMatches = types.some(type => {
    switch (type) {
      case "any":
        return true;

      case "boolean":
      case "number":
      case "string":
        return dataType === type;

      case "null":
        return data === null;

      case "integer":
        return Number.isInteger(data);

      case "object":
        return isPlainObject(data) &&
          Object.keys(dataSchema.properties).every(key =>
            matchesEventSchema(data[key], dataSchema.properties[key])
          );

      case "array":
        return Array.isArray(data) && data.every(item =>
          matchesEventSchema(item, dataSchema.items)
        );
    }
    return false;
  });

  if (!typeMatches) {
    return false;
  }

  // After type validation passes, check enum constraint if defined
  if (typeof dataSchema.enum !== "undefined") {
    if (!dataSchema.enum.includes(data)) {
      return false;
    }
  }

  return true;
}

/**
 * Represents a logger. This will provide the API for the logger, and will
 * validate the logged events are as they appear in core/sdk/events.js, but will
 * not itself do any of the actual logging.
 *
 * This is not expected to be instantiated directly, but
 * should rather be extended. Child classes should implement the _validatedLog
 * function.
 *
 * @param {string} module The module that this logger is for.
 */
class AbstractLogger {
  constructor(module, defaultEvents = events) {
    this._module = module;
    this._events = defaultEvents;

    if (!this._events[this._module]) {
      console.error(`Unknown module: ${module}. ` +
                    "Did you remember to add it to core/sdk/events.js?");
    }
  }

  _log(level, event, data, ipmId) {
    if (!this._events[this._module]) {
      return;
    }

    if (!this._events[this._module][event]) {
      console.error(`Unknown event: ${event} in module: ${this._module}. ` +
        "Did you remember to add it to core/sdk/events.js?");
      return;
    }

    if (!isSerializableToJson(data)) {
      console.error(`Data for event: ${event} in module: ${this._module} cannot be serialized to JSON.`);
      return;
    }

    const dataSchema = this._events[this._module][event].data;
    if (!matchesEventSchema(data, dataSchema)) {
      console.error(`Data for event: ${event} in module: ${this._module} does not match the schema ` +
        "provided in core/sdk/events.js. ", {data, dataSchema});
      return;
    }

    const logTime = new Date().toISOString();
    this._validatedLog(logTime, level, event, data, ipmId);
  }

  _validatedLog(logTime, level, event, data, ipmId) {
  }

  /**
   * Creates a debug log.
   *
   * @param {string} event The name of the event to log. This should be unique.
   * @param {string|number|object|array|boolean|null} [data]
   *    The dynamic data relevant to the event.
   */
  debug(event, data) {
    this._log(DEBUG, event, data);
  }

  /**
   * Creates an info log.
   *
   * @param {string} event The name of the event to log. This should be unique.
   * @param {string|number|object|array|boolean|null} [data]
   *    The dynamic data relevant to the event.
   */
  info(event, data) {
    this._log(INFO, event, data);
  }

  /**
   * Creates a behaviour log.
   *
   * @param {string} event The name of the event to log. This should be unique.
   * @param {string|number|object|array|boolean|null} [data]
   *    The dynamic data relevant to the event.
   * @param {string} [ipmId] Optional suffix appended to the behaviour
   *   counter key. IPM events pass the campaign ID; detection snippets
   *   pass type:domain. Renamed to `keySuffix` in ServerLogger internals.
   */
  behavior(event, data, ipmId) {
    this._log(BEHAVIOR, event, data, ipmId);
  }

  /**
   * Creates a warn log.
   *
   * @param {string} event The name of the event to log. This should be unique.
   * @param {string|number|object|array|boolean|null} [data]
   *    The dynamic data relevant to the event.
   */
  warn(event, data) {
    this._log(WARN, event, data);
  }
}

;// ./src/front/telemetry.js
/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */






/**
 * Represents a server logger. This is used to send data to our telemetry
 * server. The exact URL will be configured by the telemetry module in the
 * background script. Console logging is also provided for convenience.
 *
 * @param {string} module The module that this logger is for.
 */
class ServerLogger extends AbstractLogger {
  constructor(module) {
    super(module);
  }

  _validatedLog(logTime, level, event, data) {
    void ignoreNoConnectionError(
      browser_polyfill.runtime.sendMessage({
        type: "ewe:telemetry-log",
        logTime,
        module: this._module,
        level,
        event,
        data
      })
    );
  }
}

/**
 * API to interact with the telemetry module
 * @namespace telemetry
 */
/* harmony default export */ const telemetry = ({
  ServerLogger
});

;// ./src/ui/index.js
/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */






/******/ 	return __nested_webpack_exports__;
/******/ })()
;
});


/***/ }),

/***/ 2058:
/***/ ((module) => {

"use strict";
module.exports = /*#__PURE__*/JSON.parse('{"alarms":{"clear":{"minArgs":0,"maxArgs":1},"clearAll":{"minArgs":0,"maxArgs":0},"get":{"minArgs":0,"maxArgs":1},"getAll":{"minArgs":0,"maxArgs":0}},"bookmarks":{"create":{"minArgs":1,"maxArgs":1},"get":{"minArgs":1,"maxArgs":1},"getChildren":{"minArgs":1,"maxArgs":1},"getRecent":{"minArgs":1,"maxArgs":1},"getSubTree":{"minArgs":1,"maxArgs":1},"getTree":{"minArgs":0,"maxArgs":0},"move":{"minArgs":2,"maxArgs":2},"remove":{"minArgs":1,"maxArgs":1},"removeTree":{"minArgs":1,"maxArgs":1},"search":{"minArgs":1,"maxArgs":1},"update":{"minArgs":2,"maxArgs":2}},"browserAction":{"disable":{"minArgs":0,"maxArgs":1,"fallbackToNoCallback":true},"enable":{"minArgs":0,"maxArgs":1,"fallbackToNoCallback":true},"getBadgeBackgroundColor":{"minArgs":1,"maxArgs":1},"getBadgeText":{"minArgs":1,"maxArgs":1},"getPopup":{"minArgs":1,"maxArgs":1},"getTitle":{"minArgs":1,"maxArgs":1},"openPopup":{"minArgs":0,"maxArgs":0},"setBadgeBackgroundColor":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setBadgeText":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setIcon":{"minArgs":1,"maxArgs":1},"setPopup":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setTitle":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true}},"browsingData":{"remove":{"minArgs":2,"maxArgs":2},"removeCache":{"minArgs":1,"maxArgs":1},"removeCookies":{"minArgs":1,"maxArgs":1},"removeDownloads":{"minArgs":1,"maxArgs":1},"removeFormData":{"minArgs":1,"maxArgs":1},"removeHistory":{"minArgs":1,"maxArgs":1},"removeLocalStorage":{"minArgs":1,"maxArgs":1},"removePasswords":{"minArgs":1,"maxArgs":1},"removePluginData":{"minArgs":1,"maxArgs":1},"settings":{"minArgs":0,"maxArgs":0}},"commands":{"getAll":{"minArgs":0,"maxArgs":0}},"contextMenus":{"remove":{"minArgs":1,"maxArgs":1},"removeAll":{"minArgs":0,"maxArgs":0},"update":{"minArgs":2,"maxArgs":2}},"cookies":{"get":{"minArgs":1,"maxArgs":1},"getAll":{"minArgs":1,"maxArgs":1},"getAllCookieStores":{"minArgs":0,"maxArgs":0},"remove":{"minArgs":1,"maxArgs":1},"set":{"minArgs":1,"maxArgs":1}},"devtools":{"inspectedWindow":{"eval":{"minArgs":1,"maxArgs":2,"singleCallbackArg":false}},"panels":{"create":{"minArgs":3,"maxArgs":3,"singleCallbackArg":true},"elements":{"createSidebarPane":{"minArgs":1,"maxArgs":1}}}},"downloads":{"cancel":{"minArgs":1,"maxArgs":1},"download":{"minArgs":1,"maxArgs":1},"erase":{"minArgs":1,"maxArgs":1},"getFileIcon":{"minArgs":1,"maxArgs":2},"open":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"pause":{"minArgs":1,"maxArgs":1},"removeFile":{"minArgs":1,"maxArgs":1},"resume":{"minArgs":1,"maxArgs":1},"search":{"minArgs":1,"maxArgs":1},"show":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true}},"extension":{"isAllowedFileSchemeAccess":{"minArgs":0,"maxArgs":0},"isAllowedIncognitoAccess":{"minArgs":0,"maxArgs":0}},"history":{"addUrl":{"minArgs":1,"maxArgs":1},"deleteAll":{"minArgs":0,"maxArgs":0},"deleteRange":{"minArgs":1,"maxArgs":1},"deleteUrl":{"minArgs":1,"maxArgs":1},"getVisits":{"minArgs":1,"maxArgs":1},"search":{"minArgs":1,"maxArgs":1}},"i18n":{"detectLanguage":{"minArgs":1,"maxArgs":1},"getAcceptLanguages":{"minArgs":0,"maxArgs":0}},"identity":{"launchWebAuthFlow":{"minArgs":1,"maxArgs":1}},"idle":{"queryState":{"minArgs":1,"maxArgs":1}},"management":{"get":{"minArgs":1,"maxArgs":1},"getAll":{"minArgs":0,"maxArgs":0},"getSelf":{"minArgs":0,"maxArgs":0},"setEnabled":{"minArgs":2,"maxArgs":2},"uninstallSelf":{"minArgs":0,"maxArgs":1}},"notifications":{"clear":{"minArgs":1,"maxArgs":1},"create":{"minArgs":1,"maxArgs":2},"getAll":{"minArgs":0,"maxArgs":0},"getPermissionLevel":{"minArgs":0,"maxArgs":0},"update":{"minArgs":2,"maxArgs":2}},"pageAction":{"getPopup":{"minArgs":1,"maxArgs":1},"getTitle":{"minArgs":1,"maxArgs":1},"hide":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setIcon":{"minArgs":1,"maxArgs":1},"setPopup":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"setTitle":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true},"show":{"minArgs":1,"maxArgs":1,"fallbackToNoCallback":true}},"permissions":{"contains":{"minArgs":1,"maxArgs":1},"getAll":{"minArgs":0,"maxArgs":0},"remove":{"minArgs":1,"maxArgs":1},"request":{"minArgs":1,"maxArgs":1}},"runtime":{"getBackgroundPage":{"minArgs":0,"maxArgs":0},"getPlatformInfo":{"minArgs":0,"maxArgs":0},"openOptionsPage":{"minArgs":0,"maxArgs":0},"requestUpdateCheck":{"minArgs":0,"maxArgs":0},"sendMessage":{"minArgs":1,"maxArgs":3},"sendNativeMessage":{"minArgs":2,"maxArgs":2},"setUninstallURL":{"minArgs":1,"maxArgs":1}},"sessions":{"getDevices":{"minArgs":0,"maxArgs":1},"getRecentlyClosed":{"minArgs":0,"maxArgs":1},"restore":{"minArgs":0,"maxArgs":1}},"storage":{"local":{"clear":{"minArgs":0,"maxArgs":0},"get":{"minArgs":0,"maxArgs":1},"getBytesInUse":{"minArgs":0,"maxArgs":1},"remove":{"minArgs":1,"maxArgs":1},"set":{"minArgs":1,"maxArgs":1}},"managed":{"get":{"minArgs":0,"maxArgs":1},"getBytesInUse":{"minArgs":0,"maxArgs":1}},"sync":{"clear":{"minArgs":0,"maxArgs":0},"get":{"minArgs":0,"maxArgs":1},"getBytesInUse":{"minArgs":0,"maxArgs":1},"remove":{"minArgs":1,"maxArgs":1},"set":{"minArgs":1,"maxArgs":1}}},"tabs":{"captureVisibleTab":{"minArgs":0,"maxArgs":2},"create":{"minArgs":1,"maxArgs":1},"detectLanguage":{"minArgs":0,"maxArgs":1},"discard":{"minArgs":0,"maxArgs":1},"duplicate":{"minArgs":1,"maxArgs":1},"executeScript":{"minArgs":1,"maxArgs":2},"get":{"minArgs":1,"maxArgs":1},"getCurrent":{"minArgs":0,"maxArgs":0},"getZoom":{"minArgs":0,"maxArgs":1},"getZoomSettings":{"minArgs":0,"maxArgs":1},"goBack":{"minArgs":0,"maxArgs":1},"goForward":{"minArgs":0,"maxArgs":1},"highlight":{"minArgs":1,"maxArgs":1},"insertCSS":{"minArgs":1,"maxArgs":2},"move":{"minArgs":2,"maxArgs":2},"query":{"minArgs":1,"maxArgs":1},"reload":{"minArgs":0,"maxArgs":2},"remove":{"minArgs":1,"maxArgs":1},"removeCSS":{"minArgs":1,"maxArgs":2},"sendMessage":{"minArgs":2,"maxArgs":3},"setZoom":{"minArgs":1,"maxArgs":2},"setZoomSettings":{"minArgs":1,"maxArgs":2},"update":{"minArgs":1,"maxArgs":2}},"topSites":{"get":{"minArgs":0,"maxArgs":0}},"webNavigation":{"getAllFrames":{"minArgs":1,"maxArgs":1},"getFrame":{"minArgs":1,"maxArgs":1}},"webRequest":{"handlerBehaviorChanged":{"minArgs":0,"maxArgs":0}},"windows":{"create":{"minArgs":0,"maxArgs":1},"get":{"minArgs":1,"maxArgs":2},"getAll":{"minArgs":0,"maxArgs":1},"getCurrent":{"minArgs":0,"maxArgs":1},"getLastFocused":{"minArgs":0,"maxArgs":1},"remove":{"minArgs":1,"maxArgs":1},"update":{"minArgs":2,"maxArgs":2}}}');

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/nonce */
/******/ 	(() => {
/******/ 		__webpack_require__.nc = undefined;
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
(() => {
"use strict";

;// ./js/common.mjs
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

function convertDoclinks() {
  const links = document.querySelectorAll("a[data-doclink]");
  for (const link of links) {
    getDoclink(link.dataset.doclink).then((url) => {
      link.target = link.target || "_blank";
      link.href = url;
    });
  }
}

function getDoclink(link) {
  return browser.runtime.sendMessage({
    type: "app.get",
    what: "doclink",
    link
  });
}

function getErrorMessage(error) {
  let message = null;
  if (error) {
    let messageId = error.reason || error.type;
    let placeholders = [];
    if (error.reason === "filter_unknown_option") {
      if (error.option) placeholders = [error.option];
      else messageId = "filter_invalid_option";
    }

    message = browser.i18n.getMessage(messageId, placeholders);
  }

  // Use a generic error message if we don't have one available yet
  if (!message) {
    message = browser.i18n.getMessage("filter_action_failed");
  }

  if (!error || typeof error.lineno !== "number") return message;

  return browser.i18n.getMessage("line", [
    error.lineno.toLocaleString(),
    message
  ]);
}

function getSourceAttribute(element) {
  const sourceContainer = element.closest("[data-source]");

  if (!sourceContainer) return null;

  return sourceContainer.dataset.source;
}

;// ./js/dom.mjs
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

const $ = (selector, container) => {
  if (!container) container = document;
  return container.querySelector(selector);
};
const $$ = (selector, container) => {
  if (!container) container = document;
  return container.querySelectorAll(selector);
};

// basic copy and paste clipboard utility
const clipboard = {
  // warning: Firefox needs a proper event to work
  //          such click or mousedown or similar.
  copy(text) {
    const selection = document.getSelection();
    const selected = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.cssText = "position:fixed;top:-999px";
    document.body.appendChild(el).select();
    document.execCommand("copy");
    document.body.removeChild(el);
    if (selected) {
      selection.removeAllRanges();
      // simply putting back selected doesn't work anymore
      const range = document.createRange();
      range.setStart(selected.startContainer, selected.startOffset);
      range.setEnd(selected.endContainer, selected.endOffset);
      selection.addRange(range);
    }
  },
  // optionally accepts a `paste` DOM event
  // it uses global clipboardData, if available, otherwise.
  // i.e. input.onpaste = event => console.log(dom.clipboard.paste(event));
  paste(event) {
    if (!event) event = window;
    const clipboardData = event.clipboardData || window.clipboardData;
    return clipboardData ? clipboardData.getData("text") : "";
  }
};

// helper to provide the relative coordinates
// to the closest positioned containing element
function relativeCoordinates(event) {
  return { x: event.offsetX, y: event.offsetY };
}

// helper to format as indented string any HTML/XML node
function asIndentedString(element, indentation = 0) {
  // only the first time it's called
  if (!indentation) {
    // get the top meaningful element to parse
    if (element.nodeType === Node.DOCUMENT_NODE)
      element = element.documentElement;
    // accept only elements
    if (element.nodeType !== Node.ELEMENT_NODE)
      throw new Error("Unable to serialize " + element);
    // avoid original XML pollution at first iteration
    element = element.cloneNode(true);
  }
  const before = "  ".repeat(indentation + 1);
  const after = "  ".repeat(indentation);
  const doc = element.ownerDocument;
  for (const child of Array.from(element.childNodes)) {
    const { nodeType } = child;
    if (nodeType === Node.ELEMENT_NODE || nodeType === Node.TEXT_NODE) {
      if (nodeType === Node.TEXT_NODE) {
        const content = child.textContent.trim();
        child.textContent = content.length ? `\n${before}${content}` : "";
      } else {
        element.insertBefore(doc.createTextNode(`\n${before}`), child);
        asIndentedString(child, indentation + 1);
      }
    }
    if (child === element.lastChild)
      element.appendChild(doc.createTextNode(`\n${after}`));
  }
  // inner calls don't need to bother serialization
  if (indentation) return "";
  // easiest way to recognize an HTML element from an XML one
  if (/^https?:\/\/www\.w3\.org\/1999\/xhtml$/.test(element.namespaceURI))
    return element.outerHTML;
  // all other elements should use XML serializer
  return new XMLSerializer().serializeToString(element);
}

// EXTERNAL MODULE: ../../node_modules/webextension-polyfill/src/browser-polyfill.js
var browser_polyfill = __webpack_require__(2558);
var browser_polyfill_default = /*#__PURE__*/__webpack_require__.n(browser_polyfill);
;// ./src/i18n/ui/i18n.ts

const i18nAttributes = ["alt", "placeholder", "title", "value"];
function assignAction(elements, action) {
    for (const element of elements) {
        switch (typeof action) {
            case "string":
                element.href = action;
                element.target = "_blank";
                break;
            case "function":
                element.href = "#";
                element.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    action();
                });
                break;
        }
    }
}
function* getRemainingLinks(parent) {
    const links = parent.querySelectorAll("a:not([data-i18n-index])");
    for (const link of links) {
        yield link;
    }
}
function setElementLinks(idOrElement, ...actions) {
    var _a;
    const element = typeof idOrElement === "string"
        ? document.getElementById(idOrElement)
        : idOrElement;
    if (element === null) {
        return;
    }
    const remainingLinks = getRemainingLinks(element);
    for (let i = 0; i < actions.length; i++) {
        const links = element.querySelectorAll(`a[data-i18n-index='${i}']`);
        if (links.length > 0) {
            assignAction(links, actions[i]);
            continue;
        }
        const link = remainingLinks.next();
        if ((_a = link.done) !== null && _a !== void 0 ? _a : false) {
            continue;
        }
        assignAction([link.value], actions[i]);
    }
}
function stripTagsUnsafe(text) {
    return text.replace(/<\/?[^>]+>/g, "");
}
function setElementText(element, stringName, args, children = []) {
    function processString(str, currentElement) {
        const match = /^(.*?)<(a|em|slot|strong)(\d)?>(.*?)<\/\2\3>(.*)$/.exec(str);
        if (match !== null) {
            const [, before, name, index, innerText, after] = match;
            processString(before, currentElement);
            if (name === "slot") {
                const e = children[Number(index)];
                if (e !== undefined) {
                    currentElement.appendChild(e);
                }
            }
            else {
                const e = document.createElement(name);
                if (typeof index !== "undefined") {
                    e.dataset.i18nIndex = index;
                }
                processString(innerText, e);
                currentElement.appendChild(e);
            }
            processString(after, currentElement);
        }
        else {
            currentElement.appendChild(document.createTextNode(str));
        }
    }
    while (element.lastChild !== null) {
        element.removeChild(element.lastChild);
    }
    processString(browser_polyfill_default().i18n.getMessage(stringName, args !== null && args !== void 0 ? args : undefined), element);
}
function loadI18nStrings() {
    function resolveStringNames(container) {
        var _a, _b;
        if (container === null || container === undefined) {
            return;
        }
        {
            const elements = container.querySelectorAll("[data-i18n]");
            for (const element of elements) {
                const children = Array.from(element.children);
                setElementText(element, (_a = element.dataset.i18n) !== null && _a !== void 0 ? _a : "", null, children);
            }
        }
        for (const attr of i18nAttributes) {
            const elements = container.querySelectorAll(`[data-i18n-${attr}]`);
            for (const element of elements) {
                const stringName = (_b = element.getAttribute(`data-i18n-${attr}`)) !== null && _b !== void 0 ? _b : "";
                element.setAttribute(attr, browser_polyfill_default().i18n.getMessage(stringName));
            }
        }
    }
    resolveStringNames(document);
    for (const template of document.querySelectorAll("template")) {
        resolveStringNames(template.content);
    }
}
function isLocaleInfo(candidate) {
    return (candidate !== null &&
        typeof candidate === "object" &&
        "bidiDir" in candidate &&
        "locale" in candidate);
}
async function setLanguageAttributes() {
    const localeInfo = await browser_polyfill_default().runtime.sendMessage({
        type: "app.get",
        what: "localeInfo"
    });
    if (!isLocaleInfo(localeInfo)) {
        return;
    }
    document.documentElement.lang = localeInfo.locale;
    document.documentElement.dir = localeInfo.bidiDir;
}
function initI18n() {
    void setLanguageAttributes();
    loadI18nStrings();
}

;// ./src/i18n/ui/index.ts


;// ./src/core/messaging/shared/emitter.ts
class MessageEmitter {
    constructor() {
        this.listeners = new Set();
    }
    addListener(listener) {
        this.listeners.add(listener);
    }
    removeListener(listener) {
        this.listeners.delete(listener);
    }
    dispatch(message, sender) {
        const results = [];
        for (const listener of this.listeners) {
            results.push(listener(message, sender));
        }
        return results;
    }
}

;// ./src/core/messaging/shared/messaging.ts
function getMessageResponse(responses) {
    for (const response of responses) {
        if (typeof response !== "undefined") {
            return response;
        }
    }
}
function isEventMessage(candidate) {
    return isMessage(candidate) && "action" in candidate && "args" in candidate;
}
function isMessage(candidate) {
    return (candidate !== null && typeof candidate === "object" && "type" in candidate);
}
function isListenMessage(candidate) {
    return isMessage(candidate) && "filter" in candidate;
}
function isPremiumSubscriptionsAddRemoveOptions(candidate) {
    return (candidate !== null &&
        typeof candidate === "object" &&
        "subscriptionType" in candidate);
}

;// ./src/core/messaging/front/messaging.ts

let port;
const connectListeners = new Set();
const disconnectListeners = new Set();
const messageListeners = new Set();
const messageEmitter = new MessageEmitter();
function addConnectListener(listener) {
    connectListeners.add(listener);
    listener();
}
function addDisconnectListener(listener) {
    disconnectListeners.add(listener);
}
function addMessageListener(listener) {
    messageListeners.add(listener);
}
const connect = () => {
    if (port) {
        return port;
    }
    try {
        port = browser.runtime.connect({ name: "ui" });
    }
    catch (ex) {
        port = null;
        disconnectListeners.forEach((listener) => {
            listener();
        });
        return port;
    }
    port.onMessage.addListener((message) => {
        if (!isMessage(message)) {
            return;
        }
        onMessage(message);
    });
    port.onDisconnect.addListener(onDisconnect);
    connectListeners.forEach((listener) => {
        listener();
    });
    return port;
};
function listen({ type, filter, ...options }) {
    addConnectListener(() => {
        if (port) {
            port.postMessage({
                type: `${type}.listen`,
                filter,
                ...options
            });
        }
    });
}
function onDisconnect() {
    port = null;
    setTimeout(() => connect(), 100);
}
function onMessage(message) {
    if (!message.type.endsWith(".respond")) {
        return;
    }
    messageListeners.forEach((listener) => {
        listener(message);
    });
}
function removeDisconnectListener(listener) {
    disconnectListeners.delete(listener);
}
function start() {
    connect();
    if (typeof browser.devtools === "undefined") {
        browser.runtime.onMessage.addListener((message, sender) => {
            if (!isMessage(message)) {
                return;
            }
            const responses = messageEmitter.dispatch(message, sender);
            const response = getMessageResponse(responses);
            if (typeof response === "undefined") {
                return;
            }
            return Promise.resolve(response);
        });
    }
}
start();

;// ./src/core/messaging/front/category-app.ts


const platformToStore = new Map([
    ["chromium", "chrome"],
    ["edgehtml", "edge"],
    ["gecko", "firefox"]
]);
async function get(what) {
    const options = { what };
    return await send("app.get", options);
}
async function getInfo() {
    var _a;
    const [application, platform] = await Promise.all([
        get("application"),
        get("platform")
    ]);
    let store;
    if (application !== "edge" && application !== "opera") {
        store = (_a = platformToStore.get(platform)) !== null && _a !== void 0 ? _a : "chrome";
    }
    else {
        store = application;
    }
    return {
        application,
        manifestVersion: browser.runtime.getManifest().manifest_version,
        platform,
        store
    };
}
function category_app_listen(filter) {
    messaging.listen({ type: "app", filter });
}
async function category_app_open(what, parameters = {}) {
    const options = { what, ...parameters };
    await send("app.open", options);
}
async function category_app_close() {
    await send("app.close");
}

;// ./src/core/messaging/front/category-filters.ts


async function category_filters_get() {
    return await send("filters.get");
}
function category_filters_listen(filter) {
    messaging.listen({ type: "filters", filter });
}

;// ./src/core/messaging/front/category-prefs.ts


async function category_prefs_get(key) {
    const options = { key };
    return await send("prefs.get", options);
}
function category_prefs_listen(filter) {
    messaging.listen({ type: "prefs", filter });
}

;// ./src/core/messaging/front/category-premium.ts


async function add(subscriptionType) {
    const options = { subscriptionType };
    await send("premium.subscriptions.add", options);
}
async function category_premium_get() {
    return await send("premium.get");
}
async function getPremiumSubscriptionsState() {
    return await send("premium.subscriptions.getState");
}
function category_premium_listen(filter) {
    messaging.listen({ type: "premium", filter });
}
async function remove(subscriptionType) {
    const options = { subscriptionType };
    await send("premium.subscriptions.remove", options);
}

;// ./src/core/messaging/front/category-requests.ts

function category_requests_listen(filter, tabId) {
    listen({ type: "requests", filter, tabId });
}

;// ./src/core/messaging/front/category-stats.ts


async function getBlockedPerPage(tab) {
    const options = { tab };
    return await send("stats.getBlockedPerPage", options);
}
async function getBlockedTotal() {
    return await send("stats.getBlockedTotal");
}
function category_stats_listen(filter) {
    messaging.listen({ type: "stats", filter });
}

;// ./src/core/messaging/front/utils.ts
async function utils_send(sendType, options = {}) {
    const args = {
        ...options,
        type: sendType
    };
    return await browser.runtime.sendMessage(args);
}

;// ./src/core/messaging/front/category-subscriptions.ts


async function category_subscriptions_add(url) {
    const options = { url };
    return await utils_send("subscriptions.add", options);
}
async function category_subscriptions_get(options) {
    return await utils_send("subscriptions.get", options !== null && options !== void 0 ? options : {});
}
async function getInitIssues() {
    return await utils_send("subscriptions.getInitIssues");
}
async function getRecommendations() {
    return await utils_send("subscriptions.getRecommendations");
}
function category_subscriptions_listen(filter) {
    listen({ type: "subscriptions", filter });
}
async function category_subscriptions_remove(url) {
    const options = { url };
    await utils_send("subscriptions.remove", options);
}

;// ./src/core/messaging/front/category-debug.ts

async function category_debug_getInfo() {
    return await utils_send("debug.getInfo");
}

;// ./src/core/messaging/front/index.ts




















;// ./js/pages/issue-reporter/redesign/report.mjs
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */




let dataGatheringTabId = null;
let isMinimumTimeMet = false;

// Collected data stored temporarily during gathering phase
let collectedRequests = [];
let collectedFilters = [];
let collectedExtensions = [];
let collectedDebugData = null;
let isPremiumUser = false;

function getOriginalTabId() {
  const tabId = parseInt(location.search.replace(/^\?/, ""), 10);
  if (!tabId && tabId !== 0) {
    console.warn("Missing tab id. Try appending '?1' to the end of the url.");
    throw new Error("invalid tab id");
  }

  return tabId;
}

addMessageListener((message) => {
  if (message.type !== "requests.respond" || message.action !== "hits") return;

  const [request, filter, subscriptions] = message.args;

  // ELEMHIDE hitLog request doesn't contain url
  if (request.url) {
    const url = censorURL(request.url);
    let existingRequest = collectedRequests.find((r) => r.url === url);
    if (!existingRequest) {
      existingRequest = {
        url,
        type: request.type,
        documentDomain: request.docDomain,
        thirdParty: request.thirdParty,
        count: 0,
        matchedFilter: null
      };
      collectedRequests.push(existingRequest);
    }
    existingRequest.count++;
    if (filter) {
      existingRequest.matchedFilter = filter.text;
    }
  }

  if (filter) {
    const existingFilter = collectedFilters.find((f) => f.text === filter.text);
    if (existingFilter) {
      existingFilter.hitCount++;
    } else {
      const subscriptionUrls = subscriptions.map(
        (subscription) => subscription.url
      );
      collectedFilters.push({
        text: filter.text,
        subscriptions: subscriptionUrls,
        hitCount: 1
      });
    }
  }
});

function collectRequests(tabId) {
  // Reset for fresh collection
  collectedRequests = [];
  collectedFilters = [];

  return browser.tabs
    .get(tabId)
    .then((tab) => {
      return browser.tabs.create({ active: false, url: tab.url });
    })
    .then((tab) => {
      dataGatheringTabId = tab.id;
      category_requests_listen(["hits"], dataGatheringTabId);

      function minimumTimeMet() {
        if (isMinimumTimeMet) return;

        isMinimumTimeMet = true;
        $("io-steps").dispatchEvent(new CustomEvent("requestcollected"));
      }
      browser.tabs.onUpdated.addListener((updatedTabId, changeInfo) => {
        if (
          updatedTabId == dataGatheringTabId &&
          changeInfo.status == "complete"
        )
          minimumTimeMet();
      });
      window.setTimeout(minimumTimeMet, 5000);
      window.addEventListener("beforeunload", (event) => {
        closeRequestsCollectingTab();
      });
    });
}

let closedRequestsCollectingTab;
function closeRequestsCollectingTab() {
  if (!closedRequestsCollectingTab) {
    if (dataGatheringTabId === null) {
      closedRequestsCollectingTab = Promise.resolve();
    } else {
      closedRequestsCollectingTab = browser.tabs
        .remove(dataGatheringTabId)
        .catch(() => {
          // Tab may have been closed manually by user - ignore error
        });
    }
  }

  return closedRequestsCollectingTab;
}

async function retrieveAddonInfo() {
  const addonVersion = await browser.runtime.sendMessage({
    type: "app.get",
    what: "addonVersion"
  });
  const { locale } = await browser.runtime.sendMessage({
    type: "app.get",
    what: "localeInfo"
  });
  return { version: addonVersion, locale };
}

async function retrieveApplicationInfo() {
  const application = await browser.runtime.sendMessage({
    type: "app.get",
    what: "application"
  });
  const applicationVersion = await browser.runtime.sendMessage({
    type: "app.get",
    what: "applicationVersion"
  });
  return {
    name: capitalize(application),
    version: applicationVersion,
    vendor: navigator.vendor,
    userAgent: navigator.userAgent
  };
}

async function retrievePlatformInfo() {
  const { getBrowserInfo, sendMessage } = browser.runtime;
  const [browserInfo, platform, platformVersion] = await Promise.all([
    getBrowserInfo ? getBrowserInfo() : null,
    sendMessage({ type: "app.get", what: "platform" }),
    sendMessage({ type: "app.get", what: "platformVersion" })
  ]);

  const result = {
    name: capitalize(platform),
    version: platformVersion
  };
  if (browserInfo) {
    result.build = browserInfo.buildID;
  }
  return result;
}

async function retrieveWindowInfo(tabId) {
  const tab = await browser.tabs.get(tabId);
  let openerUrl = null;
  let referrerUrl = null;

  if (tab.openerTabId) {
    const openerTab = await browser.tabs.get(tab.openerTabId);
    openerUrl = openerTab.url;
  }

  if (browser.scripting) {
    const [frameResult] = await browser.scripting.executeScript({
      target: { tabId },
      func: () => document.referrer
    });
    referrerUrl = frameResult.result;
  } else {
    [referrerUrl] = await browser.tabs.executeScript(tabId, {
      code: "document.referrer"
    });
  }

  const result = { url: censorURL(tab.url) };
  if (openerUrl) {
    result.opener = censorURL(openerUrl);
  }
  if (referrerUrl) {
    result.referrer = censorURL(referrerUrl);
  }
  return result;
}

async function retrieveSubscriptions() {
  const subscriptions = await category_subscriptions_get({
    ignoreDisabled: true,
    disabledFilters: true
  });

  const now = Math.round(Date.now() / 1000);
  const result = [];

  for (const subscription of subscriptions) {
    if (!/^(http|https|ftp):/.test(subscription.url)) continue;

    const sub = {
      id: subscription.url,
      disabledFilters: subscription.disabledFilters.length
    };

    if (subscription.version) sub.version = subscription.version;
    if (subscription.lastDownload)
      sub.lastDownloadAttempt = subscription.lastDownload - now;
    if (subscription.lastSuccess)
      sub.lastDownloadSuccess = subscription.lastSuccess - now;
    if (subscription.softExpiration)
      sub.softExpiration = subscription.softExpiration - now;
    if (subscription.expires) sub.hardExpiration = subscription.expires - now;
    if (subscription.downloadStatus)
      sub.downloadStatus = subscription.downloadStatus;

    result.push(sub);
  }
  return result;
}

// Chrome doesn't update the JavaScript context to reflect changes in the
// extension's permissions so we need to proxy our calls through a frame that
// loads after we request the necessary permissions
// https://bugs.chromium.org/p/chromium/issues/detail?id=594703
function proxyApiCall(apiId, ...args) {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.hidden = true;
    iframe.src = browser.runtime.getURL("proxy.html");
    iframe.onload = () => {
      function callback(...results) {
        document.body.removeChild(iframe);
        resolve(results[0]);
      }

      const proxy = iframe.contentWindow.browser;
      switch (apiId) {
        case "management.getAll":
          if ("getAll" in proxy.management) {
            proxy.management.getAll(...args).then(callback);
          } else {
            callback(null);
          }
          break;
      }
    };
    document.body.appendChild(iframe);
  });
}

async function retrieveExtensions() {
  try {
    const installed = await proxyApiCall("management.getAll");
    const extensions = [];

    for (const extension of installed) {
      if (!extension.enabled || extension.type != "extension") continue;
      extensions.push({
        id: extension.id,
        name: extension.name,
        type: "extension",
        version: extension.version
      });
    }

    const { plugins } = navigator;
    for (const plugin of plugins) {
      extensions.push({
        id: plugin.filename,
        name: plugin.name,
        type: "plugin"
      });
    }

    return extensions;
  } catch (err) {
    console.error("Could not retrieve list of extensions");
    return [];
  }
}

async function updateConfigurationInfo(isAccessible) {
  if (!isAccessible) {
    collectedExtensions = [];
    return;
  }

  const extensions = await retrieveExtensions();
  collectedExtensions = extensions;
}

function capitalize(str) {
  return str[0].toUpperCase() + str.slice(1);
}

function censorURL(url) {
  return url.replace(/([?;&/#][^?;&/#]+?=)[^?;&/#]+/g, "$1*");
}

// Handle "Other" issue type - show/hide message input
const otherMessageContainer = $("#otherMessageContainer");

for (const typeElement of $$("#typeSelectorGroup input[name='type']")) {
  typeElement.addEventListener("change", (event) => {
    if (otherMessageContainer) {
      otherMessageContainer.hidden = event.target.value !== "other";
    }
  });
}

function sanitizeDebugData(data) {
  const sanitized = JSON.parse(JSON.stringify(data));
  // Always remove user PII from debug data
  if (sanitized.account && sanitized.account.user) {
    delete sanitized.account.user.email;
    delete sanitized.account.user.displayName;
    delete sanitized.account.user.id;
  }
  return sanitized;
}

async function updateDebugInfo(include) {
  if (!include) {
    collectedDebugData = null;
    isPremiumUser = false;
    return null;
  }

  try {
    const debugData = await category_debug_getInfo();
    collectedDebugData = sanitizeDebugData(debugData);

    if (
      debugData.account &&
      debugData.account.hasPremium &&
      debugData.account.isLoggedIn
    ) {
      isPremiumUser = true;
    }

    return debugData;
  } catch (err) {
    console.error("Failed to get debug info:", err);
    return null;
  }
}

// Stored during initial data gathering
let gatheredAddonInfo = null;
let gatheredApplicationInfo = null;
let gatheredPlatformInfo = null;
let gatheredWindowInfo = null;
let gatheredSubscriptions = null;

async function gatherInitialData() {
  const tabId = getOriginalTabId();

  const [addonInfo, applicationInfo, platformInfo, windowInfo, subscriptions] =
    await Promise.all([
      retrieveAddonInfo(),
      retrieveApplicationInfo(),
      retrievePlatformInfo(),
      retrieveWindowInfo(tabId),
      retrieveSubscriptions()
    ]);

  gatheredAddonInfo = addonInfo;
  gatheredApplicationInfo = applicationInfo;
  gatheredPlatformInfo = platformInfo;
  gatheredWindowInfo = windowInfo;
  gatheredSubscriptions = subscriptions;

  // Start collecting requests in background
  await collectRequests(tabId);
}

async function buildReport(screenshotData) {
  // Read current form state
  const typeInput = $("input[name='type']:checked");
  const commentInput = $("#comment");
  const messageInput = $("#otherMessage");
  const emailInput = $("#email");
  const includeConfigCheckbox = $("#includeConfig");
  const includeDebugCheckbox = $("#includeDebug");

  let debugData = null;
  if (
    includeDebugCheckbox &&
    includeDebugCheckbox.checked &&
    collectedDebugData
  ) {
    debugData = sanitizeDebugData(collectedDebugData);
  }

  const report = {
    issue: {
      type: typeInput ? typeInput.value : null,
      description:
        messageInput && messageInput.value ? messageInput.value : null
    },
    product: {
      name: "adblockplus",
      source: "extension",
      version: gatheredAddonInfo?.version || null,
      locale: gatheredAddonInfo?.locale || null
    },
    application: gatheredApplicationInfo,
    platform: gatheredPlatformInfo,
    page: gatheredWindowInfo,
    requests: collectedRequests,
    matchedFiltersSummary: collectedFilters,
    subscriptions: gatheredSubscriptions,
    extensions:
      includeConfigCheckbox && includeConfigCheckbox.checked
        ? collectedExtensions
        : [],
    userComment: commentInput && commentInput.value ? commentInput.value : null,
    contactEmail: null,
    screenshot: screenshotData,
    debugData,
    hasPremium: isPremiumUser
  };

  if (emailInput && emailInput.value.trim()) {
    report.contactEmail = emailInput.value.trim();
  }

  return report;
}

;// ../../node_modules/@ungap/weakmap/esm/index.js
/*! (c) Andrea Giammarchi - ISC */
var esm_self = {};
try { esm_self.WeakMap = WeakMap; }
catch (WeakMap) {
  // this could be better but 90% of the time
  // it's everything developers need as fallback
  esm_self.WeakMap = (function (id, Object) {'use strict';
    var dP = Object.defineProperty;
    var hOP = Object.hasOwnProperty;
    var proto = WeakMap.prototype;
    proto.delete = function (key) {
      return this.has(key) && delete key[this._];
    };
    proto.get = function (key) {
      return this.has(key) ? key[this._] : void 0;
    };
    proto.has = function (key) {
      return hOP.call(key, this._);
    };
    proto.set = function (key, value) {
      dP(key, this._, {configurable: true, value: value});
      return this;
    };
    return WeakMap;
    function WeakMap(iterable) {
      dP(this, '_', {value: '_@ungap/weakmap' + id++});
      if (iterable)
        iterable.forEach(add, this);
    }
    function add(pair) {
      this.set(pair[0], pair[1]);
    }
  }(Math.random(), Object));
}
/* harmony default export */ const esm = (esm_self.WeakMap);

;// ../../node_modules/@ungap/essential-weakset/esm/index.js
/*! (c) Andrea Giammarchi - ISC */
var essential_weakset_esm_self = {};
try { essential_weakset_esm_self.WeakSet = WeakSet; }
catch (WeakSet) {
  (function (id, dP) {
    var proto = WeakSet.prototype;
    proto.add = function (object) {
      if (!this.has(object))
        dP(object, this._, {value: true, configurable: true});
      return this;
    };
    proto.has = function (object) {
      return this.hasOwnProperty.call(object, this._);
    };
    proto.delete = function (object) {
      return this.has(object) && delete object[this._];
    };
    essential_weakset_esm_self.WeakSet = WeakSet;
    function WeakSet() {'use strict';
      dP(this, '_', {value: '_@ungap/weakmap' + id++});
    }
  }(Math.random(), Object.defineProperty));
}
/* harmony default export */ const essential_weakset_esm = (essential_weakset_esm_self.WeakSet);

;// ../../node_modules/uarray/esm/index.js
const {isArray} = Array;
const {indexOf, slice} = [];



;// ../../node_modules/domdiff/esm/utils.js


const append = (get, parent, children, start, end, before) => {
  const isSelect = 'selectedIndex' in parent;
  let noSelection = isSelect;
  while (start < end) {
    const child = get(children[start], 1);
    parent.insertBefore(child, before);
    if (isSelect && noSelection && child.selected) {
      noSelection = !noSelection;
      let {selectedIndex} = parent;
      parent.selectedIndex = selectedIndex < 0 ?
        start :
        indexOf.call(parent.querySelectorAll('option'), child);
    }
    start++;
  }
};

const eqeq = (a, b) => a == b;

const identity = O => O;

const utils_indexOf = (
  moreNodes,
  moreStart,
  moreEnd,
  lessNodes,
  lessStart,
  lessEnd,
  compare
) => {
  const length = lessEnd - lessStart;
  /* istanbul ignore if */
  if (length < 1)
    return -1;
  while ((moreEnd - moreStart) >= length) {
    let m = moreStart;
    let l = lessStart;
    while (
      m < moreEnd &&
      l < lessEnd &&
      compare(moreNodes[m], lessNodes[l])
    ) {
      m++;
      l++;
    }
    if (l === lessEnd)
      return moreStart;
    moreStart = m + 1;
  }
  return -1;
};

const isReversed = (
  futureNodes,
  futureEnd,
  currentNodes,
  currentStart,
  currentEnd,
  compare
) => {
  while (
    currentStart < currentEnd &&
    compare(
      currentNodes[currentStart],
      futureNodes[futureEnd - 1]
    )) {
      currentStart++;
      futureEnd--;
    };
  return futureEnd === 0;
};

const next = (get, list, i, length, before) => i < length ?
              get(list[i], 0) :
              (0 < i ?
                get(list[i - 1], -0).nextSibling :
                before);

const utils_remove = (get, children, start, end) => {
  while (start < end)
    drop(get(children[start++], -1));
};

// - - - - - - - - - - - - - - - - - - -
// diff related constants and utilities
// - - - - - - - - - - - - - - - - - - -

const DELETION = -1;
const INSERTION = 1;
const SKIP = 0;
const SKIP_OND = 50;

const HS = (
  futureNodes,
  futureStart,
  futureEnd,
  futureChanges,
  currentNodes,
  currentStart,
  currentEnd,
  currentChanges
) => {

  let k = 0;
  /* istanbul ignore next */
  let minLen = futureChanges < currentChanges ? futureChanges : currentChanges;
  const link = Array(minLen++);
  const tresh = Array(minLen);
  tresh[0] = -1;

  for (let i = 1; i < minLen; i++)
    tresh[i] = currentEnd;

  const nodes = currentNodes.slice(currentStart, currentEnd);

  for (let i = futureStart; i < futureEnd; i++) {
    const index = nodes.indexOf(futureNodes[i]);
    if (-1 < index) {
      const idxInOld = index + currentStart;
      k = findK(tresh, minLen, idxInOld);
      /* istanbul ignore else */
      if (-1 < k) {
        tresh[k] = idxInOld;
        link[k] = {
          newi: i,
          oldi: idxInOld,
          prev: link[k - 1]
        };
      }
    }
  }

  k = --minLen;
  --currentEnd;
  while (tresh[k] > currentEnd) --k;

  minLen = currentChanges + futureChanges - k;
  const diff = Array(minLen);
  let ptr = link[k];
  --futureEnd;
  while (ptr) {
    const {newi, oldi} = ptr;
    while (futureEnd > newi) {
      diff[--minLen] = INSERTION;
      --futureEnd;
    }
    while (currentEnd > oldi) {
      diff[--minLen] = DELETION;
      --currentEnd;
    }
    diff[--minLen] = SKIP;
    --futureEnd;
    --currentEnd;
    ptr = ptr.prev;
  }
  while (futureEnd >= futureStart) {
    diff[--minLen] = INSERTION;
    --futureEnd;
  }
  while (currentEnd >= currentStart) {
    diff[--minLen] = DELETION;
    --currentEnd;
  }
  return diff;
};

// this is pretty much the same petit-dom code without the delete map part
// https://github.com/yelouafi/petit-dom/blob/bd6f5c919b5ae5297be01612c524c40be45f14a7/src/vdom.js#L556-L561
const OND = (
  futureNodes,
  futureStart,
  rows,
  currentNodes,
  currentStart,
  cols,
  compare
) => {
  const length = rows + cols;
  const v = [];
  let d, k, r, c, pv, cv, pd;
  outer: for (d = 0; d <= length; d++) {
    /* istanbul ignore if */
    if (d > SKIP_OND)
      return null;
    pd = d - 1;
    /* istanbul ignore next */
    pv = d ? v[d - 1] : [0, 0];
    cv = v[d] = [];
    for (k = -d; k <= d; k += 2) {
      if (k === -d || (k !== d && pv[pd + k - 1] < pv[pd + k + 1])) {
        c = pv[pd + k + 1];
      } else {
        c = pv[pd + k - 1] + 1;
      }
      r = c - k;
      while (
        c < cols &&
        r < rows &&
        compare(
          currentNodes[currentStart + c],
          futureNodes[futureStart + r]
        )
      ) {
        c++;
        r++;
      }
      if (c === cols && r === rows) {
        break outer;
      }
      cv[d + k] = c;
    }
  }

  const diff = Array(d / 2 + length / 2);
  let diffIdx = diff.length - 1;
  for (d = v.length - 1; d >= 0; d--) {
    while (
      c > 0 &&
      r > 0 &&
      compare(
        currentNodes[currentStart + c - 1],
        futureNodes[futureStart + r - 1]
      )
    ) {
      // diagonal edge = equality
      diff[diffIdx--] = SKIP;
      c--;
      r--;
    }
    if (!d)
      break;
    pd = d - 1;
    /* istanbul ignore next */
    pv = d ? v[d - 1] : [0, 0];
    k = c - r;
    if (k === -d || (k !== d && pv[pd + k - 1] < pv[pd + k + 1])) {
      // vertical edge = insertion
      r--;
      diff[diffIdx--] = INSERTION;
    } else {
      // horizontal edge = deletion
      c--;
      diff[diffIdx--] = DELETION;
    }
  }
  return diff;
};

const applyDiff = (
  diff,
  get,
  parentNode,
  futureNodes,
  futureStart,
  currentNodes,
  currentStart,
  currentLength,
  before
) => {
  const live = [];
  const length = diff.length;
  let currentIndex = currentStart;
  let i = 0;
  while (i < length) {
    switch (diff[i++]) {
      case SKIP:
        futureStart++;
        currentIndex++;
        break;
      case INSERTION:
        // TODO: bulk appends for sequential nodes
        live.push(futureNodes[futureStart]);
        append(
          get,
          parentNode,
          futureNodes,
          futureStart++,
          futureStart,
          currentIndex < currentLength ?
            get(currentNodes[currentIndex], 0) :
            before
        );
        break;
      case DELETION:
        currentIndex++;
        break;
    }
  }
  i = 0;
  while (i < length) {
    switch (diff[i++]) {
      case SKIP:
        currentStart++;
        break;
      case DELETION:
        // TODO: bulk removes for sequential nodes
        if (-1 < live.indexOf(currentNodes[currentStart]))
          currentStart++;
        else
          utils_remove(
            get,
            currentNodes,
            currentStart++,
            currentStart
          );
        break;
    }
  }
};

const findK = (ktr, length, j) => {
  let lo = 1;
  let hi = length;
  while (lo < hi) {
    const mid = ((lo + hi) / 2) >>> 0;
    if (j < ktr[mid])
      hi = mid;
    else
      lo = mid + 1;
  }
  return lo;
}

const smartDiff = (
  get,
  parentNode,
  futureNodes,
  futureStart,
  futureEnd,
  futureChanges,
  currentNodes,
  currentStart,
  currentEnd,
  currentChanges,
  currentLength,
  compare,
  before
) => {
  applyDiff(
    OND(
      futureNodes,
      futureStart,
      futureChanges,
      currentNodes,
      currentStart,
      currentChanges,
      compare
    ) ||
    HS(
      futureNodes,
      futureStart,
      futureEnd,
      futureChanges,
      currentNodes,
      currentStart,
      currentEnd,
      currentChanges
    ),
    get,
    parentNode,
    futureNodes,
    futureStart,
    currentNodes,
    currentStart,
    currentLength,
    before
  );
};

const drop = node => (node.remove || dropChild).call(node);

function dropChild() {
  const {parentNode} = this;
  /* istanbul ignore else */
  if (parentNode)
    parentNode.removeChild(this);
}

;// ../../node_modules/domdiff/esm/index.js
/*! (c) 2018 Andrea Giammarchi (ISC) */



const domdiff = (
  parentNode,     // where changes happen
  currentNodes,   // Array of current items/nodes
  futureNodes,    // Array of future items/nodes
  options         // optional object with one of the following properties
                  //  before: domNode
                  //  compare(generic, generic) => true if same generic
                  //  node(generic) => Node
) => {
  if (!options)
    options = {};

  const compare = options.compare || eqeq;
  const get = options.node || identity;
  const before = options.before == null ? null : get(options.before, 0);

  const currentLength = currentNodes.length;
  let currentEnd = currentLength;
  let currentStart = 0;

  let futureEnd = futureNodes.length;
  let futureStart = 0;

  // common prefix
  while (
    currentStart < currentEnd &&
    futureStart < futureEnd &&
    compare(currentNodes[currentStart], futureNodes[futureStart])
  ) {
    currentStart++;
    futureStart++;
  }

  // common suffix
  while (
    currentStart < currentEnd &&
    futureStart < futureEnd &&
    compare(currentNodes[currentEnd - 1], futureNodes[futureEnd - 1])
  ) {
    currentEnd--;
    futureEnd--;
  }

  const currentSame = currentStart === currentEnd;
  const futureSame = futureStart === futureEnd;

  // same list
  if (currentSame && futureSame)
    return futureNodes;

  // only stuff to add
  if (currentSame && futureStart < futureEnd) {
    append(
      get,
      parentNode,
      futureNodes,
      futureStart,
      futureEnd,
      next(get, currentNodes, currentStart, currentLength, before)
    );
    return futureNodes;
  }

  // only stuff to remove
  if (futureSame && currentStart < currentEnd) {
    utils_remove(
      get,
      currentNodes,
      currentStart,
      currentEnd
    );
    return futureNodes;
  }

  const currentChanges = currentEnd - currentStart;
  const futureChanges = futureEnd - futureStart;
  let i = -1;

  // 2 simple indels: the shortest sequence is a subsequence of the longest
  if (currentChanges < futureChanges) {
    i = utils_indexOf(
      futureNodes,
      futureStart,
      futureEnd,
      currentNodes,
      currentStart,
      currentEnd,
      compare
    );
    // inner diff
    if (-1 < i) {
      append(
        get,
        parentNode,
        futureNodes,
        futureStart,
        i,
        get(currentNodes[currentStart], 0)
      );
      append(
        get,
        parentNode,
        futureNodes,
        i + currentChanges,
        futureEnd,
        next(get, currentNodes, currentEnd, currentLength, before)
      );
      return futureNodes;
    }
  }
  /* istanbul ignore else */
  else if (futureChanges < currentChanges) {
    i = utils_indexOf(
      currentNodes,
      currentStart,
      currentEnd,
      futureNodes,
      futureStart,
      futureEnd,
      compare
    );
    // outer diff
    if (-1 < i) {
      utils_remove(
        get,
        currentNodes,
        currentStart,
        i
      );
      utils_remove(
        get,
        currentNodes,
        i + futureChanges,
        currentEnd
      );
      return futureNodes;
    }
  }

  // common case with one replacement for many nodes
  // or many nodes replaced for a single one
  /* istanbul ignore else */
  if ((currentChanges < 2 || futureChanges < 2)) {
    append(
      get,
      parentNode,
      futureNodes,
      futureStart,
      futureEnd,
      get(currentNodes[currentStart], 0)
    );
    utils_remove(
      get,
      currentNodes,
      currentStart,
      currentEnd
    );
    return futureNodes;
  }

  // the half match diff part has been skipped in petit-dom
  // https://github.com/yelouafi/petit-dom/blob/bd6f5c919b5ae5297be01612c524c40be45f14a7/src/vdom.js#L391-L397
  // accordingly, I think it's safe to skip in here too
  // if one day it'll come out like the speediest thing ever to do
  // then I might add it in here too

  // Extra: before going too fancy, what about reversed lists ?
  //        This should bail out pretty quickly if that's not the case.
  if (
    currentChanges === futureChanges &&
    isReversed(
      futureNodes,
      futureEnd,
      currentNodes,
      currentStart,
      currentEnd,
      compare
    )
  ) {
    append(
      get,
      parentNode,
      futureNodes,
      futureStart,
      futureEnd,
      next(get, currentNodes, currentEnd, currentLength, before)
    );
    return futureNodes;
  }

  // last resort through a smart diff
  smartDiff(
    get,
    parentNode,
    futureNodes,
    futureStart,
    futureEnd,
    futureChanges,
    currentNodes,
    currentStart,
    currentEnd,
    currentChanges,
    currentLength,
    compare,
    before
  );

  return futureNodes;
};

/* harmony default export */ const domdiff_esm = (domdiff);

;// ../../node_modules/@ungap/custom-event/esm/index.js
/*! (c) Andrea Giammarchi - ISC */
var custom_event_esm_self = {};
custom_event_esm_self.CustomEvent = typeof CustomEvent === 'function' ?
  CustomEvent :
  (function (__p__) {
    CustomEvent[__p__] = new CustomEvent('').constructor[__p__];
    return CustomEvent;
    function CustomEvent(type, init) {
      if (!init) init = {};
      var e = document.createEvent('CustomEvent');
      e.initCustomEvent(type, !!init.bubbles, !!init.cancelable, init.detail);
      return e;
    }
  }('prototype'));
/* harmony default export */ const custom_event_esm = (custom_event_esm_self.CustomEvent);

;// ../../node_modules/@ungap/essential-map/esm/index.js
/*! (c) Andrea Giammarchi - ISC */
var essential_map_esm_self = {};
try { essential_map_esm_self.Map = Map; }
catch (Map) {
  essential_map_esm_self.Map = function Map() {
    var i = 0;
    var k = [];
    var v = [];
    return {
      delete: function (key) {
        var had = contains(key);
        if (had) {
          k.splice(i, 1);
          v.splice(i, 1);
        }
        return had;
      },
      forEach: function forEach(callback, context) {
        k.forEach(
          function (key, i)  {
            callback.call(context, v[i], key, this);
          },
          this
        );
      },
      get: function get(key) {
        return contains(key) ? v[i] : void 0;
      },
      has: function has(key) {
        return contains(key);
      },
      set: function set(key, value) {
        v[contains(key) ? i : (k.push(key) - 1)] = value;
        return this;
      }
    };
    function contains(v) {
      i = k.indexOf(v);
      return -1 < i;
    }
  };
}
/* harmony default export */ const essential_map_esm = (essential_map_esm_self.Map);

;// ../../node_modules/hyperhtml/esm/classes/Component.js




// hyperHTML.Component is a very basic class
// able to create Custom Elements like components
// including the ability to listen to connect/disconnect
// events via onconnect/ondisconnect attributes
// Components can be created imperatively or declaratively.
// The main difference is that declared components
// will not automatically render on setState(...)
// to simplify state handling on render.
function Component() {
  return this; // this is needed in Edge !!!
}

// Component is lazily setup because it needs
// wire mechanism as lazy content
function setup(content) {
  // there are various weakly referenced variables in here
  // and mostly are to use Component.for(...) static method.
  const children = new esm;
  const create = Object.create;
  const createEntry = (wm, id, component) => {
    wm.set(id, component);
    return component;
  };
  const get = (Class, info, context, id) => {
    const relation = info.get(Class) || relate(Class, info);
    switch (typeof id) {
      case 'object':
      case 'function':
        const wm = relation.w || (relation.w = new esm);
        return wm.get(id) || createEntry(wm, id, new Class(context));
      default:
        const sm = relation.p || (relation.p = create(null));
        return sm[id] || (sm[id] = new Class(context));
    }
  };
  const relate = (Class, info) => {
    const relation = {w: null, p: null};
    info.set(Class, relation);
    return relation;
  };
  const set = context => {
    const info = new essential_map_esm;
    children.set(context, info);
    return info;
  };
  // The Component Class
  Object.defineProperties(
    Component,
    {
      // Component.for(context[, id]) is a convenient way
      // to automatically relate data/context to children components
      // If not created yet, the new Component(context) is weakly stored
      // and after that same instance would always be returned.
      for: {
        configurable: true,
        value(context, id) {
          return get(
            this,
            children.get(context) || set(context),
            context,
            id == null ?
              'default' : id
          );
        }
      }
    }
  );
  Object.defineProperties(
    Component.prototype,
    {
      // all events are handled with the component as context
      handleEvent: {value(e) {
        const ct = e.currentTarget;
        this[
          ('getAttribute' in ct && ct.getAttribute('data-call')) ||
          ('on' + e.type)
        ](e);
      }},
      // components will lazily define html or svg properties
      // as soon as these are invoked within the .render() method
      // Such render() method is not provided by the base class
      // but it must be available through the Component extend.
      // Declared components could implement a
      // render(props) method too and use props as needed.
      html: lazyGetter('html', content),
      svg: lazyGetter('svg', content),
      // the state is a very basic/simple mechanism inspired by Preact
      state: lazyGetter('state', function () { return this.defaultState; }),
      // it is possible to define a default state that'd be always an object otherwise
      defaultState: {get() { return {}; }},
      // dispatch a bubbling, cancelable, custom event
      // through the first known/available node
      dispatch: {value(type, detail) {
        const {_wire$} = this;
        if (_wire$) {
          const event = new custom_event_esm(type, {
            bubbles: true,
            cancelable: true,
            detail
          });
          event.component = this;
          return (_wire$.dispatchEvent ?
                    _wire$ :
                    _wire$.firstChild
                  ).dispatchEvent(event);
        }
        return false;
      }},
      // setting some property state through a new object
      // or a callback, triggers also automatically a render
      // unless explicitly specified to not do so (render === false)
      setState: {value(state, render) {
        const target = this.state;
        const source = typeof state === 'function' ? state.call(this, target) : state;
        for (const key in source) target[key] = source[key];
        if (render !== false)
          this.render();
        return this;
      }}
    }
  );
}

// instead of a secret key I could've used a WeakMap
// However, attaching a property directly will result
// into better performance with thousands of components
// hanging around, and less memory pressure caused by the WeakMap
const lazyGetter = (type, fn) => {
  const secret = '_' + type + '$';
  return {
    get() {
      return this[secret] || setValue(this, secret, fn.call(this, type));
    },
    set(value) {
      setValue(this, secret, value);
    }
  };
};

// shortcut to set value on get or set(value)
const setValue = (self, secret, value) =>
  Object.defineProperty(self, secret, {
    configurable: true,
    value: typeof value === 'function' ?
      function () {
        return (self._wire$ = value.apply(this, arguments));
      } :
      value
  })[secret]
;

Object.defineProperties(
  Component.prototype,
  {
    // used to distinguish better than instanceof
    ELEMENT_NODE: {value: 1},
    nodeType: {value: -1}
  }
);

;// ../../node_modules/hyperhtml/esm/objects/Intent.js
const attributes = {};
const intents = {};
const keys = [];
const Intent_hasOwnProperty = intents.hasOwnProperty;

let Intent_length = 0;

/* harmony default export */ const Intent = ({

  // used to invoke right away hyper:attributes
  attributes,

  // hyperHTML.define('intent', (object, update) => {...})
  // can be used to define a third parts update mechanism
  // when every other known mechanism failed.
  // hyper.define('user', info => info.name);
  // hyper(node)`<p>${{user}}</p>`;
  define: (intent, callback) => {
    if (intent.indexOf('-') < 0) {
      if (!(intent in intents)) {
        Intent_length = keys.push(intent);
      }
      intents[intent] = callback;
    } else {
      attributes[intent] = callback;
    }
  },

  // this method is used internally as last resort
  // to retrieve a value out of an object
  invoke: (object, callback) => {
    for (let i = 0; i < Intent_length; i++) {
      let key = keys[i];
      if (Intent_hasOwnProperty.call(object, key)) {
        return intents[key](object[key], callback);
      }
    }
  }
});

;// ../../node_modules/@ungap/is-array/esm/index.js
var esm_isArray = Array.isArray || /* istanbul ignore next */ (function (toString) {
  /* istanbul ignore next */
  var $ = toString.call([]);
  /* istanbul ignore next */
  return function isArray(object) {
    return toString.call(object) === $;
  };
}({}.toString));
/* harmony default export */ const is_array_esm = (esm_isArray);

;// ../../node_modules/@ungap/create-content/esm/index.js
/*! (c) Andrea Giammarchi - ISC */
var createContent = (function (document) {'use strict';
  var FRAGMENT = 'fragment';
  var TEMPLATE = 'template';
  var HAS_CONTENT = 'content' in create(TEMPLATE);

  var createHTML = HAS_CONTENT ?
    function (html) {
      var template = create(TEMPLATE);
      template.innerHTML = html;
      return template.content;
    } :
    function (html) {
      var content = create(FRAGMENT);
      var template = create(TEMPLATE);
      var childNodes = null;
      if (/^[^\S]*?<(col(?:group)?|t(?:head|body|foot|r|d|h))/i.test(html)) {
        var selector = RegExp.$1;
        template.innerHTML = '<table>' + html + '</table>';
        childNodes = template.querySelectorAll(selector);
      } else {
        template.innerHTML = html;
        childNodes = template.childNodes;
      }
      append(content, childNodes);
      return content;
    };

  return function createContent(markup, type) {
    return (type === 'svg' ? createSVG : createHTML)(markup);
  };

  function append(root, childNodes) {
    var length = childNodes.length;
    while (length--)
      root.appendChild(childNodes[0]);
  }

  function create(element) {
    return element === FRAGMENT ?
      document.createDocumentFragment() :
      document.createElementNS('http://www.w3.org/1999/xhtml', element);
  }

  // it could use createElementNS when hasNode is there
  // but this fallback is equally fast and easier to maintain
  // it is also battle tested already in all IE
  function createSVG(svg) {
    var content = create(FRAGMENT);
    var template = create('div');
    template.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + svg + '</svg>';
    append(content, template.firstChild.childNodes);
    return content;
  }

}(document));
/* harmony default export */ const create_content_esm = (createContent);

;// ../../node_modules/disconnected/esm/index.js
/*! (c) Andrea Giammarchi */
function disconnected(poly) {'use strict';
  var Event = poly.Event;
  var WeakSet = poly.WeakSet;
  var notObserving = true;
  var observer = null;
  return function observe(node) {
    if (notObserving) {
      notObserving = !notObserving;
      observer = new WeakSet;
      startObserving(node.ownerDocument);
    }
    observer.add(node);
    return node;
  };
  function startObserving(document) {
    var connected = new WeakSet;
    var disconnected = new WeakSet;
    try {
      (new MutationObserver(changes)).observe(
        document,
        {subtree: true, childList: true}
      );
    }
    catch(o_O) {
      var timer = 0;
      var records = [];
      var reschedule = function (record) {
        records.push(record);
        clearTimeout(timer);
        timer = setTimeout(
          function () {
            changes(records.splice(timer = 0, records.length));
          },
          0
        );
      };
      document.addEventListener(
        'DOMNodeRemoved',
        function (event) {
          reschedule({addedNodes: [], removedNodes: [event.target]});
        },
        true
      );
      document.addEventListener(
        'DOMNodeInserted',
        function (event) {
          reschedule({addedNodes: [event.target], removedNodes: []});
        },
        true
      );
    }
    function changes(records) {
      for (var
        record,
        length = records.length,
        i = 0; i < length; i++
      ) {
        record = records[i];
        dispatchAll(record.removedNodes, 'disconnected', disconnected, connected);
        dispatchAll(record.addedNodes, 'connected', connected, disconnected);
      }
    }
    function dispatchAll(nodes, type, wsin, wsout) {
      for (var
        node,
        event = new Event(type),
        length = nodes.length,
        i = 0; i < length;
        (node = nodes[i++]).nodeType === 1 &&
        dispatchTarget(node, event, type, wsin, wsout)
      );
    }
    function dispatchTarget(node, event, type, wsin, wsout) {
      if (observer.has(node) && !wsin.has(node)) {
        wsout.delete(node);
        wsin.add(node);
        node.dispatchEvent(event);
        /*
        // The event is not bubbling (perf reason: should it?),
        // hence there's no way to know if
        // stop/Immediate/Propagation() was called.
        // Should DOM Level 0 work at all?
        // I say it's a YAGNI case for the time being,
        // and easy to implement in user-land.
        if (!event.cancelBubble) {
          var fn = node['on' + type];
          if (fn)
            fn.call(node, event);
        }
        */
      }
      for (var
        // apparently is node.children || IE11 ... ^_^;;
        // https://github.com/WebReflection/disconnected/issues/1
        children = node.children || [],
        length = children.length,
        i = 0; i < length;
        dispatchTarget(children[i++], event, type, wsin, wsout)
      );
    }
  }
}
/* harmony default export */ const disconnected_esm = (disconnected);

;// ../../node_modules/@ungap/import-node/esm/index.js
/*! (c) Andrea Giammarchi - ISC */
var importNode = (function (
  document,
  appendChild,
  cloneNode,
  createTextNode,
  importNode
) {
  var native = importNode in document;
  // IE 11 has problems with cloning templates:
  // it "forgets" empty childNodes. This feature-detects that.
  var fragment = document.createDocumentFragment();
  fragment[appendChild](document[createTextNode]('g'));
  fragment[appendChild](document[createTextNode](''));
  /* istanbul ignore next */
  var content = native ?
    document[importNode](fragment, true) :
    fragment[cloneNode](true);
  return content.childNodes.length < 2 ?
    function importNode(node, deep) {
      var clone = node[cloneNode]();
      for (var
        /* istanbul ignore next */
        childNodes = node.childNodes || [],
        length = childNodes.length,
        i = 0; deep && i < length; i++
      ) {
        clone[appendChild](importNode(childNodes[i], deep));
      }
      return clone;
    } :
    /* istanbul ignore next */
    (native ?
      document[importNode] :
      function (node, deep) {
        return node[cloneNode](!!deep);
      }
    );
}(
  document,
  'appendChild',
  'cloneNode',
  'createTextNode',
  'importNode'
));
/* harmony default export */ const import_node_esm = (importNode);

;// ../../node_modules/@ungap/trim/esm/index.js
var trim = ''.trim || /* istanbul ignore next */ function () {
  return String(this).replace(/^\s+|\s+/g, '');
};
/* harmony default export */ const trim_esm = (trim);

;// ../../node_modules/domconstants/esm/index.js
/*! (c) Andrea Giammarchi - ISC */

// Custom
var UID = '-' + Math.random().toFixed(6) + '%';
//                           Edge issue!

var UID_IE = false;

try {
  if (!(function (template, content, tabindex) {
    return content in template && (
      (template.innerHTML = '<p ' + tabindex + '="' + UID + '"></p>'),
      template[content].childNodes[0].getAttribute(tabindex) == UID
    );
  }(document.createElement('template'), 'content', 'tabindex'))) {
    UID = '_dt: ' + UID.slice(1, -1) + ';';
    UID_IE = true;
  }
} catch(meh) {}

var UIDC = '<!--' + UID + '-->';

// DOM
var COMMENT_NODE = 8;
var DOCUMENT_FRAGMENT_NODE = 11;
var ELEMENT_NODE = 1;
var TEXT_NODE = 3;

var SHOULD_USE_TEXT_CONTENT = /^(?:plaintext|script|style|textarea|title|xmp)$/i;
var VOID_ELEMENTS = /^(?:area|base|br|col|embed|hr|img|input|keygen|link|menuitem|meta|param|source|track|wbr)$/i;



;// ../../node_modules/domsanitizer/esm/index.js
/*! (c) Andrea Giammarchi - ISC */



/* harmony default export */ function domsanitizer_esm(template) {
  return template.join(UIDC)
          .replace(selfClosing, fullClosing)
          .replace(attrSeeker, attrReplacer);
}

var spaces = ' \\f\\n\\r\\t';
var almostEverything = '[^' + spaces + '\\/>"\'=]+';
var attrName = '[' + spaces + ']+' + almostEverything;
var tagName = '<([A-Za-z]+[A-Za-z0-9:._-]*)((?:';
var attrPartials = '(?:\\s*=\\s*(?:\'[^\']*?\'|"[^"]*?"|<[^>]*?>|' + almostEverything.replace('\\/', '') + '))?)';

var attrSeeker = new RegExp(tagName + attrName + attrPartials + '+)([' + spaces + ']*/?>)', 'g');
var selfClosing = new RegExp(tagName + attrName + attrPartials + '*)([' + spaces + ']*/>)', 'g');
var findAttributes = new RegExp('(' + attrName + '\\s*=\\s*)([\'"]?)' + UIDC + '\\2', 'gi');

function attrReplacer($0, $1, $2, $3) {
  return '<' + $1 + $2.replace(findAttributes, replaceAttributes) + $3;
}

function replaceAttributes($0, $1, $2) {
  return $1 + ($2 || '"') + UID + ($2 || '"');
}

function fullClosing($0, $1, $2) {
  return VOID_ELEMENTS.test($1) ? $0 : ('<' + $1 + $2 + '></' + $1 + '>');
}

;// ../../node_modules/umap/esm/index.js
/* harmony default export */ const umap_esm = (_ => ({
  // About: get: _.get.bind(_)
  // It looks like WebKit/Safari didn't optimize bind at all,
  // so that using bind slows it down by 60%.
  // Firefox and Chrome are just fine in both cases,
  // so let's use the approach that works fast everywhere 👍
  get: key => _.get(key),
  set: (key, value) => (_.set(key, value), value)
}));

;// ../../node_modules/domtagger/esm/walker.js






/* istanbul ignore next */
var normalizeAttributes = UID_IE ?
  function (attributes, parts) {
    var html = parts.join(' ');
    return parts.slice.call(attributes, 0).sort(function (left, right) {
      return html.indexOf(left.name) <= html.indexOf(right.name) ? -1 : 1;
    });
  } :
  function (attributes, parts) {
    return parts.slice.call(attributes, 0);
  }
;

function find(node, path) {
  var length = path.length;
  var i = 0;
  while (i < length)
    node = node.childNodes[path[i++]];
  return node;
}

function parse(node, holes, parts, path) {
  var childNodes = node.childNodes;
  var length = childNodes.length;
  var i = 0;
  while (i < length) {
    var child = childNodes[i];
    switch (child.nodeType) {
      case ELEMENT_NODE:
        var childPath = path.concat(i);
        parseAttributes(child, holes, parts, childPath);
        parse(child, holes, parts, childPath);
        break;
      case COMMENT_NODE:
        var textContent = child.textContent;
        if (textContent === UID) {
          parts.shift();
          holes.push(
            // basicHTML or other non standard engines
            // might end up having comments in nodes
            // where they shouldn't, hence this check.
            SHOULD_USE_TEXT_CONTENT.test(node.nodeName) ?
              Text(node, path) :
              Any(child, path.concat(i))
          );
        } else {
          switch (textContent.slice(0, 2)) {
            case '/*':
              if (textContent.slice(-2) !== '*/')
                break;
            case '\uD83D\uDC7B': // ghost
              node.removeChild(child);
              i--;
              length--;
          }
        }
        break;
      case TEXT_NODE:
        // the following ignore is actually covered by browsers
        // only basicHTML ends up on previous COMMENT_NODE case
        // instead of TEXT_NODE because it knows nothing about
        // special style or textarea behavior
        /* istanbul ignore if */
        if (
          SHOULD_USE_TEXT_CONTENT.test(node.nodeName) &&
          trim_esm.call(child.textContent) === UIDC
        ) {
          parts.shift();
          holes.push(Text(node, path));
        }
        break;
    }
    i++;
  }
}

function parseAttributes(node, holes, parts, path) {
  var attributes = node.attributes;
  var cache = [];
  var remove = [];
  var array = normalizeAttributes(attributes, parts);
  var length = array.length;
  var i = 0;
  while (i < length) {
    var attribute = array[i++];
    var direct = attribute.value === UID;
    var sparse;
    if (direct || 1 < (sparse = attribute.value.split(UIDC)).length) {
      var name = attribute.name;
      // the following ignore is covered by IE
      // and the IE9 double viewBox test
      /* istanbul ignore else */
      if (cache.indexOf(name) < 0) {
        cache.push(name);
        var realName = parts.shift().replace(
          direct ?
            /^(?:|[\S\s]*?\s)(\S+?)\s*=\s*('|")?$/ :
            new RegExp(
              '^(?:|[\\S\\s]*?\\s)(' + name + ')\\s*=\\s*(\'|")[\\S\\s]*',
              'i'
            ),
            '$1'
        );
        var value = attributes[realName] ||
                      // the following ignore is covered by browsers
                      // while basicHTML is already case-sensitive
                      /* istanbul ignore next */
                      attributes[realName.toLowerCase()];
        if (direct)
          holes.push(Attr(value, path, realName, null));
        else {
          var skip = sparse.length - 2;
          while (skip--)
            parts.shift();
          holes.push(Attr(value, path, realName, sparse));
        }
      }
      remove.push(attribute);
    }
  }
  length = remove.length;
  i = 0;

  /* istanbul ignore next */
  var cleanValue = 0 < length && UID_IE && !('ownerSVGElement' in node);
  while (i < length) {
    // Edge HTML bug #16878726
    var attr = remove[i++];
    // IE/Edge bug lighterhtml#63 - clean the value or it'll persist
    /* istanbul ignore next */
    if (cleanValue)
      attr.value = '';
    // IE/Edge bug lighterhtml#64 - don't use removeAttributeNode
    node.removeAttribute(attr.name);
  }

  // This is a very specific Firefox/Safari issue
  // but since it should be a not so common pattern,
  // it's probably worth patching regardless.
  // Basically, scripts created through strings are death.
  // You need to create fresh new scripts instead.
  // TODO: is there any other node that needs such nonsense?
  var nodeName = node.nodeName;
  if (/^script$/i.test(nodeName)) {
    // this used to be like that
    // var script = createElement(node, nodeName);
    // then Edge arrived and decided that scripts created
    // through template documents aren't worth executing
    // so it became this ... hopefully it won't hurt in the wild
    var script = document.createElement(nodeName);
    length = attributes.length;
    i = 0;
    while (i < length)
      script.setAttributeNode(attributes[i++].cloneNode(true));
    script.textContent = node.textContent;
    node.parentNode.replaceChild(script, node);
  }
}

function Any(node, path) {
  return {
    type: 'any',
    node: node,
    path: path
  };
}

function Attr(node, path, name, sparse) {
  return {
    type: 'attr',
    node: node,
    path: path,
    name: name,
    sparse: sparse
  };
}

function Text(node, path) {
  return {
    type: 'text',
    node: node,
    path: path
  };
}

;// ../../node_modules/domtagger/esm/index.js
// globals


// utils






// local


// the domtagger 🎉
/* harmony default export */ const domtagger_esm = (domtagger);

var parsed = umap_esm(new esm);

function createInfo(options, template) {
  var markup = (options.convert || domsanitizer_esm)(template);
  var transform = options.transform;
  if (transform)
    markup = transform(markup);
  var content = create_content_esm(markup, options.type);
  cleanContent(content);
  var holes = [];
  parse(content, holes, template.slice(0), []);
  return {
    content: content,
    updates: function (content) {
      var updates = [];
      var len = holes.length;
      var i = 0;
      var off = 0;
      while (i < len) {
        var info = holes[i++];
        var node = find(content, info.path);
        switch (info.type) {
          case 'any':
            updates.push({fn: options.any(node, []), sparse: false});
            break;
          case 'attr':
            var sparse = info.sparse;
            var fn = options.attribute(node, info.name, info.node);
            if (sparse === null)
              updates.push({fn: fn, sparse: false});
            else {
              off += sparse.length - 2;
              updates.push({fn: fn, sparse: true, values: sparse});
            }
            break;
          case 'text':
            updates.push({fn: options.text(node), sparse: false});
            node.textContent = '';
            break;
        }
      }
      len += off;
      return function () {
        var length = arguments.length;
        if (len !== (length - 1)) {
          throw new Error(
            (length - 1) + ' values instead of ' + len + '\n' +
            template.join('${value}')
          );
        }
        var i = 1;
        var off = 1;
        while (i < length) {
          var update = updates[i - off];
          if (update.sparse) {
            var values = update.values;
            var value = values[0];
            var j = 1;
            var l = values.length;
            off += l - 2;
            while (j < l)
              value += arguments[i++] + values[j++];
            update.fn(value);
          }
          else
            update.fn(arguments[i++]);
        }
        return content;
      };
    }
  };
}

function createDetails(options, template) {
  var info = parsed.get(template) || parsed.set(template, createInfo(options, template));
  return info.updates(import_node_esm.call(document, info.content, true));
}

var empty = [];
function domtagger(options) {
  var previous = empty;
  var updates = cleanContent;
  return function (template) {
    if (previous !== template)
      updates = createDetails(options, (previous = template));
    return updates.apply(null, arguments);
  };
}

function cleanContent(fragment) {
  var childNodes = fragment.childNodes;
  var i = childNodes.length;
  while (i--) {
    var child = childNodes[i];
    if (
      child.nodeType !== 1 &&
      trim_esm.call(child.textContent).length === 0
    ) {
      fragment.removeChild(child);
    }
  }
}

;// ../../node_modules/hyperhtml-style/esm/index.js
/*! (c) Andrea Giammarchi - ISC */
var hyperStyle = (function (){'use strict';
  // from https://github.com/developit/preact/blob/33fc697ac11762a1cb6e71e9847670d047af7ce5/src/varants.js
  var IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i;
  var hyphen = /([^A-Z])([A-Z]+)/g;
  return function hyperStyle(node, original) {
    return 'ownerSVGElement' in node ? svg(node, original) : update(node.style, false);
  };
  function ized($0, $1, $2) {
    return $1 + '-' + $2.toLowerCase();
  }
  function svg(node, original) {
    var style;
    if (original)
      style = original.cloneNode(true);
    else {
      node.setAttribute('style', '--hyper:style;');
      style = node.getAttributeNode('style');
    }
    style.value = '';
    node.setAttributeNode(style);
    return update(style, true);
  }
  function toStyle(object) {
    var key, css = [];
    for (key in object)
      css.push(key.replace(hyphen, ized), ':', object[key], ';');
    return css.join('');
  }
  function update(style, isSVG) {
    var oldType, oldValue;
    return function (newValue) {
      var info, key, styleValue, value;
      switch (typeof newValue) {
        case 'object':
          if (newValue) {
            if (oldType === 'object') {
              if (!isSVG) {
                if (oldValue !== newValue) {
                  for (key in oldValue) {
                    if (!(key in newValue)) {
                      style[key] = '';
                    }
                  }
                }
              }
            } else {
              if (isSVG)
                style.value = '';
              else
                style.cssText = '';
            }
            info = isSVG ? {} : style;
            for (key in newValue) {
              value = newValue[key];
              styleValue = typeof value === 'number' &&
                                  !IS_NON_DIMENSIONAL.test(key) ?
                                  (value + 'px') : value;
              if (!isSVG && /^--/.test(key))
                info.setProperty(key, styleValue);
              else
                info[key] = styleValue;
            }
            oldType = 'object';
            if (isSVG)
              style.value = toStyle((oldValue = info));
            else
              oldValue = newValue;
            break;
          }
        default:
          if (oldValue != newValue) {
            oldType = 'string';
            oldValue = newValue;
            if (isSVG)
              style.value = newValue || '';
            else
              style.cssText = newValue || '';
          }
          break;
      }
    };
  }
}());
/* harmony default export */ const hyperhtml_style_esm = (hyperStyle);

;// ../../node_modules/hyperhtml-wire/esm/index.js
/*! (c) Andrea Giammarchi - ISC */
var Wire = (function (slice, proto) {

  proto = Wire.prototype;

  proto.ELEMENT_NODE = 1;
  proto.nodeType = 111;

  proto.remove = function (keepFirst) {
    var childNodes = this.childNodes;
    var first = this.firstChild;
    var last = this.lastChild;
    this._ = null;
    if (keepFirst && childNodes.length === 2) {
      last.parentNode.removeChild(last);
    } else {
      var range = this.ownerDocument.createRange();
      range.setStartBefore(keepFirst ? childNodes[1] : first);
      range.setEndAfter(last);
      range.deleteContents();
    }
    return first;
  };

  proto.valueOf = function (forceAppend) {
    var fragment = this._;
    var noFragment = fragment == null;
    if (noFragment)
      fragment = (this._ = this.ownerDocument.createDocumentFragment());
    if (noFragment || forceAppend) {
      for (var n = this.childNodes, i = 0, l = n.length; i < l; i++)
        fragment.appendChild(n[i]);
    }
    return fragment;
  };

  return Wire;

  function Wire(childNodes) {
    var nodes = (this.childNodes = slice.call(childNodes, 0));
    this.firstChild = nodes[0];
    this.lastChild = nodes[nodes.length - 1];
    this.ownerDocument = nodes[0].ownerDocument;
    this._ = null;
  }

}([].slice));
/* harmony default export */ const hyperhtml_wire_esm = (Wire);

;// ../../node_modules/hyperhtml/esm/shared/constants.js
// Node.CONSTANTS
// 'cause some engine has no global Node defined
// (i.e. Node, NativeScript, basicHTML ... )
const constants_ELEMENT_NODE = 1;
const constants_DOCUMENT_FRAGMENT_NODE = 11;

// SVG related constants
const OWNER_SVG_ELEMENT = 'ownerSVGElement';

// Custom Elements / MutationObserver constants
const CONNECTED = 'connected';
const DISCONNECTED = 'dis' + CONNECTED;

;// ../../node_modules/hyperhtml/esm/objects/Updates.js
















const componentType = Component.prototype.nodeType;
const wireType = hyperhtml_wire_esm.prototype.nodeType;

const observe = disconnected_esm({Event: custom_event_esm, WeakSet: essential_weakset_esm});



// returns an intent to explicitly inject content as html
const asHTML = html => ({html});

// returns nodes from wires and components
const asNode = (item, i) => {
  switch (item.nodeType) {
    case wireType:
      // in the Wire case, the content can be
      // removed, post-pended, inserted, or pre-pended and
      // all these cases are handled by domdiff already
      /* istanbul ignore next */
      return (1 / i) < 0 ?
        (i ? item.remove(true) : item.lastChild) :
        (i ? item.valueOf(true) : item.firstChild);
    case componentType:
      return asNode(item.render(), i);
    default:
      return item;
  }
}

// returns true if domdiff can handle the value
const canDiff = value => 'ELEMENT_NODE' in value;

// borrowed from uhandlers
// https://github.com/WebReflection/uhandlers
const booleanSetter = (node, key, oldValue) => newValue => {
  if (oldValue !== !!newValue) {
    if ((oldValue = !!newValue))
      node.setAttribute(key, '');
    else
      node.removeAttribute(key);
  }
};

const hyperSetter = (node, name, svg) => svg ?
  value => {
    try {
      node[name] = value;
    }
    catch (nope) {
      node.setAttribute(name, value);
    }
  } :
  value => {
    node[name] = value;
  };

// when a Promise is used as interpolation value
// its result must be parsed once resolved.
// This callback is in charge of understanding what to do
// with a returned value once the promise is resolved.
const invokeAtDistance = (value, callback) => {
  callback(value.placeholder);
  if ('text' in value) {
    Promise.resolve(value.text).then(String).then(callback);
  } else if ('any' in value) {
    Promise.resolve(value.any).then(callback);
  } else if ('html' in value) {
    Promise.resolve(value.html).then(asHTML).then(callback);
  } else {
    Promise.resolve(Intent.invoke(value, callback)).then(callback);
  }
};

// quick and dirty way to check for Promise/ish values
const isPromise_ish = value => value != null && 'then' in value;

// list of attributes that should not be directly assigned
const readOnly = /^(?:form|list)$/i;

// reused every slice time
const Updates_slice = [].slice;

// simplifies text node creation
const Updates_text = (node, text) => node.ownerDocument.createTextNode(text);

function Tagger(type) {
  this.type = type;
  return domtagger_esm(this);
}

Tagger.prototype = {

  // there are four kind of attributes, and related behavior:
  //  * events, with a name starting with `on`, to add/remove event listeners
  //  * special, with a name present in their inherited prototype, accessed directly
  //  * regular, accessed through get/setAttribute standard DOM methods
  //  * style, the only regular attribute that also accepts an object as value
  //    so that you can style=${{width: 120}}. In this case, the behavior has been
  //    fully inspired by Preact library and its simplicity.
  attribute(node, name, original) {
    const isSVG = OWNER_SVG_ELEMENT in node;
    let oldValue;
    // if the attribute is the style one
    // handle it differently from others
    if (name === 'style')
      return hyperhtml_style_esm(node, original, isSVG);
    // direct accessors for <input .value=${...}> and friends
    else if (name.slice(0, 1) === '.')
      return hyperSetter(node, name.slice(1), isSVG);
    // boolean accessors for <input .value=${...}> and friends
    else if (name.slice(0, 1) === '?')
      return booleanSetter(node, name.slice(1));
    // the name is an event one,
    // add/remove event listeners accordingly
    else if (/^on/.test(name)) {
      let type = name.slice(2);
      if (type === CONNECTED || type === DISCONNECTED) {
        observe(node);
      }
      else if (name.toLowerCase()
        in node) {
        type = type.toLowerCase();
      }
      return newValue => {
        if (oldValue !== newValue) {
          if (oldValue)
            node.removeEventListener(type, oldValue, false);
          oldValue = newValue;
          if (newValue)
            node.addEventListener(type, newValue, false);
        }
      };
    }
    // the attribute is special ('value' in input)
    // and it's not SVG *or* the name is exactly data,
    // in this case assign the value directly
    else if (
      name === 'data' ||
      (!isSVG && name in node && !readOnly.test(name))
    ) {
      return newValue => {
        if (oldValue !== newValue) {
          oldValue = newValue;
          if (node[name] !== newValue && newValue == null) {
            // cleanup on null to avoid silly IE/Edge bug
            node[name] = '';
            node.removeAttribute(name);
          }
          else
            node[name] = newValue;
        }
      };
    }
    else if (name in Intent.attributes) {
      oldValue;
      return any => {
        const newValue = Intent.attributes[name](node, any);
        if (oldValue !== newValue) {
          oldValue = newValue;
          if (newValue == null)
            node.removeAttribute(name);
          else
            node.setAttribute(name, newValue);
        }
      };
    }
    // in every other case, use the attribute node as it is
    // update only the value, set it as node only when/if needed
    else {
      let owner = false;
      const attribute = original.cloneNode(true);
      return newValue => {
        if (oldValue !== newValue) {
          oldValue = newValue;
          if (attribute.value !== newValue) {
            if (newValue == null) {
              if (owner) {
                owner = false;
                node.removeAttributeNode(attribute);
              }
              attribute.value = newValue;
            } else {
              attribute.value = newValue;
              if (!owner) {
                owner = true;
                node.setAttributeNode(attribute);
              }
            }
          }
        }
      };
    }
  },

  // in a hyper(node)`<div>${content}</div>` case
  // everything could happen:
  //  * it's a JS primitive, stored as text
  //  * it's null or undefined, the node should be cleaned
  //  * it's a component, update the content by rendering it
  //  * it's a promise, update the content once resolved
  //  * it's an explicit intent, perform the desired operation
  //  * it's an Array, resolve all values if Promises and/or
  //    update the node with the resulting list of content
  any(node, childNodes) {
    const diffOptions = {node: asNode, before: node};
    const nodeType = OWNER_SVG_ELEMENT in node ? /* istanbul ignore next */ 'svg' : 'html';
    let fastPath = false;
    let oldValue;
    const anyContent = value => {
      switch (typeof value) {
        case 'string':
        case 'number':
        case 'boolean':
          if (fastPath) {
            if (oldValue !== value) {
              oldValue = value;
              childNodes[0].textContent = value;
            }
          } else {
            fastPath = true;
            oldValue = value;
            childNodes = domdiff_esm(
              node.parentNode,
              childNodes,
              [Updates_text(node, value)],
              diffOptions
            );
          }
          break;
        case 'function':
          anyContent(value(node));
          break;
        case 'object':
        case 'undefined':
          if (value == null) {
            fastPath = false;
            childNodes = domdiff_esm(
              node.parentNode,
              childNodes,
              [],
              diffOptions
            );
            break;
          }
        default:
          fastPath = false;
          oldValue = value;
          if (is_array_esm(value)) {
            if (value.length === 0) {
              if (childNodes.length) {
                childNodes = domdiff_esm(
                  node.parentNode,
                  childNodes,
                  [],
                  diffOptions
                );
              }
            } else {
              switch (typeof value[0]) {
                case 'string':
                case 'number':
                case 'boolean':
                  anyContent({html: value});
                  break;
                case 'object':
                  if (is_array_esm(value[0])) {
                    value = value.concat.apply([], value);
                  }
                  if (isPromise_ish(value[0])) {
                    Promise.all(value).then(anyContent);
                    break;
                  }
                default:
                  childNodes = domdiff_esm(
                    node.parentNode,
                    childNodes,
                    value,
                    diffOptions
                  );
                  break;
              }
            }
          } else if (canDiff(value)) {
            childNodes = domdiff_esm(
              node.parentNode,
              childNodes,
              value.nodeType === constants_DOCUMENT_FRAGMENT_NODE ?
                Updates_slice.call(value.childNodes) :
                [value],
              diffOptions
            );
          } else if (isPromise_ish(value)) {
            value.then(anyContent);
          } else if ('placeholder' in value) {
            invokeAtDistance(value, anyContent);
          } else if ('text' in value) {
            anyContent(String(value.text));
          } else if ('any' in value) {
            anyContent(value.any);
          } else if ('html' in value) {
            childNodes = domdiff_esm(
              node.parentNode,
              childNodes,
              Updates_slice.call(
                create_content_esm(
                  [].concat(value.html).join(''),
                  nodeType
                ).childNodes
              ),
              diffOptions
            );
          } else if ('length' in value) {
            anyContent(Updates_slice.call(value));
          } else {
            anyContent(Intent.invoke(value, anyContent));
          }
          break;
      }
    };
    return anyContent;
  },

  // style or textareas don't accept HTML as content
  // it's pointless to transform or analyze anything
  // different from text there but it's worth checking
  // for possible defined intents.
  text(node) {
    let oldValue;
    const textContent = value => {
      if (oldValue !== value) {
        oldValue = value;
        const type = typeof value;
        if (type === 'object' && value) {
          if (isPromise_ish(value)) {
            value.then(textContent);
          } else if ('placeholder' in value) {
            invokeAtDistance(value, textContent);
          } else if ('text' in value) {
            textContent(String(value.text));
          } else if ('any' in value) {
            textContent(value.any);
          } else if ('html' in value) {
            textContent([].concat(value.html).join(''));
          } else if ('length' in value) {
            textContent(Updates_slice.call(value).join(''));
          } else {
            textContent(Intent.invoke(value, textContent));
          }
        } else if (type === 'function') {
          textContent(value(node));
        } else {
          node.textContent = value == null ? '' : value;
        }
      }
    };
    return textContent;
  }
};

;// ../../node_modules/@ungap/template-literal/esm/index.js


var isNoOp = typeof document !== 'object';

var templateLiteral = function (tl) {
  var RAW = 'raw';
  var isBroken = function (UA) {
    return /(Firefox|Safari)\/(\d+)/.test(UA) &&
          !/(Chrom[eium]+|Android)\/(\d+)/.test(UA);
  };
  var broken = isBroken((document.defaultView.navigator || {}).userAgent);
  var FTS = !(RAW in tl) ||
            tl.propertyIsEnumerable(RAW) ||
            !Object.isFrozen(tl[RAW]);
  if (broken || FTS) {
    var forever = {};
    var foreverCache = function (tl) {
      for (var key = '.', i = 0; i < tl.length; i++)
        key += tl[i].length + '.' + tl[i];
      return forever[key] || (forever[key] = tl);
    };
    // Fallback TypeScript shenanigans
    if (FTS)
      templateLiteral = foreverCache;
    // try fast path for other browsers:
    // store the template as WeakMap key
    // and forever cache it only when it's not there.
    // this way performance is still optimal,
    // penalized only when there are GC issues
    else {
      var wm = new esm;
      var set = function (tl, unique) {
        wm.set(tl, unique);
        return unique;
      };
      templateLiteral = function (tl) {
        return wm.get(tl) || set(tl, foreverCache(tl));
      };
    }
  } else {
    isNoOp = true;
  }
  return TL(tl);
};

/* harmony default export */ const template_literal_esm = (TL);

function TL(tl) {
  return isNoOp ? tl : templateLiteral(tl);
}

;// ../../node_modules/@ungap/template-tag-arguments/esm/index.js


/* harmony default export */ function template_tag_arguments_esm(template) {
  var length = arguments.length;
  var args = [template_literal_esm(template)];
  var i = 1;
  while (i < length)
    args.push(arguments[i++]);
  return args;
};

/**
 * best benchmark goes here
 * https://jsperf.com/tta-bench
 * I should probably have an @ungap/template-literal-es too
export default (...args) => {
  args[0] = unique(args[0]);
  return args;
};
 */
;// ../../node_modules/hyperhtml/esm/hyper/wire.js







// all wires used per each context
const wires = new esm;

// A wire is a callback used as tag function
// to lazily relate a generic object to a template literal.
// hyper.wire(user)`<div id=user>${user.name}</div>`; => the div#user
// This provides the ability to have a unique DOM structure
// related to a unique JS object through a reusable template literal.
// A wire can specify a type, as svg or html, and also an id
// via html:id or :id convention. Such :id allows same JS objects
// to be associated to different DOM structures accordingly with
// the used template literal without losing previously rendered parts.
const wire = (obj, type) => obj == null ?
  content(type || 'html') :
  weakly(obj, type || 'html');

// A wire content is a virtual reference to one or more nodes.
// It's represented by either a DOM node, or an Array.
// In both cases, the wire content role is to simply update
// all nodes through the list of related callbacks.
// In few words, a wire content is like an invisible parent node
// in charge of updating its content like a bound element would do.
const content = type => {
  let wire, tagger, template;
  return function () {
    const args = template_tag_arguments_esm.apply(null, arguments);
    if (template !== args[0]) {
      template = args[0];
      tagger = new Tagger(type);
      wire = wireContent(tagger.apply(tagger, args));
    } else {
      tagger.apply(tagger, args);
    }
    return wire;
  };
};

// wires are weakly created through objects.
// Each object can have multiple wires associated
// and this is thanks to the type + :id feature.
const weakly = (obj, type) => {
  const i = type.indexOf(':');
  let wire = wires.get(obj);
  let id = type;
  if (-1 < i) {
    id = type.slice(i + 1);
    type = type.slice(0, i) || 'html';
  }
  if (!wire)
    wires.set(obj, wire = {});
  return wire[id] || (wire[id] = content(type));
};

// A document fragment loses its nodes 
// as soon as it is appended into another node.
// This has the undesired effect of losing wired content
// on a second render call, because (by then) the fragment would be empty:
// no longer providing access to those sub-nodes that ultimately need to
// stay associated with the original interpolation.
// To prevent hyperHTML from forgetting about a fragment's sub-nodes,
// fragments are instead returned as an Array of nodes or, if there's only one entry,
// as a single referenced node which, unlike fragments, will indeed persist
// wire content throughout multiple renderings.
// The initial fragment, at this point, would be used as unique reference to this
// array of nodes or to this single referenced node.
const wireContent = node => {
  const childNodes = node.childNodes;
  const {length} = childNodes;
  return length === 1 ?
    childNodes[0] :
    (length ? new hyperhtml_wire_esm(childNodes) : node);
};


/* harmony default export */ const hyper_wire = (wire);

;// ../../node_modules/hyperhtml/esm/hyper/render.js






// a weak collection of contexts that
// are already known to hyperHTML
const bewitched = new esm;

// better known as hyper.bind(node), the render is
// the main tag function in charge of fully upgrading
// or simply updating, contexts used as hyperHTML targets.
// The `this` context is either a regular DOM node or a fragment.
function render() {
  const wicked = bewitched.get(this);
  const args = template_tag_arguments_esm.apply(null, arguments);
  if (wicked && wicked.template === args[0]) {
    wicked.tagger.apply(null, args);
  } else {
    upgrade.apply(this, args);
  }
  return this;
}

// an upgrade is in charge of collecting template info,
// parse it once, if unknown, to map all interpolations
// as single DOM callbacks, relate such template
// to the current context, and render it after cleaning the context up
function upgrade(template) {
  const type = OWNER_SVG_ELEMENT in this ? 'svg' : 'html';
  const tagger = new Tagger(type);
  bewitched.set(this, {tagger, template: template});
  this.textContent = '';
  this.appendChild(tagger.apply(null, arguments));
}

/* harmony default export */ const hyper_render = (render);

;// ../../node_modules/hyperhtml/esm/index.js
/*! (c) Andrea Giammarchi (ISC) */










// all functions are self bound to the right context
// you can do the following
// const {bind, wire} = hyperHTML;
// and use them right away: bind(node)`hello!`;
const bind = context => hyper_render.bind(context);
const esm_define = Intent.define;
const tagger = Tagger.prototype;

hyper.Component = Component;
hyper.bind = bind;
hyper.define = esm_define;
hyper.diff = domdiff_esm;
hyper.hyper = hyper;
hyper.observe = observe;
hyper.tagger = tagger;
hyper.wire = hyper_wire;

// exported as shared utils
// for projects based on hyperHTML
// that don't necessarily need upfront polyfills
// i.e. those still targeting IE
hyper._ = {
  WeakMap: esm,
  WeakSet: essential_weakset_esm
};

// the wire content is the lazy defined
// html or svg property of each hyper.Component
setup(content);

// everything is exported directly or through the
// hyperHTML callback, when used as top level script


// by default, hyperHTML is a smart function
// that "magically" understands what's the best
// thing to do with passed arguments
function hyper(HTML) {
  return arguments.length < 2 ?
    (HTML == null ?
      content('html') :
      (typeof HTML === 'string' ?
        hyper.wire(null, HTML) :
        ('raw' in HTML ?
          content('html')(HTML) :
          ('nodeType' in HTML ?
            hyper.bind(HTML) :
            weakly(HTML, 'html')
          )
        )
      )) :
    ('raw' in HTML ?
      content('html') : hyper.wire
    ).apply(null, arguments);
}

;// ../../node_modules/hyperhtml-element/esm/index.js
/*! (C) 2017-2018 Andrea Giammarchi - ISC Style License */



// utils to deal with custom elements builtin extends
const ATTRIBUTE_CHANGED_CALLBACK = 'attributeChangedCallback';
const O = Object;
const classes = [];
const defineProperty = O.defineProperty;
const getOwnPropertyDescriptor = O.getOwnPropertyDescriptor;
const getOwnPropertyNames = O.getOwnPropertyNames;
/* istanbul ignore next */
const getOwnPropertySymbols = O.getOwnPropertySymbols || (() => []);
/* istanbul ignore next */
const getPrototypeOf = O.getPrototypeOf || (o => o.__proto__);
/* istanbul ignore next */
const ownKeys = typeof Reflect === 'object' && Reflect.ownKeys ||
                (o => getOwnPropertyNames(o).concat(getOwnPropertySymbols(o)));
/* istanbul ignore next */
const setPrototypeOf = O.setPrototypeOf ||
                      ((o, p) => (o.__proto__ = p, o));
/* istanbul ignore stop */
const camel = name => name.replace(/-([a-z])/g, ($0, $1) => $1.toUpperCase());
const {attachShadow} = HTMLElement.prototype;
const sr = new WeakMap;

class HyperHTMLElement extends HTMLElement {

  // define a custom-element in the CustomElementsRegistry
  // class MyEl extends HyperHTMLElement {}
  // MyEl.define('my-el');
  static define(name, options) {
    const Class = this;
    const proto = Class.prototype;

    const onChanged = proto[ATTRIBUTE_CHANGED_CALLBACK];
    const hasChange = !!onChanged;

    // Class.booleanAttributes
    // -----------------------------------------------
    // attributes defined as boolean will have
    // an either available or not available attribute
    // regardless of the value.
    // All falsy values, or "false", mean attribute removed
    // while truthy values will be set as is.
    // Boolean attributes are also automatically observed.
    const booleanAttributes = Class.booleanAttributes || [];
    booleanAttributes.forEach(attribute => {
      const name = camel(attribute);
      if (!(name in proto)) defineProperty(
        proto,
        name,
        {
          configurable: true,
          get() {
            return this.hasAttribute(attribute);
          },
          set(value) {
            if (!value || value === 'false')
              this.removeAttribute(attribute);
            else
              this.setAttribute(attribute, '');
          }
        }
      );
    });

    // Class.observedAttributes
    // -------------------------------------------------------
    // HyperHTMLElement will directly reflect get/setAttribute
    // operation once these attributes are used, example:
    // el.observed = 123;
    // will automatically do
    // el.setAttribute('observed', 123);
    // triggering also the attributeChangedCallback
    const observedAttributes = (Class.observedAttributes || []).filter(
      attribute => booleanAttributes.indexOf(attribute) < 0
    );
    observedAttributes.forEach(attribute => {
      // it is possible to redefine the behavior at any time
      // simply overwriting get prop() and set prop(value)
      const name = camel(attribute);
      if (!(name in proto)) defineProperty(
        proto,
        name,
        {
          configurable: true,
          get() {
            return this.getAttribute(attribute);
          },
          set(value) {
            if (value == null)
              this.removeAttribute(attribute);
            else
              this.setAttribute(attribute, value);
          }
        }
      );
    });

    // if these are defined, overwrite the observedAttributes getter
    // to include also booleanAttributes
    const attributes = booleanAttributes.concat(observedAttributes);
    if (attributes.length)
      defineProperty(Class, 'observedAttributes', {
        get() { return attributes; }
      });

    // created() {}
    // ---------------------------------
    // an initializer method that grants
    // the node is fully known to the browser.
    // It is ensured to run either after DOMContentLoaded,
    // or once there is a next sibling (stream-friendly) so that
    // you have full access to element attributes and/or childNodes.
    const created = proto.created || function () {
      this.render();
    };

    // used to ensure create() is called once and once only
    defineProperty(
      proto,
      '_init$',
      {
        configurable: true,
        writable: true,
        value: true
      }
    );

    defineProperty(
      proto,
      ATTRIBUTE_CHANGED_CALLBACK,
      {
        configurable: true,
        value: function aCC(name, prev, curr) {
          if (this._init$) {
            checkReady.call(this, created, attributes, booleanAttributes);
            if (this._init$)
              return this._init$$.push(aCC.bind(this, name, prev, curr));
          }
          // ensure setting same value twice
          // won't trigger twice attributeChangedCallback
          if (hasChange && prev !== curr) {
            onChanged.apply(this, arguments);
          }
        }
      }
    );

    const onConnected = proto.connectedCallback;
    const hasConnect = !!onConnected;
    defineProperty(
      proto,
      'connectedCallback',
      {
        configurable: true,
        value: function cC() {
          if (this._init$) {
            checkReady.call(this, created, attributes, booleanAttributes);
            if (this._init$)
              return this._init$$.push(cC.bind(this));
          }
          if (hasConnect) {
            onConnected.apply(this, arguments);
          }
        }
      }
    );

    // define lazily all handlers
    // class { handleClick() { ... }
    // render() { `<a onclick=${this.handleClick}>` } }
    getOwnPropertyNames(proto).forEach(key => {
      if (/^handle[A-Z]/.test(key)) {
        const _key$ = '_' + key + '$';
        const method = proto[key];
        defineProperty(proto, key, {
          configurable: true,
          get() {
            return  this[_key$] ||
                    (this[_key$] = method.bind(this));
          }
        });
      }
    });

    // whenever you want to directly use the component itself
    // as EventListener, you can pass it directly.
    // https://medium.com/@WebReflection/dom-handleevent-a-cross-platform-standard-since-year-2000-5bf17287fd38
    //  class Reactive extends HyperHTMLElement {
    //    oninput(e) { console.log(this, 'changed', e.target.value); }
    //    render() { this.html`<input oninput="${this}">`; }
    //  }
    if (!('handleEvent' in proto)) {
      defineProperty(
        proto,
        'handleEvent',
        {
          configurable: true,
          value(event) {
            this[
              (event.currentTarget.dataset || {}).call ||
              ('on' + event.type)
            ](event);
          }
        }
      );
    }

    if (options && options.extends) {
      const Native = document.createElement(options.extends).constructor;
      const Intermediate = class extends Native {};
      const ckeys = ['length', 'name', 'arguments', 'caller', 'prototype'];
      const pkeys = [];
      let Super = null;
      let BaseClass = Class;
      while (Super = getPrototypeOf(BaseClass)) {
        [
          {target: Intermediate, base: Super, keys: ckeys},
          {target: Intermediate.prototype, base: Super.prototype, keys: pkeys}
        ]
        .forEach(({target, base, keys}) => {
          ownKeys(base)
            .filter(key => keys.indexOf(key) < 0)
            .forEach((key) => {
              keys.push(key);
              defineProperty(
                target,
                key,
                getOwnPropertyDescriptor(base, key)
              );
            });
        });

        BaseClass = Super;
        if (Super === HyperHTMLElement)
          break;
      }
      setPrototypeOf(Class, Intermediate);
      setPrototypeOf(proto, Intermediate.prototype);
      customElements.define(name, Class, options);
    } else {
      customElements.define(name, Class);
    }
    classes.push(Class);
    return Class;
  }

  // weakly relate the shadowRoot for refs usage
  attachShadow() {
    const shadowRoot = attachShadow.apply(this, arguments);
    sr.set(this, shadowRoot);
    return shadowRoot;
  }

  // returns elements by ref
  get refs() {
    const value = {};
    if ('_html$' in this) {
      const all = (sr.get(this) || this).querySelectorAll('[ref]');
      for (let {length} = all, i = 0; i < length; i++) {
        const node = all[i];
        value[node.getAttribute('ref')] = node;
      }
      Object.defineProperty(this, 'refs', {value});
      return value;
    }
    return value;
  }

  // lazily bind once hyperHTML logic
  // to either the shadowRoot, if present and open,
  // the _shadowRoot property, if set due closed shadow root,
  // or the custom-element itself if no Shadow DOM is used.
  get html() {
    return this._html$ || (this.html = bind(
      // in a way or another, bind to the right node
      // backward compatible, first two could probably go already
      this.shadowRoot || this._shadowRoot || sr.get(this) || this
    ));
  }

  // it can be set too if necessary, it won't invoke render()
  set html(value) {
    defineProperty(this, '_html$', {configurable: true, value: value});
  }

  // overwrite this method with your own render
  render() {}

  // ---------------------//
  // Basic State Handling //
  // ---------------------//

  // define the default state object
  // you could use observed properties too
  get defaultState() { return {}; }

  // the state with a default
  get state() {
    return this._state$ || (this.state = this.defaultState);
  }

  // it can be set too if necessary, it won't invoke render()
  set state(value) {
    defineProperty(this, '_state$', {configurable: true, value: value});
  }

  // currently a state is a shallow copy, like in Preact or other libraries.
  // after the state is updated, the render() method will be invoked.
  // ⚠️ do not ever call this.setState() inside this.render()
  setState(state, render) {
    const target = this.state;
    const source = typeof state === 'function' ? state.call(this, target) : state;
    for (const key in source) target[key] = source[key];
    if (render !== false) this.render();
    return this;
  }

};

// exposing hyperHTML utilities
HyperHTMLElement.Component = Component;
HyperHTMLElement.bind = bind;
HyperHTMLElement.intent = esm_define;
HyperHTMLElement.wire = hyper_wire;
HyperHTMLElement.hyper = hyper;

try {
  if (Symbol.hasInstance) classes.push(
    defineProperty(HyperHTMLElement, Symbol.hasInstance, {
      enumerable: false,
      configurable: true,
      value(instance) {
        return classes.some(esm_isPrototypeOf, getPrototypeOf(instance));
      }
    }));
} catch(meh) {}

/* harmony default export */ const hyperhtml_element_esm = (HyperHTMLElement);

// ------------------------------//
// DOMContentLoaded VS created() //
// ------------------------------//
const dom = {
  type: 'DOMContentLoaded',
  handleEvent() {
    if (dom.ready()) {
      document.removeEventListener(dom.type, dom, false);
      dom.list.splice(0).forEach(invoke);
    }
    else
      setTimeout(dom.handleEvent);
  },
  ready() {
    return document.readyState === 'complete';
  },
  list: []
};

if (!dom.ready()) {
  document.addEventListener(dom.type, dom, false);
}

function checkReady(created, attributes, booleanAttributes) {
  if (dom.ready() || isReady.call(this, created, attributes, booleanAttributes)) {
    if (this._init$) {
      const list = this._init$$ || [];
      delete this._init$$;
      const self = defineProperty(this, '_init$', {value: false});
      booleanAttributes.forEach(name => {
        if (self.getAttribute(name) === 'false')
          self.removeAttribute(name);
      });
      attributes.forEach(name => {
        if (self.hasOwnProperty(name)) {
          const curr = self[name];
          delete self[name];
          list.unshift(() => { self[name] = curr; });
        }
      });
      created.call(self);
      list.forEach(invoke);
    }
  } else {
    if (!this.hasOwnProperty('_init$$'))
      defineProperty(this, '_init$$', {configurable: true, value: []});
    dom.list.push(checkReady.bind(this, created, attributes, booleanAttributes));
  }
}

function invoke(fn) {
  fn();
}

function esm_isPrototypeOf(Class) {
  return this === Class.prototype;
}

function isReady(created, attributes, booleanAttributes) {
  let el = this;
  do { if (el.nextSibling) return true; }
  while (el = el.parentNode);
  setTimeout(checkReady.bind(this, created, attributes, booleanAttributes));
  return false;
}

;// ./js/io-element.mjs
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */





// common DOM utilities exposed as IOElement.utils
const DOMUtils = {
  // boolean related operations/helpers
  boolean: {
    // utils.boolean.attribute(node, name, setAsTrue):void
    // set a generic node attribute name as "true"
    // if value is a boolean one or it removes the attribute
    attribute(node, name, setAsTrue) {
      // don't use `this.value(value)` with `this` as context
      // to make destructuring of helpers always work.
      // @example
      // const {attribute: setBoolAttr} = IOElement.utils.boolean;
      // setBoolAttr(node, 'test', true);
      if (DOMUtils.boolean.value(setAsTrue)) {
        node.setAttribute(name, "true");
      } else {
        node.removeAttribute(name);
      }
    },

    // utils.boolean.value(any):boolean
    // it returns either true or false
    // via truthy or falsy values, but also via strings
    // representing "true", "false" as well as "0" or "1"
    value(value) {
      if (typeof value === "string" && value.length) {
        try {
          value = JSON.parse(value);
        } catch (error) {
          // Ignore invalid JSON to continue using value as string
        }
      }
      return !!value;
    }
  },

  event: {
    // returns true if it's a left click or a touch event.
    // The left mouse button value is 0 and this
    // is compatible with pointers/touch events
    // where `button` might not be there.
    isLeftClick(event) {
      const re = /^(?:click|mouse|touch|pointer)/;
      return re.test(event.type) && !event.button;
    }
  }
};

// provides a unique-id suffix per each component
let counter = 0;

// common Custom Element class to extend
class IOElement extends hyperhtml_element_esm {
  // exposes DOM helpers as read only utils
  static get utils() {
    return DOMUtils;
  }

  // get a unique ID or, if null, set one and returns it
  static getID(element) {
    return element.getAttribute("id") || IOElement.setID(element);
  }

  // set a unique ID to a generic element and returns the ID
  static setID(element) {
    const id = `${element.nodeName.toLowerCase()}-${counter++}`;
    element.setAttribute("id", id);
    return id;
  }

  // lazily retrieve or define a custom element ID
  get id() {
    return IOElement.getID(this);
  }

  // returns true only when the component is live and styled
  get ready() {
    return !!this.offsetParent && this.isStyled();
  }

  // whenever an element is created, render its content once
  created() {
    this.render();
  }

  // based on a `--component-name: ready;` convention
  // under the `component-name {}` related stylesheet,
  // this method returns true only if such stylesheet
  // has been already loaded.
  isStyled() {
    const computed = window.getComputedStyle(this, null);
    const property = "--" + this.nodeName.toLowerCase();
    // in some case Edge returns '#fff' instead of ready
    return computed.getPropertyValue(property).trim() !== "";
  }

  // by default, render is a no-op
  render() {}

  // usually a template would contain a main element such
  // input, button, div, section, etc.
  // having a simple way to retrieve such element can be
  // both semantic and handy, as opposite of using
  // this.children[0] each time
  get child() {
    let element = this.firstElementChild;
    // if accessed too early, will render automatically
    if (!element) {
      this.render();
      element = this.firstElementChild;
    }
    return element;
  }
}

// whenever an interpolation with ${{i18n: 'string-id'}} is found
// transform such value into the expected content
// example:
//  render() {
//    return this.html`<div>${{i18n:'about-abp'}}</div>`;
//  }
IOElement.intent("i18n", (idOrArgs) => {
  const fragment = document.createDocumentFragment();
  if (typeof idOrArgs === "string") setElementText(fragment, idOrArgs);
  else if (idOrArgs instanceof Array) setElementText(fragment, ...idOrArgs);
  return fragment;
});

/* harmony default export */ const io_element = (IOElement);

;// ./js/io-steps.mjs
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



// a three steps example:
// <io-steps i18n-labels="first second third" />
class IOSteps extends io_element {
  static get observedAttributes() {
    return ["i18n-labels"];
  }

  created() {
    io_steps_reset.call(this);
  }

  attributeChangedCallback() {
    // reset setup
    io_steps_reset.call(this);
    // attributes can have spaces or new lines too
    for (const label of this.i18nLabels.split(/[\n ]+/)) {
      const trimmed = label.trim();
      if (trimmed.length) {
        this.labels.push(browser.i18n.getMessage(trimmed));
      }
    }
    this.render();
  }

  // return the amount of enabled steps
  get enabled() {
    return this._enabled;
  }

  // return true or false accordingly if an index/step
  // has been already completed.
  getCompleted(index) {
    return index < this._enabled;
  }

  // set an index completed state
  // by default, completed is true
  setCompleted(index, completed = true) {
    if (index < 0) index = this.children.length + index;
    this.children[index].classList.toggle("completed", completed);
    if (completed && index < this.labels.length && this._enabled <= index) {
      this._enabled = index + 1;
      this.render();
    }
  }

  // dispatch a "step:click" event providing
  // the clicked index as event.detail property
  onclick(event) {
    event.preventDefault();
    event.stopPropagation();
    const indexOf = Array.prototype.indexOf;
    this.dispatchEvent(
      new CustomEvent("step:click", {
        bubbles: true,
        detail: indexOf.call(this.children, event.currentTarget)
      })
    );
  }

  render() {
    this.html`${this.labels.map(getButton, this)}`;
  }
}

const { wire: io_steps_wire } = io_element;
function getButton(label, index) {
  // each click dispatches change event
  // data-value is used to show the number
  return io_steps_wire(this, `:${index}`)`
    <button
      onclick="${this}"
      disabled="${index > this._enabled}"
      data-value="${index + 1}"
    >${label}</button>`;
}

function io_steps_reset() {
  // amount of enabled lables, starts from at least one
  this._enabled = 0;
  // all the labels, passed as list
  this.labels = [];
}

IOSteps.define("io-steps");

;// ./js/drawing-handler.mjs
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */




// use native requestIdleCallback where available, fallback to setTimeout
const requestIdleCb = window.requestIdleCallback || setTimeout;

// at this point this is just a helper class
// for op-highlighter component but it could
// become a generic draw-on-canvas helper too
class DrawingHandler {
  constructor(canvas, maxSize) {
    this.paths = new Set();
    this.canvas = canvas;
    this.maxSize = maxSize;

    // the canvas needs proper width and height
    const canvasRect = canvas.getBoundingClientRect();
    canvas.width = canvasRect.width;
    canvas.height = canvasRect.height;

    // define a ratio that will produce an image with at least
    // 800px (maxSize) width and multiply by the device pixel ratio
    // to preserve the image quality on HiDPi screens.
    this.ratio = (maxSize / canvas.width) * (window.devicePixelRatio || 1);

    // it also needs to intercept all events
    if ("onpointerup" in canvas) {
      // the instance is the handler itself, no need to bind anything
      canvas.addEventListener("pointerdown", this, { passive: false });
      canvas.addEventListener("pointermove", this, { passive: false });
      canvas.addEventListener("pointerup", this, { passive: false });
      document.addEventListener("pointerup", this, { passive: false });
    } else {
      // some browser might not have pointer events.
      // the fallback should be regular mouse events
      this.onmousedown = this.onpointerdown;
      this.onmousemove = this.onpointermove;
      this.onmouseup = this.onpointerup;
      canvas.addEventListener("mousedown", this, { passive: false });
      canvas.addEventListener("mousemove", this, { passive: false });
      canvas.addEventListener("mouseup", this, { passive: false });
      document.addEventListener("mouseup", this, { passive: false });
    }
  }

  // draws an image and it starts processing its data
  // in an asynchronous, not CPU greedy, way.
  // It returns a promise that will resolve only
  // once the image has been fully processed.
  // Meanwhile, it is possible to draw rectangles on top.
  changeColorDepth(image) {
    this.clear();
    const { naturalWidth, naturalHeight } = image;
    const canvasWidth = this.canvas.width * this.ratio;
    const canvasHeight = (canvasWidth * naturalHeight) / naturalWidth;
    // resize the canvas to the displayed image size
    // to preserve HiDPi pixels
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;
    // force its computed size in normal CSS pixels
    this.canvas.style.width = Math.round(canvasWidth / this.ratio) + "px";
    this.canvas.style.height = Math.round(canvasHeight / this.ratio) + "px";
    // draw resized image accordingly with new dimensions
    this.ctx.drawImage(
      image,
      0,
      0,
      naturalWidth,
      naturalHeight,
      0,
      0,
      canvasWidth,
      canvasHeight
    );
    // collect all info to process the iamge data
    this.imageData = this.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data = this.imageData.data;
    const length = data.length;
    const mapping = [0x00, 0x55, 0xaa, 0xff];
    // don't loop all pixels at once, assuming devices
    // capable of HiDPi images have also enough power
    // to handle all those pixels.
    const avoidBlocking = Math.round(5000 * this.ratio);
    return new Promise((resolve) => {
      const remap = (i) => {
        for (; i < length; i++) {
          data[i] = mapping[data[i] >> 6];
          if (i > 0 && i % avoidBlocking == 0) {
            notifyColorDepthChanges.call(this, i, length);
            // faster when possible, otherwise less intrusive
            // than a promise based on setTimeout as in legacy code
            return requestIdleCb(() => {
              this.draw();
              requestIdleCb(() => remap(i + 1));
            });
          }
        }
        notifyColorDepthChanges.call(this, i, length);
        resolve();
      };
      remap(0);
    });
  }

  // setup the context the first time, and clean the area
  clear() {
    if (!this.ctx) {
      this.ctx = this.canvas.getContext("2d");
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.lineJoin = "round";
    this.ctx.strokeStyle = "#ED1E45";
    this.ctx.fillStyle = "#000";
    this.ctx.lineWidth = 4 * this.ratio;
  }

  // draw the image during or after it's being processed
  // and draw on top all rectangles
  draw() {
    this.clear();
    if (this.imageData) {
      this.ctx.putImageData(this.imageData, 0, 0);
    }
    for (const rect of this.paths) {
      const method = `${rect.type}Rect`;
      this.ctx[method](
        rect.x * this.ratio,
        rect.y * this.ratio,
        rect.width * this.ratio,
        rect.height * this.ratio
      );
    }
  }

  // central event dispatcher
  // https://dom.spec.whatwg.org/#interface-eventtarget
  handleEvent(event) {
    this[`on${event.type}`](event);
  }

  // pointer events to draw on canvas
  onpointerdown(event) {
    // avoid multiple pointers/fingers
    if (this.drawing || !io_element.utils.event.isLeftClick(event)) return;

    // react only if not drawing already
    stopEvent(event);
    this.drawing = true;
    const start = relativeCoordinates(event);
    // set current rect to speed up coordinates updates
    this.rect = {
      type: this.mode,
      x: start.x,
      y: start.y,
      width: 0,
      height: 0
    };
    this.paths.add(this.rect);
  }

  onpointermove(event) {
    // only if drawing
    if (!this.drawing) return;

    // update the current rect coordinates
    stopEvent(event);
    this.updateRect(event);
    // update the canvas view
    this.draw();
  }

  onpointerup(event) {
    // drop only if drawing
    // avoid issues when this event happens
    // outside the expected DOM node (or outside the browser)
    if (!this.drawing) return;

    stopEvent(event);
    if (event.currentTarget === this.canvas) {
      this.updateRect(event);
    }
    this.draw();
    this.drawing = false;

    // get out of here if the mouse didn't move at all
    if (!this.rect.width && !this.rect.height) {
      // also drop current rect from the list: it's useless.
      this.paths.delete(this.rect);
      return;
    }
    const rect = this.rect;
    const parent = this.canvas.parentNode;
    const closeCoords = getRelativeCoordinates(this.canvas, rect, {
      x: rect.x + rect.width,
      y: rect.y + rect.height
    });

    // use the DOM to show the close event
    //  - always visible, even outside the canvas
    //  - no need to re-invent hit-test coordinates
    //  - no need to redraw without closers later on
    parent.appendChild(io_element.wire()`
      <span
        class="closer"
        onclick="${(evt) => {
          if (!io_element.utils.event.isLeftClick(evt)) return;
          // when clicked, remove the related rectangle
          // and draw the canvas again
          stopEvent(evt);
          parent.removeChild(evt.currentTarget);
          this.paths.delete(rect);
          this.draw();
        }}"
        style="${{
          // always top right corner
          top: closeCoords.y + "px",
          left: closeCoords.x + "px"
        }}"
      >
        <img src="/skin/icons/close.svg" />
      </span>`);
  }

  // update current rectangle size
  updateRect(event) {
    const coords = relativeCoordinates(event);
    this.rect.width = coords.x - this.rect.x;
    this.rect.height = coords.y - this.rect.y;
  }
}

function notifyColorDepthChanges(value, max) {
  const info = { detail: { value, max } };
  const ioHighlighter = this.canvas.closest("io-highlighter");
  ioHighlighter.dispatchEvent(new CustomEvent("changecolordepth", info));
}

// helper to retrieve absolute page coordinates
// of a generic target node
function getRelativeCoordinates(canvas, start, end) {
  const x = Math.max(start.x, end.x) + canvas.offsetLeft;
  const y = Math.min(start.y, end.y) + canvas.offsetTop;
  return { x: Math.round(x), y: Math.round(y) };
}

// prevent events from doing anything
// in the current node, and every parent too
function stopEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

/* harmony default export */ const drawing_handler = (DrawingHandler);

;// ./js/io-highlighter.mjs
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */





// <io-highlighter data-max-size=800 />
class IOHighlighter extends io_element {
  // define an initial state per each new instance
  // https://viperhtml.js.org/hyperhtml/documentation/#components-2
  get defaultState() {
    return { drawing: "", changeDepth: null };
  }

  // resolves once the image depth has been fully changed
  // comp.changeDepth.then(...)
  get changeDepth() {
    return this.state.changeDepth;
  }

  // returns true if there were hidden/highlighted areas
  get edited() {
    return this.drawingHandler ? this.drawingHandler.paths.size > 0 : false;
  }

  // process an image and setup changeDepth promise
  // returns the component for chainability sake
  // comp.edit(imageOrString).changeDepth.then(...);
  edit(source) {
    return this.setState({
      changeDepth: new Promise((res, rej) => {
        const changeDepth = (image) => {
          this.drawingHandler.changeColorDepth(image).then(res, rej);
        };

        if (typeof source === "string") {
          // create an image and use the source as data
          const img = this.ownerDocument.createElement("img");
          img.onload = () => changeDepth(img);
          img.onerror = rej;
          img.src = source;
        } else {
          // assume the source is an Image already
          // (or anything that can be drawn on a canvas)
          changeDepth(source);
        }
      })
    });
  }

  // the component content (invoked automatically on state change too)
  render() {
    if (this.state.drawing) this.setAttribute("drawing", this.state.drawing);
    else this.removeAttribute("drawing");

    this.html`
    <div class="split">
      <div class="options">
        <button
          tabindex="-1"
          class="highlight"
          onclick="${(event) => {
            if (io_element.utils.event.isLeftClick(event))
              changeMode(this, "highlight");
          }}"
        >
          ${{ i18n: "issueReporter_screenshot_highlight" }}
        </button>
        <button
          tabindex="-1"
          class="hide"
          onclick="${(event) => {
            if (io_element.utils.event.isLeftClick(event))
              changeMode(this, "hide");
          }}"
        >
          ${{ i18n: "issueReporter_screenshot_hide" }}
        </button>
      </div>
      <canvas />
    </div>`;

    // first time only, initialize the DrawingHandler
    // through the newly created canvas
    if (!this.drawingHandler)
      this.drawingHandler = new drawing_handler(
        $("canvas", this),
        parseInt(this.dataset.maxSize, 10) || 800
      );
  }

  // shortcut for internal canvas.toDataURL()
  toDataURL() {
    return $("canvas", this).toDataURL();
  }
}

IOHighlighter.define("io-highlighter");

const changeMode = (self, mode) => {
  const drawing = self.state.drawing === mode ? "" : mode;
  self.drawingHandler.mode = mode === "hide" ? "fill" : "stroke";
  self.setState({ drawing });
};

;// ./js/pages/issue-reporter/redesign/steps-manager.mjs
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */



// both components are needed,
// and handled, by this file



// managers are invoked right away
// but their initialization might be asynchronous
const managers = [
  // First page: Combined screenshot + issue type selection
  // User must select an issue type to continue, then consent via modal
  ({ ioSteps, page, index, screenshot }) => {
    const screenshotContainer = $("#screenshotContainer");
    const consentModal = $("#screenshotConsentModal");
    const consentConfirm = $("#consentConfirm");
    const consentCancel = $("#consentCancel");
    const modalBackdrop = consentModal?.querySelector(".modal-backdrop");

    // Initialize highlighter immediately since screenshot is always included
    const ioHighlighter = document.createElement("io-highlighter");
    screenshotContainer.appendChild(ioHighlighter);
    ioHighlighter.edit(screenshot);

    let issueTypeSelected = false;
    let screenshotConsentGiven = false;

    // Show modal when trying to continue
    const showConsentModal = () => {
      if (consentModal) {
        consentModal.hidden = false;
      }
    };

    // Hide modal
    const hideConsentModal = () => {
      if (consentModal) {
        consentModal.hidden = true;
      }
    };

    // Handle consent confirm
    if (consentConfirm) {
      consentConfirm.addEventListener("click", () => {
        screenshotConsentGiven = true;
        hideConsentModal();
        // Now actually proceed to next step
        ioSteps.dispatchEvent(
          new CustomEvent("step:click", { detail: index + 1 })
        );
      });
    }

    // Handle consent cancel
    if (consentCancel) {
      consentCancel.addEventListener("click", hideConsentModal);
    }

    // Handle backdrop click to close
    if (modalBackdrop) {
      modalBackdrop.addEventListener("click", hideConsentModal);
    }

    // Listen for issue type selection
    page.addEventListener("change", (event) => {
      if (event.target.name === "type") {
        issueTypeSelected = true;
        ioSteps.setCompleted(index, true);
        enableContinue();
      }
    });

    // Intercept continue button to show modal first
    const btnContinue = $("#continue");
    btnContinue.addEventListener(
      "click",
      (event) => {
        // Only intercept on first page and if consent not yet given
        if (!screenshotConsentGiven && issueTypeSelected) {
          event.stopImmediatePropagation();
          showConsentModal();
        }
      },
      true
    ); // Use capture to intercept before other handlers
  },

  // Second page: Details (comment + include config)
  // Always valid - user can proceed with or without comment
  ({ ioSteps, page, index }) => {
    ioSteps.addEventListener("step:click", function once(event) {
      if (event.detail !== index) return;
      ioSteps.removeEventListener(event.type, once);

      // Details page is always valid - comment is optional
      ioSteps.setCompleted(index, true);
      enableContinue();
    });

    // Also listen for when data collection is complete
    ioSteps.addEventListener("requestcollected", () => {
      // Data is ready, can proceed to review
    });
  },

  // Third page: Review and send
  // Shows preview and allows user to send the report
  ({ ioSteps, page, index, resolve }) => {
    const reportConsent = $("#reportConsent");
    const sendButton = $("#send");

    // Update send button state based on consent
    const updateSendButtonState = () => {
      sendButton.disabled = !reportConsent || !reportConsent.checked;
    };

    // Listen for consent checkbox changes
    if (reportConsent) {
      reportConsent.addEventListener("change", updateSendButtonState);
    }

    ioSteps.addEventListener("step:click", function once(event) {
      if (event.detail !== index) return;
      ioSteps.removeEventListener(event.type, once);

      // Show send button, hide continue
      $("#continue").hidden = true;
      sendButton.hidden = false;
      // Send button disabled until consent is given
      updateSendButtonState();
      ioSteps.setCompleted(index, true);
    });

    // Handle send button click
    sendButton.addEventListener("click", function sendOnce() {
      sendButton.removeEventListener("click", sendOnce);
      sendButton.disabled = true;
      $("#back").hidden = true;
      $("#cancel").disabled = true;
      $("#cancel").hidden = true;

      // Hide review page heading/description during send
      const reviewHeading = page.querySelector("h1");
      const reviewDescription = page.querySelector("h1 + p");
      if (reviewHeading) reviewHeading.hidden = true;
      if (reviewDescription) reviewDescription.hidden = true;

      // Show sending state, hide preview
      $("#reportPreview").hidden = true;
      $("#sendingState").hidden = false;

      const ioHighlighter = $("io-highlighter");
      ioHighlighter.changeDepth.then(() => {
        resolve({
          screenshot: {
            get edited() {
              return ioHighlighter.edited;
            },
            get data() {
              return ioHighlighter.toDataURL();
            }
          }
        });
      });
    });
  }
];

const stepManager = ({ screenshot }) =>
  new Promise((resolve) => {
    const ioSteps = $("io-steps");
    const pages = $$("main > .page");
    const btnContinue = $("#continue");
    const btnBack = $("#back");
    let currentPage = pages[0];
    let index = 0;

    // Set initial page state
    document.body.setAttribute("data-page", currentPage.id);

    ioSteps.addEventListener("step:click", (event) => {
      index = event.detail;
      const nextPage = pages[index];
      if (nextPage === currentPage) return;
      currentPage.hidden = true;
      currentPage = nextPage;
      currentPage.hidden = false;
      document.body.setAttribute("data-page", nextPage.id);

      // Update button states
      btnContinue.disabled = !ioSteps.getCompleted(index);
      btnBack.hidden = index === 0;
    });

    btnContinue.addEventListener("click", (event) => {
      ioSteps.dispatchEvent(
        new CustomEvent("step:click", { detail: index + 1 })
      );
    });

    btnBack.addEventListener("click", (event) => {
      if (index > 0) {
        ioSteps.dispatchEvent(
          new CustomEvent("step:click", { detail: index - 1 })
        );
        // Re-show continue button if going back from review page
        $("#continue").hidden = false;
        $("#send").hidden = true;
      }
    });

    managers.forEach((setup, i) => {
      setup({ ioSteps, page: pages[i], index: i, resolve, screenshot });
    });
  });

function enableContinue() {
  $("#continue").disabled = false;
}

/* harmony default export */ const steps_manager = (stepManager);

// EXTERNAL MODULE: ../../node_modules/@eyeo/webext-ad-filtering-solution/dist/ewe-ui.js
var ewe_ui = __webpack_require__(2181);
// EXTERNAL MODULE: ../../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js
var injectStylesIntoStyleTag = __webpack_require__(3465);
var injectStylesIntoStyleTag_default = /*#__PURE__*/__webpack_require__.n(injectStylesIntoStyleTag);
// EXTERNAL MODULE: ../../node_modules/style-loader/dist/runtime/styleDomAPI.js
var styleDomAPI = __webpack_require__(6622);
var styleDomAPI_default = /*#__PURE__*/__webpack_require__.n(styleDomAPI);
// EXTERNAL MODULE: ../../node_modules/style-loader/dist/runtime/insertBySelector.js
var insertBySelector = __webpack_require__(5814);
var insertBySelector_default = /*#__PURE__*/__webpack_require__.n(insertBySelector);
// EXTERNAL MODULE: ../../node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js
var setAttributesWithoutAttributes = __webpack_require__(9337);
var setAttributesWithoutAttributes_default = /*#__PURE__*/__webpack_require__.n(setAttributesWithoutAttributes);
// EXTERNAL MODULE: ../../node_modules/style-loader/dist/runtime/insertStyleElement.js
var insertStyleElement = __webpack_require__(2389);
var insertStyleElement_default = /*#__PURE__*/__webpack_require__.n(insertStyleElement);
// EXTERNAL MODULE: ../../node_modules/style-loader/dist/runtime/styleTagTransform.js
var styleTagTransform = __webpack_require__(8722);
var styleTagTransform_default = /*#__PURE__*/__webpack_require__.n(styleTagTransform);
// EXTERNAL MODULE: ./node_modules/css-loader/dist/cjs.js??ruleSet[1].rules[1].use[1]!../../node_modules/postcss-loader/dist/cjs.js!./src/issue-reporter/ui/issue-reporter-redesign.css
var issue_reporter_redesign = __webpack_require__(6092);
;// ./src/issue-reporter/ui/issue-reporter-redesign.css

      
      
      
      
      
      
      
      
      

var options = {};

options.styleTagTransform = (styleTagTransform_default());
options.setAttributes = (setAttributesWithoutAttributes_default());

      options.insert = insertBySelector_default().bind(null, "head");
    
options.domAPI = (styleDomAPI_default());
options.insertStyleElement = (insertStyleElement_default());

var update = injectStylesIntoStyleTag_default()(issue_reporter_redesign/* default */.A, options);




       /* harmony default export */ const ui_issue_reporter_redesign = (issue_reporter_redesign/* default */.A && issue_reporter_redesign/* default */.A.locals ? issue_reporter_redesign/* default */.A.locals : undefined);

;// ./js/pages/issue-reporter/redesign/index.mjs
/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */










const serverLogger = new ewe_ui.telemetry.ServerLogger("adblockplus_ui");

const optionalPermissions = {
  permissions: ["management"]
};

convertDoclinks();
initI18n();

function formatReportForPreview(
  report,
  includeConfig = true,
  includeDebug = true
) {
  const i18n = (key) => browser.i18n.getMessage(key) || key;
  const escape = (str) =>
    String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const section = (title, content) => {
    if (!content) return "";
    return `<div class="preview-section">
      <h3>${escape(title)}</h3>
      <div class="preview-content">${content}</div>
    </div>`;
  };

  const row = (label, value) => {
    if (!value) return "";
    return `<div class="preview-row">
      <span class="preview-label">${escape(label)}:</span>
      <span class="preview-value">${escape(value)}</span>
    </div>`;
  };

  let html = "";

  // Issue
  if (report.issue) {
    const typeLabels = {
      "false positive": i18n("issueReporter_falsePositive_label"),
      "false negative": i18n("issueReporter_falseNegative_label"),
      other: i18n("issueReporter_other_label")
    };
    let content = "";
    if (report.issue.type) {
      content += `<p><strong>${i18n("issueReporter_preview_issueType")}:</strong> ${escape(typeLabels[report.issue.type] || report.issue.type)}</p>`;
    }
    if (report.issue.description) {
      content += `<p><strong>${i18n("issueReporter_preview_issueDescription")}:</strong> ${escape(report.issue.description)}</p>`;
    }
    html += section(i18n("issueReporter_preview_issue"), content);
  }

  // Page URL
  if (report.page && report.page.url) {
    html += section(
      i18n("issueReporter_preview_pageUrl"),
      `<p>${escape(report.page.url)}</p>`
    );
  }

  // Email
  if (report.contactEmail) {
    html += section(
      i18n("issueReporter_preview_email"),
      `<p>${escape(report.contactEmail)}</p>`
    );
  }

  // Comment
  if (report.userComment) {
    html += section(
      i18n("issueReporter_preview_comment"),
      `<p>${escape(report.userComment)}</p>`
    );
  }

  // Screenshot
  if (report.screenshot) {
    const edited = report.screenshot.edited ? "yes" : "no";
    const data = report.screenshot.data;
    let content = `<p>${i18n("issueReporter_preview_screenshotIncluded").replace("{0}", edited)}</p>`;
    if (data && data.startsWith("data:image")) {
      content += `<img src="${data}" class="preview-screenshot" alt="Screenshot preview">`;
    }
    html += section(i18n("issueReporter_preview_screenshot"), content);
  }

  // Product Info
  if (report.product) {
    const isPremium = report.hasPremium;
    html += section(
      i18n("issueReporter_preview_adblockplus"),
      row("Product", report.product.name) +
        row("Source", report.product.source) +
        row("Version", report.product.version) +
        row("Locale", report.product.locale) +
        (isPremium ? row("Premium", "Yes") : "")
    );
  }

  // Browser Info (only if includeConfig is true)
  if (includeConfig && report.application) {
    html += section(
      i18n("issueReporter_preview_browser"),
      row("Name", report.application.name) +
        row("Version", report.application.version) +
        row("User Agent", report.application.userAgent)
    );
  }

  // Platform Info (only if includeConfig is true)
  if (includeConfig && report.platform) {
    html += section(
      i18n("issueReporter_preview_platform"),
      row("Name", report.platform.name) +
        row("Version", report.platform.version)
    );
  }

  // Subscriptions (Filter Lists)
  if (report.subscriptions && report.subscriptions.length > 0) {
    let content = "";
    report.subscriptions.forEach((sub) => {
      content += `<div class="preview-list-item">${escape(sub.id || "")}</div>`;
    });
    html += section(
      i18n("issueReporter_preview_subscriptions"),
      `<div class="preview-list">${content}</div>`
    );
  }

  // Requests
  if (report.requests && report.requests.length > 0) {
    html += section(
      i18n("issueReporter_preview_requests"),
      `<p>${report.requests.length} request(s) logged</p>`
    );
  }

  // Filters
  if (report.matchedFiltersSummary && report.matchedFiltersSummary.length > 0) {
    let content = "";
    report.matchedFiltersSummary.forEach((filter) => {
      content += `<div class="preview-list-item"><code>${escape(filter.text || "")}</code></div>`;
    });
    html += section(
      i18n("issueReporter_preview_filters"),
      `<div class="preview-list">${content}</div>`
    );
  }

  // Extensions (only if includeConfig is true)
  if (includeConfig && report.extensions && report.extensions.length > 0) {
    let content = "";
    report.extensions.forEach((ext) => {
      content += `<div class="preview-list-item">${escape(ext.name || "")} (${escape(ext.version || "")})</div>`;
    });
    html += section(
      i18n("issueReporter_preview_extensions"),
      `<div class="preview-list">${content}</div>`
    );
  }

  // Debug data (only if includeDebug is true)
  if (includeDebug && report.debugData) {
    html += section(
      i18n("issueReporter_preview_debugData"),
      `<div class="preview-list"><pre style="font-size: 0.75rem; white-space: pre-wrap; word-break: break-all;">${escape(JSON.stringify(report.debugData, null, 2))}</pre></div>`
    );
  }

  return html || `<p>${i18n("issueReporter_preview_notProvided")}</p>`;
}

function containsPermissions() {
  // Firefox doesn't trigger the promise's catch() but instead throws
  try {
    return browser.permissions.contains(optionalPermissions);
  } catch (ex) {
    return Promise.reject(ex);
  }
}

function getScreenshotData() {
  const ioHighlighter = $("io-highlighter");
  if (!ioHighlighter) return null;

  const proc = browser.i18n.getMessage("issueReporter_processing_screenshot");
  return {
    edited: ioHighlighter.edited || false,
    data: ioHighlighter.toDataURL() || `data:image/png;base64,...${proc}...`
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  const supportEmail = "support@adblockplus.org";
  setElementLinks("sr-warning", `mailto:${supportEmail}`);
  setElementLinks(
    "other-issues",
    `mailto:${supportEmail}?subject=${encodeURIComponent("[Issue Reporter]")}`
  );

  const cancelButton = $("#cancel");
  cancelButton.addEventListener("click", closeMe);
  $("#hide-notification").addEventListener("click", () => {
    $("#notification").setAttribute("aria-hidden", true);
  });

  const screenshot = await browser.tabs.captureVisibleTab(null, {
    format: "png"
  });
  // activate current tab and let the user report
  const tab = await browser.tabs.getCurrent();
  await browser.tabs.update(tab.id, { active: true });
  const manageSteps = steps_manager({ screenshot });

  // Gather initial data (browser info, subscriptions, etc.)
  const dataReady = gatherInitialData().catch((e) => {
    console.error(e);
    alert(e);
    closeMe();
  });

  $("#send").addEventListener("click", async function sendAll(event) {
    const sendButton = event.currentTarget;
    const lastStep = $("io-steps button:last-child");
    sendButton.removeEventListener("click", sendAll);
    sendButton.disabled = true;
    lastStep.disabled = false;
    lastStep.click();

    // Add sending class to body to hide consent and back button via CSS
    document.body.classList.add("sending");

    $("io-highlighter").addEventListener("changecolordepth", (evt) => {
      const progress = $("#sendingProgress");
      const { max, value } = evt.detail;
      progress.max = max * 2;
      progress.value = value;
    });

    try {
      // Wait for data gathering and steps to complete
      await Promise.all([dataReady, manageSteps]);

      window.removeEventListener("beforeunload", closeMe);
      cancelButton.disabled = true;
      cancelButton.hidden = true;

      // Build report fresh at send time
      const report = await buildReport(getScreenshotData());
      sendReport(report);
      serverLogger.behavior("issue_report_submitted");

      sendButton.textContent = browser.i18n.getMessage(
        "issueReporter_closeButton_label"
      );
      $("io-steps").setCompleted(-1, true);
    } catch (error) {
      console.error("Failed to send report:", error);
      window.removeEventListener("beforeunload", closeMe);
      document.body.classList.remove("sending");
      document.body.classList.add("sent");
      $("#sendingState").hidden = true;
      $("#error").textContent = "Something went wrong. Please try again.";
      $("#error").hidden = false;
      sendButton.disabled = false;
      sendButton.textContent = browser.i18n.getMessage(
        "issueReporter_closeButton_label"
      );
      sendButton.addEventListener("click", closeMe);
    }
  });

  // We query our permissions here to find out whether the browser supports them
  containsPermissions()
    .then(() => {
      const includeConfig = $("#includeConfig");

      const requestConfigPermissions = () => {
        return browser.permissions
          .request(optionalPermissions)
          .then((granted) => {
            return updateConfigurationInfo(granted).then(() => {
              includeConfig.checked = granted;
            });
          })
          .catch(console.error)
          .then(() => browser.permissions.remove(optionalPermissions))
          .then((success) => {
            if (!success) throw new Error("Failed to remove permissions");
          })
          .catch(console.error);
      };

      includeConfig.addEventListener("change", (event) => {
        if (!includeConfig.checked) {
          updateConfigurationInfo(false);
          return;
        }
        event.preventDefault();
        requestConfigPermissions();
      });
    })
    .catch((err) => {
      // No need to ask for more data if we won't be able to access it anyway
      const includeConfig = $("#includeConfigContainer");
      includeConfig.hidden = true;
    });

  // Debug data checkbox handler
  const includeDebugCheckbox = $("#includeDebug");
  includeDebugCheckbox.addEventListener("change", () => {
    updateDebugInfo(includeDebugCheckbox.checked);
  });
  // Initialize debug data since it's checked by default
  updateDebugInfo(true).then((debugData) => {
    // Check if user is logged in premium
    if (debugData && debugData.account) {
      const { hasPremium, isLoggedIn, user } = debugData.account;

      if (hasPremium && isLoggedIn && user && user.email) {
        // Hide regular email section, show premium email section
        const regularEmailSection = $("#regularEmailSection");
        const premiumEmailSection = $("#premiumEmailSection");
        const premiumEmailDisplay = $("#premiumEmailDisplay");
        const emailField = $("#email");

        if (regularEmailSection) {
          regularEmailSection.hidden = true;
        }
        if (premiumEmailSection) {
          premiumEmailSection.hidden = false;
        }
        if (premiumEmailDisplay) {
          premiumEmailDisplay.textContent = user.email;
        }

        // Set the email field (default is "use this email")
        if (emailField) {
          emailField.value = user.email;
        }

        // Handle radio button changes
        const usePremiumEmail = $("#usePremiumEmail");
        const reportAnonymously = $("#reportAnonymously");

        if (usePremiumEmail) {
          usePremiumEmail.addEventListener("change", () => {
            if (usePremiumEmail.checked && emailField) {
              emailField.value = user.email;
            }
          });
        }

        if (reportAnonymously) {
          reportAnonymously.addEventListener("change", () => {
            if (reportAnonymously.checked && emailField) {
              emailField.value = "";
            }
          });
        }
      }
    }
  });

  // Populate preview when entering review page
  const ioStepsPreview = $("io-steps");
  ioStepsPreview.addEventListener("step:click", async (event) => {
    // Review page is index 2 (third page)
    if (event.detail === 2) {
      // Ensure debug data is updated based on checkbox before showing preview
      const includeDebugCb = $("#includeDebug");
      await updateDebugInfo(includeDebugCb && includeDebugCb.checked);

      await dataReady;
      await closeRequestsCollectingTab();

      // Build report for preview
      const includeConfigCheckbox = $("#includeConfig");
      const includeConfig =
        includeConfigCheckbox && includeConfigCheckbox.checked;
      const includeDebug = includeDebugCb && includeDebugCb.checked;

      const report = await buildReport(getScreenshotData());
      const previewElement = $("#reportPreview");
      previewElement.innerHTML = formatReportForPreview(
        report,
        includeConfig,
        includeDebug
      );
      previewElement.focus();
    }
  });
});

let notifyClosing = true;
window.addEventListener("beforeunload", closeMe);
function closeMe() {
  if (notifyClosing) {
    notifyClosing = false;
    browser.runtime
      .sendMessage({
        type: "app.get",
        what: "senderId"
      })
      .then((tabId) => {
        if (tabId) {
          return browser.tabs.remove(tabId);
        }
      })
      .catch(console.error);
  }
}

const REQUEST_TIMEOUT_MS = 30000;
const SUPPORT_EMAIL = "support@adblockplus.org";

function sendReport(reportData) {
  const url = "https://issue-report.adblockplus.org/api/v1/issue-report";

  const createSupportEmailLink = (reportId = null) => {
    const link = document.createElement("a");
    if (reportId) {
      link.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Issue Report: ${reportId}`)}`;
    } else {
      link.href = `mailto:${SUPPORT_EMAIL}`;
    }
    link.textContent = SUPPORT_EMAIL;
    link.className = "support-email";
    return link;
  };

  const showError = () => {
    document.getElementById("sendReportMessage").hidden = true;
    document.getElementById("sendingProgressContainer").hidden = true;
    document.body.classList.remove("sending");
    document.body.classList.add("sent");

    const errorElement = document.getElementById("error");
    errorElement.textContent = "";

    const errorText =
      browser.i18n.getMessage("issueReporter_errorMessage_simple") ||
      "Something went wrong. Please contact ";
    errorElement.appendChild(document.createTextNode(errorText));
    errorElement.appendChild(createSupportEmailLink());
    errorElement.appendChild(document.createTextNode(" for assistance."));

    errorElement.hidden = false;

    document.getElementById("continue").disabled = false;
    $("#send").disabled = false;
    $("#send").addEventListener("click", closeMe);
  };

  const showSuccess = (reportId) => {
    document.getElementById("sendReportMessage").hidden = true;
    document.getElementById("sendingProgressContainer").hidden = true;
    document.body.classList.remove("sending");
    document.body.classList.add("sent");

    const resultElement = document.getElementById("result");
    resultElement.textContent = "";

    const reportIdElement = document.createElement("p");
    reportIdElement.className = "report-id";
    reportIdElement.textContent =
      browser.i18n.getMessage("issueReporter_reportId", [reportId]) ||
      `Report ID: ${reportId}`;
    resultElement.appendChild(reportIdElement);

    const supportMessage = document.createElement("p");
    supportMessage.className = "support-message";

    const supportText =
      browser.i18n.getMessage("issueReporter_supportContact_before") ||
      "If you have further issues, please contact ";
    supportMessage.appendChild(document.createTextNode(supportText));
    supportMessage.appendChild(createSupportEmailLink(reportId));

    const afterText =
      browser.i18n.getMessage("issueReporter_supportContact_after", [
        reportId
      ]) || ` with your report ID: ${reportId}`;
    supportMessage.appendChild(document.createTextNode(afterText));

    resultElement.appendChild(supportMessage);

    resultElement.hidden = false;

    document.getElementById("continue").disabled = false;
    $("#send").disabled = false;
    $("#send").addEventListener("click", closeMe);
  };

  const reportSent = () => {
    let success = false;
    let reportId = null;

    try {
      success = request.status === 200;
    } catch (e) {
      // Getting request status might throw if no connection was established
    }

    if (success) {
      try {
        const response = JSON.parse(request.responseText);
        reportId = response.reportId;
      } catch (e) {
        success = false;
      }
    }

    if (success && reportId) {
      showSuccess(reportId);
    } else {
      showError();
    }
  };

  const reportTimeout = () => {
    request.abort();
    showError();
  };

  const request = new XMLHttpRequest();
  request.open("POST", url);
  request.setRequestHeader("Content-Type", "application/json");
  request.setRequestHeader("X-Adblock-Plus", "1");
  request.timeout = REQUEST_TIMEOUT_MS;
  request.addEventListener("load", reportSent);
  request.addEventListener("error", reportSent);
  request.addEventListener("timeout", reportTimeout);
  const progress = document.getElementById("sendingProgress");
  request.upload.addEventListener("progress", (event) => {
    if (!event.lengthComputable) return;

    if (event.loaded > 0) {
      progress.max = 100;
      progress.value = 50 + (50 * event.loaded) / event.total;
    }
  });
  request.send(JSON.stringify(reportData));
}

document.body.hidden = false;

})();

/******/ })()
;