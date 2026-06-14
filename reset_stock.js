const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db/database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 초기화할 재고 수량 설정 (원하는 숫자로 변경 가능)
    const defaultStock = 100; 

    // products 테이블의 모든 상품 재고(stock)를 일괄 업데이트
    db.run("UPDATE products SET stock = ?", [defaultStock], function(err) {
        if (err) {
            console.error("재고 초기화 실패:", err.message);
        } else {
            // this.changes는 업데이트된 행(상품)의 개수를 반환해
            console.log(`✅ 총 ${this.changes}개 상품의 재고가 ${defaultStock}개로 초기화되었습니다.`);
        }
    });
});

db.close();