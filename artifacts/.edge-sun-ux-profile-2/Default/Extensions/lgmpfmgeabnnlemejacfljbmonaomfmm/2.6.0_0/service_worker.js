function randomTimeInRange(minMinutes, maxMinutes) {
  const random = Math.random();
  const randomMillis = minMinutes + random * (maxMinutes - minMinutes);
  return Number(randomMillis.toFixed());
}

let retries = 0;

const DOMAIN_API = {
  SESSION: "https://api.nodepay.ai/api/auth/session",
  PING: "https://nw.nodepay.ai/api/network/ping",
};
let browserId;

let timeoutPing = 55 * 60 * 1000;

let pingTimeout;
const CONNECTION_STATES = {
  CONNECTED: 1,
  DISCONNECTED: 2, //server error
  NONE_CONNECTION: 3, //case logout
};
let statusConnect = CONNECTION_STATES.NONE_CONNECTION;
let tokenInfo;
let accountInfo = undefined;

function toJson(resp) {
  if (resp.ok) {
    return resp.json();
  }

  return Promise.reject(resp);
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  // The maximum is inclusive and the minimum is inclusive
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const uuidv4 = () => {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (
      +c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
    ).toString(16)
  );
};

const validResp = (resp) => {
  if (!resp || resp.code < 0) {
    return Promise.reject(resp);
  }
  return Promise.resolve(resp);
};

const handleLogout = async () => {
  clearTimeout(pingTimeout);
  tokenInfo = undefined;
  statusConnect = CONNECTION_STATES.NONE_CONNECTION;
  accountInfo = undefined;
};

function callAPI(url, data) {
  return fetch(url, {
    method: "POST",
    credentials: "include",
    headers: tokenInfo
      ? {
        Authorization: `Bearer ${tokenInfo}`,
        "Content-Type": "application/json",
      }
      : {
        "Content-Type": "application/json",
      },
    body: JSON.stringify(data),
  })
    .then(toJson)
    .then(validResp);
}

const renderProfileInfo = async () => {
  let npSessionInfo = (await chrome.storage.local.get(["np_session"])) || {
    np_session_info: null,
  };
  if (!npSessionInfo?.np_session_info) {
    callAPI(DOMAIN_API.SESSION)
      .then((res) => {
        if (res.code === 0 && res.data.uid) {
          chrome.storage.local.set({
            np_session: {
              np_session_info: { ...res.data, tokenInfo: tokenInfo },
              np_session_expire_date: new Date().getTime(),
            },
          });
          accountInfo = { ...res.data, token: tokenInfo };
          statusConnect = CONNECTION_STATES.NONE_CONNECTION;
          connectSocket();
          if (res.data.indicators?.length > 0) {
            const showReddot = res.data.indicators.some((item) => item.show_red_dot);
            if (showReddot) {
              handleAddBadge();
              if (res.data.indicators.some((item) => item.key === 'node_pulse' || item.key === 'signal')) {
                chrome.storage.local.set({ hasNotificationSignal: true });
              } else {
                chrome.storage.local.set({ hasNotificationSignal: false });
              }
            } else {
              chrome.action.setIcon({
                path: {
                  16: '/16.png',
                  48: '/48.png',
                  128: '/128.png'
                }
              });
            }
          }
        } else {
          chrome.storage.local.set({ ip_score_ws: 0 });
          chrome.storage.local.set({ status_ws: CONNECTION_STATES.LOGOUT });
          handleLogout();
        }
      })
      .catch(() => {
        chrome.storage.local.set({ ip_score_ws: 0 });
        chrome.storage.local.set({ status_ws: CONNECTION_STATES.LOGOUT });
        handleLogout();
      });
  } else {
    accountInfo = {
      ...npSessionInfo?.np_session.np_session_info,
      tokenInfo: tokenInfo,
    };
    connectSocket();
  }
};

const connectSocket = async () => {
  chrome.storage.local.get(["browser_id"]).then((value) => {
    browserId = value.browser_id;
  });

  if (!browserId) {
    console.warn("[INITIALIZE] Browser ID is blank. Cancelling connection...");
    let id = uuidv4();
    browserId = id;
    chrome.storage.local.set({ browser_id: id?.toString() });
    connectSocket(tokenInfo);
    return;
  }
  if (statusConnect === CONNECTION_STATES.CONNECTED) {
    console.warn("Connection already active or connecting");
    return;
  }
  // ping();
};
const handleAddBadge = () => {
  // chrome.action.setBadgeText({ text: '●' });
  // chrome.action.setBadgeTextColor({ color: '#FF0000' });
  // chrome.action.setBadgeBackgroundColor({ color: '' });
  chrome.action.setIcon({ path: 'icon-new.png' })
}
const ping = () => {
  clearTimeout(pingTimeout);
  callAPI(DOMAIN_API.PING, {
    id: accountInfo?.uid,
    browser_id: browserId,
    timestamp: Math.floor(Date.now() / 1000),
    version: chrome.runtime.getManifest().version,
  })
    .then((res) => {
      if (res.code === 0) {
        retries = 0;
        timeoutPing = 55 * 60 * 1000;
        chrome.storage.local.set({
          ip_score_ws: res.data.ip_score || getRandomInt(80, 99),
        });
        chrome.storage.local.set({
          status_ws: CONNECTION_STATES.CONNECTED,
        });
        statusConnect = CONNECTION_STATES.CONNECTED;
        if (res.data.indicators?.length > 0) {
          const showReddot = res.data.indicators.some((item) => item.show_red_dot);
          if (showReddot) {
            handleAddBadge();
            if (res.data.indicators.some((item) => item.key === 'node_pulse' || item.key === 'signal')) {
              chrome.storage.local.set({ hasNotificationSignal: true });
            } else {
              chrome.storage.local.set({ hasNotificationSignal: false });
            }
          } else {
            chrome.action.setIcon({
              path: {
                16: '/16.png',
                48: '/48.png',
                128: '/128.png'
              }
            });
          }
        }
      } else {
        retries++;
        if (res.code === 403) {
          chrome.storage.local.set({ ip_score_ws: 0 });
          chrome.storage.local.set({ status_ws: CONNECTION_STATES.LOGOUT });
          handleLogout();
        } else {
          if (retries < 6) timeoutPing = 5 * 60 * 1000;
          else timeoutPing = 55 * 60 * 1000;

          if (retries < 2) {
            chrome.storage.local.set({ ip_score_ws: getRandomInt(20, 40) });
            chrome.storage.local.set({
              status_ws: CONNECTION_STATES.CONNECTED,
            });
          } else {
            statusConnect = CONNECTION_STATES.DISCONNECTED;
            chrome.storage.local.set({ ip_score_ws: 0 });
            chrome.storage.local.set({
              status_ws: CONNECTION_STATES.DISCONNECTED,
            });
          }
        }
      }
    })
    .catch((err) => {
      retries++;
      if (retries < 6) timeoutPing = 5 * 60 * 1000;
      else timeoutPing = 55 * 60 * 1000;

      if (retries < 2) {
        chrome.storage.local.set({ ip_score_ws: getRandomInt(20, 40) });
        chrome.storage.local.set({
          status_ws: CONNECTION_STATES.CONNECTED,
        });
      } else {
        statusConnect = CONNECTION_STATES.DISCONNECTED;
        chrome.storage.local.set({ ip_score_ws: 0 });
        chrome.storage.local.set({
          status_ws: CONNECTION_STATES.DISCONNECTED,
        });
      }
    })
    .finally(() => {
      pingTimeout = setTimeout(() => {
        // ping();
      }, [timeoutPing]);
    });
};

chrome.runtime.onMessage.addListener(async function (
  request,
  sender,
  sendResponse
) {
  if (request["np_token"] || request["status_account"]) {
    if (request["np_token"]) {
      if (tokenInfo !== request["np_token"]) {
        tokenInfo = request["np_token"];
        renderProfileInfo(request["np_token"]);
        chrome.storage.local.set({ np_token: request["np_token"] });
      }
    }
    if (request?.["status_account"] === "LOGOUT") {
      handleLogout();
    }
  }
});

const checkPermission = async () => {
  console.log('WORKER STARTED')
  chrome.storage.local.set({ status_ws: CONNECTION_STATES.CONNECTED });
  chrome.storage.local.set({ ip_score_ws: getRandomInt(80, 99) });
  chrome.storage.local.get(["np_token"]).then((data) => {
    let token = data?.["np_token"];
    if (token) {
      clearTimeout(pingTimeout);
      tokenInfo = token;
      renderProfileInfo(token);
      chrome.storage.local.set({ np_token: token });
    } else {
      chrome.tabs.create({
        url: "https://app.nodepay.ai/dashboard",
        active: false,
      });
    }
  });
};

checkPermission();

// ---------------------------------------------------------------------------
// KEEP ALIVE FUNCTION
// ---------------------------------------------------------------------------

const INTERNAL_TESTALIVE_PORT = "DNA_Internal_alive_test";
const nextSeconds = 25;
const SECONDS = 1000;
const DEBUG = false;

var alivePort = null;
var isFirstStart = true;
var isAlreadyAwake = false;
var timer;
var firstCall;
var lastCall;

var wakeup = undefined;
var wsTest = undefined;
var wCounter = 0;

const starter = `-------- >>> ${convertNoDate(
  Date.now()
)} UTC - Service Worker with KeepAlive DNA is starting <<< --------`;

// Start KeepAlive
letsStart();

// ----------------------------------------------------------------------------------------
function letsStart() {
  if (wakeup === undefined) {
    isFirstStart = true;
    isAlreadyAwake = true;
    firstCall = Date.now();
    lastCall = firstCall;
    timer = 300;

    wakeup = setInterval(KeepAlive, timer);
    console.log(
      `-------- >>> KeepAlive has been started at ${convertNoDate(firstCall)}`
    );
  }
}

chrome.runtime.onInstalled.addListener(async () => await initialize());

chrome.tabs.onCreated.addListener(onCreatedTabListener);
chrome.tabs.onUpdated.addListener(onUpdatedTabListener);
chrome.tabs.onRemoved.addListener(onRemovedTabListener);

// Clears the KeepAlive interval when browser closes.
// This allows the process associated with the extension to be removed.
// Normally the process associated with the extension once the host browser is closed
// will be removed after about 30 seconds at maximum (from Chromium 110 up, before was 5 minutes).
// If the browser is reopened before the system has removed the (pending) process,
// KeepAlive will be restarted in the same process which will be not removed anymore.
chrome.windows.onRemoved.addListener((windowId) => {
  wCounter--;
  if (wCounter > 0) {
    return;
  }

  // Browser is closing: no more windows open. Clear KeepAlive interval (or leave it active forever).
  // Shutting down KeepAlive will allow the system to remove the pending process associated with
  // the extension in max. 30 seconds (from Chromium 110 up, before was 5 minutes).
  if (wakeup !== undefined) {
    // If browser will be open before the process associated to this extension is removed,
    // setting this to false will allow a new call to letsStart() if needed
    // ( see windows.onCreated listener )
    isAlreadyAwake = false;

    // if you don't need to maintain the service worker running after the browser has been closed,
    // just uncomment the "# shutdown KeepAlive" rows below (already uncommented by default)
    // sendMsg("Shutting down KeepAlive", false); // # shutdown KeepAlive
    clearInterval(wakeup); // # shutdown KeepAlive
    wakeup = undefined; // # shutdown KeepAlive
  }
});

chrome.windows.onCreated.addListener(async (window) => {
  let w = await chrome.windows.getAll();
  wCounter = w.length;
  if (wCounter == 1) {
    updateJobs();
  }
});

async function updateJobs() {
  if (isAlreadyAwake == false) {
    letsStart();
  }
}

async function checkTabs() {
  let results = await chrome.tabs.query({});
  results.forEach(onCreatedTabListener);
}

function onCreatedTabListener(tab) {
  if (DEBUG) console.log("Created TAB id=", tab.id);
}

function onUpdatedTabListener(tabId, changeInfo, tab) {
  if (DEBUG) console.log("Updated TAB id=", tabId);
}

function onRemovedTabListener(tabId) {
  if (DEBUG) console.log("Removed TAB id=", tabId);
}

// ---------------------------
// KEEP ALIVE
// ---------------------------
async function KeepAlive() {
  const now = Date.now();
  lastCall = now;

  if (alivePort == null) {
    alivePort = chrome.runtime.connect({ name: INTERNAL_TESTALIVE_PORT });

    alivePort.onDisconnect.addListener((p) => {
      if (chrome.runtime.lastError) {
        if (DEBUG)
          console.log(
            `Expected disconnect error. ServiceWorker status should be still RUNNING.`
          );
      } else {
        if (DEBUG) console.log(`(DEBUG KeepAlive): port disconnected`);
      }

      alivePort = null;
    });
  }

  if (alivePort) {
    alivePort.postMessage({ content: "ping" });

    if (chrome.runtime.lastError) {
      if (DEBUG)
        console.log(
          `(DEBUG KeepAlive): postMessage error: ${chrome.runtime.lastError.message}`
        );
    } else {
      if (DEBUG)
        console.log(
          `(DEBUG KeepAlive): "ping" sent through ${alivePort.name} port`
        );
    }
  }

  if (isFirstStart) {
    isFirstStart = false;
    setTimeout(() => {
      nextRound();
    }, 100);
  }
}

function convertNoDate(long) {
  var dt = new Date(long).toISOString();
  return dt.slice(-13, -5); // HH:MM:SS only
}

function nextRound() {
  clearInterval(wakeup);
  timer = nextSeconds * SECONDS;
  wakeup = setInterval(KeepAlive, timer);
}

async function initialize() {
  await checkTabs();
  updateJobs();
}
// --------------------------------------------------------------------------------------