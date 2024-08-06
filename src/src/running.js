let refresh = 10000;
let ul_selector = 'ul[class="blocks blocks-100 blocks-xlg-3 blocks-md-2 blocks-sm-1 postits-container"]';
let page = window;

function beautifyTime(minutes) {
    return (Math.abs(minutes) / 60) > 1 ? formateTime(Math.floor(Math.abs(minutes) / 60)) + 'h' + formateTime(Math.abs(minutes) % 60) : '0h' + formateTime(Math.abs(minutes));
}

function addTimers(ul) {
    let m = new Date();
    let dateString = m.getUTCFullYear() + "-" + ("0" + (m.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + m.getUTCDate()).slice(-2);
    $.get('/brain/users/me', function (data) {
        $.get("/api/employees/" + data.id + "/workday?date=" + dateString, function (result) {
            let toMinutes = (s) => {
                const a = s.split(':');
                return (+a[0]) * 60 + (+a[1]);
            };
            let date = new Date();
            let x = (60 * todo()) - (+(result.timechecks
                .map(x => x.duration > 0 ? Math.floor(x.duration) : toMinutes(date.getHours() + ':' + date.getMinutes()) - toMinutes(x.hour_in))
                .reduce((a, b) => a + b, 0)));
            let innertext = '';
            let hourToDo = Math.floor(x / 60);
            let minuteToDo = x % 60;
            minuteToDo = result.timechecks[0].time_out === null ? minuteToDo + 30 : minuteToDo;
            let endHour = date.getHours() + hourToDo;
            if (minuteToDo >= 60) {
                minuteToDo = minuteToDo - 60;
                endHour++;
            }
            let endMinute = date.getMinutes() + minuteToDo;
            if (endMinute >= 60) {
                endHour++;
                endMinute -= 60;
            }

            const counter = page.document.querySelector("#custom-counter");

            if (!counter) {
                const fileURL = chrome.runtime.getURL("tpl/application.html");
                let xmlHttp = new XMLHttpRequest();
                xmlHttp.open("GET", fileURL, false);
                xmlHttp.send(null);
                let responseParsed = (xmlHttp.responseText);
                const list = page.document.querySelector("div.page-content ul.blocks");
                list.innerHTML = responseParsed
                page.document.querySelector('#todo-hour').addEventListener('change', todo)
                loadSoldes()
                activePip()
            }

            page.document.querySelector("#left-hour").textContent = beautifyTime(x)
            if (x > 0) {
                hide("rab-hour")
                show("exit-hour")
                page.document.querySelector("#exit-hour").textContent = (formateTime(endHour) + 'h' + formateTime(endMinute))
            } else {
                hide("exit-hour")
                show("rab-hour")
                page.document.querySelector("#rab-hour").textContent = (beautifyTime(-x))
            }
            clocker(result.timechecks);
        })
    })
}


function loadSoldes() {
    let xmlHttp = new XMLHttpRequest();
    xmlHttp.open("GET", "/brain/plannings/soldes", false);
    xmlHttp.send(null);
    const soldes = JSON.parse(xmlHttp.responseText)
    if (soldes !== undefined && soldes !== null) {
        let todoHour = parseInt((soldes.hours.total + "").split('.')[0]);
        let todoMinute = 0;
        if ((soldes.hours.total + "").split('.')[1]) {
            const minutes = Number('0.' + (soldes.hours.total + "").split('.')[1]) * 60;
            todoMinute = Math.floor(minutes);
        }
        if (soldes.hours.total > 0) {
            page.document.querySelector('#soldes-positive-content').style.width = (soldes.hours.total * 10) + '%';
            page.document.querySelector('#soldes-positive-text').innerHTML = formateTime(todoHour) + 'h' + formateTime(todoMinute);
        } else {
            page.document.querySelector('#soldes-negative-content').style.width = (soldes.hours.total * -10) + '%';
            page.document.querySelector('#soldes-negative-text').innerHTML = formateTime(todoHour) + 'h' + formateTime(todoMinute);
        }
    }
}

function todo(value) {
    const input = page.document.getElementById("todo-hour");
    if (!input) {
        return 8;
    }
    if (value && value.target) {
        updater()
        return;
    }
    if (value) {
        input.value = value
    }
    let inputValue = input.value;
    let hour = Number(inputValue.split(':')[0])
    let minute = Number(inputValue.split(':')[1])
    return hour + minute / 60
}

function hide(id) {
    const element = page.document.querySelector('#' + id);
    if (!element.classList.contains('hide')) element.classList.add('hide');
}

function show(id) {
    const element = page.document.querySelector('#' + id);
    if (element.classList.contains('hide')) element.classList.remove('hide');
}

function clocker(timechecks) {
    page.document.querySelector('#clock-bar').textContent = ""
    for (const timecheck of timechecks) {
        new ClockBar(timecheck.hour_in, timecheck.hour_out);
    }
}


class ClockBar {
    #start = {
        string: {time: '', hour: '', minute: ''},
        numeric: {time: 0, hour: 0, minute: 0},
    }
    #end = {
        string: {time: '', hour: '', minute: ''},
        numeric: {time: 0, hour: 0, minute: 0},
    }
    div = {
        content: null,
        position: {start: null, end: null, width: null},
        html: null,
    }
    static total = {hour: 0, minute: 0}
    static position = 'out';

    constructor(hourIn, hourOut) {
        this.#start.string.time = hourIn;
        this.#end.string.time = hourOut;
        if (this.#end.string.time === null) {
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

            this.div.html = page.document.createElement('div');
            this.div.html.classList.add('clock-bar-content');
            this.div.html.style.marginLeft = this.div.position.start + '%';
            this.div.html.style.width = this.div.position.width + '%';

            this.div.content = page.document.createElement('div');
            this.div.content.classList.add('clock-bar-content-content-end-of-day');
            this.div.html.appendChild(this.div.content);

            page.document.querySelector('#clock-bar').appendChild(this.div.html);
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

        this.div.html = page.document.createElement('div');
        this.div.html.classList.add('clock-bar-content');
        this.div.html.style.marginLeft = this.div.position.start + '%';
        this.div.html.style.width = this.div.position.width + '%';

        // ajouter une div avec la classe clock-bar-content-content à cette div
        this.div.content = page.document.createElement('div');
        this.div.content.classList.add('clock-bar-content-content');
        this.div.html.appendChild(this.div.content);

        // ajouter un label à la div créé avec les heures de début et de fin
        const label = page.document.createElement('label');
        label.textContent = this.#start.string.hour + ':' + this.#start.string.minute + ' - ' + (this.#end.string.time === new Date().getHours() + ':' + new Date().getMinutes() ? 'xx-xx' : this.#end.string.hour + ':' + this.#end.string.minute);
        label.classList.add('clock-bar-content-label');
        this.div.content.appendChild(label);

        page.document.querySelector('#clock-bar').appendChild(this.div.html);
    }
}

function formateTime(hourOrMinute, reverse = false) {
    hourOrMinute = Math.round(hourOrMinute);
    let time = hourOrMinute.toString();
    if (time.length === 1) {
        if (reverse) {
            time = time + '0';
        } else {
            time = '0' + time;
        }
    }
    return time;
}

let timer;

function updater() {
    page.clearTimeout(timer);
    timer = page.setTimeout(function () {
        addTimers();
    }, 500)
}

function activePip() {
    if (!('documentPictureInPicture' in window)) {
        hide("pipButton")
    }
    const pipButton = document.querySelector('#custom-counter #pipButton')
    pipButton.addEventListener("click", async () => {
        try {
            const pipPage = document.querySelector("#custom-counter");
            const pipWindow = await documentPictureInPicture.requestWindow({
                copyStyleSheets: true,
                width: pipPage.clientWidth,
                height: pipPage.clientHeight - pipButton.clientHeight,
            });
            pipWindow.document.body.style.padding = 0;

            hide("pipButton")


            // Move the player to the Picture-in-Picture window.
            pipWindow.document.body.append(pipPage);
            page = pipWindow;

            pipWindow.addEventListener("unload", (event) => {
                page = window;
                addTimers();
            });
        } catch (e) {
            console.log("pip don't work")
        }
    });
}

$(document).ready(function () {
    $.when($(ul_selector)).then(function (obj) {
        addTimers(ul_selector);
        page.setInterval(function () {
            addTimers(ul_selector);
        }, refresh);
    });
});
