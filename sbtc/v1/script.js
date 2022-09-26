/*
  tmi 참고 : https://codepen.io/tbogard/pen/mRKGbp
*/

const selectedColor = document.getElementById("color").getAttribute("color");

let normalChats = [];
let predictionChats = {};
let chatOrder = 'last'
let messageTimeout = 30000;

let streamer = [];

const layoutEle = document.getElementById('layout');
const chatEle = document.getElementById('chat');
const twitchBadgeCache = {
  data: { global: {} } };

const bttvEmoteCache = {
  lastUpdated: 0,
  data: { global: [] },
  urlTemplate: '//cdn.betterttv.net/emote/{{id}}/{{image}}' };

const krakenBase = 'https://api.twitch.tv/kraken/';
const krakenClientID = '4g5an0yjebpf93392k4c5zll7d7xcec';

const helixBase = 'https://api.twitch.tv/helix/';
const helixClientID = 'u2844yyspjg8a92oyw99uocbkdhb0l';
const helixAuth = 'Bearer 12jaupzty33uhlxn0gusvr73rpbv9g';

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
    // getBTTVEmotes();
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
    // console.log(userstate)
    if (chatFilter.test(message)) {
      testing && console.log(message);
      return;
    }

    let chan = getChan(channel);
    let name = userstate['display-name'] || userstate.username;
    if(userstate['username'] !== 'nightbot' && userstate['username'] !== 'bbangddeock' && userstate['username'] !== 'ssakdook') {
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
    // getBTTVEmotes(chan);
    twitchNameToUser(chan).
    then(user => {
      streamer = user;
      return getBadges(user.id);
    }).
    then(badges => {
      twitchBadgeCache.data[chan] = badges;
    }).
    then(c => {
      infoTag();
      let version = params.version;
      if (params.version == undefined) {
        version = 'not';
      } 
      document.title = document.title + ' ' + streamer.display_name + ' ' + version;
      gtag('config', 'GA_MEASUREMENT_ID', {
        'user_id': chan
      });
      gtag('event', 'login', { 'method' : 'sbtc', 'channel_id' : chan, 'display_name' : streamer.display_name, 'version' : version });
      showAdminMessage({
        message: `Joined ${chan}`,
        timeout: 1000 });
    });
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

function showMessage({ chan, type, message = '', data = {}, timeout = messageTimeout, attribs = {} } = {}) {
  
  let chatBox = document.createElement('div');
  let chatLine = document.createElement('div');
  let chatLineBg = document.createElement('div');
  let chatLineInner = document.createElement('div');
  let chatLine_tail = document.createElement('div');
  let chatLine_tail_shadow = document.createElement('div');
  let chatUser = document.createElement('div');
  let chatUserAvatar = document.createElement('div');
  let messageEle = document.createElement('span');

  let chatType = 'normal';
  let chatProperty = '';
  let predictionNum = 0;
  let predictionSeqNum = 0;
  let predictionChatsLength = Object.keys(predictionChats).length;

  let maxChatNum = 15;
  
  chatBox.classList.add('chat-box');
  chatLine.classList.add('chat-line');
  chatLineBg.classList.add('chat-line-bg');
  chatLineInner.classList.add('chat-line-inner');
  chatLine_tail.classList.add('chat-line-inner-tail');
  chatLine_tail_shadow.classList.add('chat-line-inner-tail-shadow');
  chatUser.classList.add('chat-user');
  chatUserAvatar.classList.add('chat-user-avatar');
  
  // 말풍선 일반, 예측 구분
  // if (data.badges !== undefined && data.badges !== null) {
  //   Object.keys(data.badges).
  //   forEach(badgeType => {
  //     let version = data.badges[badgeType];
  //     // 트위치 예측 이모티콘으로 구분
  //     if (badgeType == 'predictions') {
  //       let number = version.split('-');
  //       chatType = 'prediction';
  //       predictionNum = parseInt(number[number.length - 1]);
  //       chatBox.setAttribute('type', chatType);
  //       chatBox.setAttribute('prediction', predictionNum);
  //     } else {
  //       chatBox.setAttribute('type', chatType);
  //     }
  //   }, []);
  // } else {
  //   chatBox.setAttribute('type', 'normal');
  // }

  chatBox.setAttribute('type', 'normal');

  if (params.prediction == 1) {
    if (chatType === 'normal' && type !== 'admin') {
      return false;
    }
  }
  
  // console.log('type', chatBox.getAttribute('type'));
  // console.log('prediction', chatBox.getAttribute('prediction'));

  // 말풍선 위치 지정
  let left_pos = Math.floor(mulberry32(Date.now()) * 8000 + 1) / 100;
  if (normalChats.length > 0) {
    let lastChat = normalChats[parseInt(normalChats.length) - 1];
    let last2Chat = normalChats[parseInt(normalChats.length) - 2];
    let perfectPos = false;
    let lastloop = 0;
    while (perfectPos != true) {
      let existPos = 0;
      normalChats.forEach(element => {
        if (element.pos !== undefined 
          && element.type == 'normal' 
          && element.pos < left_pos + 2.2 
          && element.pos > left_pos - 2.2) {
          existPos++;
        }
      });
      if (lastChat.pos < left_pos + 20 && lastChat.pos > left_pos - 20) {
        existPos++;
      }
      // if (last2Chat !== undefined && last2Chat.pos < left_pos + 20 && last2Chat.pos > left_pos - 20) {
      //   existPos++;
      // }
      if (existPos !== 0) {
        left_pos = Math.floor(Math.random() * 8000 + 1) / 100;
      } else if (existPos === 0) {
        perfectPos = true;
      }
      if (lastloop >= 22) {
        perfectPos = true;
      }
      lastloop++;
    }
  }

  if (chatType == 'normal') {

  }
  // else if (chatType == 'prediction') {
  //   chatProperty['prediction'] = predictionNum;
  //   if (predictionChats[predictionNum] === undefined) {
  //     predictionChats[predictionNum] = [];
  //   }
  //   predictionChats[predictionNum].push(chatProperty);
  //   predictionChatsLength = Object.keys(predictionChats).length;
  //   document.documentElement.style.setProperty('--prediction', predictionChatsLength);
  //   let _break = 0;
  //   Object.keys(predictionChats)
  //   .forEach(chatKey => {
  //     if (_break !== 1) {
  //       predictionSeqNum++;
  //       if (parseInt(chatKey) === parseInt(predictionNum)) {
  //         _break = 1;
  //       }
  //     }
  //   });
  // }

  chatBox.style.left = 'calc(' + left_pos + 'vw)';

  let colorHue = '';
  let currentTime = Date.now();

  // if (chatType === 'prediction') {
  //   if (predictionChatsLength >= 2) {
  //     chatBox.style.left = 'calc('+ (100 / (predictionChatsLength)) * (predictionSeqNum - 1) +'vw + calc(' + left_pos + 'vw / var(--prediction)) )';
  //   }
  //   if (predictionNum === 0) {

  //   } else if (predictionNum === 1) {
  //     colorHue = 'blue';
  //   } else if (predictionNum === 2) {
  //     colorHue = 'red';
  //   } else if (predictionNum === 3) {
  //     colorHue = 'green';
  //   } else if (predictionNum === 4) {
  //     colorHue = 'orange';
  //   } else if (predictionNum === 5) {
  //     colorHue = 'purple';
  //   } else if (predictionNum === 6) {
  //     colorHue = 'pink ';
  //   } else if (predictionNum === 7) {
  //     colorHue = '#0E0C32'; // 남색
  //   } else if (predictionNum === 8) {
  //     colorHue = '#92DF45'; // 연두색
  //   } else if (predictionNum === 9) {
  //     colorHue = 'yellow';
  //   } else if (predictionNum === 10) {
  //     colorHue = 'monochrome';
  //   } else {
  //     colorHue = '';
  //   }
  // }

  let random_color = randomColor({
    luminosity: 'bright',
    seed: currentTime,
    hue: colorHue,
  });
  let random_color_light = randomColor({
    luminosity: 'light',
    seed: currentTime,
    hue: colorHue,
  });
  let random_color_dark = randomColor({
    luminosity: 'dark',
    seed: currentTime,
    hue: colorHue,
  });

  if (selectedColor === "") {
    random_color = random_color;
  } else {
    random_color = "#" + selectedColor;
  }
  chatLineInner.style.borderColor = random_color;
  // chatLineInner.style.background = random_color_light+"33";
  chatLineInner.style.color = random_color_dark;
  
  chatLine_tail.style.borderColor = random_color + " transparent";
  chatLine_tail.style.backgroundColor = random_color;

  chatBox.appendChild(chatLine);
  chatLine.appendChild(chatLineBg);
  chatLine.appendChild(chatUser);
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
        // 트위치 예측 이모티콘 구분
        if (type == 'predictions') {
          let number = version.split('-');
        }
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
    
    let nameDiv = document.createElement('div');
    let nameBox = document.createElement('div');
    let nameEle = document.createElement('span');

    nameDiv.classList.add('user-name');
    nameEle.classList.add('user-name-text');
    // nameEle.innerText = Date.now();
    nameEle.innerText = data.name;

    nameBox.appendChild(nameEle);
    nameDiv.appendChild(nameBox);

    nameDiv.style.color = random_color_light;
    nameDiv.style.background = random_color;
    nameDiv.style.borderColor = random_color;

    messageEle.classList.add('message');
    messageEle.style.background = random_color_light+"33";

    let finalMessage = handleEmotes(chan, data.emotes || {}, message);
    addEmoteDOM(messageEle, finalMessage);

    chatUser.appendChild(badgeEle);
    
    chatLineInner.appendChild(spaceEle);

    // 유저 정보 표시 여부
    if (params.userinfo == 1 || params.userinfo == undefined) {
      chatLineInner.appendChild(nameDiv);
    }
    // 글자 색 선택
    if (params.messagecolor == 'random' || params.messagecolor == undefined){

    } else if (params.messagecolor == 'black') {
      messageEle.classList.add('black');
    }
    // 테마 선택
    if (params.theme == 'dark') { // 다크 테마
      chatBox.classList.add('dark');

      chatLineInner.style.borderColor = random_color_light;
      chatLineInner.style.background = '#000';
      chatLineInner.style.color = random_color_light;

      nameDiv.style.color = random_color_dark;
      nameDiv.style.background = random_color_light;
      nameDiv.style.borderColor = random_color_light;

      chatLine_tail.style.borderColor = random_color_light + " transparent";
      chatLine_tail.style.backgroundColor = random_color_light;
    } else if (params.theme == 'mlt') { // MLT 테마
      chatBox.classList.add('mlt');

      let margin_bottom = Math.floor(mulberry32(Date.now()) * 74 + 1) + 'px';

      chatLine.style.marginBottom = margin_bottom;
    } else if (params.theme == 'smm') { // SMM 테마
      chatBox.classList.add('smm');
      maxChatNum = 10;
      chatOrder = 'first';
      chatEle.style.paddingLeft = '50px';
      chatEle.style.width = '200%';
      nameDiv.style.color = random_color_dark;
      chatLine_tail.style.borderColor = random_color;
      if (params.size == 's') { // 작은 크기
        chatBox.classList.add('sizes');
        maxChatNum = 20;
        chatEle.style.width = '400%';
      }
    } else if (params.theme == 'instalive') { // instalive 테마
      chatBox.classList.add('instalive');
      chatEle.classList.add('instalive');

      nameEle.style.color = '#fff';
      chatLineInner.style.color = '#fff';
      chatUser.style.backgroundColor = random_color_light;

      heartEmojiFlow();
      layoutEle.classList.add('instalive');

      let options = [];
      if (params.option != undefined) {
        options = params.option.split('');
      }

      options.forEach((option, key) => {
        if (key == 3 && option == 1) { // hideBottomBackgroundColor - 0001
          chatEle.style.background = 'none';
        } else if (key == 2 && option == 1) { // hideStreamerInfo - 0010
          document.getElementsByClassName('infotag')[0].style.display = 'none';
        } else if (key == 1 && option == 1) { // hideHeartEmojiFlow - 0100
          document.getElementsByClassName('hearts')[0].style.display = 'none';
        } else if (key == 0 && option == 1) { // hideLiveBanner - 1000
          document.getElementsByClassName('livebanner')[0].style.display = 'none';
        }
      });
    }
    // 피버 모드
    if (params.fever == '1') {
      chatLineInner.classList.add('fever');
    }
    // 트위치 이모티콘 한개 크게
    if (params.one == '0') {
      if (finalMessage.length != 1) {
        
      }
    } else {
      if (finalMessage.length == 1 && finalMessage[0].type) {
        messageEle.classList.add('onecharacter');
      }
    }
    // 코믹스 모양 채팅
    if (params.comic == '0') {

    } else {
      let messageText = finalMessage[0];
      messageText = messageText.toLowerCase();
      if (finalMessage.length == 1 && 
        messageText == '와우!'||
        messageText == '우와'||
        messageText == '와우'||
        messageText == '우와!'||
        messageText == '오!' ||
        messageText == '와' ||
        messageText == '와!' ||
        messageText == '굿' ||
        messageText == '굿!' ||
        messageText == '대박' ||
        messageText == '대박!' ||
        messageText == 'wow' || 
        messageText == 'wow!') {
        let starEle = document.createElement('div');
        starEle.classList.add('star');
        starEle.style.backgroundColor = random_color_light;
        chatLineBg.appendChild(starEle);
        chatLine.classList.add('comic');
        starEle.style.clipPath = 'url(#star)';
      }
    }
    // 아바타 선택
    if  (params.avatar == '1' ||  params.avatar == 'gridy' || params.avatar == undefined || params.avatar == '') {
      chatUserAvatar.setAttribute('style', 'background: url(https://avatars.dicebear.com/api/gridy/'+ data['user-id'] +'.svg);');
      chatUserAvatar.style.color = random_color;
    } else if (params.avatar == '0') {
      chatUserAvatar.classList.add('hide');
    } else if (params.avatar == 'whiteperson') {
      chatUserAvatar.setAttribute('style', 'background: url(img/person.svg); filter: invert(1);');
    } else {
      chatUserAvatar.setAttribute('style', 'background: url(https://avatars.dicebear.com/api/'+ params.avatar +'/'+ data['user-id'] +'.svg);');
      chatUserAvatar.style.color = random_color;
    }
    // ㅋㅋㅋ 웃는 채팅 더 흔들리게
    if (params.lol == '0') {

    } else if (params.lol == '1' || params.lol == undefined) {
      finalMessage.forEach(n => {
        if (typeof n === 'string') {
          let lolword = n.search('ㅋㅋㅋ');
          if (lolword >= 0) {
            chatLine.classList.add('lol-animation');
          }
        }
      });
    }
    // 스트리머 메세지는 안보이게
    if (params.streamermessage == '0') {
      if (data.username == twitchID) {
        return false;
      }
    } else if (params.streamermessage == '1') {

    }
    // 원하는 유저 메세지 안보이게
    if (params.hideuser != undefined) {
      if (data.username == params.hideuser) {
        return false;
      }
    }

    chatLineInner.appendChild(messageEle);

    // 말풍선 정보 배열 저장
    chatProperty = { id: data.id, date: Date.now(), pos: left_pos, type: chatType };
    normalChats.push(chatProperty);
  } else if (type === 'admin') {
    chatBox.classList.add('admin');

    let messageEle = document.createElement('span');
    messageEle.classList.add('message');
    messageEle.innerText = message;
    
    if (params.avatar == '1' ||  params.avatar == 'gridy' || params.avatar == undefined) {
      chatUserAvatar.setAttribute('style', 'background: url(https://avatars.dicebear.com/api/gridy/admin.svg);');
    } else if (params.avatar == '0') {
      chatUserAvatar.classList.add('hide');
    } else {
      chatUserAvatar.setAttribute('style', 'background: url(https://avatars.dicebear.com/api/gridy/admin.svg);');
    }
    chatLineInner.appendChild(messageEle);

    normalChats.push({ id: 'admin', date: Date.now(), pos: left_pos });
  }

  if (chatOrder == 'last') {
    chatEle.appendChild(chatBox);
  } else if (chatOrder == 'first') {
    chatEle.insertBefore(chatBox, chatEle.firstChild);
  }
  
  if (params.theme == '' || params.theme == 'dark' || params.theme == undefined) {
    fitty('.user-name-text', {
      multiLine: false,
      minSize: 2,
      maxSize: 13,
    });
  }
  setTimeout(() => chatBox.classList.add('visible'), 100);

  if (normalChats.length > maxChatNum) {
    let chatId = normalChats[0].id;
    let chatType = normalChats[0].type;
    normalChats.shift();

    // if (chatType == 'prediction') {
    //   Object.keys(predictionChats)
    //   .forEach(preKey => {
    //     predictionChats[preKey].forEach((chat, index) => {
    //       if (chat.id === chatId) {
    //         predictionChats[preKey].splice(index, 1);
    //       }
    //     });
    //     if (parseInt(predictionChats[preKey].length) === 0) {
    //       delete predictionChats[preKey];
    //     }
    //   });
    // }

    chatEle.childNodes.forEach(node => {
      if (chatId === 'admin') {
        if (node.getAttribute('type') === 'admin') {
          chatEle.removeChild(node);
        }
      } else {
        if (node.getAttribute('message-id') == chatId) {
          chatEle.removeChild(node);
        }
      }
    });
  }

  if (timeout) {
    setTimeout(() => {
      if (chatBox.parentElement) {
        chatBox.classList.remove('visible');
        setTimeout(() => {
          let isAdmin = false;
          if (chatBox.getAttribute('type') === 'admin') {
            isAdmin = true;
            chatEle.removeChild(chatBox);
          }
          if (!isAdmin) {
            let boxIndex = normalChats.findIndex(chat => chat.id == chatBox.getAttribute('message-id'));
            let chatId = normalChats[boxIndex].id;
            let chatType = normalChats[boxIndex].type;

            normalChats.splice(boxIndex, 1);
            
            // if (chatType == 'prediction') {
            //   Object.keys(predictionChats)
            //   .forEach(preKey => {
            //     predictionChats[preKey].forEach((chat, index) => {
            //       if (chat.id === chatId) {
            //         predictionChats[preKey].splice(index, 1);
            //       }
            //     });
            //     if (parseInt(predictionChats[preKey].length) === 0) {
            //       delete predictionChats[preKey];
            //     }
            //   });
            // }

            chatEle.removeChild(chatBox);
          }
        }, 1000);
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
          out.setAttribute('src', `https://static-cdn.jtvnw.net/emoticons/v2/${n.id}/default/light/3.0`);
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

function helix(opts) {
  let defaults = {
    base: helixBase,
    headers: {
      'Client-Id' : helixClientID,
      'Authorization' : helixAuth,
      } };


  return request(Object.assign(defaults, opts));
}

function twitchNameToUser(username) {
  return helix({
    endpoint: 'users',
    qs: { login: username } }).
  then(({ data }) => data[0] || null);
}

function getBadges(channel) {
  return helix({
    base: 'https://badges.twitch.tv/v1/badges/',
    endpoint: (channel ? `channels/${channel}` : 'global') + '/display',
    qs: { language: 'en' } }).
  then(data => {
    return data.badge_sets;
  });
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

// 랜덤 숫자 생성기 a : 시드
function mulberry32(a) {
  var t = a += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

function heartEmojiFlow() {
  let heart = document.createElement('div');
  let hearts = document.getElementsByClassName('hearts')[0];
  heart.classList.add('heart');
  heart.innerText = '❤';
  heart.style.right = 40 + (Math.floor(mulberry32(Date.now()) * 8 + 1)) + 'px';

  hearts.appendChild(heart);
  setTimeout(() => {
    setTimeout(() => {
      hearts.removeChild(heart);
    }, 5400);
    heart.classList.add('active');
  }, 100);
}

function infoTag() {
  let infotag = document.createElement('div');
  let streamerPic = document.createElement('span');
  let streamerId = document.createElement('span');

  infotag.classList.add('infotag');

  streamerPic.classList.add('streamer-pic');
  streamerId.classList.add('streamer-id');

  streamerPic.style.backgroundImage = 'url('+ streamer.profile_image_url +')';
  streamerId.innerText = streamer.login;

  infotag.appendChild(streamerPic);
  infotag.appendChild(streamerId);

  layoutEle.appendChild(infotag);
}