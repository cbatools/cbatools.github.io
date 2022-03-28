const c_color = document.getElementById("color").getAttribute("color");

function mulberry32(a) {
  var t = a += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

/*
  원본 : https://codepen.io/tbogard/pen/mRKGbp
*/

const chatEle = document.getElementById('chat');
const twitchBadgeCache = {
  data: { global: {} } };

const bttvEmoteCache = {
  lastUpdated: 0,
  data: { global: [] },
  urlTemplate: '//cdn.betterttv.net/emote/{{id}}/{{image}}' };


const krakenBase = 'https://api.twitch.tv/kraken/';
const krakenClientID = '4g5an0yjebpf93392k4c5zll7d7xcec';

const chatFilters = [
// '\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF', // Partial Latin-1 Supplement
// '\u0100-\u017F', // Latin Extended-A
// '\u0180-\u024F', // Latin Extended-B
'\u0250-\u02AF', // IPA Extensions
'\u02B0-\u02FF', // Spacing Modifier Letters
'\u0300-\u036F', // Combining Diacritical Marks
'\u0370-\u03FF', // Greek and Coptic
'\u0400-\u04FF', // Cyrillic
'\u0500-\u052F', // Cyrillic Supplement
'\u0530-\u1FFF', // Bunch of non-English
'\u2100-\u214F', // Letter Like
'\u2500-\u257F', // Box Drawing
'\u2580-\u259F', // Block Elements
'\u25A0-\u25FF', // Geometric Shapes
'\u2600-\u26FF', // Miscellaneous Symbols
// '\u2700-\u27BF', // Dingbats
'\u2800-\u28FF'];


const chatFilter = new RegExp(`[${chatFilters.join('')}]`);

let client;
let testing = false;

if (testing) {
  kraken({
    endpoint: 'streams',
    qs: {
      limit: 20,
      language: 'ko' } }).


  then(({ streams }) => {
    client = new tmi.client({
      // options: { debug: true },
      connection: {
        reconnect: true,
        secure: true },

      // channels: [ 'alca' ],
      channels: streams.map(n => n.channel.name) });

    addListeners();
    client.connect();
  });
} else
{
  client = new tmi.client({
    // options: { debug: true },
    connection: {
      reconnect: true,
      secure: true },

    // channels: [ 'alca' ],
    channels: [twitchID] });

  addListeners();
  client.connect();
}

function addListeners() {
  client.on('connecting', () => {
    showAdminMessage({
      message: 'Connecting...',
      attribs: { subtype: 'connecting' } });

    removeAdminChatLine({ subtype: 'disconnected' });
  });

  client.on('connected', () => {
    getBTTVEmotes();
    getBadges().
    then(badges => twitchBadgeCache.data.global = badges);
    showAdminMessage({
      message: 'Connected...',
      attribs: { subtype: 'connected' },
      timeout: 5000 });
    removeAdminChatLine({ subtype: 'connecting' });
    removeAdminChatLine({ subtype: 'disconnected' });
  });

  client.on('disconnected', () => {
    twitchBadgeCache.data = { global: {} };
    bttvEmoteCache.data = { global: [] };
    showAdminMessage({
      message: 'Disconnected...',
      attribs: { subtype: 'disconnected' } });

    removeAdminChatLine({ subtype: 'connecting' });
    removeAdminChatLine({ subtype: 'connected' });
  });

  function handleMessage(channel, userstate, message, fromSelf) {
    console.log(userstate)
    if (chatFilter.test(message)) {
      testing && console.log(message);
      return;
    }

    let chan = getChan(channel);
    let name = userstate['display-name'] || userstate.username;
    if(userstate['username'] !== 'nightbot') {
      // if(/[^\w]/g.test(name)) {
      // 	name += ` (${userstate.username})`;
      // }
      userstate.name = name;
      showMessage({ chan, type: 'chat', message, data: userstate });
    }
  }

  client.on('message', handleMessage);
  client.on('cheer', handleMessage);

  client.on('join', (channel, username, self) => {
    if (!self) {
      return;
    }
    let chan = getChan(channel);
    getBTTVEmotes(chan);
    twitchNameToUser(chan).
    then(user => getBadges(user._id)).
    then(badges => twitchBadgeCache.data[chan] = badges);
    showAdminMessage({
      message: `Joined ${chan}`,
      timeout: 1000 });
    if (chan != twitchID) {
      document.title = document.title + " " + chan;
    }
  });

  client.on('part', (channel, username, self) => {
    if (!self) {
      return;
    }
    let chan = getChan(channel);
    delete bttvEmoteCache.data[chan];
    showAdminMessage({
      message: `Parted ${chan}`,
      timeout: 1000 });

  });

  client.on('clearchat', channel => {
    removeChatLine({ channel });
  });

  client.on('timeout', (channel, username) => {
    removeChatLine({ channel, username });
  });
}

function removeChatLine(params = {}) {
  if ('channel' in params) {
    params.channel = getChan(params.channel);
  }
  let search = Object.keys(params).
  map(key => `[${key}="${params[key]}"]`).
  join('');
  chatEle.querySelectorAll(search).
  forEach(n => chatEle.removeChild(n));
}

function removeAdminChatLine(params = {}) {
  params.type = 'admin';
  removeChatLine(params);
}

function showAdminMessage(opts) {
  opts.type = 'admin';
  if ('attribs' in opts === false) {
    opts.attribs = {};
  }
  opts.attribs.type = 'admin';
  return showMessage(opts);
}

function getChan(channel = '') {
  return channel.replace(/^#/, '');
}

function showMessage({ chan, type, message = '', data = {}, timeout = 12000, attribs = {} } = {}) {
  
  let chatBox = document.createElement('div');
  let chatLine_ = document.createElement('div');
  let chatLineBg = document.createElement('div');
  let chatLineInner = document.createElement('div');
  let chatLine_tail = document.createElement('div');
  let chatLine_tail_shadow = document.createElement('div');
  let chatUser = document.createElement('div');
  let chatUserAvatar = document.createElement('div');
  
  chatBox.classList.add('chat-box');
  chatLine_.classList.add('chat-line');
  chatLineBg.classList.add('chat-line-bg');
  chatLineInner.classList.add('chat-line-inner');
  chatLine_tail.classList.add('chat-line-inner-tail');
  chatLine_tail_shadow.classList.add('chat-line-inner-tail-shadow');
  chatUser.classList.add('chat-user');
  chatUserAvatar.classList.add('chat-user-avatar');

  var leftpx = Math.floor(mulberry32(Date.now()) * 80 + 1) + "vw";

  chatBox.style.left = leftpx;

  // var random_color = "#" + Math.floor(Math.random() * 16777215).toString(16);
  var currentTime = Date.now();
  var random_color = randomColor({
    luminosity: 'bright',
    seed: currentTime,
    // seed: data['user-id']
  });
  var random_color_light = randomColor({
    luminosity: 'light',
    seed: currentTime,
    // seed: data['user-id']
  });
  var random_color_dark = randomColor({
    luminosity: 'dark',
    seed: currentTime,
    // seed: data['user-id']
  });
  console.log(random_color);
  document.getElementById("color").getAttribute("color");

  if (c_color === "") {
    random_color = random_color
  } else {
    random_color = "#" + c_color;
  }
  chatLineInner.style.borderColor = random_color;
  // chatLineInner.style.background = random_color_light+"33";
  chatLineInner.style.color = random_color_dark;
  
  chatLine_tail.style.borderColor = random_color + " transparent";

  chatBox.appendChild(chatLine_);
  chatLine_.appendChild(chatLineBg);
  chatLine_.appendChild(chatUser);
  chatUser.appendChild(chatUserAvatar);
  chatLineBg.appendChild(chatLineInner);
  chatLineInner.appendChild(chatLine_tail_shadow);
  chatLine_tail_shadow.appendChild(chatLine_tail);

  if (chan) {
    chatBox.setAttribute('channel', chan);
  }

  Object.keys(attribs).
  forEach(key => {
    chatBox.setAttribute(key, attribs[key]);
  });

  if (type === 'chat') {
    'id' in data && chatBox.setAttribute('message-id', data.id);
    'user-id' in data && chatBox.setAttribute('user-id', data['user-id']);
    'room-id' in data && chatBox.setAttribute('channel-id', data['room-id']);
    // 'username' in data && chatBox.setAttribute('username', Date.now());
    'username' in data && chatBox.setAttribute('username', data.username);
    // console.log(data['room-id']);
    let spaceEle = document.createElement('span');
    spaceEle.innerText = ' ';
    let badgeEle = document.createElement('span');
    if ('badges' in data && data.badges !== null) {
      badgeEle.classList.add('badges');
      let badgeGroup = Object.assign({}, twitchBadgeCache.data.global, twitchBadgeCache.data[chan] || {});
      let badges = Object.keys(data.badges).
      forEach(type => {
        let version = data.badges[type];
        let group = badgeGroup[type];
        if (group && version in group.versions) {
          let url = group.versions[version].image_url_1x;
          let ele = document.createElement('img');
          ele.setAttribute('src', url);
          ele.setAttribute('badgeType', type);
          ele.setAttribute('alt', type);
          ele.classList.add('badge');
          badgeEle.appendChild(ele);
        }
      }, []);
    }

    chatUserAvatar.setAttribute('style', 'background: url(https://avatars.dicebear.com/api/gridy/'+data['user-id']+'.svg);');
    // https://avatars.dicebear.com/api/bottts/%EC%98%A4%EB%B2%84_.svg?r=50
    let nameEle = document.createElement('span');
    nameEle.classList.add('user-name');
    // nameEle.innerText = Date.now();
    nameEle.innerText = data.name;
    // console.log(data.name.length);
    if (data.name.length > 7) {
      nameEle.style.fontSize = '0.8em';
    } else if (data.name.length > 10) {
      nameEle.style.fontSize = '0.4em';
    } else if (data.name.length > 12) {
      nameEle.style.fontSize = '0.2em';
    } else if (data.name.length > 20) {
      nameEle.style.fontSize = '0.1em';
    }
    nameEle.style.color = random_color_light;
    nameEle.style.background = random_color;
    nameEle.style.borderColor = random_color;

    // let colonEle = document.createElement('span');
    // colonEle.classList.add('message-colon');
    // colonEle.innerText = ': ';

    let messageEle = document.createElement('span');
    messageEle.classList.add('message');
    messageEle.style.background = random_color_light+"33";

    let finalMessage = handleEmotes(chan, data.emotes || {}, message);
    addEmoteDOM(messageEle, finalMessage);

    chatUser.appendChild(badgeEle);
    
    chatLineInner.appendChild(spaceEle);
    if (params.userinfo == 1 || params.userinfo == undefined) {
      chatLineInner.appendChild(nameEle);
    }
    if (params.theme == 'dark') {
      messageEle.classList.add('dark');

      chatLineInner.classList.add('dark');
      chatLineInner.style.borderColor = random_color_light;
      chatLineInner.style.background = '#000';
      chatLineInner.style.color = random_color_light;

      nameEle.classList.add('dark');
      nameEle.style.color = random_color_dark;
      nameEle.style.background = random_color_light;
      nameEle.style.borderColor = random_color_light;

      chatLine_tail.style.borderColor = random_color_light + " transparent";
    }
    if (params.fever == '1') {
      chatLineInner.classList.add('fever');
    }
    // chatLineInner.appendChild(colonEle);
    chatLineInner.appendChild(messageEle);
  } else
  if (type === 'admin') {
    chatBox.classList.add('admin');

    let messageEle = document.createElement('span');
    messageEle.classList.add('message');
    messageEle.innerText = message;

    chatLineInner.appendChild(messageEle);
  }

  chatEle.appendChild(chatBox);

  setTimeout(() => chatBox.classList.add('visible'), 100);

  if (chatEle.childElementCount > 10) {
    chatEle.removeChild(chatEle.children[0]);
  }

  if (timeout) {
    setTimeout(() => {
      if (chatBox.parentElement) {
        chatBox.classList.remove('visible');
        setTimeout(() => chatEle.removeChild(chatBox), 1000);
      }
    }, timeout);
  }
}

function handleEmotes(channel, emotes, message) {
  // let messageParts = message.split(' ');
  let bttvEmotes = bttvEmoteCache.data.global.slice(0);
  if (channel in bttvEmoteCache.data) {
    bttvEmotes = bttvEmotes.concat(bttvEmoteCache.data[channel]);
  }
  let twitchEmoteKeys = Object.keys(emotes);
  let allEmotes = twitchEmoteKeys.reduce((p, id) => {
    let emoteData = emotes[id].map(n => {
      let [a, b] = n.split('-');
      let start = +a;
      let end = +b + 1;
      return {
        start,
        end,
        id,
        code: message.slice(start, end),
        type: ['twitch', 'emote'] };

    });
    return p.concat(emoteData);
  }, []);
  bttvEmotes.forEach(({ code, id, type, imageType }) => {
    let hasEmote = message.indexOf(code);
    if (hasEmote === -1) {
      return;
    }
    for (let start = message.indexOf(code); start > -1; start = message.indexOf(code, start + 1)) {
      let end = start + code.length;
      allEmotes.push({ start, end, id, code, type });
    }
  });
  let seen = [];
  allEmotes = allEmotes.sort((a, b) => a.start - b.start).
  filter(({ start, end }) => {
    if (seen.length && !seen.every(n => start > n.end)) {
      return false;
    }
    seen.push({ start, end });
    return true;
  });
  if (allEmotes.length) {
    let finalMessage = [message.slice(0, allEmotes[0].start)];
    allEmotes.forEach((n, i) => {
      let p = Object.assign({}, n, { i });
      let { end } = p;
      finalMessage.push(p);
      if (i === allEmotes.length - 1) {
        finalMessage.push(message.slice(end));
      } else
      {
        finalMessage.push(message.slice(end, allEmotes[i + 1].start));
      }
      finalMessage = finalMessage.filter(n => n);
    });
    return finalMessage;
  }
  return [message];
}

function addEmoteDOM(ele, data) {
  data.forEach(n => {
    let out = null;
    if (typeof n === 'string') {
      out = document.createTextNode(n);
    } else
    {
      let { type: [type, subtype], code } = n;
      if (type === 'twitch') {
        if (subtype === 'emote') {
          out = document.createElement('img');
          out.setAttribute('src', `https://static-cdn.jtvnw.net/emoticons/v2/${n.id}/default/light/1.0`);
          out.setAttribute('alt', code);
        }
      } else
      if (type === 'bttv') {
        out = document.createElement('img');
        let url = bttvEmoteCache.urlTemplate;
        url = url.replace('{{id}}', n.id).replace('{{image}}', '1x');
        out.setAttribute('src', 'https:' + url);
      }
    }

    if (out) {
      ele.appendChild(out);
    }
  });
  twemoji.parse(ele);
}

function formQuerystring(qs = {}) {
  return Object.keys(qs).
  map(key => `${key}=${qs[key]}`).
  join('&');
}

function request({ base = '', endpoint = '', qs, headers = {}, method = 'get' }) {
  let opts = {
    method,
    headers: new Headers(headers) };

  return fetch(base + endpoint + '?' + formQuerystring(qs), opts).
  then(res => res.json());
}

function kraken(opts) {
  let defaults = {
    base: krakenBase,
    headers: {
      'Client-ID': krakenClientID,
      Accept: 'application/vnd.twitchtv.v5+json' } };


  return request(Object.assign(defaults, opts));
}

function twitchNameToUser(username) {
  return kraken({
    endpoint: 'users',
    qs: { login: username } }).

  then(({ users }) => users[0] || null);
}

function getBadges(channel) {
  return kraken({
    base: 'https://badges.twitch.tv/v1/badges/',
    endpoint: (channel ? `channels/${channel}` : 'global') + '/display',
    qs: { language: 'en' } }).

  then(data => data.badge_sets);
}

function getClip(clipSlug) {
  return kraken({
    endpoint: `clips/${clipSlug}` });

}

function getBTTVEmotes(channel) {
  let endpoint = 'emotes';
  let global = true;
  if (channel) {
    endpoint = 'channels/' + channel;
    global = false;
  }
  return request({
    base: 'https://api.betterttv.net/2/',
    endpoint }).

  then(({ emotes, status, urlTemplate }) => {
    if (status === 404) return;
    bttvEmoteCache.urlTemplate = urlTemplate;
    emotes.forEach(n => {
      n.global = global;
      n.type = ['bttv', 'emote'];
      if (!global) {
        if (channel in bttvEmoteCache.data === false) {
          bttvEmoteCache.data[channel] = [];
        }
        bttvEmoteCache.data[channel].push(n);
      } else
      {
        bttvEmoteCache.data.global.push(n);
      }
    });
  });
}

