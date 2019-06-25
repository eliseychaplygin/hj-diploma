'use strict'

const app = document.querySelector('.wrap.app');
const menu = app.querySelector('.menu');
const menuItems = app.querySelectorAll('.menu__item');
const drag = menu.querySelector('.drag');
const burgerBtn = menu.querySelector('.burger');

const modes = menu.querySelectorAll('.mode');
const tools = menu.querySelectorAll('.tool');

const newBtn = menu.querySelector('.new');

const commentsBtn = menu.querySelector('.comments');
const commentsTools = menu.querySelector('.comments-tools');
const commentsOnBtn = commentsTools.querySelector('.menu__toggle[value="on"]');
const commentsOffBtn = commentsTools.querySelector('.menu__toggle[value="off"]');
const drawBtn = menu.querySelector('.draw');
const drawTools = menu.querySelector('.draw-tools');
const shareBtn = menu.querySelector('.share');
const shareTools = menu.querySelector('.share-tools');
const urlImg = app.querySelector('.menu__url');
const currImg = app.querySelector('.current-image');
const error = app.querySelector('.error');
const errorMsg = app.querySelector('.error__message');
const loader = app.querySelector('.image-loader');
const commentsForm = app.querySelector('.comments__form');
const boundsForm = commentsForm.getBoundingClientRect();
const boundsMarker = commentsForm.querySelector('.comments__marker').getBoundingClientRect();
const errors = [
    'Неверный формат файла. Пожалуйста, выберите изображение в формате .jpg или .png.',
    'Чтобы загрузить новое изображение, пожалуйста, воспользуйтесь пунктом "Загрузить новое" в меню.'
];
const url = '//neto-api.herokuapp.com';
const picture = document.createElement('div');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const drawing = false;
const curves = [];
const needsRedraw = false;
let moveMenu = true;

// Инициализация приложения
function initApp() {
    app.removeChild(commentsForm);
    picture.appendChild(currImg);
    picture.insertBefore(canvas, currImg.nextElementSibling);
    app.insertBefore(picture, menu.nextElementSibling);

    if (!sessionStorage.imageInfo) {
      deleteImg();
      changeCommentsMarkerDisplay();
      saveToSessionStorage('menuHeight', menu.offsetHeight);
      
      if (location.search && getFromSessionStorage('menuMode').state !== 'initial') {
        showLoader();
        const idImg = location.search.replace('?id=', '');
        serverRequest(`/pic/${idImg}`);
      } else {
        selectMenuMode('initial');
      }
    } else {
      showLoader();
      showCurrImg();
    }
}

// Определение положения меню:
window.addEventListener('resize', () => findMenuPosition());

function findMenuPosition() {
  let x, y;
  if (!sessionStorage.menuPosition) {
    x = menu.getBoundingClientRect().left;
    y = menu.getBoundingClientRect().top;
  } else {
    x = getFromSessionStorage('menuPosition').x;
    y = getFromSessionStorage('menuPosition').y;
    setMenuPosition(x, y);
  }
  if (menu.offsetHeight > getFromSessionStorage('menuHeight')) {
    while (menu.offsetHeight > getFromSessionStorage('menuHeight')) {
      x = --x;
      menu.style.left = `${x}px`;
    }
    saveToSessionStorage('menuPosition', {x: x, y: y});
  }
}

// Задание положения меню на странице:
function setMenuPosition(x, y) {
   menu.style.left = `${x}px`;
   menu.style.top = `${y}px`;
}

// Отоборажение картинки на странице:
function showCurrImg(state, mode) {
    const imgData = getFromSessionStorage('imageInfo');
    currImg.src = imgData.url;
    urlImg.value = location.search ? location.href.replace(location.search, `?id=${imgData.id}`) : `${location.href}?id=${imgData.id}`;
    startWebSocket(imgData.id);

    if (state) {
      selectMenuMode(state, mode);
    } else {
      const menuMode = getFromSessionStorage('menuMode');
      selectMenuMode(menuMode.state, menuMode.mode);
    }

    currImg.addEventListener('load', () => {
      picture.style.width = `${currImg.width}px`;
      picture.style.height = `${currImg.height}px`;
      picture.classList.add('current-image');
      canvas.width = currImg.width;
      canvas.height = currImg.height;
      canvas.classList.add('current-image');

      hideElement(loader);
      showElement(menu);
      findMenuPosition();
      checkCommentsMarkerDisplay();
      checkComments();
      checkBrushColor();
    });
}

// Удаление изображения и его ссылки со страницы:
function deleteImg() {
    currImg.src = '';
    urlImg.value = '';
}

// Очистка страницы:
function clearPage() {
    sessionStorage.clear();
    connectionWSS.close();
    deleteImg();
    changeCommentsMarkerDisplay();
    saveToSessionStorage('menuHeight', menu.offsetHeight);
    canvas.style.background = '';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    picture.classList.remove('current-image');
    canvas.classList.remove('current-image');
    picture.querySelectorAll('.comments__form').forEach(form => {
      picture.removeChild(form);
    });
}

// Скрытие элемента на странице:
function hideElement(element) {
    element.style.display = 'none';
}

// Отображение элемента на странице:
function showElement(element) {
    element.style.display = 'inline-block';
}

// Показ прелоадера в момент загрузки:
function showLoader() {
    hideElement(menu);
    сommentsMarkerDisplay(false);
    showElement(loader);
}

// Переключение состояния приложения:
function selectMenuState(event) {
    if (event.target === newBtn || event.target.closest('.menu__item') === newBtn) {
      selectMenuMode('initial');
    }
    if (event.target === burgerBtn || event.target.closest('.menu__item') === burgerBtn) {
      selectMenuMode('default');
    }
    if (event.target === commentsBtn || event.target.closest('.menu__item') === commentsBtn) {
      selectMenuMode('selected', 'comments');
    }
    if (event.target === drawBtn || event.target.closest('.menu__item') === drawBtn) {
      selectMenuMode('selected', 'draw');
    }
    if (event.target === shareBtn || event.target.closest('.menu__item') === shareBtn) {
      selectMenuMode('selected', 'share');
    }
}

// Переключение режима приложения:
menu.addEventListener('click', event => {
    if (menu.dataset.state !== 'initial' && event.target !== drag) {
      if (event.target === newBtn || event.target.closest('.new') === newBtn) {
        clearPage();
      } else {
        hideCommentsForm(true);
      }
      selectMenuState(event);
    }
});

function selectMenuMode(state, mode) {
    switch(state) {
      case 'initial':
        menu.dataset.state = 'initial';
        hideElement(burgerBtn);
        break;
      case 'default':
        menu.dataset.state = 'default';
        hideElement(burgerBtn);
        menu.querySelectorAll('[data-state="selected"]').forEach(item => item.dataset.state = '');
        break;        
      case 'selected':
        menu.dataset.state = 'selected';
        showElement(burgerBtn);
        Array.from(modes).find(item => item.classList.contains(mode)).dataset.state = 'selected';
        break;
    }
    saveToSessionStorage('menuMode', {state: state, mode: mode});
    findMenuPosition();
}

// Запросы на сервер:
function serverRequest(endUrl, data, type) {
    const url = `https:${url}${endUrl}`;
    if (type === 'multipart/form-data') {
      return fetch(url, {
        method: 'POST',
        body: data
      })
      .then(result => result.json())
      .then(data => {
        saveToSessionStorage('imageInfo', data);
        showCurrImg('selected', 'share');
      })
      .catch(error => showErrorMsg(error))
    } else if (type === 'application/x-www-form-urlencoded') {
      return fetch(url, {
        method: 'POST',
        body: data,
        headers: {
          'Content-Type': type
        }
      })
      .then(result => result.json())
      .then(data => {
        saveToSessionStorage('imageInfo', data);
      })
      .catch(error => {
        showErrorMsg(error);
      })
    } else {
      return fetch(url)
      .then(result => result.json())
      .then(data => {
        saveToSessionStorage('imageInfo', data);
        showCurrImg('selected', 'comments');
      })
      .catch(error => showErrorMsg(error, false))
    }
}

// Сохранение данныx в локальное хранилище:
function saveToSessionStorage(key, data) {
    sessionStorage[key] = JSON.stringify(data);
}

// Получение данных из локального хранилища:
function getFromSessionStorage(key) {
    try {
      if (sessionStorage[key]) {
        return JSON.parse(sessionStorage[key]);
      }
    } catch (error) {
      console.error(`${error}`);
    }
}

// Добавление данных в локальное хранилище:
function addToSessionStorage(key, data) {
    const imgData = getFromSessionStorage(key);
    if (!imgData.comments) {
      imgData.comments = {};
    } 
    if (!imgData.comments[data.id]) {
      imgData.comments[data.id] = {
        left: data.left,
        message: data.message,
        timestamp: data.timestamp,
        top: data.top
      }
      saveToSessionStorage(key, imgData);
    }
}

// Запуск перетаскивания меню:
drag.addEventListener('mousedown', event => startDragMenu(event));

function startDragMenu(event) {
    moveMenu = true;
    shiftX = event.pageX - menu.getBoundingClientRect().left - window.pageXOffset;
    shiftY = event.pageY - menu.getBoundingClientRect().top - window.pageYOffset;
    minX = app.offsetLeft;
    minY = app.offsetTop;
    maxX = app.offsetLeft + app.offsetWidth - menu.getBoundingClientRect().width;
    maxY = app.offsetTop + app.offsetHeight - menu.getBoundingClientRect().height;
}

// Перетаскивание меню:
document.addEventListener('mousemove', event => dragMenu(event));

function dragMenu(event) {
    if (moveMenu) {
      findMenuCoord(event);
    }
}

// Окончание перетаскивания меню:
document.addEventListener('mouseup', event => dropMenu(event));

function dropMenu(event) {
    if (moveMenu) {
      moveMenu = false;
      saveToSessionStorage('menuPosition', findMenuCoord(event));
    }
}

// Нахождение новых координат меню:
function findMenuCoord(event) {
    let x, y;
    x = event.pageX - shiftX;
    y = event.pageY - shiftY;
    x = Math.min(x, maxX);
    y = Math.min(y, maxY);
    x = Math.max(x, minX);
    y = Math.max(y, minY);
    setMenuPosition(x, y);
    return {x: x, y: y};
}

// Выбор изображения при клике на поле "Загрузить новое":
newBtn.addEventListener('click', () => {
    if (menu.dataset.state === 'initial') {
      selectImage();
    }
});

function selectImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg, image/png';
    input.click();
    input.addEventListener('change', event => {
      const file = event.currentTarget.files[0];
      sendImg(file);
    });
}

// Выбор изображения при перетаскивании его на холст:
currImg.addEventListener('dragstart', event => event.preventDefault());
app.addEventListener('dragover', event => event.preventDefault());
app.addEventListener('drop', event => dropImage(event));

function dropImage(event) {
    event.preventDefault();

    if (sessionStorage.imageInfo) {
      showErrorMsg(errors[1]);
      return;
    }
    const file = event.dataTransfer.files[0];
    const imageTypeRegExp = /^image\/[jpeg|png]/;
    if (imageTypeRegExp.test(file.type)) {
      sendImg(file);
    } else {
      showErrorMsg(errors[0]);
    }
}

// Отправка изображения на сервер:
function sendImg(file) {
    showLoader();
    const name = file.name.replace(/\.\w*$/, "");
    const data = new FormData();
    data.append('title', `${name}`);
    data.append('image', file);
    serverRequest('/pic', data, 'multipart/form-data');
}

// Отображение ошибки на странице:
function showErrorMsg(errorMsg, closeMsg = true) {
    hideElement(menu);
    hideElement(loader);
    errorMsg.textContent = errorMsg;
    showElement(error);
    if (closeMsg) {
      setTimeout(() => {
        hideElement(error);
        showElement(menu);
      }, 3000);
    }
}

// Копирование ссылки в режиме "Поделиться":
shareTools.addEventListener('click', event => copyLink(event));

function copyLink(event) {
    if (event.target.classList.contains('menu_copy')) {
      const link = document.createElement('textarea');
      link.textContent = menu.querySelector('.menu__url').value;
      document.body.appendChild(link);
      link.select();
      try {
        document.execCommand('copy');
      } catch (error) {
        console.error(error);
        showErrorMsg('Не удалось скопировать ссылку');
      }
      document.body.removeChild(link);
    }
}

// Проверка необходимости отображения/ скрытия маркеров коммантариев на странице:
function checkCommentsMarkerDisplay() {
    let display =  getFromSessionStorage('markerDisplay');
    changeCommentsMarkerDisplay(display);
    return display;
}

// Переключение отображения/ скрытия маркеров коммантариев на странице:
commentsTools.addEventListener('change', () => toggleCommentsMarkerDisplay());

function toggleCommentsMarkerDisplay() {
    const display = commentsTools.querySelector('.menu__toggle:checked').value === 'on';
    changeCommentsMarkerDisplay(display);
}
  
// Изменение положения переключателя и отображения/ скрытия комментариев:
function changeCommentsMarkerDisplay(display = true) {
    if (display) {
      commentsOnBtn.setAttribute('checked', '');
      commentsOffBtn.removeAttribute('checked');
    } else {
      commentsOffBtn.setAttribute('checked', '');
      commentsOnBtn.removeAttribute('checked');
    }
    saveToSessionStorage('markerDisplay', display);
    display ? сommentsMarkerDisplay() : сommentsMarkerDisplay(false);
}

// Отображение/ скрытие маркеров комментариев на странице:
function сommentsMarkerDisplay(display = true) {
    const commentsForms = app.querySelectorAll('.comments__form');
    if (commentsForms) {
      commentsForms.forEach(form => {
        display ? showElement(form) : hideElement(form);
      });
    }
}

// Скрытие / удаление формы комментариев на странице:
function hideCommentsForm(hideOnlyNew = false) {
    const openMarker = app.querySelector('.comments__marker-checkbox[disabled=""]');
    
    if (openMarker) {
      const openCommentsForm = openMarker.closest('.comments__form');
      const comment = openCommentsForm.querySelector('.comment');
  
      if (comment.firstElementChild.classList.contains('loader')) {
        picture.removeChild(openCommentsForm);
      } else if (!hideOnlyNew) {
        openMarker.checked = openMarker.disabled = false;
        openCommentsForm.style.zIndex = '';
      }
    }
}
  
// Создание шаблона формы добавления комментария:
function createCommentsFormTemplate(x, y) {
    return {
      tag: 'form',
      cls: 'comments__form',
      attrs: {style: `left: ${x}px; top: ${y}px;`, 'data-left': `${x}`, 'data-top': `${y}`},
      content: [
        {
          tag: 'span',
          cls: 'comments__marker',
        },
        {
          tag: 'input',
          cls: 'comments__marker-checkbox',
          attrs: {type: 'checkbox'}
        },
        {
          tag: 'div',
          cls: 'comments__body',
          content: [
            {
              tag: 'div',
              cls: 'comment',
              content: {
                tag: 'div',
                cls: 'loader',
                attrs: {style: 'display: none'},
                content: [
                  {tag: 'span'},
                  {tag: 'span'},
                  {tag: 'span'},
                  {tag: 'span'},
                  {tag: 'span'}
                ]
              }
            },
            {
              tag: 'textarea',
              cls: 'comments__input',
              attrs: {type: 'text', placeholder: 'Напишите ответ...'}
            },
            {
              tag: 'input',
              cls: 'comments__close',
              attrs: {type: 'button', value: 'Закрыть'}
            },
            {
              tag: 'input',
              cls: 'comments__submit',
              attrs: {type: 'submit', value: 'Отправить'}
            }
          ]
        }
      ]
    }
}

// Создание шаблона комментария:
function createCommentTemplate(id, comment) {
    return {
      tag: 'div',
      cls: 'comment',
      attrs: {'data-timestamp': `${comment.timestamp}`, 'data-id': `${id}`},
      content: [
        {
          tag: 'p',
          cls: 'comment__time',
          content: new Date(comment.timestamp).toLocaleString('ru-Ru').replace(',', '')
        },
        {
          tag: 'p',
          cls: 'comment__message',
          attrs: {style: 'white-space: pre'},
          content: comment.message
        }
      ]
    }
}

// Создание элемента разметки из шаблона:
function createElementFromTemplate(template) {
    if ((template === undefined) || (template === null) || (template === false)) {
      return document.createTextNode('');
    }
    if ((typeof template === 'string') || (typeof template === 'number') || (template === true)) {
      return document.createTextNode(template.toString());
    }
    if (Array.isArray(template)) {
      return template.reduce((fragment, element) => {
        fragment.appendChild(createElementFromTemplate(element));
        return fragment;
      }, document.createDocumentFragment());
    }

    const element = document.createElement(template.tag);

    if (template.cls) {
      element.classList.add(...[].concat(template.cls).filter(Boolean));
    }
    
    if (template.attrs) {
      Object.keys(template.attrs).forEach(key => {
        element.setAttribute(key, template.attrs[key])
      });
    }

    if (template.content) {
      element.appendChild(createElementFromTemplate(template.content));
    }

    return element;
}

// Добавление пользователем новой формы комментариев на страницу:
picture.addEventListener('click', event => addNewCommentsForm(event));

function addNewCommentsForm(event) {
    if (event.target.classList.contains('current-image') && commentsBtn.dataset.state === 'selected' && checkCommentsMarkerDisplay()) {
      hideCommentsForm();

      const shiftX = boundsMarker.left - boundsForm.left + boundsMarker.width / 2;
      const shiftY = boundsMarker.top - boundsForm.top + boundsMarker.height;

      const commentsForm = createNewCommentsForm(event.offsetX - shiftX, event.offsetY - shiftY);
      const markerCheckbox = commentsForm.querySelector('.comments__marker-checkbox');
      const textArea = commentsForm.querySelector('.comments__input');
      markerCheckbox.checked = markerCheckbox.disabled = true;
      textArea.focus();
    }
}
  
// Создание новой формы комментариев:
function createNewCommentsForm(x, y) {
    const commentsForm = createElementFromTemplate(createCommentsFormTemplate(x, y));
    picture.appendChild(commentsForm);

    commentsForm.addEventListener('change', event => openCommentsForm(event));
    commentsForm.addEventListener('click', event => closeCommentsForm(event));
    commentsForm.addEventListener('submit', event => sendComment(event));
    return commentsForm;
}

// Открытие формы комментариев при клике на маркер:
function openCommentsForm(event) {
    if (event.target.classList.contains('comments__marker-checkbox')) {
      hideCommentsForm();

      const markerCheckbox = event.target;
      const commentsForm = event.target.closest('.comments__form');
      const textArea = commentsForm.querySelector('.comments__input');
      
      markerCheckbox.checked = markerCheckbox.disabled = true;
      commentsForm.style.zIndex = '1';
      textArea.focus();
    }
}

// Закрытие формы комментариев при клике на кнопку "Закрыть":
function closeCommentsForm(event) {
    if (event.target.classList.contains('comments__close')) {
      hideCommentsForm();
    }
}

// Отправка комментария на сервер при клике на кнопку "Отправить":
function sendComment(event) {
    event.preventDefault();

    const commentsForm = event.target.closest('.comments__form');
    const loader = commentsForm.querySelector('.loader');
    const input = commentsForm.querySelector('.comments__input');
    const textArea = commentsForm.querySelector('.comments__input');
    const message = input.value;
    const left = commentsForm.dataset.left;
    const top = commentsForm.dataset.top;
    
    if (message) {
      showElement(loader);
      const id = getFromSessionStorage('imageInfo').id;
      const data = `message=${encodeURIComponent(message)}&left=${encodeURIComponent(left)}&top=${encodeURIComponent(top)}`;
      serverRequest(`/pic/${id}/comments`, data, 'application/x-www-form-urlencoded');
    }
    input.value = '';
    textArea.focus();
}

// Добавление комментария на страницу:
function addComment(id, data) {
    let commentsForm = app.querySelector(`.comments__form[data-left="${data.left}"][data-top="${data.top}"]`);
    if (!commentsForm) {
      commentsForm = createNewCommentsForm(data.left, data.top);
    }
    const comments = Array.from(commentsForm.getElementsByClassName('comment'));
    const sameID = comments.find(comment => comment.dataset.id === id);
    
    if (!sameID) {
      const newComment = createElementFromTemplate(createCommentTemplate(id, data));
      const nextComment = comments.find(comment => Number(comment.dataset.timestamp) > data.timestamp);
      const commentsBody = commentsForm.querySelector('.comments__body');
      const loader = commentsForm.querySelector('.loader');
      commentsBody.insertBefore(newComment, nextComment ? nextComment : loader.parentElement);
      hideElement(loader);
      checkCommentsMarkerDisplay();
    }
}
  
// Проверка наличия комментариев к изображению:
function checkComments() {
    const comments = getFromSessionStorage('imageInfo').comments;
    if (comments) {
      const commentsKeys = Object.keys(comments);
      commentsKeys.forEach(key => addComment(key, comments[key]));
    }
}

// Перерисовка изображения:
function redraw() {
    curves.forEach((curve) => {
      drawPoint(curve[0]);
      drawCurve(curve);
    })
}

// Начало рисования:
canvas.addEventListener('mousedown', event => {
    if (drawBtn.dataset.state === 'selected') {
      startDrawing(event);
    }
});

function startDrawing(event) {
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = ctx.fillStyle = getComputedStyle(app.querySelector('.menu__color:checked').nextElementSibling).backgroundColor;

    drawing = true;
    const point = [event.offsetX, event.offsetY];
    const curve = [];
    curve.push(point);
    curves.push(curve);
    redraw();
}

// Рисование:
canvas.addEventListener('mousemove', (event) => {
    if (drawBtn.dataset.state === 'selected') {
      draw(event);
    }
});
canvas.addEventListener('mouseleave', () => {
    if (drawBtn.dataset.state === 'selected') {
      drawing = false;
    }
});

function draw(event) {
    if (drawing) {
      const point = [event.offsetX, event.offsetY];
      curves[curves.length - 1].push(point);
      redraw();
    }
}

// Отрисовка точек:
function drawPoint(point) {
    ctx.beginPath();
    ctx.arc(...point,  ctx.lineWidth / 2, 0, 2 * Math.PI);
    ctx.fill();
}
  
// Отрисовка кривых:
function drawCurve(points) {
    for(let i = 1; i < points.length - 1; i++) {
      smoothCurveBetween(points[i], points[i + 1]);
    }
}
  
// Сглаживание кривых:
function smoothCurveBetween(point1, point2) {
    const controlPoint = [(point1[0] + point2[0]) / 2, (point1[1] + point2[1]) / 2];
    ctx.beginPath();
    ctx.moveTo(point1[0], point1[1]);
    ctx.quadraticCurveTo(controlPoint[0], controlPoint[1], point2[0], point2[1]);
    ctx.stroke();
}

// Завершение рисования:
canvas.addEventListener('mouseup', () => {
    if (drawBtn.dataset.state === 'selected') {
      stopDrawing();
    }
});

function stopDrawing() {
    drawing = false;
    curves = [];
    sendMask();
}

// Отправка данных холста на сервер:
function sendMask() {
    canvas.toBlob(blob => {
      connectionWSS.send(blob);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
}

// Переключение цвета кисти:
drawTools.addEventListener('change', () => toggleBrushColor());

function toggleBrushColor() {
    const brushColor = app.querySelector('.menu__color:checked').value;
    saveToSessionStorage('brushColor', brushColor);
}

// Проверка сохраненного ранее цвета кисти и его установка на странице:
function checkBrushColor() {
    if (getFromSessionStorage('brushColor')) {
      app.querySelectorAll('.menu__color').forEach(color => {
        if (color.classList.contains(getFromSessionStorage('brushColor'))) {
          color.setAttribute('checked', '');
        } else {
          color.removeAttribute('checked');
        }
      });
    }
}

// Подключение WebSocket:
function startWebSocket(id) {
    connectionWSS = new WebSocket(`wss:${url}/pic/${id}`);

    connectionWSS.addEventListener('open', event => {
      console.log('Вебсокет соединение установлено');
    });
    connectionWSS.addEventListener('close', event => {
      if (event.wasClean) {
        console.log('Вебсокет соединение закрыто чисто');
      } else {
        console.warn(`Обрыв соединения. Код:${event.code} причина:${event.reason}`);
      }
    });
    connectionWSS.addEventListener('error', event => {
      console.error(`Ошибка вебсокет соединения: ${error.message}`);
    });
    connectionWSS.addEventListener('message', event => {
      const responseWSS = JSON.parse(event.data);
      switch(responseWSS.event) {
        case 'pic':
          if (responseWSS.pic.mask) {
            canvas.style.background = `url("${responseWSS.pic.mask}")`;
          } else {
            canvas.style.background = '';
          }
          break;

        case 'comment':
          addToSessionStorage('imageInfo', responseWSS.comment);
          addComment(responseWSS.comment.id, responseWSS.comment);
          break;

        case 'mask':
          console.log('пришла маска!');
          canvas.style.background = `url("${responseWSS.url}")`;
          break;

        case 'error':
          console.error(`Ошибка: ${responseWSS.message}`);
          break;
      }
    });
}

initApp()