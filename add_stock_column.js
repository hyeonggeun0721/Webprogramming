const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.run("ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 10", (err) => {
    if (err) {
        console.log("❌ 컬럼 추가 실패 (이미 있을 수 있음):", err.message);
    } else {
        console.log("✅ products 테이블에 stock 컬럼 추가 완료!");
    }
    db.close();
});