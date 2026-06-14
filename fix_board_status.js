const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // board 테이블에 상태 컬럼 추가 (기본값은 '대기')
    db.run("ALTER TABLE board ADD COLUMN status TEXT DEFAULT '답변 대기'", (err) => {
        if (err) console.log("✔️ status 컬럼이 이미 존재합니다.");
        else console.log("✅ board 테이블에 status 컬럼 추가 완료!");
    });
});

db.close();