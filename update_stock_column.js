const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'db/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // products 테이블에 stock 컬럼 추가 (기본값 10개로 설정)
    db.run(`ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 10`, (err) => {
        if (err) console.log("재고 컬럼이 이미 존재합니다.");
        else console.log("재고(stock) 컬럼 추가 완료.");
    });
});
db.close();