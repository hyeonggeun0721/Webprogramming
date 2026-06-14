const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // users 테이블에 status 컬럼이 없으면 추가 (기본값 'active')
    db.run(`
        ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'
    `, (err) => {
        if (err) {
            console.log("이미 컬럼이 존재하거나 추가할 수 없습니다. (계속 진행 가능)");
        } else {
            console.log("users 테이블에 status 컬럼 추가 완료");
        }
    });
});

db.close();