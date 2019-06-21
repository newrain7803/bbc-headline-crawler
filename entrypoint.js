const cheerio = require('cheerio');
const request = require('request');
const browse = require('./browse.js');
const urlBase = "https://www.bbc.com";
let $;

request({
    url: 'https://www.bbc.com/news/world',
    method: 'GET'
}, (error, res, body) => {
    if (!error && res.statusCode === 200) {
        $ = cheerio.load(body);
        const worldHtml = $('#nw-c-navigation-enhanced-javascript').next().html();
        // console.log(worldHtml);
        const newsJsonRegex = /{"title".+};/;
        const newsJsonStr = worldHtml.match(newsJsonRegex).toString();
        // console.log(newsJsonStr);
        let newsJson = JSON.parse(newsJsonStr.substring(0, newsJsonStr.length - 1));
        // console.log(JSON.stringify(newsJson));
        // console.log(newsJson);
        console.log('------------------------------');

        newsJson.topStories.stories.items.forEach(i => {
            if (i.mediaType === 'video') {
                return;
            }
            console.log(i.title);
            console.log(urlBase + i.url);
        });
        newsJson.slices.forEach(i1 => {
            i1.items.forEach(i2 => {
                if (i2.mediaType === 'video') {
                    return;
                }
                console.log(i2.title);
                console.log(urlBase + i2.url);
            })
        });
    }
});

const waitAndBrowse = (u) => {
    setTimeout(() => browse(u), (1000 + Math.random() * 1000));
};
