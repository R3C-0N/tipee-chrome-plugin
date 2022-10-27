window.document.addEventListener('DOMContentLoaded', main);
function main(){
  document.querySelector('#register').addEventListener('click', register)
  document.querySelector('#goin').addEventListener('click', goIn)
  document.querySelector('#goout').addEventListener('click', goOut)
  document.querySelector('#disconnect').addEventListener('click', disconnect)
  document.querySelector('#todo-hour').addEventListener('change', updateHour)
  checkToken();
}

async function get(url, params = {}){
    const proxy = 'https://cors.mathis-medard.com/';
    return axios.get(proxy+url, {params: params})
}
async function post(url, params = {}, options = {}){
    const proxy = 'https://cors.mathis-medard.com/';
    return axios.post(proxy+url, params, options)
}

async function storage(name){
    return await chrome.storage.local.get(name).then(function (result) {
        return result[name];
    });
}
async function store(name, value){
    return await chrome.storage.local.set({[name]: value}).then(function (result) {return result;});
}
async function forget(name){
    return await store(name, null);
}

function checkToken(){
  storage("token").then(function(result){
    const token = result;
    if (token && token.login && token.password){
      hide('connection')
      show('badging')
      checkState(token).then(function(state){
      })
    } else {
      console.log('need connect')
      connect();
    }
  });
}

async function setHourEnter(hour, minute){
    let time = (hour * 60) + minute

    if(ClockBar.position === 'in'){
        show('exit');
    } else {
        show('enter');
    }


    const manualTimeToDo = await storage('manualTimeToDo');

    const todo = manualTimeToDo !== null && manualTimeToDo !== undefined ? formateTime(manualTimeToDo.hours) + ':' + formateTime(manualTimeToDo.minutes) : document.querySelector('#todo-hour').value;
    const todoHour = parseInt(todo.split(':')[0]);
    const todoMinute = parseInt(todo.split(':')[1]);
    const todoTime = (todoHour * 60) + todoMinute;

    let hourLeft = 0;
    let minuteLeft = 0;
    let date = new Date();
    let timeRab = 0;
    let timeRabMinute = 0;
    let timeRabHour = 0;

    if (todoTime - time > 0){
        let timeLeft = (todoHour * 60 + todoMinute) - time;
        hourLeft = Math.floor(timeLeft / 60);
        minuteLeft = timeLeft % 60;

        date.setHours(date.getHours() + hourLeft);
        date.setMinutes(date.getMinutes() + minuteLeft);

        show('exit-hour-parent');
        show('left-hour-parent');
        hide('rab-hour-parent');

        document.querySelector('#exit-hour').textContent = formateTime(date.getHours()) + 'h' + formateTime(date.getMinutes());
        document.querySelector('#left-hour').textContent = formateTime(hourLeft.toString()) + 'h' + formateTime(minuteLeft.toString());
    } else {
        timeRab = time - todoTime;
        timeRabMinute = Math.floor(timeRab % 60);
        timeRabHour = Math.floor(timeRab / 60);

        date.setHours(date.getHours() + hourLeft);
        date.setMinutes(date.getMinutes() + minuteLeft);
        hide('exit-hour-parent');
        hide('left-hour-parent');
        show('rab-hour-parent');
        document.querySelector('#rab-hour').textContent = formateTime(timeRabHour.toString()) + 'h' + formateTime(timeRabMinute.toString());
    }


    // Ajoute le temps restant à l'heure actuelle
}

function updateHour(){
    storage('totalTimeDone').then(function(totalTimeDone){
        storage('manualTimeToDo').then(function(previousManualTime){
            const todo = document.querySelector('#todo-hour').value;
            let todoHour = parseInt(todo.split(':')[0]);
            let todoMinute = parseInt(todo.split(':')[1]);

            if(previousManualTime !== undefined && previousManualTime !== null && previousManualTime.hours !== undefined && previousManualTime.minutes !== undefined){
                if (previousManualTime.minutes === 59 && todoMinute === 0){
                    todoHour += 1;
                    todoHour = todoHour%13;
                } else if (previousManualTime.minutes === 0 && todoMinute === 59){
                    todoHour -= 1;
                    todoHour = todoHour === -1 ? 12 : todoHour;
                }
            }
            document.querySelector('#todo-hour').value = formateTime(todoHour) + ':' + formateTime(todoMinute);

            store('manualTimeToDo', {hours: todoHour, minutes: todoMinute, setDay: new Date().getDay()});

            setHourEnter(totalTimeDone.hours, totalTimeDone.minutes);
        });
    });
}

function formateTime(hourOrMinute){
    let time = hourOrMinute.toString();
    if (time.length === 1){
        time = '0' + time;
    }
    return time;
}

function connect(){
  show('connection')
  hide('badging')
  hide('enter')
  hide('exit')
}

function disconnect(){
    console.log('disconnect');
    forget('manualTimeToDo');
    forget('token').then(() => {checkToken();});
}

async function checkState(token){
    try {
      const csrf = await loadCSRF(token);
      store('csrf', csrf).then(() => {});
      const params = new URLSearchParams();
      params.append('_username', token.login.toString());
      params.append('_password', token.password.toString());
      params.append('_csrf_token', csrf.toString());

      await login(params);

      const active = await getActiveUser();
      // await chrome.storage.local.set({'activeUser': active});
      await store('activeUser', active);

      const workstatus = await loadWorkStatus(active);
      // await chrome.storage.local.set({'workstatus': workstatus});
      await store('workstatus', workstatus);


      return true;

    } catch (error) {
        console.error(error);
        return false;
    }
}

async function loadCSRF(){
    return get("https://infomaniak.tipee.net/auth/login")
        .then(function(data){
            const startPos = data.data.indexOf('<input type="hidden" name="_csrf_token" value="')+47;
            const endPos = data.data.indexOf('"', startPos)
            return data.data.slice(startPos, endPos);
        })
}
async function login(params){
    return post("https://infomaniak.tipee.net/auth/login",
        params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
            }
        })
        .then(function(data){
            return data;
        })
}
async function getActiveUser(){
    return get("https://infomaniak.tipee.net/home.php")
        .then(function(data){
            const active = {};

            let startPos = data.data.indexOf('active_user: ')+13;
            let endPos = data.data.indexOf(',', startPos);
            active.user = parseInt(data.data.slice(startPos, endPos));

            startPos = data.data.indexOf('active_username: "')+18;
            endPos = data.data.indexOf('"', startPos);

            active.username = data.data.slice(startPos, endPos);
            // get today date to format YYYY-MM-DD
            const today = new Date();
            const year = today.getFullYear();
            // check if month is less than 10
            const month = formateTime(today.getMonth()+1);
            const day = today.getDate();
            active.date = year + '-' + formateTime(month) + '-' + formateTime(day);
            return active;
        })
}
async function loadWorkStatus(active){
    return  get("https://infomaniak.tipee.net/api/employees/"+active.user+"/workday?date="+active.date)
        .then(function(data){
            const hoursToDo = parseInt(data.data.a_faire.split('h')[0]);
            const minutesToDo = parseInt(data.data.a_faire.split('h')[1].replace('.', ''));

            document.querySelector('#todo-hour').value = formateTime(hoursToDo) + ':' + formateTime(minutesToDo);

            storage('manualTimeToDo').then(function(manualTimeTodo){
                if(manualTimeTodo !== undefined && manualTimeTodo !== null && manualTimeTodo.hours !== undefined && manualTimeTodo.minutes !== undefined){
                    if(manualTimeTodo.setDay === (new Date()).getDay()){
                        document.querySelector('#todo-hour').value = formateTime(manualTimeTodo.hours) + ':' + formateTime(manualTimeTodo.minutes);
                    } else {
                        forget('manualTimeToDo');
                    }
                }
            });

            const timechecks = data.data.timechecks;
            // pour chaque timecheck on créé une nouvelle div au sein de la div #clock-bar et on lui ajoute la classe clock-bar-content et le style margin-left par rapport à l'heure de début
            for (const timecheck of timechecks){
                new ClockBar(timecheck.hour_in, timecheck.hour_out);
            }
            store('totalTimeDone', {'hours': ClockBar.total.hour, 'minutes': ClockBar.total.minute});

            setHourEnter(ClockBar.total.hour, ClockBar.total.minute);
            return data.data;
        })
}

function register(){
  console.log('register');

  const login = document.querySelector('#login').value;
  const password = document.querySelector('#password').value;

  // chrome.storage.local.set({'token': {'login': login, 'password': password}}).then(() => {checkToken();});
  store('token', {'login': login, 'password': password}).then(() => {checkToken();});
}

async function goIn(){
    console.log('goin');
    const activeUser = await storage('activeUser').then(function(data){
        return data;
    });
    // console.log(activeUser);
    return post('https://infomaniak.tipee.net/brain/timeclock/timechecks', {
        person: activeUser.user,
        timeclock: "Mac OS X"
    }).then(function(data){
        console.log(data);
        return data;
    })
}
async function goOut(){
    console.log('goout');
    const activeUser = await storage('activeUser').then(function(data){
        return data;
    });
    // console.log(activeUser);
    return post('https://infomaniak.tipee.net/brain/timeclock/timechecks', {
        person: activeUser.user,
        timeclock: "Mac OS X"
    }).then(function(data){
        console.log(data);
        return data;
    })
}

class ClockBar {
    #start = {
        string:{time:'',hour:'',minute:''},
        numeric:{time:0,hour:0,minute:0},
    }
    #end = {
        string:{time:'',hour:'',minute:''},
        numeric:{time:0,hour:0,minute:0},
    }
    div = {
        content:null,
        position:{start:null,end:null,width:null},
        html:null,
    }
    static total = {hour:0, minute:0}
    static position = 'out';

    constructor(hourIn, hourOut) {
        this.#start.string.time = hourIn;
        this.#end.string.time = hourOut;
        if(this.#end.string.time === null){
            this.#end.string.time = new Date().getHours() + ':' + new Date().getMinutes();
            ClockBar.position = 'in';

            this.#start.string.hour = formateTime(this.#end.string.time.split(':')[0]);
            this.#start.string.minute = formateTime(this.#end.string.time.split(':')[1]);

            // Parse int pour avoir un nombre entier
            this.#start.numeric.hour = parseInt(this.#start.string.hour);
            this.#start.numeric.minute = parseInt(this.#start.string.minute);
            this.#end.numeric.hour = 23;
            this.#end.numeric.minute = 59;

            this.div.position.start = ((this.#start.numeric.hour * 60 + this.#start.numeric.minute) / (24 * 60)) * 100;
            this.div.position.end = ((this.#end.numeric.hour * 60 + this.#end.numeric.minute) / (24 * 60)) * 100;
            this.div.position.width = this.div.position.end - this.div.position.start;

            this.div.html = document.createElement('div');
            this.div.html.classList.add('clock-bar-content');
            this.div.html.style.marginLeft = this.div.position.start + '%';
            this.div.html.style.width = this.div.position.width + '%';

            this.div.content = document.createElement('div');
            this.div.content.classList.add('clock-bar-content-content-end-of-day');
            this.div.html.appendChild(this.div.content);

            document.querySelector('#clock-bar').appendChild(this.div.html);
        }
        this.#start.string.hour = formateTime(this.#start.string.time.split(':')[0]);
        this.#start.string.minute = formateTime(this.#start.string.time.split(':')[1]);
        this.#end.string.hour = formateTime(this.#end.string.time.split(':')[0]);
        this.#end.string.minute = formateTime(this.#end.string.time.split(':')[1]);
        // Parse int pour avoir un nombre entier
        this.#start.numeric.hour = parseInt(this.#start.string.hour);
        this.#start.numeric.minute = parseInt(this.#start.string.minute);
        this.#end.numeric.hour = parseInt(this.#end.string.hour);
        this.#end.numeric.minute = parseInt(this.#end.string.minute);

        this.div.position.start = ((this.#start.numeric.hour * 60 + this.#start.numeric.minute) / (24 * 60)) * 100;
        this.div.position.end = ((this.#end.numeric.hour * 60 + this.#end.numeric.minute) / (24 * 60)) * 100;
        this.div.position.width = this.div.position.end - this.div.position.start;

        ClockBar.total.hour += this.#end.numeric.hour - this.#start.numeric.hour;
        ClockBar.total.minute += this.#end.numeric.minute - this.#start.numeric.minute;

        this.div.html = document.createElement('div');
        this.div.html.classList.add('clock-bar-content');
        this.div.html.style.marginLeft = this.div.position.start + '%';
        this.div.html.style.width = this.div.position.width + '%';

        // ajouter une div avec la classe clock-bar-content-content à cette div
        this.div.content = document.createElement('div');
        this.div.content.classList.add('clock-bar-content-content');
        this.div.html.appendChild(this.div.content);

        // ajouter un label à la div créé avec les heures de début et de fin
        const label = document.createElement('label');
        label.textContent = this.#start.string.hour + ':' + this.#start.string.minute + ' - ' + (this.#end.string.time === new Date().getHours() + ':' + new Date().getMinutes() ? 'xx-xx' : this.#end.string.hour + ':' + this.#end.string.minute);
        label.classList.add('clock-bar-content-label');
        this.div.content.appendChild(label);

        document.querySelector('#clock-bar').appendChild(this.div.html);
    }
}







function hide(id){
  const element = document.querySelector('#'+id);
  if(!element.classList.contains('hide')) element.classList.add('hide');
}
function show(id){
  const element = document.querySelector('#'+id);
  if(element.classList.contains('hide')) element.classList.remove('hide');
}
