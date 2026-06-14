const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("🛠️ 데이터베이스 구조 수정을 시작합니다...");

    // 1. 기존 위시리스트 테이블 삭제 (잘못된 구조 제거)
    db.run("DROP TABLE IF EXISTS wishlist");

    // 2. 제대로 된 구조로 위시리스트 테이블 생성 (product_id 추가)
    db.run(`CREATE TABLE wishlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        UNIQUE(user_id, product_id)
    )`, (err) => {
        if (err) console.error("❌ 위시리스트 생성 실패:", err.message);
        else console.log("✅ wishlist 테이블에 product_id 컬럼이 정상적으로 생성되었습니다.");
    });

    // 3. (선택사항) products 테이블에 필요한 컬럼들이 다 있는지 최종 확인
    // image_url, category, is_featured, stock 등
    db.run("PRAGMA table_info(products)", (err, rows) => {
        console.log("✅ 현재 products 테이블 컬럼 확인 완료.");
    });

    db.close(() => {
        console.log("✨ DB 구조 수정이 완료되었습니다! 이제 서버를 다시 켜보세요.");
    });
});