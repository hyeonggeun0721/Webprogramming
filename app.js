var createError = require('http-errors');
var express = require('express');
const path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const session = require('express-session');
const http = require('http'); // 서버 실행을 위해 http 모듈 추가

const boardRouter = require('./routes/board');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const userRouter = require('./routes/user');
const productRouter = require('./routes/products');
const cartRouter = require('./routes/cart');
const orderRouter = require('./routes/order');
const noticeRouter = require('./routes/notice');
const adminRouter = require('./routes/admin');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'))); 

app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
}));

// 전역 로컬 변수 설정 미들웨어
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// ==========================================
// ✨ [친구 코드 적용: 포트 자동 연산 및 URL 조작]
// ==========================================

const currentStudent = process.env.USER || '';
const isServerEnvironment = currentStudent.startsWith('stud');

// 포트 자동 연산 (예: stud6 -> 3006)
let defaultPort = '3000';
if (isServerEnvironment) {
    const match = currentStudent.match(/stud(\d+)/);
    if (match) {
        defaultPort = String(3000 + parseInt(match[1], 10));
    }
}
const port = normalizePort(process.env.PORT || defaultPort);
app.set('port', port);

// ==========================================
// ⭕ [404 우회 미들웨어] Nginx가 던지는 /stud6 경로를 안전하게 무시
// ==========================================
app.use((req, res, next) => {
    // 1. 쿼리스트링(? 뒤의 검색어 등)을 제외한 순수 경로만 추출
    const purePath = req.url.split('?')[0]; 
    const parts = purePath.split('/').filter(Boolean);
    
    // 2. 첫 번째 경로가 라우터 이름이 아니면 (즉, stud6 등 계정명이면)
    if (parts.length > 0 && !['user', 'board', 'products', 'cart', 'order', 'notice', 'admin', 'users'].includes(parts[0])) {
        const prefix = '/' + parts[0];
        
        // 3. 원래의 전체 주소(req.url)에서 계정명만 지우고 쿼리스트링은 그대로 살림
        if (req.url.startsWith(prefix)) {
            req.url = req.url.replace(prefix, '') || '/';
        }
    }
    next();
});

// 라우터 연결
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/user', userRouter);
app.use('/board', boardRouter);

app.get('/login', (req, res) => {
  res.redirect('./user/login');
});

app.use('/products', productRouter);
app.use('/cart', cartRouter);
app.use('/order', orderRouter);
app.use('/notice', noticeRouter);
app.use('/admin', adminRouter);

// 404 에러 핸들러
app.use(function(req, res, next) {
  next(createError(404));
});

// 최종 에러 핸들러
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

// ==========================================
// 서버 진짜 구동하기 (listen 코드 내장)
// ==========================================
const server = http.createServer(app);
server.listen(port, () => {
    console.log(`\n==================================================`);
    console.log(`[*] 학과 실습 서버 멀티유저 라우팅 유연화 세팅 완료!`);
    console.log(`[*] 현재 실행 계정: ${currentStudent || '로컬 PC 개발 환경'}`);
    console.log(`[*] 오픈된 포트: ${port}번`);
    console.log(`[*] 접속 테스트 주소: http://164.125.249.71/${currentStudent || ''}`);
    console.log(`==================================================\n`);
});

function normalizePort(val) {
    var port = parseInt(val, 10);
    if (isNaN(port)) return val;
    if (port >= 0) return port;
    return false;
}

module.exports = app;