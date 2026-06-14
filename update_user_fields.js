const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'db/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // users 테이블에 phone, address 컬럼 추가
    db.run(`ALTER TABLE users ADD COLUMN phone TEXT`, (err) => {
        if (err) console.log("phone 컬럼이 이미 존재합니다.");
    });
    db.run(`ALTER TABLE users ADD COLUMN address TEXT`, (err) => {
        if (err) console.log("address 컬럼이 이미 존재합니다.");
        else console.log("회원 테이블 컬럼(전화번호, 주소) 추가 완료");
    });
});
db.close();