const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'db/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 기존 users 테이블에 phone, address 컬럼 추가 (오류 무시)
    db.run("ALTER TABLE users ADD COLUMN phone TEXT", (err) => { if(!err) console.log("phone 추가됨"); });
    db.run("ALTER TABLE users ADD COLUMN address TEXT", (err) => { if(!err) console.log("address 추가됨"); });
});
db.close();