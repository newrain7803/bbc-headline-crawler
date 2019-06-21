const $ = require('cheerio');
const request = require('request');
const rp = require('request-promise');
const BASE_URL = "https://www.bbc.com";
const CROSS_REGION = /http.*/;
const ELE_A = 'a';
const ELE_DIV = 'div';
const ELE_FIGURE = 'figure';
const ELE_HR = 'hr';
const ELE_H2 = 'h2';
const ELE_LI = 'li';
const ELE_P = 'p';
const ELE_STRONG = 'strong';
const ELE_TEXT = 'text';
const ELE_UL = 'ul';
const IMG_PRESENTATIONAL_ALT = /[Pp]resentational [wg].+/;
const IMG_RES = /news\/[^\/]+\//;
const IMG_RES_640 = 'news/640/';
const NOT_BLANK = /^[\S\s]*\S+[\S\s]*$/;
let news = {};

const browse = async u => {
    return rp({
        url: u,
        method: 'GET',
        transform: b => {
            return $.load(b);
        },
        transform2xxOnly: true
    }).then(async $ => {
        news.url = u;

        console.log("Resolving...");

        const newsDiv = $('.story-body');
        news.title = newsDiv.find('.story-body__h1').text();

        if (newsDiv.find('.byline__name').length) {
            news.byName = newsDiv.find('.byline__name').text();
            news.byTitle = newsDiv.find('.byline__title').text();
        } else {
            news.byName = 'BBC';
            news.byTitle = 'Official';
        }

        news.timestamp = newsDiv.find('.date.date--v2').data('seconds');
        const newsBody = newsDiv.find('.story-body__inner').first();

        // console.log(newsBody.html());
        // console.log('------------------------------');

        news.contents = [];
        const bodyEls = newsBody.contents();
        for (let i = 0; i < bodyEls.length; i++) {
            await traversal(i, bodyEls.get(i), news.contents);
        }

        console.log("Resolve accomplished.");
        return news;
    }).catch(e => {
        console.error(e);
    });
};


const traversal = async (i, e, es) => {
    let o = {};
    if (!!e.name) {
        switch (e.name) {
            case ELE_FIGURE:
                es[i] = await handleFigure(e);
                break;
            case ELE_P:
                es[i] = handleP(e);
                break;
            case ELE_DIV:
                if ($(e).hasClass('mpu-ad') || $(e).hasClass('social-embed')) {
                    es[i] = null;
                } else {
                    es[i] = '<div>';
                }
                break;
            case ELE_H2:
                o.type = ELE_H2;
                o.text = $(e).text();
                es[i] = o;
                break;
            case ELE_A:
                es[i] = handleA(e);
                break;
            case ELE_STRONG:
                o.type = ELE_STRONG;
                o.text = $(e).text();
                es[i] = o;
                break;
            case ELE_UL:
                es[i] = handleUl(e);
                break;
            case ELE_HR:
                o.type = ELE_HR;
                es[i] = o;
                break;
            default:
                es[i] = '!!!!!!!!!!!!!' + $(e).text().trim();
                break;
        }
    } else {
        const tmp = $(e).text().trim();
        if (!!tmp && tmp.match(NOT_BLANK)) {
            es[i] = '!!!!!!!!!!!!!' + $(e).text();
        } else {
            es[i] = null;
        }
    }
};

const handleFigure = async e => {
    // video
    if ($(e).hasClass('media-with-caption')) {
        let o = {};
        o.type = ELE_FIGURE;
        o.playable = true;

        const img = $(e).find('.media-placeholder').attr('src');
        if (!!img) {
            o.img = imgResReplace(img.trim());
        } else {
            o.img = handleUnprocessedMedia(e);
        }

        o.data = await imgToBase64(o.img);

        o.alt = '';
        o.copyright = '';
        o.caption = $(e).find('.media-with-caption__caption').contents().eq(1).text().trim();

        return o;
    } else {
        return await handleImg(e);
    }
};

const handleImg = async e => {
    let o = {};

    o.type = ELE_FIGURE;
    o.playable = false;

    const copyright = $(e).find('.story-image-copyright').text();
    if (!!copyright) {
        o.copyright = copyright.trim();
    } else {
        o.copyright = '';
    }

    const caption = $(e).find('.media-caption__text').text();
    if (!!caption) {
        o.caption = caption.trim();
    } else {
        o.caption = '';
    }

    if ($(e).find('.js-delayed-image-load').length) {
        const img = $(e).find('.js-delayed-image-load').first();
        const imgAlt = img.data('alt').trim();

        if (imgAlt.match(IMG_PRESENTATIONAL_ALT)) {
            return null;
        } else {
            o.img = imgResReplace(img.data('src').trim());

            o.data = await imgToBase64(o.img);
            o.alt = imgAlt;
            return o;
        }
    } else {
        const img = $(e).find('.js-image-replace').first();
        const imgAlt = img.attr('alt').trim();

        if (imgAlt.match(IMG_PRESENTATIONAL_ALT)) {
            return null;
        } else {
            o.img = imgResReplace(img.attr('src').trim());
            o.data = await imgToBase64(o.img);
            o.alt = imgAlt;
            return o;
        }
    }
};

const handleA = e => {
    let o = {};
    o.type = ELE_A;
    o.text = $(e).text().trim();

    const link = $(e).attr('href');
    if (link.match(CROSS_REGION)) {
        o.link = link.trim();
    } else {
        o.link = BASE_URL + link.trim();
    }

    return o;
};

const handleUl = e => {
    let o = {};
    o.type = ELE_UL;
    o.list = [];

    $(e).find(ELE_LI).each((i, e) => {
        o.list[i] = handleLi(e);
    });

    return o;
};

const handleLi = e => {
    let o = {};
    o.type = ELE_LI;
    o.inner = [];

    $(e).contents().each((i, e) => {
        if (!!e.name && e.name === ELE_A) {
            o.inner[i] = handleA(e);
        } else {
            o.inner[i] = handleText(e);
        }
    });

    return o;
};

const handleText = e => {
    let o = {};
    o.type = ELE_TEXT;
    o.text = $(e).text().trim();

    return o;
};

const handleP = e => {
    let o = {};
    o.type = ELE_P;
    o.inner = [];

    $(e).contents().each((i, e) => {
        if (!!e.name && e.name === ELE_A) {
            o.inner[i] = handleA(e);
        } else {
            o.inner[i] = handleText(e);
        }
    });

    return o;
};

const handleUnprocessedMedia = e => {
    const playable = $(e).find('.media-player').data('playable');

    if (!!playable) {
        return imgResReplace(playable.otherSettings.unProcessedImageUrl);
    } else {
        return '';
    }
};

const imgResReplace = s => {
    return s.replace(IMG_RES, IMG_RES_640);
};

const imgToBase64 = async u => {
    return rp({
        url: u,
        method: 'GET',
        encoding: 'base64'
    }).then(d => {
        console.log('Downloaded: ' + u);
        return d;
    });
};

(async () => {
    let a = await browse('https://www.bbc.com/news/entertainment-arts-48635450');
    console.log(a);
})();

module.exports = browse;
