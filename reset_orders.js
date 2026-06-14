const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. orders 테이블의 모든 데이터 삭제
    db.run("DELETE FROM orders", (err) => {
        if (err) {
            console.error("데이터 삭제 실패:", err.message);
        } else {
            console.log("✅ 주문 내역(orders) 데이터가 모두 삭제되었습니다.");
        }
    });

    // 2. 주문 번호(AUTOINCREMENT id)를 다시 1번부터 시작하도록 초기화
    db.run("DELETE FROM sqlite_sequence WHERE name='orders'", (err) => {
        if (err) {
            // sqlite_sequence에 아직 데이터가 없을 수도 있으므로 에러는 무시
        } else {
            console.log("✅ 주문 번호가 1번부터 다시 시작되도록 초기화되었습니다.");
        }
    });
});

db.close();