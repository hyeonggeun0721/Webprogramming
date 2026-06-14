var createError = require('http-errors');
var express = require('express');
const path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const session = require('express-session');
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

// 전역 로컬 변수 설정 미들웨어 (라우터들보다 위에 위치)
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// 라우터 연결
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/user', userRouter);
app.use('/board', boardRouter);

// 💡 [/login] 접속 시 무조건 절대 경로(/user/login)로 튕기던 곳을 상대 경로(./user/login)로 안전하게 변경
app.get('/login', (req, res) => {
  res.redirect('./user/login');
});

app.use('/products', productRouter);
app.use('/cart', cartRouter);
app.use('/order', orderRouter);
app.use('/notice', noticeRouter);
app.use('/admin', adminRouter);


// [1] 404 에러를 잡아 에러 핸들러로 전달하는 미들웨어
app.use(function(req, res, next) {
  next(createError(404));
});

// [2] 최종 에러 핸들러 (모든 404, 500 에러는 여기서 처리되어 error.ejs를 보여줍니다)
app.use(function(err, req, res, next) {
  // 개발 환경(development)에서만 상세한 에러 출력
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;