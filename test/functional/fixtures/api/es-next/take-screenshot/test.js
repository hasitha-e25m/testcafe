var path            = require('path');
var expect          = require('chai').expect;
var config          = require('../../../../config.js');
var assertionHelper = require('../../../../assertion-helper.js');

var CUSTOM_SCREENSHOT_DIR              = '___test-screenshots___';
var SCREENSHOT_PATH_MESSAGE_RE         = /^___test-screenshots___[\\/]\d{4,4}-\d{2,2}-\d{2,2}_\d{2,2}-\d{2,2}-\d{2,2}[\\/]test-1$/;
var SCREENSHOT_ON_FAIL_PATH_MESSAGE_RE = /^.*run-1/;
var SLASH_RE                           = /[\\/]/g;

var getReporter = function (scope) {
    const userAgents = { };

    function patchScreenshotPath (screenshotPath) {
        return screenshotPath.replace(SCREENSHOT_ON_FAIL_PATH_MESSAGE_RE, '').replace(CUSTOM_SCREENSHOT_DIR, '').replace(SLASH_RE, '_');
    }

    function prepareScreenshot (screenshot, quarantine) {
        screenshot.screenshotPath  = patchScreenshotPath(screenshot.screenshotPath);
        screenshot.thumbnailPath   = patchScreenshotPath(screenshot.thumbnailPath);
        screenshot.isPassedAttempt = quarantine[screenshot.quarantineAttemptID].passed;

        userAgents[screenshot.userAgent] = true;
    }

    return function () {
        return {
            reportTestDone: (name, testRunInfo) => {
                testRunInfo.screenshots.forEach(screenshot => prepareScreenshot(screenshot, testRunInfo.quarantine));

                scope.screenshots = testRunInfo.screenshots;
                scope.userAgents  = Object.keys(userAgents);
                scope.unstable    = testRunInfo.unstable;
            },
            reportFixtureStart: () => {
            },
            reportTaskStart: () => {
            },
            reportTaskDone: () => {
            }
        };
    };
};

describe('[API] t.takeScreenshot()', function () {
    if (config.useLocalBrowsers) {
        afterEach(assertionHelper.removeScreenshotDir);

        it('Should take a screenshot', function () {
            return runTests('./testcafe-fixtures/take-screenshot.js', 'Take a screenshot', { setScreenshotPath: true })
                .then(function () {
                    expect(SCREENSHOT_PATH_MESSAGE_RE.test(testReport.screenshotPath)).eql(true);
                    expect(assertionHelper.checkScreenshotsCreated({ forError: false, screenshotsCount: 4 })).eql(true);
                });
        });

        it('Should take a screenshot with a custom path (OS separator)', function () {
            return runTests('./testcafe-fixtures/take-screenshot.js', 'Take a screenshot with a custom path (OS separator)',
                { setScreenshotPath: true })
                .then(function () {
                    expect(testReport.screenshotPath).eql(CUSTOM_SCREENSHOT_DIR);

                    const screenshotsCheckingOptions = { forError: false, screenshotsCount: 2, customPath: 'custom' };

                    expect(assertionHelper.checkScreenshotsCreated(screenshotsCheckingOptions)).eql(true);
                });
        });

        it('Should take a screenshot with a custom path (DOS separator)', function () {
            return runTests('./testcafe-fixtures/take-screenshot.js', 'Take a screenshot with a custom path (DOS separator)',
                { setScreenshotPath: true })
                .then(function () {
                    expect(testReport.screenshotPath).contains(CUSTOM_SCREENSHOT_DIR);

                    const screenshotsCheckingOptions = { forError: false, screenshotsCount: 2, customPath: 'custom' };

                    expect(assertionHelper.checkScreenshotsCreated(screenshotsCheckingOptions)).eql(true);
                });
        });

        it('Should create warning if screenshotPath is not specified', function () {
            return runTests('./testcafe-fixtures/take-screenshot.js', 'Take a screenshot')
                .then(function () {
                    expect(assertionHelper.isScreenshotDirExists()).eql(false);
                    expect(testReport.warnings).eql([
                        'Was unable to take screenshots because the screenshot directory is not specified. To specify it, ' +
                        'use the "-s" or "--screenshots" command line option or the "screenshots" method of the ' +
                        'test runner in case you are using API.'
                    ]);
                });
        });

        it('Should create warning if screenshotPath is not specified even if a custom path is specified', function () {
            return runTests('./testcafe-fixtures/take-screenshot.js', 'Take a screenshot with a custom path (OS separator)')
                .then(function () {
                    expect(assertionHelper.isScreenshotDirExists()).eql(false);
                    expect(testReport.warnings).eql([
                        'Was unable to take screenshots because the screenshot directory is not specified. To specify it, ' +
                        'use the "-s" or "--screenshots" command line option or the "screenshots" method of the ' +
                        'test runner in case you are using API.'
                    ]);
                });
        });

        it('Should validate path argument', function () {
            return runTests('./testcafe-fixtures/take-screenshot.js', 'Incorrect action path argument', {
                shouldFail: true,
                only:       'chrome'
            })
                .catch(function (errs) {
                    expect(errs[0]).to.contains('The "path" argument is expected to be a non-empty string, but it was number.');
                    expect(errs[0]).to.contains(
                        '35 |test(\'Incorrect action path argument\', async t => {' +
                        ' > 36 |    await t.takeScreenshot(1); ' +
                        '37 |});'
                    );
                });
        });

        it('Should take a screenshot in quarantine mode', function () {
            return runTests('./testcafe-fixtures/take-screenshot.js', 'Take a screenshot in quarantine mode', {
                setScreenshotPath: true,
                quarantineMode:    true
            })
                .catch(function () {
                    expect(SCREENSHOT_PATH_MESSAGE_RE.test(testReport.screenshotPath)).eql(true);
                    expect(testReport.unstable).eql(false);

                    const screenshotsCheckingOptions = { forError: false, screenshotsCount: 2, runDirCount: 3 };

                    expect(assertionHelper.checkScreenshotsCreated(screenshotsCheckingOptions)).eql(true);
                });
        });

        it('Should throw warning when taking screenshots with same path', function () {
            return runTests('./testcafe-fixtures/take-screenshot.js', 'Take screenshots with same path', {
                setScreenshotPath: true
            }).then(function () {
                const screenshotFileName = path.join(CUSTOM_SCREENSHOT_DIR, '1.png');

                expect(testReport.warnings).eql([
                    `The file at "${screenshotFileName}" already exists. It has just been rewritten ` +
                    'with a recent screenshot. This situation can possibly cause issues. To avoid them, make sure ' +
                    'that each screenshot has a unique path. If a test runs in multiple browsers, consider ' +
                    'including the user agent in the screenshot path or generate a unique identifier in another way.'
                ]);
            });
        });

        it('Should crop screenshots to a page viewport area', function () {
            return runTests('./testcafe-fixtures/take-screenshot.js', 'Should crop screenshots',
                { setScreenshotPath: true })
                .then(function () {
                    return assertionHelper.checkScreenshotsCropped(false, 'custom');
                })
                .then(function (result) {
                    expect(result).eql(true);
                });
        });

        it('Should provide screenshot log to a reporter', function () {
            var result   = {};
            var reporter = getReporter(result);

            return runTests('./testcafe-fixtures/take-screenshot.js', 'Take screenshots for reporter', {
                setScreenshotPath:  true,
                quarantineMode:     true,
                screenshotsOnFails: true,
                reporters:          [{ reporter }]
            })
                .then(function () {
                    var getScreenshotsInfo = (screenshotPath, thumbnailPath, attempt, userAgent, takenOnFail) => {
                        if (!takenOnFail) {
                            screenshotPath = '_' + userAgent + attempt + screenshotPath;
                            thumbnailPath  = '_thumbnails' + screenshotPath;
                        }

                        return {
                            screenshotPath,
                            thumbnailPath,
                            takenOnFail,
                            quarantineAttemptID: attempt,
                            isPassedAttempt:     attempt > 1,
                            userAgent
                        };
                    };

                    var expected = result.userAgents.reduce(function (value, userAgent) {
                        for (var attempt = 1; attempt <= 4; attempt++) {
                            value.push(getScreenshotsInfo('1.png', null, attempt, userAgent, false));
                            value.push(getScreenshotsInfo('2.png', null, attempt, userAgent, false));
                        }

                        var errorScreenshotPath = '_' + userAgent + '_errors_1.png';
                        var errorThumbnailPath  = '_' + userAgent + '_errors_thumbnails_1.png';

                        value.push(getScreenshotsInfo(errorScreenshotPath, errorThumbnailPath, 1, userAgent, true));

                        return value;
                    }, []);

                    expect(result.screenshots).deep.members(expected);
                    expect(result.unstable).eql(true);
                });
        });
    }
});

describe('[API] t.takeElementScreenshot()', function () {
    if (config.useLocalBrowsers) {
        afterEach(assertionHelper.removeScreenshotDir);

        it('Should take screenshot of an element', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Element',
                { setScreenshotPath: true })
                .then(function () {
                    return assertionHelper.isScreenshotsEqual('custom', path.join(__dirname, './data/element.png'));
                })
                .then(function (result) {
                    expect(result).eql(true);
                });
        });

        it('Should create warning if screenshotPath is not specified even if a custom path is specified', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Element')
                .then(function () {
                    expect(assertionHelper.isScreenshotDirExists()).eql(false);
                    expect(testReport.warnings).eql([
                        'Was unable to take screenshots because the screenshot directory is not specified. To specify it, ' +
                        'use the "-s" or "--screenshots" command line option or the "screenshots" method of the ' +
                        'test runner in case you are using API.'
                    ]);
                });
        });

        it('Should validate selector argument', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Incorrect action selector argument', {
                shouldFail: true,
                only:       'chrome'
            })
                .catch(function (errs) {
                    expect(errs[0]).to.contains(
                        'Action "selector" argument error:  Selector is expected to be initialized with a ' +
                        'function, CSS selector string, another Selector, node snapshot or a Promise returned ' +
                        'by a Selector, but number was passed.'
                    );

                    expect(errs[0]).to.contains(
                        ' 29 |test(\'Incorrect action selector argument\', async t => {' +
                        ' > 30 |    await t.takeElementScreenshot(1, \'custom/\' + t.ctx.parsedUA.family + \'.png\');' +
                        ' 31 |});'
                    );
                });
        });

        it('Should validate path argument', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Incorrect action path argument', {
                shouldFail: true,
                only:       'chrome'
            })
                .catch(function (errs) {
                    expect(errs[0]).to.contains('The "path" argument is expected to be a non-empty string, but it was number.');
                    expect(errs[0]).to.contains(
                        ' 33 |test(\'Incorrect action path argument\', async t => {' +
                        ' > 34 |    await t.takeElementScreenshot(\'table\', 1);' +
                        ' 35 |});'
                    );
                });
        });

        it('Should take screenshot of an element with margins', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Element with margins',
                { setScreenshotPath: true })
                .then(function () {
                    return assertionHelper.isScreenshotsEqual('custom', path.join(__dirname, './data/element-with-margins.png'));
                })
                .then(function (result) {
                    expect(result).eql(true);
                });
        });

        it('Should perform top-left crop', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Top-left',
                { setScreenshotPath: true })
                .then(function () {
                    return assertionHelper.isScreenshotsEqual('custom', path.join(__dirname, './data/top-left.png'));
                })
                .then(function (result) {
                    expect(result).eql(true);
                });
        });

        it('Should perform top-left crop by default', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Default crop',
                { setScreenshotPath: true })
                .then(function () {
                    return assertionHelper.isScreenshotsEqual('custom', path.join(__dirname, './data/top-left.png'));
                })
                .then(function (result) {
                    expect(result).eql(true);
                });
        });

        it('Should perform top-right crop', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Top-right',
                { setScreenshotPath: true })
                .then(function () {
                    return assertionHelper.isScreenshotsEqual('custom', path.join(__dirname, './data/top-right.png'));
                })
                .then(function (result) {
                    expect(result).eql(true);
                });
        });


        it('Should perform bottom-left crop', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Bottom-left',
                { setScreenshotPath: true })
                .then(function () {
                    return assertionHelper.isScreenshotsEqual('custom', path.join(__dirname, './data/bottom-left.png'));
                })
                .then(function (result) {
                    expect(result).eql(true);
                });
        });


        it('Should perform bottom-right crop', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Bottom-right',
                { setScreenshotPath: true })
                .then(function () {
                    return assertionHelper.isScreenshotsEqual('custom', path.join(__dirname, './data/bottom-right.png'));
                })
                .then(function (result) {
                    expect(result).eql(true);
                });
        });

        it('Should throw an error if element dimensions are invalid', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Invalid dimensions', {
                setScreenshotPath: true,
                shouldFail:        true,
                only:              'chrome'
            })
                .catch(function (errs) {
                    const screenshotsCheckingOptions = { forError: false, screenshotsCount: 2, customPath: 'custom' };

                    expect(assertionHelper.checkScreenshotsCreated(screenshotsCheckingOptions)).eql(false);
                    expect(errs[0]).to.contains('Unable to capture an element image because the resulting image width is zero or negative.');
                    expect(errs[0]).to.contains(
                        ' 37 |test(\'Invalid dimensions\', async t => {' +
                        ' > 38 |    await t.takeElementScreenshot(\'table\', \'custom/\' + t.ctx.parsedUA.family + \'.png\', { crop: { left: -10, right: -50 } });' +
                        ' 39 |});'
                    );
                });
        });

        it('Should throw an error if the element is invisible', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Invisible element', {
                setScreenshotPath: true,
                shouldFail:        true,
                only:              'chrome'
            })
                .catch(function (errs) {
                    expect(errs[0]).to.contains('The element that matches the specified selector is not visible.');
                    expect(errs[0]).to.contains(
                        ' 43 |        .click(\'#hide\')' +
                        ' > 44 |        .takeElementScreenshot(\'table\', \'custom/\' + t.ctx.parsedUA.family + \'.png\');' +
                        ' 45 |});'
                    );
                });
        });

        it('Should throw an error if the element doesn\'t exist', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Non-existent element', {
                setScreenshotPath: true,
                shouldFail:        true,
                only:              'chrome'
            })
                .catch(function (errs) {
                    expect(errs[0]).to.contains('The specified selector does not match any element in the DOM tree.');
                    expect(errs[0]).to.contains(
                        ' 49 |        .click(\'#remove\')' +
                        ' > 50 |        .takeElementScreenshot(\'table\', \'custom/\' + t.ctx.parsedUA.family + \'.png\');' +
                        ' 51 |});'
                    );
                });
        });

        it('Should throw an error if the specified scroll target is out of the cropping region', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Invalid scroll target', {
                setScreenshotPath: true,
                shouldFail:        true,
                only:              'chrome'
            })
                .catch(function (errs) {
                    expect(errs[0]).to.contains('Unable to scroll to the specified point because a point ' +
                                                'with the specified scrollTargetX and scrollTargetY properties ' +
                                                'is not located inside the element\'s cropping region');
                    expect(errs[0]).to.contains(
                        ' 53 |test(\'Invalid scroll target\', async t => {' +
                        ' > 54 |    await t.takeElementScreenshot(\'table\', \'custom/\' + t.ctx.parsedUA.family + \'.png\', { scrollTargetX: -2000, scrollTargetY: -3000 });' +
                        ' 55 |});'
                    );
                });
        });

        it('Should capture screenshot of the element inside a same-domain iframe', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Same-domain iframe',
                { setScreenshotPath: true })
                .then(function () {
                    return assertionHelper.isScreenshotsEqual('custom', path.join(__dirname, './data/element.png'));
                })
                .then(function (result) {
                    expect(result).eql(true);
                });
        });

        it('Should capture screenshot of the element inside a nested iframe', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Nested iframes',
                { setScreenshotPath: true })
                .then(function () {
                    return assertionHelper.isScreenshotsEqual('custom', path.join(__dirname, './data/element.png'));
                })
                .then(function (result) {
                    expect(result).eql(true);
                });
        });

        it('Should capture screenshot of the element inside a cross-domain iframe', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Cross-domain iframe',
                { setScreenshotPath: true })
                .then(function () {
                    return assertionHelper.isScreenshotsEqual('custom', path.join(__dirname, './data/element.png'));
                })
                .then(function (result) {
                    expect(result).eql(true);
                });
        });

        it('Shouldn\'t scroll parent frames multiple times', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Rescroll parents',
                { setScreenshotPath: true })
                .then(function () {
                    return assertionHelper.isScreenshotsEqual('custom', path.join(__dirname, './data/element.png'));
                })
                .then(function (result) {
                    expect(result).eql(true);
                });
        });

        it('Should scroll to the scroll target when positive scrollTargetX/Y are specified', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Scroll target',
                { setScreenshotPath: true })
                .then(function () {
                    return assertionHelper.checkScreenshotIsNotWhite(false, 'custom');
                })
                .then(function (result) {
                    expect(result).eql(true);
                });
        });

        it('Should scroll to the scroll target when negative scrollTargetX/Y are specified', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Negative scroll target',
                { setScreenshotPath: true })
                .then(function () {
                    return assertionHelper.checkScreenshotIsNotWhite(false, 'custom');
                })
                .then(function (result) {
                    expect(result).eql(true);
                });
        });

        it('Should remove screenshot mark from an element screenshot when the element is in bottom right corner', function () {
            return runTests('./testcafe-fixtures/take-element-screenshot.js', 'Bottom-right element',
                { setScreenshotPath: true })
                .then(function () {
                    function referenceImagePathGetter (screenshotPath) {
                        const referenceImageName = screenshotPath.match(/chrome|firefox/i) ? 'element' : 'element-bottom-right';

                        return path.join(__dirname, `./data/${referenceImageName}.png`);
                    }

                    return assertionHelper.isScreenshotsEqual('custom', referenceImagePathGetter);
                })
                .then(function (result) {
                    expect(result).eql(true);
                });
        });
    }
});

