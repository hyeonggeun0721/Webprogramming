const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 위시리스트 테이블 생성
    db.run(`
        CREATE TABLE IF NOT EXISTS wishlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            price INTEGER NOT NULL
        )
    `);

    // 주문내역 테이블 생성 (quantity 추가됨)
    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            price INTEGER NOT NULL,
            quantity INTEGER DEFAULT 1,  /* ✅ 수량(quantity) 추가 */
            order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT '결제완료'
        )
    `);

    // ✅ 기존에 만들어진 orders 테이블에 quantity 컬럼 강제 추가
    // (이미 추가되어 있다면 발생하는 에러는 무시하도록 처리)
    db.run("ALTER TABLE orders ADD COLUMN quantity INTEGER DEFAULT 1", (err) => {
        // 에러가 나도 신경 쓸 필요 없음 (이미 컬럼이 있다는 뜻)
    });

    console.log("✅ 위시리스트, 주문내역 테이블 생성 및 업데이트 완료");
});

db.close();