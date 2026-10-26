(function (window, jQuery) {
    'use strict';

    if (!jQuery) {
        if (window.console && console.error) {
            console.error('[Tracker] jQuery is required.');
        }
        return;
    }

    function getTrackingConfig() {
        return window.TrackingConfig || {};
    }

    function getConfigArray(name) {
        var value = getTrackingConfig()[name];
        return Array.isArray(value) ? value : [];
    }

    function getLowerConfigArray(name) {
        return getConfigArray(name).map(function (value) {
            return String(value || '').trim().toLowerCase();
        }).filter(Boolean);
    }

    function getDealerConfig() {
        var dealer = getTrackingConfig().dealer;
        return dealer && typeof dealer === 'object' ? dealer : {};
    }

    function normalizeFuelType(value, fallback) {
        var original = String(value == null ? '' : value).trim();
        var fuel = original.toLowerCase();

        if (/^(h|hev|phev)$/.test(fuel) || /\bhybrid\b/.test(fuel)) return 'Hybrid';
        if (fuel === 'd' || /\bdiesel\b/.test(fuel)) return 'Diesel';
        if (/^(e|ev|bev)$/.test(fuel) || /\belectric\b|\bbattery[- ]?powered\b/.test(fuel)) return 'Electric';
        if (fuel === 'g' || /\b(gas|gasoline|petrol|unleaded)\b/.test(fuel)) return 'Gasoline';

        return fallback !== undefined ? fallback : original;
    }

    var activeVehicleData = null;
    var formTypeCache = {};

    var knownMakes = [
        "Polaris",
        "Yamaha",
        "Honda",
        "Kawasaki",
        "Can-Am",
        "CanAm",
        "Can Am",
        "Sea-Doo",
        "SeaDoo",
        "Ski-Doo",
        "SkiDoo",
        "Suzuki",
        "KTM",
        "Harley-Davidson",
        "Harley",
        "BMW",
        "Indian",
        "Slingshot",
        "Ducati",
        "Triumph",
        "CFMOTO",
        "Arctic Cat",
        "Timbersled",
        "Kymco",
        "Lynx",
        "BRP",
        "Taiga",
        "Aprilia",
        "Benelli",
        "BETA",
        "GasGas",
        "Husqvarna",
        "Moto Guzzi",
        "MV Agusta",
        "Royal Enfield",
        "Vespa",
        "Zero",
        "LiveWire",
        "Hisun",
        "Massimo",
        "Segway",
        "Cub Cadet",
        "John Deere"
    ];

    var noiseWords = [
        "omg",
        "i",
        "want",
        "to",
        "drive",
        "buy",
        "the",
        "a",
        "an",
        "please",
        "looking",
        "for",
        "need",
        "quote",
        "get",
        "info",
        "about",
        "interested",
        "in",
        "can",
        "you",
        "give",
        "me",
        "price",
        "on",
        "this",
        "unit",
        "yamaga",
        "is",
        "awesome",
        "have",
        "finally",
        "of",
        "year",
        "yess",
        "yes",
        "thank",
        "thanks",
        "hate",
        "love",
        "being",
        "alive",
        "am",
        "are",
        "was",
        "were",
        "be",
        "been",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "shall",
        "should",
        "may",
        "might",
        "must",
        "very",
        "really",
        "so",
        "too",
        "just",
        "quite",
        "how",
        "what",
        "when",
        "where",
        "why",
        "who",
        "which",
        "there",
        "here",
        "then",
        "now",
        "that",
        "these",
        "those",
        "it",
        "its",
        "my",
        "mine",
        "your",
        "yours",
        "his",
        "hers",
        "our",
        "ours",
        "their",
        "theirs",
        "we",
        "us",
        "they",
        "them",
        "he",
        "she",
        "him",
        "her",
        "and",
        "but",
        "or",
        "nor",
        "as",
        "at",
        "by",
        "from",
        "into",
        "like",
        "over",
        "through",
        "with",
        "without",
        "after",
        "before",
        "under",
        "around",
        "among",
        "im",
        "id",
        "ill",
        "ive",
        "cant",
        "wont",
        "dont",
        "doesnt",
        "didnt",
        "isnt",
        "arent",
        "wasnt",
        "werent",
        "hasnt",
        "havent",
        "hadnt",
        "wouldnt",
        "couldnt",
        "shouldnt",
        "much",
        "many",
        "some",
        "any",
        "all",
        "every",
        "each",
        "no",
        "none",
        "one",
        "two",
        "three",
        "four",
        "five",
        "six",
        "seven",
        "eight",
        "nine",
        "ten",
        "first",
        "last",
        "new",
        "used",
        "good",
        "bad",
        "great",
        "well",
        "better",
        "best",
        "worst",
        "vehicle",
        "car",
        "truck",
        "suv",
        "motorcycle",
        "bike",
        "atv",
        "utv",
        "sxs",
        "boat",
        "trailer",
        "machine",
        "ride",
        "riding",
        "test",
        "divr"
    ];

    var directionsUrls = [
        "google.com/maps",
        "maps.google.com",
        "maps.app.goo.gl",
        "goo.gl/maps"
    ];

    var contactProtocols = [
        "tel:",
        "sms:"
    ];

    var departments = [
        "Sales",
        "Service",
        "Parts"
    ];

    function getDynamicFormType() {
        var currentFormTypeDataAttribute = jQuery('[form-name]').last().attr('form-name');
        return currentFormTypeDataAttribute || 'Other';
    }

    function buildVehicleDataFromFormInputs(formElement) {
        if (!formElement || formElement.length === 0) return null;

        var extractedSpecs = {};
        var foundDataAttributes = false;

        formElement.find('[data-form-vehicle]').each(function () {
            var $wrapperOrInput = jQuery(this);
            var key = $wrapperOrInput.attr('data-form-vehicle');
            var val = '';

            if ($wrapperOrInput.is('input, select, textarea')) {
                val = $wrapperOrInput.val();
            } else {
                val = $wrapperOrInput.find('input, select, textarea').first().val();
            }

            if (key && val) {
                extractedSpecs[key] = val;
                foundDataAttributes = true;
            }
        });

        if (foundDataAttributes) {
            var vData = {
                status: extractedSpecs['status'] || '',
                year: extractedSpecs['year'] || '',
                make: extractedSpecs['make'] || '',
                model: extractedSpecs['model'] || '',
                trim: extractedSpecs['trim'] || '',
                engine: extractedSpecs['engine'] || '',
                transmission: extractedSpecs['transmission'] || '',
                interiorColor: extractedSpecs['interiorColor'] || '',
                exteriorColor: extractedSpecs['exteriorColor'] || '',
                vin: extractedSpecs['vin'] || '',
                driveTrain: extractedSpecs['driveTrain'] || '',
                msrp: (
                    extractedSpecs['msrp']
                        ? extractedSpecs['msrp'].replace(/[^0-9.]/g, '')
                        : ''
                ) || '',
                displayedPrice: (
                    extractedSpecs['displayedPrice']
                        ? extractedSpecs['displayedPrice'].replace(/[^0-9.]/g, '')
                        : ''
                ) || '',
                fuelType: extractedSpecs['fuelType'] || ''
            };

            var unitNameStr =
                extractedSpecs['unitName'] ||
                extractedSpecs['name'] ||
                '';

            if (unitNameStr) {
                var workingStr = unitNameStr;

                var yearMatches =
                    workingStr.match(/\b(20\d{2}|19\d{2})\b/g);

                if (yearMatches) {
                    if (!vData.year) {
                        vData.year = yearMatches[0];
                    }

                    for (var y = 0; y < yearMatches.length; y++) {
                        workingStr =
                            workingStr.replace(yearMatches[y], ' ');
                    }
                }

                var detectedMake = '';

                var configuredDealerBrand =
                    String(
                        getDealerConfig().dealerBrand || ''
                    ).trim();

                if (configuredDealerBrand) {
                    var db =
                        configuredDealerBrand.toLowerCase();

                    if (
                        workingStr
                            .toLowerCase()
                            .indexOf(db) > -1
                    ) {
                        detectedMake =
                            configuredDealerBrand;
                    }
                }

                if (!detectedMake) {
                    for (
                        var m = 0;
                        m < knownMakes.length;
                        m++
                    ) {
                        var mkRegex =
                            new RegExp(
                                '\\b' +
                                knownMakes[m] +
                                '\\b',
                                'i'
                            );

                        if (mkRegex.test(workingStr)) {
                            detectedMake =
                                knownMakes[m];

                            break;
                        }
                    }
                }

                if (detectedMake) {
                    if (!vData.make) {
                        vData.make =
                            detectedMake;
                    }

                    var mkRemoveRegex =
                        new RegExp(
                            '\\b' +
                            detectedMake +
                            '\\b',
                            'gi'
                        );

                    workingStr =
                        workingStr.replace(
                            mkRemoveRegex,
                            ' '
                        );
                }

                var currentNoiseWords = noiseWords.slice();

                if (vData.make) {
                    currentNoiseWords.push(
                        vData.make.toLowerCase()
                    );
                }

                var words =
                    workingStr
                        .split(/\s+/)
                        .filter(Boolean);

                var cleanModelWords = [];

                for (
                    var w = 0;
                    w < words.length;
                    w++
                ) {
                    var cleanWord =
                        words[w].replace(
                            /[^a-zA-Z0-9\-.]/g,
                            ''
                        );

                    var lowerWord =
                        cleanWord.toLowerCase();

                    if (
                        cleanWord &&
                        currentNoiseWords.indexOf(
                            lowerWord
                        ) === -1
                    ) {
                        cleanModelWords.push(
                            cleanWord
                        );
                    }
                }

                if (
                    !vData.model &&
                    cleanModelWords.length > 0
                ) {
                    vData.model =
                        cleanModelWords
                            .slice(0, 5)
                            .join(' ');
                }

                if (
                    !vData.make &&
                    cleanModelWords.length > 0
                ) {
                    vData.make =
                        cleanModelWords.shift();

                    vData.model =
                        cleanModelWords
                            .slice(0, 4)
                            .join(' ');
                }
            }

            vData.status =
                getVehicleStatus(
                    vData.status
                );

            vData.fuelType = normalizeFuelType(vData.fuelType);

            return vData;
        }

        var formSpecs = {};

        formElement
            .find(
                'input, select, textarea'
            )
            .each(function () {
                var name = (
                    jQuery(this).attr('name') ||
                    jQuery(this).attr(
                        'data-name'
                    ) ||
                    ''
                ).toLowerCase();

                var val =
                    jQuery(this).val();

                if (name && val) {
                    formSpecs[name] = val;
                }
            });

        if (
            formSpecs['year'] ||
            formSpecs['make'] ||
            formSpecs['model'] ||
            formSpecs['vin']
        ) {
            var formStatus =
                getVehicleStatus(
                    formSpecs['status'] ||
                    formSpecs['condition'] ||
                    ''
                );

            var rawFuel =
                formSpecs['fueltype'] ||
                formSpecs['fuel'] ||
                formSpecs['fuel type'] ||
                '';

            var parsedFuel = normalizeFuelType(rawFuel, '');

            return {
                status: formStatus,
                year:
                    formSpecs['year'] ||
                    '',
                make:
                    formSpecs['make'] ||
                    '',
                model:
                    formSpecs['model'] ||
                    '',
                trim:
                    formSpecs['trim'] ||
                    '',
                engine:
                    formSpecs['engine'] ||
                    '',
                transmission:
                    formSpecs[
                    'transmission'
                    ] || '',
                interiorColor:
                    formSpecs[
                    'interiorcolor'
                    ] ||
                    formSpecs[
                    'interior color'
                    ] ||
                    '',
                exteriorColor:
                    formSpecs[
                    'exteriorcolor'
                    ] ||
                    formSpecs[
                    'exterior color'
                    ] ||
                    formSpecs['color'] ||
                    '',
                vin:
                    formSpecs['vin'] ||
                    '',
                driveTrain:
                    formSpecs[
                    'drivetrain'
                    ] ||
                    formSpecs[
                    'drive train'
                    ] ||
                    '',
                msrp: (
                    formSpecs['msrp']
                        ? formSpecs[
                            'msrp'
                        ].replace(
                            /[^0-9.]/g,
                            ''
                        )
                        : ''
                ) || '',
                displayedPrice: (
                    formSpecs['price']
                        ? formSpecs[
                            'price'
                        ].replace(
                            /[^0-9.]/g,
                            ''
                        )
                        : ''
                ) || '',
                fuelType:
                    parsedFuel
            };
        }

        return null;
    }

    function getVehicleStatus(
        statusValue
    ) {
        var status =
            String(
                statusValue || ''
            )
                .trim()
                .toLowerCase();

        if (status) {
            if (
                status.includes(
                    'cpo'
                ) ||
                status.includes(
                    'certified'
                )
            ) {
                return 'CPO';
            }

            if (
                status.includes(
                    'used'
                ) ||
                status.includes(
                    'pre-owned'
                ) ||
                status.includes(
                    'preowned'
                ) ||
                status.includes(
                    'owned'
                )
            ) {
                return 'Used';
            }

            if (
                status.includes(
                    'new'
                )
            ) {
                return 'New';
            }
        }

        var url =
            window.location.href
                .toLowerCase();

        var params =
            new URLSearchParams(
                window.location.search
            );

        var condition =
            (
                params.get(
                    'condition'
                ) || ''
            ).toLowerCase();

        var conditions =
            condition
                .split('|')
                .map(function (
                    value
                ) {
                    return value.trim();
                })
                .filter(Boolean);

        var hasNew =
            conditions.includes(
                'new'
            ) ||
            url.includes(
                'new-inventory'
            ) ||
            url.includes('/new/');

        var hasUsed =
            conditions.some(
                function (value) {
                    return (
                        value ===
                        'pre-owned' ||
                        value ===
                        'preowned' ||
                        value ===
                        'used'
                    );
                }
            ) ||
            url.includes(
                'pre-owned-inventory'
            ) ||
            url.includes(
                'used-inventory'
            );

        if (
            hasNew &&
            hasUsed
        ) {
            return '';
        }

        if (hasNew) {
            return 'New';
        }

        if (hasUsed) {
            return 'Used';
        }

        return '';
    }

    function getCurrentVehicleData(
        formElement
    ) {
        var vehicleToSend = null;

        if (
            typeof activeVehicleData !==
            'undefined' &&
            activeVehicleData
        ) {
            vehicleToSend =
                jQuery.extend(
                    {},
                    activeVehicleData
                );
        }

        var fallbackData = null;

        if (
            formElement &&
            formElement.length > 0
        ) {
            fallbackData =
                buildVehicleDataFromFormInputs(
                    formElement
                );
        }

        if (fallbackData) {
            if (vehicleToSend) {
                for (
                    var key in fallbackData
                ) {
                    if (
                        vehicleToSend[
                        key
                        ] !== ''
                    ) {
                        fallbackData[key] =
                            vehicleToSend[
                            key
                            ];
                    }
                }
            } else {
                vehicleToSend =
                    fallbackData;
            }
        }

        return vehicleToSend;
    }

    function initPageTypeTracking(
        onPageviewSent
    ) {
        if (
            initPageTypeTracking
                .initialized
        ) {
            return;
        }

        initPageTypeTracking.initialized =
            true;

        function getOrCreateSessionUserId() {
            var userIdKey =
                'sd_custom_user_id';

            var currentUserId =
                sessionStorage.getItem(
                    userIdKey
                );

            if (!currentUserId) {
                currentUserId =
                    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
                        .replace(
                            /[xy]/g,
                            function (c) {
                                var r =
                                    Math.random() *
                                    16 |
                                    0;

                                var v =
                                    c == 'x'
                                        ? r
                                        : (
                                            r &
                                            0x3 |
                                            0x8
                                        );

                                return v.toString(
                                    16
                                );
                            }
                        );

                sessionStorage.setItem(
                    userIdKey,
                    currentUserId
                );
            }

            return currentUserId;
        }

        var dealerData =
            jQuery.extend(
                true,
                {},
                getDealerConfig()
            );

        dealerData.language =
            dealerData.language ||
            'en';

        dealerData.sessionId =
            getOrCreateSessionUserId();

        dealerData.customer =
            jQuery.extend(
                {},
                dealerData.customer ||
                {}
            );

        dealerData.customer.language =
            dealerData.customer
                .language ||
            dealerData.language;

        function getDynamicPageType() {
            if (document.querySelector('.inventory-single-content')) {
                return 'Vehicle Details';
            }

            if (document.querySelector('#inventory-units-main-container')) {
                return 'Vehicle Listing';
            }

            if (document.querySelector('.error404-content, body.error404')) {
                return 'Page Not Found';
            }

            var explicitType = jQuery('[page-type]').first().attr('page-type');
            if (explicitType && explicitType.trim()) {
                return explicitType.trim();
            }

            var path = window.location.pathname || '/';
            if (path === '/' || path === '') {
                return 'Home';
            }

            if (/^\/(?:success|thank[-_]?you|confirmation)(?:[-_/]|$)/i.test(path)) {
                return 'Other';
            }

            function normalize(value) {
                value = String(value || '');
                try {
                    value = decodeURIComponent(value);
                } catch (e) {
                }
                return value.toLowerCase()
                    .replace(/&/g, ' and ')
                    .replace(/[^a-z0-9]+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            }

            var urlText = normalize(path);
            var heading = document.querySelector('main h1, #main h1, #content h1, h1');
            var headingText = normalize(heading ? heading.textContent : '');

            if (!headingText) {
                headingText = normalize((document.title || '').split('|')[0]);
            }

            function matchRules(rules, text) {
                if (!text) return '';
                for (var i = 0; i < rules.length; i++) {
                    if (rules[i][1].test(text)) return rules[i][0];
                }
                return '';
            }

            var specificRules = [
                ['Page Not Found', /^(404|page not found)$/],
                ['Payment Estimator', /\b(payment estimator|payment calculator|monthly payment calculator|what can i afford|affordability calculator)\b/],
                ['Service Credit Card', /\bservice (credit card|card financing)\b/],
                ['Service Xpress', /\b(service xpress|express service|quick service)\b/],
                ['Service Event', /\bservice (event|clinic|open house)\b/],
                ['Service Specials', /\b(service|maintenance|repair) (specials|offers|coupons|promotions)\b/],
                ['Parts Specials', /\bparts (specials|offers|coupons|promotions)\b/],
                ['Parts Order Form', /\b(order parts|parts order|parts request|request parts)\b/],
                ['Schedule Service', /\b(schedule|book|request) (a )?(service|maintenance|repair|appointment)\b|\bservice (appointment|booking|request|scheduler)\b/],
                ['Maintenance Menu', /\b(maintenance (menu|schedule)|scheduled maintenance)\b/],
                ['Service Menu', /\bservice (menu|pricing|price list)\b/],
                ['Finance Prequalification', /\b(pre qualif(?:y|ication)|pre approval|pre approved|credit pre approval|finance prequal)\b/],
                ['OEM Incentives', /\b(oem|manufacturer|factory) (incentives|offers|rebates|specials|promotions)\b|\bincentives\b/],
                ['Dealer Specials', /\b(dealer specials|sales specials|vehicle specials|inventory specials|special offers|promotions|current offers)\b/],
                ['Tire Finder', /\b(tire|tyre) (finder|search|selector)\b/],
                ['Tire Store', /\b(tire|tyre) (store|shop|center|centre)\b/],
                ['CPOV Program', /\b(certified pre owned|certified preowned|cpov|certified used) (program|vehicles|inventory)?\b/],
                ['Model Showroom', /\b(model showroom|model lineup|model line up|explore models|all models)\b/],
                ['Test Drive', /\b(test drive|test ride|schedule a ride|book a ride|demo ride)\b/],
                ['Trade In', /\b(trade in|trade value|trade appraisal|value your trade|value my trade|sell your vehicle)\b/],
                ['Hours & Directions', /\b(hours and directions|hours directions|directions and hours|store hours|dealership hours|find us|get directions|our location|directions)\b/],
                ['Competitive Advantage', /\b(why buy from us|why choose us|why buy here|our advantage|competitive advantage)\b/],
                ['Business Elite', /\bbusiness elite\b/],
                ['OnStar', /\bonstar\b/],
                ['DriverGear', /\bdriver ?gear\b/],
                ['Brochure', /\b(brochure|e brochure|download catalog|download catalogue)\b/],
                ['Finance', /\b(finance application|financing application|apply for financing|apply for credit|finance center|financing center)\b/],
                ['Vehicle Details', /\b(vehicle details|unit details|inventory details)\b/],
                ['Vehicle Listing', /\b(new inventory|used inventory|pre owned inventory|all inventory|inventory search|view inventory|search inventory|vehicles for sale|units for sale)\b/],
                ['Contact Us', /\b(contact us|contact the dealer|contact dealership|get in touch)\b/],
                ['About Us', /\b(about us|our dealership|meet our team|our story|who we are)\b/],
                ['Blog', /\b(blog|news and insights|news articles|latest news)\b/],
                ['Accessories Home', /\baccessories home\b/],
                ['Service Home', /\bservice home\b/],
                ['Parts Home', /\bparts home\b/],
                ['Custom Dealer Content', /\b(video gallery|warranty (and )?recall|recall lookup|recall look up)\b/]
            ];

            var detected = matchRules(specificRules, urlText);
            if (detected) return detected;

            detected = matchRules(specificRules, headingText);
            if (detected) return detected;

            var genericRules = [
                ['Showroom', /\bshowroom\b/],
                ['Vehicle Listing', /\binventory\b/],
                ['Finance', /\b(finance|financing|payment options)\b/],
                ['Service', /\b(service|repairs|repair center|maintenance)\b/],
                ['Parts', /\bparts\b/],
                ['Accessories', /\baccessories\b/],
                ['Dealer Specials', /\b(specials|offers|coupons)\b/],
                ['Contact Us', /\bcontact\b/],
                ['About Us', /\babout\b/],
                ['Blog', /\b(news|articles)\b/]
            ];

            detected = matchRules(genericRules, urlText);
            if (detected) return detected;

            detected = matchRules(genericRules, headingText);
            return detected || 'Other';
        }

        var dynamicPageType =
            getDynamicPageType();

        dealerData.pageType =
            dynamicPageType;

        var scrapedSpecs = {};

        if (
            dynamicPageType ===
            'Vehicle Details'
        ) {
            setTimeout(
                function () {
                    jQuery(
                        '.single-info-desc-name'
                    ).each(
                        function () {
                            var $this =
                                jQuery(this);

                            var infoName =
                                $this
                                    .text()
                                    .trim()
                                    .toLowerCase()
                                    .replace(
                                        ':',
                                        ''
                                    );

                            var infoValue =
                                $this
                                    .next(
                                        '.single-info-values'
                                    )
                                    .text()
                                    .trim();

                            if (
                                infoName &&
                                infoValue
                            ) {
                                scrapedSpecs[
                                    infoName
                                ] =
                                    infoValue;
                            }
                        }
                    );

                    jQuery(
                        '.glance-basic-info, .unit-more-info'
                    ).each(
                        function () {
                            var $this =
                                jQuery(this);

                            var infoName =
                                $this
                                    .find(
                                        '.info-title'
                                    )
                                    .text()
                                    .trim()
                                    .toLowerCase()
                                    .replace(
                                        ':',
                                        ''
                                    );

                            var infoValue =
                                $this
                                    .find(
                                        '.info-value'
                                    )
                                    .text()
                                    .trim();

                            if (
                                infoName &&
                                infoValue
                            ) {
                                scrapedSpecs[
                                    infoName
                                ] =
                                    infoValue;
                            }
                        }
                    );

                    var vdpData = {
                        status:
                            getVehicleStatus(
                                scrapedSpecs[
                                'condition'
                                ] ||
                                scrapedSpecs[
                                'status'
                                ] ||
                                ''
                            ),

                        year:
                            scrapedSpecs[
                            'year'
                            ] ||
                            jQuery(
                                '.vehicle-year'
                            )
                                .text()
                                .trim() ||
                            'Unknown',

                        make:
                            scrapedSpecs[
                            'make'
                            ] ||
                            'Unknown',

                        model:
                            scrapedSpecs[
                            'model'
                            ] ||
                            jQuery(
                                '.vehicle-model'
                            )
                                .text()
                                .trim() ||
                            'Unknown',

                        trim:
                            scrapedSpecs[
                            'trim'
                            ] ||
                            'Unknown',

                        engine:
                            scrapedSpecs[
                            'engine'
                            ] ||
                            scrapedSpecs[
                            'engine type'
                            ] ||
                            'Unknown',

                        transmission:
                            scrapedSpecs[
                            'transmission'
                            ] ||
                            'Unknown',

                        interiorColor:
                            scrapedSpecs[
                            'interior color'
                            ] ||
                            'Unknown',

                        exteriorColor:
                            scrapedSpecs[
                            'color'
                            ] ||
                            scrapedSpecs[
                            'exterior color'
                            ] ||
                            'Unknown',

                        vin:
                            scrapedSpecs[
                            'vin'
                            ] ||
                            'Unknown',

                        driveTrain:
                            scrapedSpecs[
                            'drivetrain'
                            ] ||
                            scrapedSpecs[
                            'drive train'
                            ] ||
                            'Unknown',

                        msrp: (
                            scrapedSpecs[
                                'msrp'
                            ]
                                ? scrapedSpecs[
                                    'msrp'
                                ].replace(
                                    /[^0-9.]/g,
                                    ''
                                )
                                : 'Unknown'
                        ) || 'Unknown',

                        displayedPrice:
                            jQuery(
                                '.price-with-label .prices b'
                            )
                                .last()
                                .text()
                                .replace(
                                    /[^0-9.]/g,
                                    ''
                                ) ||
                            (
                                scrapedSpecs[
                                    'price'
                                ]
                                    ? scrapedSpecs[
                                        'price'
                                    ].replace(
                                        /[^0-9.]/g,
                                        ''
                                    )
                                    : 'Unknown'
                            ) ||
                            'Unknown',

                        fuelType: normalizeFuelType(scrapedSpecs['fuel type'], '')
                    };

                    dealerData.vehicleDetails =
                        vdpData;

                    activeVehicleData =
                        vdpData;

                    sd(
                        'dataLayer',
                        dealerData
                    );

                    sd(
                        'send',
                        'pageview'
                    );

                    if (
                        typeof onPageviewSent ===
                        'function'
                    ) {
                        onPageviewSent();
                    }
                },
                1000
            );

        } else if (
            dynamicPageType ===
            'Vehicle Listing'
        ) {
            sd(
                'dataLayer',
                dealerData
            );

            sd(
                'send',
                'pageview'
            );

            if (
                typeof onPageviewSent ===
                'function'
            ) {
                onPageviewSent();
            }

            setTimeout(
                function () {
                    var urlParams =
                        new URLSearchParams(
                            window.location
                                .search
                        );

                    function getParam(
                        key,
                        defaultValue
                    ) {
                        var val =
                            urlParams.get(
                                key
                            );

                        return (
                            val &&
                            val.trim() !==
                            ''
                        )
                            ? decodeURIComponent(
                                val
                            )
                            : (
                                defaultValue ||
                                'All'
                            );
                    }

                    var searchResultsCount =
                        '0';

                    var totalResultsElem =
                        jQuery(
                            '.inventory-total-results'
                        );

                    if (
                        totalResultsElem
                            .length > 0
                    ) {
                        var match =
                            totalResultsElem
                                .text()
                                .match(
                                    /of\s+([\d,]+)/i
                                );

                        if (match) {
                            searchResultsCount =
                                match[1]
                                    .replace(
                                        /,/g,
                                        ''
                                    );
                        }
                    }

                    var minPrice;
                    var maxPrice;

                    var priceParam =
                        urlParams.get(
                            'price'
                        );

                    if (priceParam) {
                        var parts =
                            priceParam
                                .split('-');

                        if (
                            parts[0] &&
                            !isNaN(
                                parts[0]
                            )
                        ) {
                            minPrice =
                                Number(
                                    parts[0]
                                );
                        }

                        if (
                            parts[1] &&
                            !isNaN(
                                parts[1]
                            )
                        ) {
                            maxPrice =
                                Number(
                                    parts[1]
                                );
                        }
                    } else {
                        if (
                            urlParams.get(
                                'min_price'
                            ) &&
                            !isNaN(
                                urlParams.get(
                                    'min_price'
                                )
                            )
                        ) {
                            minPrice =
                                Number(
                                    urlParams.get(
                                        'min_price'
                                    )
                                );
                        }

                        if (
                            urlParams.get(
                                'max_price'
                            ) &&
                            !isNaN(
                                urlParams.get(
                                    'max_price'
                                )
                            )
                        ) {
                            maxPrice =
                                Number(
                                    urlParams.get(
                                        'max_price'
                                    )
                                );
                        }
                    }

                    var yearsVal =
                        getParam(
                            'years',
                            getParam(
                                'year',
                                'All'
                            )
                        );

                    if (
                        yearsVal !==
                        'All' &&
                        yearsVal.indexOf(
                            '-'
                        ) > -1
                    ) {
                        var yearParts =
                            yearsVal.split(
                                '-'
                            );

                        var startYear =
                            parseInt(
                                yearParts[0],
                                10
                            );

                        var endYear =
                            parseInt(
                                yearParts[1],
                                10
                            );

                        if (
                            !isNaN(
                                startYear
                            ) &&
                            !isNaN(
                                endYear
                            ) &&
                            startYear <=
                            endYear
                        ) {
                            var expandedYears =
                                [];

                            for (
                                var y =
                                    startYear;
                                y <=
                                endYear;
                                y++
                            ) {
                                expandedYears.push(
                                    y
                                );
                            }

                            yearsVal =
                                expandedYears.join(
                                    '|'
                                );
                        }
                    }

                    function getConditionFromURL() {
                        var statusParam =
                            decodeURIComponent(
                                getParam(
                                    'condition',
                                    ''
                                )
                            );

                        if (
                            statusParam &&
                            statusParam !==
                            'All'
                        ) {
                            return statusParam;
                        }

                        var pathname =
                            window.location
                                .pathname
                                .toLowerCase();

                        if (
                            pathname.includes(
                                'new-inventory'
                            )
                        ) {
                            return 'New';
                        }

                        if (
                            pathname.includes(
                                'pre-owned-inventory'
                            ) ||
                            pathname.includes(
                                'used-inventory'
                            )
                        ) {
                            return 'Pre-Owned';
                        }

                        return 'All';
                    }

                    var filterData = {
                        countSearchResults:
                            searchResultsCount,

                        filterSearch: {
                            year:
                                yearsVal,

                            make:
                                getParam(
                                    'make',
                                    'All'
                                ),

                            model:
                                getParam(
                                    'model',
                                    'All'
                                ),

                            status:
                                (function () {
                                    var status =
                                        decodeURIComponent(
                                            getConditionFromURL()
                                        );

                                    var conditions =
                                        status
                                            .split(
                                                '|'
                                            )
                                            .map(
                                                function (
                                                    item
                                                ) {
                                                    return item
                                                        .trim()
                                                        .toLowerCase();
                                                }
                                            );

                                    if (
                                        conditions.includes(
                                            'new'
                                        ) &&
                                        conditions.includes(
                                            'pre-owned'
                                        )
                                    ) {
                                        return 'Mixed';
                                    }

                                    if (
                                        conditions.includes(
                                            'pre-owned'
                                        ) ||
                                        conditions.includes(
                                            'owned'
                                        )
                                    ) {
                                        return 'Used';
                                    }

                                    return status;
                                })(),

                            color:
                                getParam(
                                    'color',
                                    'All'
                                ),

                            trim:
                                getParam(
                                    'trim',
                                    'All'
                                ),

                            driveTerrain:
                                getParam(
                                    'driveTerrain',
                                    getParam(
                                        'driveTerrain',
                                        'All'
                                    )
                                ),

                            bodyStyle:
                                getParam(
                                    'category',
                                    getParam(
                                        'bodyStyle',
                                        'All'
                                    )
                                ),

                            features:
                                getParam(
                                    'features',
                                    'All'
                                )
                        },

                        events:
                            'filterSearch'
                    };

                    if (
                        minPrice !==
                        undefined
                    ) {
                        filterData
                            .filterSearch
                            .minPrice =
                            minPrice;
                    }

                    if (
                        maxPrice !==
                        undefined
                    ) {
                        filterData
                            .filterSearch
                            .maxPrice =
                            maxPrice;
                    }

                    sd(
                        'dataLayer',
                        filterData
                    );

                    sd('send');
                },
                800
            );

            jQuery('body').on(
                'click',
                '.modal-link[data-inventory-id]',
                function () {
                    var inventoryId =
                        jQuery(this).attr(
                            'data-inventory-id'
                        );

                    var $card =
                        jQuery(
                            '.manage-inventory-container[data-inventory-id="' +
                            inventoryId +
                            '"]'
                        );

                    if (
                        $card.length > 0
                    ) {
                        var titleText =
                            $card
                                .find(
                                    '.inventory-main-title h2'
                                )
                                .text()
                                .replace(
                                    /\s+/g,
                                    ' '
                                )
                                .trim();

                        var bText =
                            $card
                                .find(
                                    '.inventory-main-title h2 b'
                                )
                                .text()
                                .replace(
                                    /\s+/g,
                                    ' '
                                )
                                .trim();

                        var yearMatch =
                            bText.match(
                                /\b(20\d{2}|19\d{2})\b/
                            );

                        var year =
                            yearMatch
                                ? yearMatch[0]
                                : '';

                        var make =
                            bText
                                .replace(
                                    year,
                                    ''
                                )
                                .trim() ||
                            dealerData
                                .dealerBrand ||
                            'Unknown';

                        var model =
                            titleText
                                .replace(
                                    bText,
                                    ''
                                )
                                .trim() ||
                            '';

                        var status =
                            getVehicleStatus(
                                titleText
                            );

                        var msrp =
                            $card
                                .find(
                                    '.list-msrp'
                                )
                                .text()
                                .replace(
                                    /[^0-9.]/g,
                                    ''
                                ) ||
                            '';

                        var displayedPrice =
                            $card
                                .find(
                                    '.list-sale-price'
                                )
                                .first()
                                .text()
                                .replace(
                                    /[^0-9.]/g,
                                    ''
                                ) ||
                            '';

                        var specs = {};

                        $card
                            .find(
                                '.spec-name-value'
                            )
                            .each(
                                function () {
                                    var name =
                                        jQuery(
                                            this
                                        )
                                            .find(
                                                '.spec-name'
                                            )
                                            .text()
                                            .toLowerCase()
                                            .trim();

                                    var val =
                                        jQuery(
                                            this
                                        )
                                            .find(
                                                '.spec-value'
                                            )
                                            .text()
                                            .trim();

                                    specs[name] =
                                        val;
                                }
                            );

                        var rawFuelType =
                            specs['fuel type'] ||
                            $card.find('.spec-name-value.fuel_type .spec-value.fuel_type').first().attr('title') ||
                            '';

                        var fuelType = normalizeFuelType(rawFuelType, '');

                        activeVehicleData = {
                            status:
                                status,

                            year:
                                year,

                            make:
                                make,

                            model:
                                model,

                            trim:
                                specs[
                                'trim'
                                ] ||
                                '',

                            engine:
                                specs[
                                'engine'
                                ] ||
                                '',

                            transmission:
                                specs[
                                'transmission'
                                ] ||
                                '',

                            interiorColor:
                                specs[
                                'interior color'
                                ] ||
                                '',

                            exteriorColor:
                                specs[
                                'exterior color'
                                ] ||
                                specs[
                                'color'
                                ] ||
                                '',

                            vin:
                                specs[
                                'vin'
                                ] ||
                                specs[
                                'stock #'
                                ] ||
                                '',

                            driveTrain:
                                specs[
                                'drivetrain'
                                ] ||
                                '',

                            msrp:
                                msrp,

                            displayedPrice:
                                displayedPrice,

                            fuelType:
                                fuelType
                        };
                    }
                }
            );

        } else {
            sd(
                'dataLayer',
                dealerData
            );

            sd(
                'send',
                'pageview'
            );

            if (
                typeof onPageviewSent ===
                'function'
            ) {
                onPageviewSent();
            }
        }
    }

    function getDisplayType(
        element
    ) {
        return (
            element &&
            element.closest(
                '.modal, .modal__container, [role="dialog"]'
            )
        )
            ? 'modal'
            : 'in-page';
    }

    function checkAndFireFormShown(
        clickIdCTA
    ) {
        if (
            clickIdCTA == null
        ) {
            return;
        }

        var activeForms =
            new Set();

        jQuery(
            '.wpcf7:visible'
        ).each(
            function () {
                var $form =
                    jQuery(this);

                var formId =
                    $form.attr(
                        'data-wpcf7-id'
                    ) ||
                    'unknown';

                var displayType =
                    getDisplayType(
                        this
                    );

                if (
                    clickIdCTA === 0 &&
                    displayType !==
                    'in-page'
                ) {
                    return;
                }

                if (
                    clickIdCTA !== 0 &&
                    String(formId) !==
                    String(
                        clickIdCTA
                    )
                ) {
                    return;
                }

                if (
                    activeForms.has(
                        formId
                    )
                ) {
                    return;
                }

                activeForms.add(
                    formId
                );

                var vehicle =
                    getCurrentVehicleData(
                        $form
                    );

                var formShownData = {
                    formType:
                        getDynamicFormType(),

                    displayType:
                        displayType,

                    events:
                        'formShown'
                };

                if (vehicle) {
                    formShownData
                        .formVehicle =
                        vehicle;
                }

                sd(
                    'dataLayer',
                    formShownData
                );

                sd('send');
            }
        );
    }

    function initFormShownTracking() {
        if (
            initFormShownTracking
                .initialized
        ) {
            return;
        }

        initFormShownTracking.initialized =
            true;

        var delay = 400;

        setTimeout(
            function () {
                checkAndFireFormShown(
                    0
                );
            },
            delay
        );

        jQuery('body').on(
            'click',
            '.modal-link',
            function () {
                var matches =
                    (
                        jQuery(this)
                            .attr(
                                'class'
                            ) || ''
                    ).match(
                        /cf7-\d+/g
                    );

                var formId =
                    matches
                        ? parseInt(
                            matches
                                .pop()
                                .replace(
                                    'cf7-',
                                    ''
                                ),
                            10
                        )
                        : null;

                setTimeout(
                    function () {
                        checkAndFireFormShown(
                            formId
                        );
                    },
                    delay
                );
            }
        );
    }

    function initSearchTracking() {
        var selector =
            '.inventory-search-input, input[name="sortSearch"]';

        var lastSearchTime =
            0;

        function fireSearchTracking(
            value
        ) {
            var searchValue =
                String(
                    value || ''
                ).trim();

            if (!searchValue) {
                return;
            }

            var now =
                Date.now();

            if (
                now -
                lastSearchTime <
                1000
            ) {
                return;
            }

            lastSearchTime =
                now;

            sd(
                'dataLayer',
                {
                    typedSearchContent:
                        searchValue.replace(
                            /\s+/g,
                            '|'
                        ),

                    events:
                        'typedSearch'
                }
            );

            sd('send');
        }

        jQuery('body')
            .off(
                'keydown.sdSearch',
                selector
            )
            .on(
                'keydown.sdSearch',
                selector,
                function (e) {
                    if (
                        e.key ===
                        'Enter'
                    ) {
                        fireSearchTracking(
                            jQuery(this)
                                .val()
                        );
                    }
                }
            )
            .off(
                'click.sdSearch',
                'form .cta-submit, form button[type="submit"]'
            )
            .on(
                'click.sdSearch',
                'form .cta-submit, form button[type="submit"]',
                function () {
                    var $input =
                        jQuery(this)
                            .closest(
                                'form'
                            )
                            .find(
                                selector
                            )
                            .first();

                    if (
                        $input.length
                    ) {
                        fireSearchTracking(
                            $input.val()
                        );
                    }
                }
            );
    }

    function initServiceOfferClickTracking() {
        jQuery('body').on(
            'click',
            'a.service-promo-link',
            function () {
                var $link =
                    jQuery(this);

                var fields = {
                    offerCategory:
                        'category',

                    offerType:
                        'type',

                    offerName:
                        'name',

                    offerExpire:
                        'expire',

                    offerStatus:
                        'status'
                };

                var offerData =
                    {};

                jQuery.each(
                    fields,
                    function (
                        key,
                        attribute
                    ) {
                        offerData[key] =
                            $link.attr(
                                'data-promotion-' +
                                attribute
                            ) ||
                            'Unknown';
                    }
                );

                sd(
                    'dataLayer',
                    {
                        events:
                            'serviceOfferClick',

                        serviceOfferClick:
                            offerData
                    }
                );

                sd('send');
            }
        );
    }

    function initBrochureDownloadTracking() {
        jQuery('body').on(
            'click',
            'a[data-download-brochure="true"]',
            function () {
                var assetName =
                    jQuery(this)
                        .attr(
                            'download'
                        ) ||
                    'Unknown_Asset';

                sd(
                    'dataLayer',
                    {
                        events:
                            'brochureDownload',

                        brochureName:
                            assetName
                    }
                );

                sd('send');
            }
        );
    }

    function initOfferClickTracking() {
        var selector =
            '.promotions-row__cont a[href], ' +
            '.oem-mp__promotions-grid .oem-mp__card-media[href], ' +
            '.oem-mp__promotions-grid .oem-mp__coupon-button, ' +
            '.oem-mp__featured .oem-mp__featured-card a';

        jQuery('body')
            .off(
                'click.offerTracking'
            )
            .on(
                'click.offerTracking',
                selector,
                function () {
                    var $element =
                        jQuery(this);

                    var $img =
                        $element
                            .find('img')
                            .first();

                    var offerName =
                        $element.attr(
                            'title'
                        ) ||
                        $element.attr(
                            'data-coupon-title'
                        ) ||
                        $img.attr(
                            'alt'
                        ) ||
                        $element
                            .closest(
                                '.oem-mp__card'
                            )
                            .find(
                                '.oem-mp__card-title'
                            )
                            .text()
                            .trim() ||
                        (
                            $element.attr(
                                'aria-label'
                            ) || ''
                        ).replace(
                            /^View (coupon for )?/i,
                            ''
                        ) ||
                        'Unknown_Offer';

                    sd(
                        'dataLayer',
                        {
                            events:
                                'offerClick',

                            offerClick: {
                                offerName:
                                    offerName
                                        .trim()
                            }
                        }
                    );

                    sd('send');
                }
            );
    }

    function initFinancingClickTracking() {
        var financeKeywords =
            getLowerConfigArray(
                'financeKeywords'
            );

        jQuery('body').on(
            'click',
            'a[href]',
            function () {
                var $link =
                    jQuery(this);

                var href =
                    (
                        $link.attr(
                            'href'
                        ) || ''
                    ).toLowerCase();

                if (
                    href.startsWith('tel:') ||
                    href.startsWith('sms:')
                ) {
                    return;
                }

                var text =
                    $link
                        .text()
                        .trim()
                        .toLowerCase();

                var title =
                    (
                        $link.attr(
                            'title'
                        ) || ''
                    ).toLowerCase();

                var className =
                    $link.attr(
                        'class'
                    ) || '';

                var isModalFormLink =
                    $link.hasClass(
                        'modal-link'
                    ) ||
                    /(^|\s)cf7-[^\s]+/i.test(
                        className
                    );

                if (
                    isModalFormLink
                ) {
                    return;
                }

                var isFinanceLink =
                    $link.hasClass(
                        'cta-financing'
                    ) ||
                    financeKeywords.some(
                        function (
                            keyword
                        ) {
                            return (
                                href.includes(
                                    keyword
                                ) ||
                                text.includes(
                                    keyword
                                ) ||
                                title.includes(
                                    keyword
                                )
                            );
                        }
                    );

                if (
                    !isFinanceLink
                ) {
                    return;
                }

                sd(
                    'dataLayer',
                    {
                        linkType:
                            'Finance',

                        events:
                            'linkClick'
                    }
                );

                sd('send');
            }
        );
    }

    function initClickToCallTracking() {
        jQuery('body').on(
            'click',
            'a[href]',
            function () {
                var $link =
                    jQuery(this);

                var href =
                    (
                        $link.attr(
                            'href'
                        ) || ''
                    ).toLowerCase();

                if (
                    !contactProtocols.some(
                        function (
                            protocol
                        ) {
                            return href.startsWith(
                                protocol
                            );
                        }
                    )
                ) {
                    return;
                }

                var linkContext =
                    (
                        $link.text() +
                        ' ' +
                        (
                            $link.attr(
                                'title'
                            ) || ''
                        )
                    ).toLowerCase();

                var parentContext =
                    $link
                        .closest('p')
                        .text()
                        .toLowerCase();

                function findDepartment(
                    text
                ) {
                    return departments.find(
                        function (
                            dept
                        ) {
                            return text.includes(
                                String(
                                    dept ||
                                    ''
                                )
                                    .toLowerCase()
                            );
                        }
                    );
                }

                var department =
                    findDepartment(
                        linkContext
                    ) ||
                    findDepartment(
                        parentContext
                    ) ||
                    'Other';

                sd(
                    'dataLayer',
                    {
                        clickToCallDepartment:
                            department,

                        events:
                            href.startsWith(
                                'sms:'
                            )
                                ? 'clickToText'
                                : 'clickToCall'
                    }
                );

                sd('send');
            }
        );
    }

    function initGetDirectionsTracking() {
        jQuery('body').on(
            'click',
            'a[href]',
            function () {
                var href =
                    (
                        jQuery(this)
                            .attr(
                                'href'
                            ) || ''
                    ).toLowerCase();

                if (
                    directionsUrls.some(
                        function (
                            url
                        ) {
                            return href.includes(
                                url
                            );
                        }
                    )
                ) {
                    sd(
                        'dataLayer',
                        {
                            events:
                                'getDirections'
                        }
                    );

                    sd('send');
                }
            }
        );
    }

    function initScheduleServiceClickTracking() {
        var scheduleServiceUrls =
            getLowerConfigArray(
                'scheduleServiceUrls'
            );

        jQuery('body').on(
            'click',
            'a[href]',
            function () {
                var href =
                    (
                        jQuery(this)
                            .attr(
                                'href'
                            ) || ''
                    ).toLowerCase();

                if (
                    scheduleServiceUrls.some(
                        function (
                            url
                        ) {
                            return href.includes(
                                url
                            );
                        }
                    )
                ) {
                    sd(
                        'dataLayer',
                        {
                            events:
                                'scheduleServiceClick'
                        }
                    );

                    sd('send');
                }
            }
        );
    }

    function initCarouselClickTracking() {
        var selector =
            '.data-carrusel a[href]:not(.flex-prev, .flex-next)';

        jQuery('body')
            .off(
                'click.carouselTracking',
                selector
            )
            .on(
                'click.carouselTracking',
                selector,
                function () {
                    var $link =
                        jQuery(this);

                    var $slide =
                        $link.closest(
                            '.swiper-slide, .metaslider .slides > li'
                        );

                    var position = 1;

                    if (
                        $slide.hasClass(
                            'swiper-slide'
                        )
                    ) {
                        var index =
                            $slide.attr(
                                'data-swiper-slide-index'
                            );

                        position =
                            index !==
                                undefined
                                ? parseInt(
                                    index,
                                    10
                                ) + 1
                                : $slide
                                    .prevAll(
                                        '.swiper-slide'
                                    )
                                    .length +
                                1;

                    } else if (
                        $slide.is('li')
                    ) {
                        var $originalSlides =
                            $slide
                                .parent()
                                .children(
                                    'li:not(.clone)'
                                );

                        position =
                            $originalSlides
                                .index(
                                    $slide
                                ) +
                            1;

                        if (!position) {
                            position =
                                $slide
                                    .prevAll(
                                        'li:not(.clone)'
                                    )
                                    .length
                                    ? 1
                                    : $originalSlides
                                        .length;
                        }

                    } else if (
                        $link.is(
                            '.promo-slide'
                        )
                    ) {
                        position =
                            $link
                                .prevAll(
                                    '.promo-slide'
                                )
                                .length +
                            1;
                    } else {
                        return;
                    }

                    var src =
                        $link
                            .find('img')
                            .first()
                            .attr(
                                'src'
                            ) ||
                        $slide
                            .find('img')
                            .first()
                            .attr(
                                'src'
                            ) ||
                        '';

                    var assetName =
                        src
                            .split('/')
                            .pop()
                            .split(
                                /[?#]/
                            )[0]
                            .replace(
                                /\.[^/.]+$/,
                                ''
                            ) ||
                        'Unknown_Asset';

                    sd(
                        'dataLayer',
                        {
                            carouselClick: {
                                assetPosition:
                                    position,

                                assetName:
                                    assetName
                            },

                            events:
                                'carouselClick'
                        }
                    );

                    sd('send');
                }
            );
    }

    function initFormFieldTracking() {
        if (
            initFormFieldTracking
                .initialized
        ) {
            return;
        }

        initFormFieldTracking.initialized =
            true;

        var initiatedForms =
            new WeakSet();

        var selector =
            '.wpcf7-form-control:not(.wpcf7-submit)';

        function getFieldName(
            name
        ) {
            name =
                (
                    name ||
                    'other'
                ).toLowerCase();

            if (
                /\b(last[-_]?name|lname)\b/
                    .test(name)
            ) {
                return 'lastname';
            }

            if (
                /\b(middle[-_]?name|mname)\b/
                    .test(name)
            ) {
                return 'middlename';
            }

            if (
                /\b(first[-_]?name|fname|your[-_]?name)\b/
                    .test(name) ||
                name === 'name'
            ) {
                return 'firstname';
            }

            if (
                /\b(email|e-mail)\b/
                    .test(name)
            ) {
                return 'emailaddress';
            }

            if (
                /\b(phone|cell|mobile|tel)\b/
                    .test(name)
            ) {
                return 'phonenumber';
            }

            if (
                /\b(address|street)\b/
                    .test(name) &&
                !name.includes('ip') &&
                !name.includes('mac')
            ) {
                return 'address';
            }

            if (
                /\bcity\b/
                    .test(name)
            ) {
                return 'city';
            }

            if (
                /\b(state|province)\b/
                    .test(name)
            ) {
                return 'state';
            }

            if (
                /\b(zip|zipcode|postal)\b/
                    .test(name)
            ) {
                return 'zipcode';
            }

            if (
                /\b(message|comment|comments)\b/
                    .test(name)
            ) {
                return 'comments';
            }

            return 'other';
        }

        jQuery('body').on(
            'focusin.sdFormFields',
            selector,
            function () {
                var $field =
                    jQuery(this);

                var $form =
                    $field.closest(
                        'form.wpcf7-form'
                    );

                var $wrapper =
                    $field.closest(
                        '.wpcf7'
                    );

                if (
                    !$form.length ||
                    !$wrapper.length
                ) {
                    return;
                }

                var form =
                    $form[0];

                var vehicle =
                    getCurrentVehicleData(
                        $wrapper
                    );

                var formData = {
                    formType:
                        formTypeCache[
                        $form.attr(
                            'id'
                        )
                        ] ||
                        formTypeCache[
                        $wrapper.attr(
                            'id'
                        )
                        ] ||
                        getDynamicFormType(),

                    displayType:
                        getDisplayType(
                            this
                        )
                };

                if (vehicle) {
                    formData
                        .formVehicle =
                        vehicle;
                }

                if (
                    !initiatedForms.has(
                        form
                    )
                ) {
                    initiatedForms.add(
                        form
                    );

                    sd(
                        'dataLayer',
                        {
                            ...formData,
                            events:
                                'formInitiation'
                        }
                    );

                    sd('send');
                }

                sd(
                    'dataLayer',
                    {
                        ...formData,

                        events:
                            'formFieldInteraction',

                        formFieldName:
                            getFieldName(
                                $field.attr(
                                    'name'
                                )
                            )
                    }
                );

                sd('send');
            }
        );

        var ctaModal =
            document.getElementById(
                'cta-modal'
            );

        if (ctaModal) {
            new MutationObserver(
                function () {
                    if (
                        !ctaModal
                            .classList
                            .contains(
                                'is-open'
                            )
                    ) {
                        jQuery(
                            ctaModal
                        )
                            .find(
                                'form.wpcf7-form'
                            )
                            .each(
                                function () {
                                    initiatedForms
                                        .delete(
                                            this
                                        );
                                }
                            );
                    }
                }
            ).observe(
                ctaModal,
                {
                    attributes:
                        true,

                    attributeFilter:
                        ['class']
                }
            );
        }
    }

    function initFormTracking() {
        if (
            initFormTracking
                .initialized
        ) {
            return;
        }

        initFormTracking.initialized =
            true;

        function getForm(
            element
        ) {
            var $element =
                jQuery(element);

            if (
                $element.is(
                    'form.wpcf7-form'
                )
            ) {
                return $element;
            }

            var $form =
                $element.closest(
                    'form.wpcf7-form'
                );

            return $form.length
                ? $form
                : $element
                    .find(
                        'form.wpcf7-form'
                    )
                    .first();
        }

        function getTradeInValue(
            $form,
            field
        ) {
            var $element =
                $form
                    .find(
                        '[data-trade-in="' +
                        field +
                        '"]'
                    )
                    .first();

            if (
                !$element.is(
                    'input, select, textarea'
                )
            ) {
                $element =
                    $element
                        .find(
                            'input, select, textarea'
                        )
                        .first();
            }

            return String(
                $element.val() ||
                ''
            ).trim();
        }

        function trackFormEvent(
            element,
            eventType,
            errorMessage,
            deduplicate
        ) {
            var $form =
                getForm(
                    element
                );

            if (
                !$form.length
            ) {
                return;
            }

            var isError =
                eventType ===
                'formSubmissionError';

            if (
                isError &&
                deduplicate !==
                false
            ) {
                var now =
                    Date.now();

                var lastTracked =
                    $form.data(
                        'last_error_time'
                    ) ||
                    0;

                if (
                    now -
                    lastTracked <
                    2000
                ) {
                    return;
                }

                $form.data(
                    'last_error_time',
                    now
                );
            }

            var formId =
                $form.attr(
                    'id'
                );

            var wrapperId =
                $form
                    .closest(
                        '.wpcf7'
                    )
                    .attr(
                        'id'
                    );

            var formType =
                formTypeCache[
                formId
                ] ||
                formTypeCache[
                wrapperId
                ] ||
                getDynamicFormType();

            var vehicle =
                getCurrentVehicleData(
                    $form
                );

            var data = {
                formType:
                    formType,

                displayType:
                    getDisplayType(
                        $form[0]
                    ),

                events:
                    eventType,

                prefContact:
                    'email',

                leadType:
                    'lead',

                leadId:
                    sessionStorage
                        .getItem(
                            'sd_custom_user_id'
                        ) ||
                    'unknown',

                formOptIn:
                    'in-implicit'
            };

            if (vehicle) {
                data.formVehicle =
                    vehicle;
            }

            if (isError) {
                data.formError =
                    errorMessage ||
                    'Validation failed';

                data.language =
                    'en';

                data.customer = {
                    language:
                        'en'
                };
            }

            if (
                !isError &&
                formType.includes(
                    'Trade In'
                )
            ) {
                data.tradeIn =
                    {};

                [
                    'year',
                    'make',
                    'model'
                ].forEach(
                    function (
                        field
                    ) {
                        data.tradeIn[
                            field
                        ] =
                            getTradeInValue(
                                $form,
                                field
                            ) ||
                            (
                                vehicle &&
                                vehicle[
                                field
                                ]
                            ) ||
                            '';
                    }
                );
            }

            sd(
                'dataLayer',
                data
            );

            sd('send');
        }

        document.addEventListener(
            'click',
            function (event) {
                var button =
                    event.target.closest(
                        '.wpcf7-submit'
                    );

                if (!button) {
                    return;
                }

                var $form =
                    getForm(
                        button
                    );

                if (
                    !$form.length
                ) {
                    return;
                }

                setTimeout(
                    function () {
                        var error =
                            $form
                                .find(
                                    '.wpcf7-not-valid-tip'
                                )
                                .first()
                                .text()
                                .trim();

                        if (error) {
                            trackFormEvent(
                                $form[0],
                                'formSubmissionError',
                                error
                            );
                        }
                    },
                    150
                );
            },
            true
        );

        document.addEventListener(
            'wpcf7invalid',
            function (event) {
                var response =
                    event.detail &&
                    event.detail
                        .apiResponse;

                var fields =
                    response &&
                    response
                        .invalid_fields;

                var message =
                    fields &&
                        fields.length
                        ? fields[0]
                            .message
                        : 'Validation failed';

                trackFormEvent(
                    event.target,
                    'formSubmissionError',
                    message
                );
            }
        );

        document.addEventListener(
            'wpcf7spam',
            function (event) {
                trackFormEvent(
                    event.target,
                    'formSubmissionError',
                    'Submission was referred to as spam',
                    false
                );
            }
        );

        document.addEventListener(
            'wpcf7mailsent',
            function (event) {
                trackFormEvent(
                    event.target,
                    'formSubmission'
                );
            }
        );
    }

    jQuery(document).ready(
        function () {
            initPageTypeTracking(
                function () {
                    initFormShownTracking();
                    initSearchTracking();
                    initServiceOfferClickTracking();
                    initBrochureDownloadTracking();
                    initOfferClickTracking();
                    initFinancingClickTracking();
                    initClickToCallTracking();
                    initGetDirectionsTracking();
                    initScheduleServiceClickTracking();
                    initCarouselClickTracking();

                    initFormTracking();
                    initFormFieldTracking();
                }
            );
        }
    );

})(window, window.jQuery);
