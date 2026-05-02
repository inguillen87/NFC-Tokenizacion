"use strict";

var amount;
var licenseType = "singleUser";
var licenseSelected;
let minimumDonation; // but being set overwritten when donate buttons are clicked

var donateButtonClicked = null;
var extensionName = getMessage("nameNoTM");
var email;
var stripeLiveMode = true;
var donationPageUrl = location.protocol + "//" + location.hostname + location.pathname;
const stripeCancelOrError = ["stripeCancel", "stripeError"].includes(getUrlValue("action"));

window.addEventListener("pageshow", () => {
    // Only reset if coming from browser history
    if (performance.getEntriesByType("navigation")[0]?.type === "back_forward" || performance.getEntriesByType("navigation")[0]?.type === "reload") {
        document.querySelectorAll("input[type=radio]").forEach(r => r.checked = false);
}
});

Controller();

if (!extensionName) {
	try {
		extensionName = chrome.runtime.getManifest().name;
	} catch (e) {
		console.error("Manifest has not been loaded yet: " + e);
	}
	
	var prefix = "__MSG_";
	// look for key name to message file
	if (extensionName?.match(prefix)) {
		var keyName = extensionName.replace(prefix, "").replace("__", "");
		extensionName = getMessage(keyName);
	}
}

function isSimilarValueToUS(currencyCode) {
	if (/USD|CAD|EUR|GBP|AUD/i.test(currencyCode)) {
		return true;
	}
}

async function initCurrencyAndMinimums(currencyCode) {
    const minPaymentObj = await Controller.getMinimumPayment();

	if (licenseType == "multipleUsers") {
		byId("currency").value = "USD"; // hard coded to USD for multipe user license
	} else {
		byId("currency").value = currencyCode;

        if (isMonthly()) {
            selectorAll("#monthlyAmountSelections j-button").forEach(el => {
                if (el.getAttribute("amount") <= minPaymentObj.getMonthlyPayment("USD")) {
                    hide(el);
                }
            });

            initButtonGroup(byId("monthlyAmountSelections"));

            hide("#onetimeAmountSelections");
            show("#monthlyAmountSelections");
            hide("#yearlyAmountSelections");

            show("#amount");
        } else if (isYearlyForAllExtensions()) {
            const $button = selector("#yearlyAmountSelections j-button");
            const yearlyAmount = minPaymentObj.getYearlyPayment("USD");
            $button.innerText = yearlyAmount;
            $button.setAttribute("amount", yearlyAmount);

            hide("#onetimeAmountSelections");
            hide("#monthlyAmountSelections");
            show("#yearlyAmountSelections");
            
            hide("#amount");
        } else {
            selectorAll("#onetimeAmountSelections j-button").forEach(el => {
                if (el.getAttribute("amount") < minPaymentObj.getOneTimePayment("USD")) {
                    hide(el);
                }
            });

            initButtonGroup(byId("onetimeAmountSelections"));

            show("#onetimeAmountSelections");
            hide("#monthlyAmountSelections");
            hide("#yearlyAmountSelections");

            show("#amount");
        }
		
		if (isMonthly() || isYearlyForAllExtensions()) {
			if (isPayPalSubscriptionsSupported() && stripeCancelOrError) {
				show("#paypal");
			} else {
				hide("#paypal");
			}
			hide("#alipay");
			hide("#wechat-pay");
		} else {
            if (stripeCancelOrError) {
                show("#paymentMethods j-button");
            } else {
                show("#paymentMethods j-button:not(#paypal)");
            }
		}
		
		if (currencyCode == "BTC") {
            niceAlert("Select a fiat currency and an amount then the Coinbase option will appear.");
            byId("currency").value = "USD";
		} else {
            selectorAll("j-button[amount]").forEach(el => {
				el.innerText = Controller.convertUSDToOtherCurrency(el.getAttribute("amount"), currencyCode);
			});

            if (isMonthly()) {
                minimumDonation = minPaymentObj.getMonthlyPayment(currencyCode);
            } else if (isYearlyForAllExtensions()) {
                minimumDonation = minPaymentObj.getYearlyPayment(currencyCode);
            } else {
                if (await isEligibleForReducedDonation()) {
                    minimumDonation = minPaymentObj.getOneTimeReducedPayment(currencyCode);
                } else {
                    minimumDonation = minPaymentObj.getOneTimePayment(currencyCode);
                }
            }
		}

        byId("amount").min = minimumDonation;
	}
}
	
function initPaymentDetails(buttonClicked) {
	donateButtonClicked = buttonClicked;
	
	slideUp("#multipleUserLicenseIntro");

	if (ITEM_ID == "screenshots" && !email && (isMonthly() || isYearlyForAllExtensions() || buttonClicked == "alipay" || buttonClicked == "wechat")) {
		let promptMessage;
		if (isMonthly() || isYearlyForAllExtensions()) {
			promptMessage = "Enter your email to link the other extensions";
		} else {
			promptMessage = "Enter your email for the receipt";
		}
		email = prompt(promptMessage);
		if (!email) {
			niceAlert("You must enter an email");
			return;
		}
	}

	if (licenseType == "singleUser") {
		initPaymentProcessor(amount);
	} else {
		initPaymentProcessor(licenseSelected.price);
	}
}

function isZeroDecimalCurrency(currencyCode) {
	const zeroDecimalCurrencies = ["bif", "djf", "jpy", "krw", "pyg", "vnd", "xaf", "xpf", "clp", "gnf", "kmf", "mga", "rwf", "vuv", "xof"];
	if (zeroDecimalCurrencies.includes(currencyCode.toLowerCase())) {
		return true;
	}
}

function getAmountNumberOnly() {
	let amount = byId("amount").value;
	
	if (amount.indexOf(".") == 0) {
		amount = "0" + amount;
	}
	
	// make sure 2 decimal positions ie. 0.5 > 0.50
	if (/\..$/.test(amount)) {
		amount += "0";
	}
	
	amount = amount.trim();
	return amount;
}

function hideBeforeSuccessfulPayment() {
    document.body.classList.add("payment-successful");
}

async function showSuccessfulPayment(paymentInfo) {

    // if paymentInfo does not exist then assume contributed and call Controller.processFeatures
    if (!paymentInfo) {
        paymentInfo = {
            unlocked: true,
        }

        const billingPeriod = getUrlValue("billingPeriod");        
        if (billingPeriod) {
            paymentInfo.billingPeriod = billingPeriod;
        }
        await Controller.processFeatures(paymentInfo);
    }
	
	hideBeforeSuccessfulPayment();

	byId("video").src = getYouTubeEmbedUrl("https://www.youtube.com/embed/Ue-li7gl3LM?rel=0&autoplay=1&theme=light");

	show("#extraFeaturesWrapper");
	
	if (localStorage._amountForAllExtensions) {
		show("#unlockOtherExtensions");
	}
	show("#paymentComplete");
}

function getStripeAmount(price, currencyCode) {
	var stripeAmount;

	if (isZeroDecimalCurrency(currencyCode)) {
		stripeAmount = price;
	} else {
		stripeAmount = price * 100;
	}

	stripeAmount = Math.round(stripeAmount) // round to prevent invalid integer error ie. when entering amount 1.1

	return stripeAmount;
}

async function paymentFetch(url, data, options = {}) {
    try {
        return await fetchJSON(url, data, options);
    } catch (error) {
        hideLoading();
        openDialog(getMessage("tryAgainLater") + " " + getMessage("or") + " " + "try another payment method.", {
            title: getMessage("theresAProblem") + " - " + error
        });
        console.error(error);
        throw error;
    }
}

function openMobilePayDialog(params) {
    let $content = document.createElement("div");
    $content.style.textAlign = "center";

    const $img = document.createElement("img");
    $img.addEventListener("load", () => {
        console.log("QR code image loaded");
        hideSpinner();
    });

    emptyAppend($content, 
        params.message,
        document.createElement("br"),
        document.createElement("br"),
        $img
    );

    openDialog($content, {
        cancel: true,
        ok: false,
        buttons: [
            {
                label: getMessage("continue"),
                primary: true,
                onClick: (dialog) => {
                    showLoading();
                    Controller.verifyPayment(ITEM_ID, email).then(response => {
                        hideLoading();
                        if (response.unlocked) {
                            dialog.close();
                            showSuccessfulPayment(response);
                        } else {
                            const content = new DocumentFragment();

                            const $link = document.createElement("a");
                            $link.href = "https://jasonsavard.com/contact";
                            $link.textContent = "contact";

                            content.append("You must scan the code and complete the payment first.", createBR(), createBR(), "If you did this then ", $link, " the developer!");

                            niceAlert(content);
                        }
                    }).catch(error => {
                        dialog.close();
                        hideLoading();
                        // show success anyways because they might just have extensions preventing access to my server
                        showSuccessfulPayment();
                        sendGA(params.type, 'failure ' + error + ' but show success anyways');
                    });
                }
            }
        ]
    });

    // must do this after openDialog because the spinner needs to be inside the dialog
    showSpinner();
    $img.src = `https://jasonsavard.com/qrcode?data=${encodeURIComponent(params.url)}`;
}

async function initPaymentProcessor(price) {
	if (donateButtonClicked == "paypal") {
		sendGA("paypal", 'start');
		
		showLoading();

		// seems description is not used - if item name is entered, but i put it anyways
		const data = {
			itemId:			ITEM_ID,
			itemName:		extensionName,
			currency:		getCurrencyCode(),
			price:			price,
			description:	extensionName,
			successUrl:		`${donationPageUrl}?action=paypalSuccess`,
			errorUrl:		`${donationPageUrl}?action=paypalError`,
			cancelUrl:		`${Controller.DOMAIN}tools/redirectToExtension.php?url=${encodeURIComponent(donationPageUrl)}`
		};

		if (email) {
			data.email = email;
		}
		
		if (licenseType == "multipleUsers") {
			data.license = licenseSelected.number;
			data.action = "recurring";
		} else if (isMonthly()) {
            data.action = "recurring";
        } else if (isYearlyForAllExtensions()) {
			data.action = "yearly";
		}
        
        location.href = await paymentFetch(Controller.DOMAIN + "paymentSystems/paypal/createPayment.php", data, {method: "POST"});
	} else if (donateButtonClicked == "stripe" || donateButtonClicked == "wechat") {
		sendGA("stripe", 'start');
		
		function addFormField(form, name, value) {
            const $input = document.createElement("input");
            $input.name = name;
            $input.value = value;
            $input.type = "hidden";

            form.append($input);
		}

        const form = document.createElement("form");
        form.action = 'https://jasonsavard.com/payment';
        form.method = DetectClient.isChromium() ? 'post' : 'get' // seems firefox cross domain post

        addFormField(form, "paymentType",   donateButtonClicked);
		addFormField(form, "amount", 		price);
		addFormField(form, "currency", 		getCurrencyCode());
		addFormField(form, "itemId", 		ITEM_ID);
		addFormField(form, "itemName",		extensionName);
		addFormField(form, "description", 	extensionName);
		addFormField(form, "livemode", 		stripeLiveMode);
		addFormField(form, "returnUrl", 	donationPageUrl);
		        
		if (email) {
			addFormField(form, "email", email);
		}

		if (licenseType == "multipleUsers") {
			addFormField(form, "license", licenseSelected.number);
			addFormField(form, "billingPeriod", "monthly");
		} else if (isMonthly()) {
			addFormField(form, "billingPeriod", "monthly");
		} else if (isYearlyForAllExtensions()) {
            addFormField(form, "billingPeriod", "yearly");
        }
		        
        document.body.append(form);
        form.submit();
        form.remove();
	} else if (donateButtonClicked == "applePay") {
		sendGA("applePay", 'start');
		
		let url = "https://jasonsavard.com/contribute?action=applePay";

		function appendParam(url, name, value) {
			return url + "&" + name + "=" + encodeURIComponent(value);
		}

		url = appendParam(url, "amount", price);	
		url = appendParam(url, "currency", getCurrencyCode());
		url = appendParam(url, "itemId", ITEM_ID);
		url = appendParam(url, "itemName", extensionName);
		url = appendParam(url, "description", extensionName);

		if (window.email) {
			url = appendParam(url, "email", window.email);
		}
		
		if (licenseType == "multipleUsers") {
			url = appendParam(url, "license", licenseSelected.number);
			url = appendParam(url, "billingPeriod", "monthly");
		} else if (isMonthly()) {
			url = appendParam(url, "billingPeriod", "monthly");
		} else if (isYearlyForAllExtensions()) {
            url = appendParam(url, "billingPeriod", "yearly");
        }

		openMobilePayDialog({
			message:	"Scan this QR code with your mobile.",
			url:	url, 
			type:	"applePay"
		});
	} else if (donateButtonClicked == "coinbase") {
		sendGA("coinbase", 'start');
		
		var data = {
			action: "createCoinbaseCharge",
			name: extensionName,
			amount: price,
			currency: getCurrencyCode(),
			itemId: ITEM_ID,
			redirectUrl: `${Controller.DOMAIN}tools/redirectToExtension.php?url=${encodeURIComponent(donationPageUrl + "?action=coinbaseSuccess")}`
		}

		if (window.email) {
			data.email = window.email;
		}

		if (licenseType == "multipleUsers") {
			data.license = licenseSelected.number;
		}
			
        showLoading();
		data = await paymentFetch(`${Controller.DOMAIN}paymentSystems/coinbase/ajax.php`, data, {method: "post"});
        location.href = data.url;
	} else {
		openDialog('invalid payment process', {
			title: getMessage("theresAProblem")
		});
	}
}

function ensureEmail(closeWindow) {
	if (!email) {
		openDialog("You must first grant access via the popup window so that I can associate your account with the contribution.").then(function() {
			if (closeWindow) {
				window.close();
			}
		});
	}
}

function signOut() {
	location.href = Urls.SignOut;
}

function canHaveALicense(email) {
	return isDomainEmail(email) || getUrlValue("testlicense");
}


function isPayPalSubscriptionsSupported() {
	function isInThisLang(thisLang) {
		return locale.includes(thisLang) || chrome.i18n.getUILanguage().includes(thisLang);
	}
	
	if (isInThisLang("de") || isInThisLang("zh")) {
		return false;
	} else {
		return true;
	}
}

function isMonthly() {
	return getPaymentType() == "monthly" || isMonthlyForAllExtensions();
}

function isMonthlyForAllExtensions() {
    return getPaymentType() == "monthly-all-extensions";
}

function isYearlyForAllExtensions() {
    return getPaymentType() == "yearly-all-extensions";
}

function showAmountSelections() {
	hide("#multipleUserLicenseIntro");
	slideDown("#donateAmountWrapper");
	slideUp("#paymentMethods");
}

function getCurrencyCode() {
	return byId("currency").value;
}

function getPaymentType() {
    return document.querySelector("[name='paymentType']:checked")?.value;
}

function setPaymentType(value) {
    document.querySelector("[name='paymentType'][value='" + value + "']").checked = true;
}

function amountSelected(amount) {
	if (isSimilarValueToUS(getCurrencyCode())) {
        if (isMonthlyForAllExtensions() || isYearlyForAllExtensions()) {
            localStorage._amountForAllExtensions = true;
        } else {
            localStorage.removeItem("_amountForAllExtensions");
        }
	}

	if (amount == "") {
        byId("amount").setCustomValidity(getMessage("enterAnAmount"));
        byId("amount").reportValidity();
		byId("amount").focus();
    } else if (isNaN(amount)) {
        byId("amount").setCustomValidity("Invalid number");
        byId("amount").reportValidity();
        byId("amount").focus();
	} else if (parseFloat(amount) < minimumDonation) {
        byId("amount").setCustomValidity(getMessage("minimumAmount", formatCurrency(minimumDonation, getCurrencyCode())));
        byId("amount").reportValidity();
        byId("amount").focus();
	} else {
		slideDown("#paymentMethods").then(() => {
            byId("paymentMethods").scrollIntoView({behavior: "smooth"});
        });
		hide("#multipleUserLicenseIntro");
	}
}

function getYouTubeEmbedUrl(url) {
    return `https://jasonsavard.com/embed-youtube-video?url=${encodeURIComponent(url)}`;
}

(async () => {

    await docReady();
    await initUI();
	
	selectorAll("title, .titleLink").forEach(el => el.textContent = extensionName);
	slideUp("#multipleUserLicenseWrapper");

	byId("video").src = getYouTubeEmbedUrl("https://www.youtube.com/embed/pN9aec4QjRQ?si=PYcur0y1MzkfmqfM");

    const accountsWithoutErrors = getAccountsWithoutErrors(accounts);
	email = getFirstEmail( accountsWithoutErrors );
	ensureEmail(true);

	initCurrencyAndMinimums(getMessage("currencyCode")).then(() => {
        if (getUrlValue("ref") == "reducedDonationFromNotif") {
    		niceAlert(getMessage("reducedDonationAd_popup", [getMessage("extraFeatures"), formatCurrency(minimumDonation)]), true);
    	}
    });

	if (canHaveALicense(email)) {
        hide("#paymentType");
    
        show("#singleUserButton");
        onClick("#singleUserButton", () => {
            slideUp("#singleUserButton");
            slideDown("#paymentType");
        });

        hide("#multipleUserLicenseLink");
        byId("multipleUserLicenseButton").textContent = getMessage("multipleUserLicenseFor", email.split("@")[1]);
        show("#multipleUserLicenseButtonWrapper");
	}
	
    const action = getUrlValue("action");

    if (action == "paypalSuccess" || action == "stripeSuccess") {
        hideBeforeSuccessfulPayment();
        
        new Promise((resolve, reject) => {
            if (ITEM_ID == "screenshots") {
                resolve();
            } else {
                showLoading();
                Controller.verifyPayment(ITEM_ID, email).then(response => {
                    hideLoading();
                    if (response.unlocked) {
                        resolve(response);
                    } else {
                        const content = new DocumentFragment();

                        const $link = document.createElement("a");
                        $link.href = "https://jasonsavard.com/contact";
                        $link.textContent = "contact";

                        content.append("Could not match your email, please ", $link, " the developer!");

                        openDialog(content, {
                            title: getMessage("theresAProblem")
                        });
                    }
                }).catch(error => {
                    hideLoading();
                    // show success anyways because they might just have extensions preventing access to my server
                    showSuccessfulPayment();
                    sendGA("paypal", 'failure ' + error + ' but show success anyways');
                });
            }
        }).then(response => {
            showSuccessfulPayment(response);
        });
    } else if (action == "paypalError" || action == "stripeError") {
        const error = getUrlValue("error") || "";
        
        openDialog(getMessage("tryAgainLater") + " " + getMessage("or") + " " + "try another payment method instead.", {
            title: getMessage("theresAProblem") + " " + error
        });
        
        if (action == "paypalError") {
            sendGA("paypal", 'failure ' + error);
        } else if (action == "stripeError") {
            sendGA("stripe", 'failure ' + error);
        }
    } else if (action == "stripeCancel") {
        niceAlert("Try another payment method instead.");
        if (isPayPalSubscriptionsSupported()) {
            show("#paypal");
        }
    } else if (action == "coinbaseSuccess") {
        showSuccessfulPayment();
	} else {
		// nothing
	}
	
	var contributionType = getUrlValue("contributionType");
	
	if (contributionType == "monthly") {
		// nothing
	}
	
    addEventListeners("[name='paymentType']", "change", function() {
		initCurrencyAndMinimums(getCurrencyCode());
		
		if (window.matchMedia && window.matchMedia("(min-height: 800px)").matches) {
			showAmountSelections();
		} else {
                hide("#multipleUserLicenseIntro");

            byId("video").style.opacity = 0; // to avoid seeing scrollbar jump in iframe
                slideUp("#extraFeaturesWrapper", 800);
			setTimeout(() => {
				showAmountSelections();
			}, 200);
		}
        sendGA("paymentTypeClicked", this.value);
	});
	
    byId("currency").addEventListener("change", function(e) {
        const currencyCode = e.target.value;
		initCurrencyAndMinimums(currencyCode);
	});
	
    function attachClickToInitPayment(selector, name) {
        onClick(selector, () => {
            initPaymentDetails(name);
            sendGA("paymentProcessorClicked", name);
        });
    }

    attachClickToInitPayment("#paypal", "paypal");
    attachClickToInitPayment("#stripe, #googlePay", "stripe");
    attachClickToInitPayment("#alipay", "alipay");
    attachClickToInitPayment("#wechat-pay", "wechat");
    attachClickToInitPayment("#applePay", "applePay");

    onClick("#coinbase", () => {
		if (isMonthly() || isYearlyForAllExtensions()) {
			niceAlert("Coinbase doesn't support recurring payments, please try the other payment options.");
		} else {
			initPaymentDetails("coinbase");
			sendGA("paymentProcessorClicked", "coinbase");
		}
	});

    onClick(".amountSelections j-button", event => {
        amount = event.target.getAttribute("amount");
        amount = Controller.convertUSDToOtherCurrency(amount, getCurrencyCode());
        amountSelected(amount)
    });

    onClick("#submitDonationAmount", () => {
        amount = getAmountNumberOnly();
        amountSelected(amount);
    });

    onClick("#amount", function() {
        this.removeAttribute("placeholder");
        slideUp("#paymentMethods");
    });

    byId("amount").addEventListener("input", function() {
        byId("amount").setCustomValidity("");
    });

    byId("amount").addEventListener("keydown", event => {
        if (event.key == 'Enter' && !event.isComposing) {
            byId("submitDonationAmount").click();
        } else {
            byId("submitDonationAmount").classList.add("visible");
        }
    });
	
    onClick("#alreadyDonated", () => {
		if (email) {
			showLoading();
			Controller.verifyPayment(ITEM_ID, email).then(response => {
				hideLoading();
				if (response.unlocked) {
					showSuccessfulPayment(response);
				} else {
                    const $dialog = document.createElement("div");
                    
                    const $noPaymentText = document.createElement("span");
                    $noPaymentText.textContent = "No payment found for email";
                    
                    const $separator = document.createTextNode(": ");
                    
                    const $emailSpan = document.createElement("span");
                    $emailSpan.id = "noPaymentEmail";
                    $emailSpan.style.fontWeight = "bold";
                    $emailSpan.textContent = email;
                    
                    const $instructionDiv = document.createElement("div");
                    $instructionDiv.textContent = "Make sure to sign into the Google account which you contributed from, then try again!";
                    
                    const $helpText = document.createElement("span");
                    $helpText.textContent = "If your contribution is not recognized then please use the ";
                    
                    const $link = document.createElement("a");
                    $link.href = "https://jasonsavard.com/already-contributed-form";
                    $link.textContent = "already contributed form";
                    
                    $helpText.append($link);
                    
                    $dialog.append($noPaymentText, $separator, $emailSpan, createBR(), createBR(), $instructionDiv, createBR(), $helpText);
                    
                    openDialog($dialog).then(response => {
						if (response == "ok") {
							
						}
					});
				}
			}).catch(error => {
                console.error(error);
				hideLoading();
                openDialog(getMessage("tryAgainLater"), {
                    title: getMessage("theresAProblem")
				});
			});
		} else {
			ensureEmail();
		}
	});
	
    onClick("#multipleUserLicenseLink, #multipleUserLicenseButton", () => {

        if (ITEM_ID == "screenshots") {
            niceAlert("Click Ok to contact the developer to purchase a multiple user license.").then(() => {
                openUrl("https://jasonsavard.com/contact?ref=otherLicense");
            });

            return;
        }

        //email = "test@company.com";

        slideUp("#multipleUserLicenseIntro");
        slideUp('#donateAmountWrapper');
		if (email) {
            byId("licenseDomain").textContent = `@${email.split("@")[1]}`;
			if (canHaveALicense(email)) {
                slideUp("#singleUserButton");
                slideUp("#paymentType");
                slideUp("#paymentMethods");
                    
                selectorAll("#licenseOptions j-item").forEach(el => {
                    var users = el.getAttribute("users");
                    var price = el.getAttribute("price");
					
					var userText;
					var priceText;
					
					if (users == 1) {
						userText = getMessage("Xuser", 1);
						priceText = getMessage("anyAmount");
					} else if (users == "other") {
						// do nothing
					} else {
						if (users == "unlimited") {
							userText = getMessage("Xusers", getMessage("unlimited"));
						} else {
							userText = getMessage("Xusers", users);
						}
						priceText = "$" + price + "/" + getMessage("month").toLowerCase();
					}
					
					if (userText) {
                        el.querySelectorAll("div")[0].textContent = userText;
                        el.querySelectorAll("div")[1].textContent = priceText;
					}
					
                    onClickReplace(el, event => {
						sendGA("license", users + "");
						if (users == 1) {
                            slideDown("#paymentType");
                            slideUp("#paymentMethods");
                            hide("#multipleUserLicenseLink");
                            slideDown("#multipleUserLicenseIntro");
                            slideUp("#multipleUserLicenseWrapper");
						} else if (users == "other") {
							location.href = "https://jasonsavard.com/contact?ref=otherLicense";
						} else {
							if (event.ctrlKey) {
								price = 0.01;
							}
							licenseSelected = {number:users, price:price};

                            //byId("paymentType").value = "monthly";
                            setPaymentType("monthly");

							licenseType = "multipleUsers";
							initCurrencyAndMinimums(); // called only to set default currency to usd

							//if (isPayPalSubscriptionsSupported()) {
								//initPaymentDetails("paypal");
							//} else {
								initPaymentDetails("stripe");
							//}
						}
                    });
				});
			} else {
                hide("#licenseOnlyValidFor");
                show("#signInAsUserOfOrg");
                hide("#licenseOptions");
                
                const exampleEmail = byId("exampleEmail");
                emptyNode(exampleEmail);
				
                const span = document.createElement("span");
                span.textContent = email.split("@")[0];
            
                const company = document.createElement("b");
                company.textContent = "@mycompany.com";

                exampleEmail.append(span, company);
			}
            slideDown("#multipleUserLicenseWrapper");
		} else {
			ensureEmail();
		}
		
		sendGA("license", "start");
	});
	
    onClick("#changeDomain", () => {
        openDialog(getMessage("changeThisDomain", getMessage("changeThisDomain2")), {
            buttons: [
                {
                    label: getMessage("changeThisDomain2"),
                    onClick: () => {
                        signOut();
			}
                }
            ]
		});
	});
	
    onClick("#options", () => {
		location.href = "options.html";
	});
	
	onClick(".signOutAndSignIn", () => {
        signOut();
	});
	
    onClick(".driveExtraFeatures", () => {
		chrome.tabs.create({url:"https://jasonsavard.com/Checker-Plus-for-Google-Drive?ref=contributePage"});
	});

    onClick(".gmailExtraFeatures", () => {
		chrome.tabs.create({url:"https://jasonsavard.com/Checker-Plus-for-Gmail?ref=contributePage"});
	});

    onClick(".calendarExtraFeatures", () => {
		chrome.tabs.create({url:"https://jasonsavard.com/Checker-Plus-for-Google-Calendar?ref=contributePage"});
	});

    onClick(".screenshotExtraFeatures", () => {
        chrome.tabs.create({url:"https://jasonsavard.com/Explain-and-Send-Screenshots?ref=contributePage"});
	});

    onClick(".checkerPlusCompose", () => {
        chrome.tabs.create({url:"https://jasonsavard.com/wiki/Checker_Plus_Compose?ref=contributePage"});
    });

    onClick(".support", () => {
        chrome.tabs.create({url:"https://jasonsavard.com/forum/?ref=contributePage"});
    });

	// load these things at the end
	
	// prevent jumping due to anchor # and because we can't javascript:; or else content security errors appear
    onClick("a[href='#']", event => {
        event.preventDefault();
	});
})();