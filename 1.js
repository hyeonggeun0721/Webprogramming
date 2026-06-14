const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('db/database.sqlite'); // 경로에 맞게 수정

db.run("ALTER TABLE products ADD COLUMN image_url TEXT", (err) => {
    if (err) console.log("이미 컬럼이 있거나 오류 발생:", err.message);
    else console.log("image_url 컬럼 추가 완료!");
    db.close();
});