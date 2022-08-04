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

    storage('position').then(function(position){
        if(position.position === 'in'){
            show('exit');
        } else {
            show('enter');
        }
    });


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
            console.log(previousManualTime);

            const todo = document.querySelector('#todo-hour').value;
            let todoHour = parseInt(todo.split(':')[0]);
            let todoMinute = parseInt(todo.split(':')[1]);

            if (previousManualTime.minutes === 59 && todoMinute === 0){
                todoHour += 1;
                todoHour = todoHour%13;
            } else if (previousManualTime.minutes === 0 && todoMinute === 59){
                todoHour -= 1;
                todoHour = todoHour === -1 ? 12 : todoHour;
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
            const month = today.getMonth() <= 10 ? '0' + (today.getMonth() + 1) : today.getMonth() + 1;
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
                if(manualTimeTodo.hours !== undefined && manualTimeTodo.minutes !== undefined){
                    if(manualTimeTodo.setDay === (new Date()).getDay()){
                        document.querySelector('#todo-hour').value = formateTime(manualTimeTodo.hours) + ':' + formateTime(manualTimeTodo.minutes);
                    } else {
                        forget('manualTimeToDo');
                    }
                }
            });


            const timechecks = data.data.timechecks;
            let totalHours = 0;
            let totalMinutes = 0;
            // pour chaque timecheck on créé une nouvelle div au sein de la div #clock-bar et on lui ajoute la classe clock-bar-content et le style margin-left par rapport à l'heure de début
            for (const timecheck of timechecks){
                let start = timecheck.hour_in;
                let end = timecheck.hour_out;
                let position = 'out';
                if(timecheck.hour_out === null){
                    end = new Date().getHours() + ':' + new Date().getMinutes();
                    position = 'in';

                    const startHour = end.split(':')[0];
                    const startMinute = end.split(':')[1];

                    // Parse int pour avoir un nombre entier
                    const startHourInt = parseInt(startHour);
                    const startMinuteInt = parseInt(startMinute);
                    const endHourInt = 23;
                    const endMinuteInt = 59;

                    const startPos = ((startHourInt * 60 + startMinuteInt) / (24 * 60)) * 100;
                    const endPos = ((endHourInt * 60 + endMinuteInt) / (24 * 60)) * 100;
                    const width = endPos - startPos;

                    const div = document.createElement('div');
                    div.classList.add('clock-bar-content');
                    div.style.marginLeft = startPos + '%';
                    div.style.width = width + '%';

                    const divContent = document.createElement('div');
                    divContent.classList.add('clock-bar-content-content-end-of-day');
                    div.appendChild(divContent);

                    document.querySelector('#clock-bar').appendChild(div);
                }
                store('position', {'position': position});
                const startHour = start.split(':')[0];
                const startMinute = start.split(':')[1];
                const endHour = end.split(':')[0];
                const endMinute = end.split(':')[1];
                // Parse int pour avoir un nombre entier
                const startHourInt = parseInt(startHour);
                const startMinuteInt = parseInt(startMinute);
                const endHourInt = parseInt(endHour);
                const endMinuteInt = parseInt(endMinute);

                const startPos = ((startHourInt * 60 + startMinuteInt) / (24 * 60)) * 100;
                const endPos = ((endHourInt * 60 + endMinuteInt) / (24 * 60)) * 100;
                const width = endPos - startPos;

                totalHours += endHourInt - startHourInt;
                totalMinutes += endMinuteInt - startMinuteInt;

                const div = document.createElement('div');
                div.classList.add('clock-bar-content');
                div.style.marginLeft = startPos + '%';
                div.style.width = width + '%';

                // ajouter une div avec la classe clock-bar-content-content à cette div
                const divContent = document.createElement('div');
                divContent.classList.add('clock-bar-content-content');
                div.appendChild(divContent);

                // ajouter un label à la div créé avec les heures de début et de fin
                const label = document.createElement('label');
                label.textContent = start + ' - ' + (end === '23:59' ? 'xx-xx' : end);
                label.classList.add('clock-bar-content-label');
                divContent.appendChild(label);

                document.querySelector('#clock-bar').appendChild(div);
            }
            store('totalTimeDone', {'hours': totalHours, 'minutes': totalMinutes});

            setHourEnter(totalHours, totalMinutes);
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









function hide(id){
  const element = document.querySelector('#'+id);
  if(!element.classList.contains('hide')) element.classList.add('hide');
}
function show(id){
  const element = document.querySelector('#'+id);
  if(element.classList.contains('hide')) element.classList.remove('hide');
}