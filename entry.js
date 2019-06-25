const $ = require('cheerio');
const rp = require('request-promise');
const browse = require('./browse.js');
const imgToBase64 = require('./browse.js');
const BASE_URL = "https://www.bbc.com";
const CROSS_REGION = /http.*/;
let news = {};

const entry = async () => {
    return rp({
        url: 'https://www.bbc.com/news/world',
        method: 'GET',
        transform: b => {
            return $.load(b);
        },
        transform2xxOnly: true
    }).then(async $ => {
        const worldHtml = $('#nw-c-navigation-enhanced-javascript').next().html();
        const newsJsonRegex = /{"title".+};/;
        const newsJsonStr = worldHtml.match(newsJsonRegex).toString();
        let newsJson = JSON.parse(newsJsonStr.substring(0, newsJsonStr.length - 1));
        console.log('------------------------------');

        let topItems = newsJson.topStories.stories.items;
        news.top = [];
        await traversalList(topItems, news.top);

        let s1 = newsJson.slices[0].items;
        news.s1 = [];
        await traversalList(s1, news.s1);

        let features = newsJson.slices[1].items;
        news.features = [];
        await traversalList(features, news.features);

        return news;
    });
};

const traversalList = async (s, d) => {
    for (let i = 0; i < s.length; i++) {
        if (s[i].isMedia) {
            d[i] = {};
        } else {
            d[i] = await handleItem(s[i]);
        }
    }
};

const handleItem = async i => {
    return new Promise(r => {
        setTimeout(async () => {
            let o = {};

            o.assetId = i.assetId;
            o.imgAlt = i.imageAltText;
            o.img = i.imageUrl;
            o.data = await imgToBase64(o.img);
            o.sectionName = i.sectionName;
            o.summary = i.summary;
            o.timestamp = i.timestamp;
            if (i.url.match(CROSS_REGION)) {
                o.url = i.url.trim();
            } else {
                o.url = BASE_URL + i.url.trim();
            }
            o.type = i.type;
            o.title = i.title;

            r(o);
        }, (1000 + Math.random() * 1000));
    });
};

(async () => {
    let a = await entry();
    console.log(a);
    //TODO: browse each links
})();

module.exports = entry;
